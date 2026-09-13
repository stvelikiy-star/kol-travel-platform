#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

psql_file() {
  local label="$1"
  local file="$2"
  local log="$3"
  printf '::group::%s: %s\n' "$label" "$file"
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f "$file" >> "$log" 2>&1
  printf '::endgroup::\n'
}

: "${KOL_DATABASE_URL:?KOL_DATABASE_URL must be supplied as a GitHub Actions secret}"

for cmd in supabase psql node npm openssl tar sha256sum diff; do
  require_command "$cmd"
done

RUN_ROOT="${RUNNER_TEMP:-/tmp}/kol-live-rehearsal-${GITHUB_RUN_ID:-local}-$$"
BACKUP_ROOT="$RUN_ROOT/source"
OFF_TARGET_ROOT="$RUN_ROOT/off-target"
ARCHIVE_ROOT="$RUN_ROOT/archive-check"
ARTIFACT_ROOT="$ROOT/.kol-ci-artifacts"
LOCAL_DB_URL="${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
MANIFEST="supabase/staging/migration-plan.json"
MIGRATION_LOG="$RUN_ROOT/migration-rehearsal.log"

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$RUN_ROOT" >/dev/null 2>&1 || true
}
trap cleanup EXIT

rm -rf "$ARTIFACT_ROOT"
mkdir -p "$BACKUP_ROOT" "$OFF_TARGET_ROOT" "$ARCHIVE_ROOT" "$ARTIFACT_ROOT"
touch "$MIGRATION_LOG"

# Start a disposable Supabase-compatible target. Keep Auth + Storage + PostgREST,
# because the source backup contains Auth/Storage metadata and migration 009 uses Storage API.
touch supabase/seed.sql
supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector

supabase status -o env > "$RUN_ROOT/local.env"
set -a
# shellcheck disable=SC1090
source "$RUN_ROOT/local.env"
set +a

export SUPABASE_URL="${API_URL:-http://127.0.0.1:54321}"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?local Supabase SERVICE_ROLE_KEY missing}"
export SUPABASE_ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
[[ -n "$SUPABASE_ANON_KEY" ]] || fail "local Supabase anon/publishable key missing"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export KOL_DEPLOYMENT_ENV="staging"

# The restore guard requires an empty public schema before mutation.
TARGET_PUBLIC_TABLES="$(psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")"
[[ "$TARGET_PUBLIC_TABLES" == "0" ]] || fail "disposable target unexpectedly contains $TARGET_PUBLIC_TABLES public tables"

printf 'Creating portable logical backup from live KÖL...\n'
KOL_BACKUP_ROOT="$BACKUP_ROOT" bash scripts/backup-live-supabase.sh

mapfile -t backup_dirs < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name 'kol-live-baseline-*' -print)
[[ "${#backup_dirs[@]}" -eq 1 ]] || fail "expected exactly one backup directory, found ${#backup_dirs[@]}"
SOURCE_BACKUP_DIR="${backup_dirs[0]}"
BACKUP_BASENAME="$(basename "$SOURCE_BACKUP_DIR")"
OFF_TARGET_DIR="$OFF_TARGET_ROOT/$BACKUP_BASENAME"
cp -a "$SOURCE_BACKUP_DIR" "$OFF_TARGET_DIR"
(cd "$OFF_TARGET_DIR" && sha256sum -c SHA256SUMS)

# Persist only an encrypted backup in GitHub Actions artifacts. The encryption
# passphrase is supplied from the same protected secret as the DB URL and is
# never printed. Plain SQL dumps stay only on the ephemeral runner.
PLAIN_ARCHIVE="$RUN_ROOT/${BACKUP_BASENAME}.tar.gz"
ENCRYPTED_ARCHIVE="$ARTIFACT_ROOT/${BACKUP_BASENAME}.tar.gz.enc"
tar -C "$OFF_TARGET_ROOT" -czf "$PLAIN_ARCHIVE" "$BACKUP_BASENAME"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 250000 -md sha256 \
  -in "$PLAIN_ARCHIVE" \
  -out "$ENCRYPTED_ARCHIVE" \
  -pass env:KOL_DATABASE_URL
sha256sum "$ENCRYPTED_ARCHIVE" > "$ARTIFACT_ROOT/${BACKUP_BASENAME}.tar.gz.enc.sha256"

# Prove the encrypted artifact can be decrypted and its internal checksums pass.
DECRYPTED_ARCHIVE="$ARCHIVE_ROOT/backup.tar.gz"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -md sha256 \
  -in "$ENCRYPTED_ARCHIVE" \
  -out "$DECRYPTED_ARCHIVE" \
  -pass env:KOL_DATABASE_URL
mkdir -p "$ARCHIVE_ROOT/unpacked"
tar -C "$ARCHIVE_ROOT/unpacked" -xzf "$DECRYPTED_ARCHIVE"
(cd "$ARCHIVE_ROOT/unpacked/$BACKUP_BASENAME" && sha256sum -c SHA256SUMS)

printf 'Restoring backup into disposable local Supabase...\n'
KOL_RESTORE_DATABASE_URL="$LOCAL_DB_URL" \
KOL_RESTORE_CONFIRM="RESTORE_TO_DISPOSABLE_TARGET" \
  bash scripts/rehearse-live-backup-restore.sh "$OFF_TARGET_DIR"

