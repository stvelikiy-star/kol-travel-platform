#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
# Never fall back to an unencrypted PostgreSQL connection.
export PGCONNECT_TIMEOUT=12

# Explicitly PRODUCTION-only source, disposable LOCAL-only target.
# Never use this script against live source for restore.
[[ "${GITHUB_ACTIONS:-}" == "true" ]] || { echo "GitHub Actions only" >&2; exit 1; }
[[ "${GITHUB_REPOSITORY:-}" == "stvelikiy-star/kol-travel-platform" ]] || exit 1
# Manual recovery retains its old protected branch. Daily backups are opt-in,
# run only on protected main, and still fail closed on absent Production secrets.
if [[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" ]] &&
   [[ "${GITHUB_REF:-}" == "refs/heads/release/kol-cloud-production-canary-20261123" ]]; then
  :
elif [[ "${GITHUB_EVENT_NAME:-}" == "schedule" ]] &&
     [[ "${GITHUB_REF:-}" == "refs/heads/main" ]] &&
     [[ "${KOL_PRODUCTION_BACKUP_SCHEDULE_ENABLED:-}" == "true" ]]; then
  :
else
  echo "Untrusted Production backup trigger" >&2
  exit 1
fi
: "${KOL_PRODUCTION_DATABASE_URL:?Dedicated Production PostgreSQL secret missing}"
: "${KOL_PRODUCTION_BACKUP_PASSPHRASE:?Independent recovery passphrase secret missing}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
for cmd in supabase psql openssl tar sha256sum python3; do command -v "$cmd" >/dev/null; done

# Fail closed when credentials target QA, a different host, or a pooler.
python3 - <<'PY'
import os,urllib.parse,sys,re
v=urllib.parse.urlparse(os.environ['KOL_PRODUCTION_DATABASE_URL'])
try:
 host, user, port, password=v.hostname,v.username,v.port,v.password
except ValueError:
 sys.exit('Malformed PostgreSQL URL; check encoded password and connection format')
direct=(host=='db.sggajelagfonzpovnsiz.supabase.co' and user=='postgres' and port in (None,5432))
pooler=(bool(re.fullmatch(r'aws-[0-9]+-ap-northeast-2[.]pooler[.]supabase[.]com',host or ''))
        and user=='postgres.sggajelagfonzpovnsiz' and port==5432)
if v.scheme not in ('postgres','postgresql') or not (direct or pooler) or not password or v.path!='/postgres':
 sys.exit('Refusing non-Production or unreviewed PostgreSQL source (direct or session pooler only)')
if urllib.parse.parse_qs(v.query).get('sslmode',['require'])[0] not in ('require','verify-ca','verify-full'):
 sys.exit('Insecure Production connection sslmode refused')
if os.environ['KOL_PRODUCTION_BACKUP_PASSPHRASE'] == os.environ['KOL_PRODUCTION_DATABASE_URL']:
 sys.exit('Recovery key must be independent of DB URL')
PY

PGSSLMODE=require psql "$KOL_PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select 1" | grep -qx '1'
# Storage object bytes must be backed up independently. A database-only
# backup never certifies a full platform recovery once files exist.
object_count="$(PGSSLMODE=require psql "$KOL_PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc 'select count(*) from storage.objects')"
[[ "$object_count" =~ ^[0-9]+$ ]] || { echo 'Production Storage count invalid' >&2; exit 1; }
node --check scripts/backup-production-storage-bytes.mjs

RUN_ROOT="${RUNNER_TEMP:?}/kol-production-recovery-${GITHUB_RUN_ID}"
BACKUPS="$RUN_ROOT/source"
EVIDENCE="$RUN_ROOT/evidence"
OFF_TARGET="$RUN_ROOT/off-target"
OUT="$ROOT/.kol-production-recovery-artifacts"
mkdir -p "$BACKUPS" "$EVIDENCE" "$OFF_TARGET" "$OUT"
# One immutable source metadata snapshot for every Storage object. The list
# contains private object names and stays only on the ephemeral runner.
storage_source_query="SELECT coalesce(json_agg(json_build_object(
 'bucket',bucket_id,'name',name,'id',id::text,'version',version,
 'updated_at',updated_at::text,'metadata',metadata,
 'is_delete_marker',is_delete_marker
) ORDER BY bucket_id,name,id,version),'[]'::json) FROM storage.objects"
PGSSLMODE=require psql "$KOL_PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "$storage_source_query" \
  > "$RUN_ROOT/storage-source-before.json"
node -e 'const fs=require("fs");const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!Array.isArray(x)||x.length!==Number(process.argv[2]))process.exit(1)' \
  "$RUN_ROOT/storage-source-before.json" "$object_count" ||
  { echo "Production Storage snapshot count mismatch" >&2; exit 1; }
LOCAL_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
MIGRATION_HOLD="$RUN_ROOT/held-repository-migrations"
BOOTSTRAP="$ROOT/supabase/migrations/20260101000000_kol_disposable_restore_bootstrap.sql"

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
  if [[ -d "$MIGRATION_HOLD" ]]; then
    rm -f "$BOOTSTRAP"
    if [[ -z "$(find "$ROOT/supabase/migrations" -mindepth 1 -print -quit)" ]]; then
      rmdir "$ROOT/supabase/migrations"
      mv "$MIGRATION_HOLD" "$ROOT/supabase/migrations"
    else
      echo "Refusing to discard held source migrations" >&2
      return 1
    fi
  fi
  # Ephemeral runner only. Encrypted .kol-production-recovery-artifacts survives to upload.
  rm -rf "$RUN_ROOT"
}
trap cleanup EXIT

