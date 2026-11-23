#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Explicitly PRODUCTION-only source, disposable LOCAL-only target.
# Never use this script against live source for restore.
[[ "${GITHUB_ACTIONS:-}" == "true" ]] || { echo "GitHub Actions only" >&2; exit 1; }
[[ "${GITHUB_REPOSITORY:-}" == "stvelikiy-star/kol-travel-platform" ]] || exit 1
[[ "${GITHUB_EVENT_NAME:-}" == "workflow_dispatch" ]] || exit 1
[[ "${GITHUB_REF:-}" == "refs/heads/release/kol-cloud-production-canary-20261123" ]] || exit 1
: "${KOL_PRODUCTION_DATABASE_URL:?Dedicated Production PostgreSQL secret missing}"
: "${KOL_PRODUCTION_BACKUP_PASSPHRASE:?Independent recovery passphrase secret missing}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
for cmd in supabase psql openssl tar sha256sum python3; do command -v "$cmd" >/dev/null; done

# Fail closed when credentials target QA, a different host, or a pooler.
python3 - <<'PY'
import os,urllib.parse,sys
v=urllib.parse.urlparse(os.environ['KOL_PRODUCTION_DATABASE_URL'])
if v.scheme not in ('postgres','postgresql') or v.hostname!='db.sggajelagfonzpovnsiz.supabase.co' or v.username!='postgres' or not v.password or v.path!='/postgres':
 sys.exit('Refusing non-Production or unreviewed PostgreSQL source')
if os.environ['KOL_PRODUCTION_BACKUP_PASSPHRASE'] == os.environ['KOL_PRODUCTION_DATABASE_URL']:
 sys.exit('Recovery key must be independent of DB URL')
PY

psql "$KOL_PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select 1" | grep -qx '1'
# This logical backup retains Storage metadata but not file bytes: reject if any files exist.
object_count="$(psql "$KOL_PRODUCTION_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc 'select count(*) from storage.objects')"
[[ "$object_count" == '0' ]] || { echo "Cannot certify recovery: Production Storage object bytes need a separate backup ($object_count objects)." >&2; exit 1; }

RUN_ROOT="${RUNNER_TEMP:?}/kol-production-recovery-${GITHUB_RUN_ID}"
BACKUPS="$RUN_ROOT/source"
EVIDENCE="$RUN_ROOT/evidence"
OFF_TARGET="$RUN_ROOT/off-target"
OUT="$ROOT/.kol-production-recovery-artifacts"
mkdir -p "$BACKUPS" "$EVIDENCE" "$OFF_TARGET" "$OUT"
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
KOL_DATABASE_URL="$KOL_PRODUCTION_DATABASE_URL" KOL_BACKUP_ROOT="$BACKUPS" bash scripts/backup-live-supabase.sh
mapfile -t dirs < <(find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -name 'kol-live-baseline-*')
[[ "${#dirs[@]}" -eq 1 ]] || exit 1
name="$(basename "${dirs[0]}")"
cp -a "${dirs[0]}" "$OFF_TARGET/$name"
(cd "$OFF_TARGET/$name" && sha256sum -c SHA256SUMS > /dev/null)

tar -C "$OFF_TARGET" -czf "$RUN_ROOT/backup.tar.gz" "$name"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 350000 -md sha256 -in "$RUN_ROOT/backup.tar.gz" \
  -out "$OUT/$name.tar.gz.enc" -pass env:KOL_PRODUCTION_BACKUP_PASSPHRASE
sha256sum "$OUT/$name.tar.gz.enc" > "$OUT/$name.tar.gz.enc.sha256"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 350000 -md sha256 -in "$OUT/$name.tar.gz.enc" \
  -out "$RUN_ROOT/decrypted.tar.gz" -pass env:KOL_PRODUCTION_BACKUP_PASSPHRASE
mkdir "$RUN_ROOT/decrypted"
tar -C "$RUN_ROOT/decrypted" -xzf "$RUN_ROOT/decrypted.tar.gz"
(cd "$RUN_ROOT/decrypted/$name" && sha256sum -c SHA256SUMS > /dev/null)

KOL_RESTORE_DATABASE_URL="$LOCAL_URL" KOL_RESTORE_CONFIRM=RESTORE_TO_DISPOSABLE_TARGET \
  bash scripts/rehearse-live-backup-restore.sh "$OFF_TARGET/$name"
restore_evidence="$(find "$OFF_TARGET/$name" -mindepth 1 -maxdepth 1 -type d -name 'restore-evidence-*' | head -n 1)"
[[ -s "$restore_evidence/result.txt" ]] && grep -qx 'status=RESTORE_REHEARSAL_PASS' "$restore_evidence/result.txt"
cp "$restore_evidence/result.txt" "$OUT/restore-result.txt"
# Persist only an encrypted archive and non-sensitive evidence.
cat > "$OUT/recovery-summary.txt" <<EOF
status=PRODUCTION_SOURCE_TO_DISPOSABLE_RESTORE_PASS
project_ref=sggajelagfonzpovnsiz
source_mutated=false
storage_object_bytes=0
backup_encrypted=true
encryption_key_separate=true
EOF
echo 'KOL Production encrypted source backup and disposable restoration: PASS'