RESTORE_EVIDENCE_DIR="$(find "$OFF_TARGET_DIR" -mindepth 1 -maxdepth 1 -type d -name 'restore-evidence-*' -print | head -n 1)"
[[ -n "$RESTORE_EVIDENCE_DIR" && -s "$RESTORE_EVIDENCE_DIR/result.txt" ]] || fail "restore evidence missing"
grep -qx 'status=RESTORE_REHEARSAL_PASS' "$RESTORE_EVIDENCE_DIR/result.txt" || fail "restore rehearsal did not report PASS"

printf 'Rehearsing staged migration plan on restored live shape...\n'
psql_file "Restored-live preflight" "supabase/staging/000_preflight_read_only.sql" "$MIGRATION_LOG"

mapfile -t migration_rows < <(
  node --input-type=module - "$MANIFEST" <<'NODE'
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const migration of manifest.migrations) {
  const verifies = Array.isArray(migration.verify) ? migration.verify.join('|') : '';
  process.stdout.write(`${migration.id}\t${migration.apply}\t${verifies}\n`);
}
NODE
)

for row in "${migration_rows[@]}"; do
  IFS=$'\t' read -r id apply_file verify_joined <<< "$row"

  if [[ "$id" == "009" ]]; then
    printf '::group::009 pre-action: provision private catalog-media bucket\n'
    npm run provision:catalog-media-bucket >> "$MIGRATION_LOG" 2>&1
    npm run check:catalog-media-bucket >> "$MIGRATION_LOG" 2>&1
    printf '::endgroup::\n'
  fi

  psql_file "${id} APPLY" "$apply_file" "$MIGRATION_LOG"
  IFS='|' read -ra verify_files <<< "$verify_joined"
  for verify_file in "${verify_files[@]}"; do
    [[ -n "$verify_file" ]] || continue
    psql_file "${id} VERIFY" "$verify_file" "$MIGRATION_LOG"
  done
done

psql_file "Restored-live postflight" "supabase/staging/999_postflight_read_only.sql" "$MIGRATION_LOG"

# Machine gate for the production-critical outcomes of the staged package.
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL' >> "$MIGRATION_LOG" 2>&1
DO $$
DECLARE
  v_bad_search_path integer;
  v_policyless integer;
  v_direct_dml integer;
  v_rpc_count integer;
BEGIN
  SELECT count(*) INTO v_bad_search_path
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('set_updated_at','has_role','is_admin','is_finance_admin','is_partner_for','is_assigned_courier')
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    );
  IF v_bad_search_path <> 0 THEN
    RAISE EXCEPTION 'restored_live_search_path_failed: % functions', v_bad_search_path;
  END IF;

  SELECT count(*) INTO v_policyless
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
    );
  IF v_policyless <> 0 THEN
    RAISE EXCEPTION 'restored_live_policyless_rls_failed: % tables', v_policyless;
  END IF;

  SELECT count(*) INTO v_direct_dml
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND grantee IN ('anon','authenticated')
    AND privilege_type IN ('INSERT','UPDATE','DELETE')
    AND table_name IN (
      'bookings','booking_status_history','orders','order_items','order_status_history',
      'payments','order_payments','deliveries','order_delivery','courier_assignments',
      'delivery_status_history','audit_logs'
    );
  IF v_direct_dml <> 0 THEN
    RAISE EXCEPTION 'restored_live_direct_dml_failed: % grants', v_direct_dml;
  END IF;

  SELECT count(DISTINCT p.proname) INTO v_rpc_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'create_stay_booking_atomic','create_tour_booking_atomic','create_order_atomic',
      'partner_update_booking_status_atomic','partner_update_order_status_atomic'
    );
  IF v_rpc_count <> 5 THEN
    RAISE EXCEPTION 'restored_live_atomic_rpc_gate_failed: expected 5, got %', v_rpc_count;
  END IF;
END
$$;
SQL

mkdir -p "$ARTIFACT_ROOT/evidence"
cp "$OFF_TARGET_DIR/source-baseline.tsv" "$ARTIFACT_ROOT/evidence/source-baseline.tsv"
cp "$RESTORE_EVIDENCE_DIR/result.txt" "$ARTIFACT_ROOT/evidence/restore-result.txt"
cp "$RESTORE_EVIDENCE_DIR/restore-baseline.tsv" "$ARTIFACT_ROOT/evidence/restore-baseline.tsv"

psql "$LOCAL_DB_URL" -X -q -v ON_ERROR_STOP=1 -A -F $'\t' -P footer=off <<'SQL' > "$ARTIFACT_ROOT/evidence/post-migration-gate.tsv"
select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as public_tables,
  (select count(*) from pg_policies where schemaname='public') as public_policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as public_functions,
  (select count(*) from public.room_availability) as room_availability,
  (select count(*) from public.tour_schedules) as tour_schedules,
  (select count(*) from auth.users) as auth_users;
SQL

cat > "$ARTIFACT_ROOT/evidence/result.txt" <<EOF
captured_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
source_project_ref=mphruawzozrpwcjgejhs
status=RESTORE_AND_MIGRATION_REHEARSAL_PASS
live_database_mutated=false
encrypted_backup_artifact=$(basename "$ENCRYPTED_ARCHIVE")
storage_object_bytes_restored=false
EOF

sha256sum "$ARTIFACT_ROOT"/*.enc "$ARTIFACT_ROOT"/*.sha256 "$ARTIFACT_ROOT"/evidence/* > "$ARTIFACT_ROOT/evidence/SHA256SUMS" || true

printf 'RESTORE + MIGRATION REHEARSAL PASS\n'
printf 'Live KÖL database was read only. Encrypted backup and sanitized evidence are ready for upload.\n'