[[ -d "$ROOT/supabase/migrations" ]] || exit 1
mv "$ROOT/supabase/migrations" "$MIGRATION_HOLD"
mkdir "$ROOT/supabase/migrations"
printf '%s\n' '-- Disposable local Supabase bootstrap only' 'select 1;' > "$BOOTSTRAP"
touch "$ROOT/supabase/seed.sql"
bash scripts/start-local-supabase-with-retry.sh
local_count="$(psql "$LOCAL_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")"
[[ "$local_count" == '0' ]] || { echo 'Local restore target is not empty' >&2; exit 1; }
local_ledger="$(psql "$LOCAL_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from supabase_migrations.schema_migrations where version='20260101000000'")"
[[ "$local_ledger" == '1' ]] || exit 1

# Source is read-only. Includes roles/schema/data and exact migration ledger.
KOL_DATABASE_URL="$KOL_PRODUCTION_DATABASE_URL" KOL_BACKUP_ROOT="$BACKUPS" PGSSLMODE=require bash scripts/backup-live-supabase.sh
mapfile -t dirs < <(find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -name 'kol-live-baseline-*')
[[ "${#dirs[@]}" -eq 1 ]] || exit 1
name="$(basename "${dirs[0]}")"
cp -a "${dirs[0]}" "$OFF_TARGET/$name"
(cd "$OFF_TARGET/$name" && sha256sum -c SHA256SUMS > /dev/null)
# Downloads are read-only; object names are never used as filesystem paths.
# When Storage has files, a dedicated Production service-role secret is REQUIRED.
# A missing or wrong key fails closed; it cannot silently produce a DB-only backup.
node scripts/backup-production-storage-bytes.mjs capture \
  "$RUN_ROOT/storage-source-before.json" "$OFF_TARGET/$name/storage-objects"
storage_counts="$(node scripts/backup-production-storage-bytes.mjs summary "$OFF_TARGET/$name/storage-objects")"
read -r storage_captured_count storage_captured_bytes <<< "$storage_counts"
[[ "$storage_captured_count" == "$object_count" ]] ||
  { echo 'Production Storage captured object count differs' >&2; exit 1; }

tar -C "$OFF_TARGET" -czf "$RUN_ROOT/backup.tar.gz" "$name"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 350000 -md sha256 -in "$RUN_ROOT/backup.tar.gz" \
  -out "$OUT/$name.tar.gz.enc" -pass env:KOL_PRODUCTION_BACKUP_PASSPHRASE
sha256sum "$OUT/$name.tar.gz.enc" > "$OUT/$name.tar.gz.enc.sha256"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 350000 -md sha256 -in "$OUT/$name.tar.gz.enc" \
  -out "$RUN_ROOT/decrypted.tar.gz" -pass env:KOL_PRODUCTION_BACKUP_PASSPHRASE
mkdir "$RUN_ROOT/decrypted"
tar -C "$RUN_ROOT/decrypted" -xzf "$RUN_ROOT/decrypted.tar.gz"
(cd "$RUN_ROOT/decrypted/$name" && sha256sum -c SHA256SUMS > /dev/null)
node scripts/backup-production-storage-bytes.mjs verify \
  "$RUN_ROOT/decrypted/$name/storage-objects"

KOL_RESTORE_DATABASE_URL="$LOCAL_URL" KOL_RESTORE_CONFIRM=RESTORE_TO_DISPOSABLE_TARGET PGSSLMODE=disable \
  bash scripts/rehearse-live-backup-restore.sh "$OFF_TARGET/$name"
restore_evidence="$(find "$OFF_TARGET/$name" -mindepth 1 -maxdepth 1 -type d -name 'restore-evidence-*' | head -n 1)"
[[ -s "$restore_evidence/result.txt" ]] && grep -qx 'status=RESTORE_REHEARSAL_PASS' "$restore_evidence/result.txt"
cp "$restore_evidence/result.txt" "$OUT/restore-result.txt"
# Persist only an encrypted archive and non-sensitive evidence.
cat > "$OUT/recovery-summary.txt" <<EOF
status=PRODUCTION_SOURCE_TO_DISPOSABLE_RESTORE_PASS
project_ref=sggajelagfonzpovnsiz
source_mutated=false
storage_object_count=$storage_captured_count
storage_object_bytes=$storage_captured_bytes
storage_manifest_sha256=$(sha256sum "$RUN_ROOT/decrypted/$name/storage-objects/manifest.json" | cut -d' ' -f1)
backup_encrypted=true
encryption_key_separate=true
EOF
# Fail closed on any source object creation, deletion, replacement or metadata
# mutation during backup. The initial snapshot includes IDs, versions, timestamps.
PGSSLMODE=require psql "$KOL_PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "$storage_source_query" \
  > "$RUN_ROOT/storage-source-after.json"
cmp -s "$RUN_ROOT/storage-source-before.json" "$RUN_ROOT/storage-source-after.json" ||
  { echo 'Production Storage metadata changed during recovery: no complete recovery claim' >&2; exit 1; }
echo 'KOL Production encrypted source backup and disposable restoration: PASS'
