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
  if ! psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f "$file" >> "$log" 2>&1; then
    printf '::error title=KOL migration rehearsal failed::%s: %s\n' "$label" "$file" >&2
    # Emit only database error diagnostics, not the full SQL log or credentials.
    grep -E '(^|[[:space:]])(psql:|ERROR:|FATAL:|DETAIL:|HINT:)' "$log" \
      | tail -n 12 \
      | cut -c 1-400 >&2 || true
    exit 1
  fi
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
bash scripts/start-local-supabase-with-retry.sh

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
 
# The human-readable preflight above is diagnostic; enforce an actual SQL exit
# gate before any migration mutates the restored source. The managed baseline
# includes four historical onboarding/support RPCs and extra FK indexes.
printf '::group::Managed restored-baseline safety gate\\n'
if ! psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 >> "$MIGRATION_LOG" 2>&1 <<'SQL'
DO $kol_gate$
DECLARE
  v_tables integer;
  v_rls integer;
  v_functions integer;
  v_known integer;
  v_bad_paths integer;
  v_definers integer;
  v_indexes integer;
  v_invalid integer;
  v_stage21 integer;
  v_ledger_count integer;
  v_ledger_known integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE c.relrowsecurity)
    INTO v_tables, v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r';
  SELECT count(*),
         count(*) FILTER (WHERE p.proname IN (
           'set_updated_at','has_role','is_admin','is_finance_admin',
           'is_partner_for','is_assigned_courier',
           'admin_support_lifecycle_atomic','client_onboarding_complete_atomic',
           'client_stay_booking_create_atomic','client_support_ticket_create_atomic'
         )),
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           WHERE cfg LIKE 'search_path=%'
         )),
         count(*) FILTER (WHERE p.prosecdef)
    INTO v_functions,v_known,v_bad_paths,v_definers
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public';
  SELECT count(*), count(*) FILTER (WHERE NOT i.indisvalid OR NOT i.indisready)
    INTO v_indexes,v_invalid
    FROM pg_index i JOIN pg_class t ON t.oid=i.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public';
  SELECT count(*) INTO v_stage21
    FROM information_schema.columns
    WHERE table_schema='public'
      AND (table_name,column_name) IN (
        ('menu_items','slug'),('products','slug'),
        ('tours','image_url'),('stays','capacity')
      );
  -- Restored source must match the audited managed migration ledger, not
  -- merely the same number of tables/functions. Reject unknown applied steps.
  SELECT count(*),
         count(*) FILTER (WHERE (version, name) IN (
           ('20260924060622','security_hardening_phase1_20260924'),
           ('20260924060745','auth_profile_rls_minimal_20260924'),
           ('20260924061353','mvp_support_read_rls_20260924'),
           ('20260924061357','client_support_runtime_20260924'),
           ('20260924061403','admin_support_lifecycle_20260924'),
           ('20260925051259','public_intake_requests_mvp_20260925'),
           ('20260925051615','temporary_auth_bootstrap_token_store_20260925'),
           ('20260925051647','remove_unused_auth_bootstrap_token_store_20260925'),
           ('20260925052929','harden_public_intake_validation_20260925'),
           ('20260925053800','restore_audited_admin_intake_lifecycle_20260925'),
           ('20260928065214','client_stay_booking_atomic_v1'),
           ('20261007130434','010_fk_index_baseline'),
           ('20261007130525','006b_rls_initplan_scope_hardening'),
           ('20261007131749','006a_audit_log_write_lockdown'),
           ('20261007133920','order_booking_auth_uid_initplan_hardening'),
           ('20261007190013','client_onboarding_atomic_20261008'),
           ('20261007193325','support_queue_admin_read_20261008')
         ))
    INTO v_ledger_count, v_ledger_known
    FROM supabase_migrations.schema_migrations;
  IF v_tables<>54 OR v_rls<>54 OR v_functions<>10 OR v_known<>10
     OR v_bad_paths<>0 OR v_definers<>0 OR v_indexes<>151
     OR v_invalid<>0 OR v_stage21<>0 OR v_ledger_count<>17 OR v_ledger_known<>17 THEN
    RAISE EXCEPTION 'managed_restored_baseline_gate_failed: tables % rls % functions % known % unsafe_paths % public_definers % indexes % invalid % stage21 % ledger % known_ledger %',
      v_tables,v_rls,v_functions,v_known,v_bad_paths,v_definers,v_indexes,v_invalid,v_stage21,v_ledger_count,v_ledger_known;
  END IF;
END
$kol_gate$;
SQL
then
  printf '::error title=KOL managed staging baseline mismatch::Refusing migration apply after nonconforming restored baseline\\n' >&2
  grep -E '(^|[[:space:]])(psql:|ERROR:|FATAL:|DETAIL:|HINT:)' "$MIGRATION_LOG" | tail -n 12 | cut -c 1-400 >&2 || true
  exit 1
fi
printf '::endgroup::\\n'

# Preserve identity of existing operational records across the 43 migration steps.
# A schema migration may add columns, but must not silently drop or replace
# the current bookings, orders, deliveries, users or partner catalog rows.
# Keep these identifiers exclusively in ephemeral runner state, never artifacts.
capture_operational_identity() {
  local output="$1"
  psql "$LOCAL_DB_URL" -X -q -v ON_ERROR_STOP=1 -A -F 
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

capture_operational_identity "$RUN_ROOT/post-migration-entities.tsv"
if ! diff -u "$RUN_ROOT/pre-migration-entities.tsv" "$RUN_ROOT/post-migration-entities.tsv" > "$RUN_ROOT/preserved-entities.diff"; then
  # Do not leak private record identifiers or a subset of data to CI logs.
  fail "restored-live migration changed existing operational record identities or counts"
fi
printf 'KOL restored-live operational identity preservation: PASS\\n'

psql_file "Restored-live postflight" "supabase/staging/999_postflight_read_only.sql" "$MIGRATION_LOG"
psql_file "Restored-copy role isolation" "supabase/staging/restored_role_isolation_TEST.sql" "$MIGRATION_LOG"

# Machine gate for the production-critical outcomes of the staged package.
# Capture the result explicitly, otherwise set -e exits without exposing SQL diagnostics.
set +e
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
      'partner_booking_action_atomic','partner_order_action_atomic'
    );
  IF v_rpc_count <> 5 THEN
    RAISE EXCEPTION 'restored_live_atomic_rpc_gate_failed: expected 5, got %', v_rpc_count;
  END IF;
END
$$;
SQL
gate_exit=$?
set -e
if (( gate_exit != 0 )); then
  printf '::error title=KOL restored-live security gate failed::Post-migration security assertions failed (psql exit %s)\n' "$gate_exit" >&2
  grep -E '(^|[[:space:]])(psql:|ERROR:|FATAL:|DETAIL:|HINT:)' "$MIGRATION_LOG" \
    | tail -n 12 \
    | cut -c 1-400 >&2 || true
  exit 1
fi

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

# Prove recovery after the staged package has changed the disposable database.
# Only the CLI-managed local stack is discarded; the live source is never reset.
# Restore from the decrypted archive, rather than relying on the first restore.
printf 'Rehearsing rollback to the pre-migration backup on a fresh disposable target...\n'
supabase stop --no-backup
bash scripts/start-local-supabase-with-retry.sh
ROLLBACK_BACKUP_DIR="$ARCHIVE_ROOT/unpacked/$BACKUP_BASENAME"
KOL_RESTORE_DATABASE_URL="$LOCAL_DB_URL" \
KOL_RESTORE_CONFIRM="RESTORE_TO_DISPOSABLE_TARGET" \
  bash scripts/rehearse-live-backup-restore.sh "$ROLLBACK_BACKUP_DIR"
ROLLBACK_EVIDENCE_DIR="$(find "$ROLLBACK_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'restore-evidence-*' -print | head -n 1)"
[[ -n "$ROLLBACK_EVIDENCE_DIR" && -s "$ROLLBACK_EVIDENCE_DIR/result.txt" ]] || fail "rollback evidence missing"
grep -qx 'status=RESTORE_REHEARSAL_PASS' "$ROLLBACK_EVIDENCE_DIR/result.txt" || fail "rollback restore did not report PASS"
cp "$ROLLBACK_EVIDENCE_DIR/result.txt" "$ARTIFACT_ROOT/evidence/rollback-result.txt"
cp "$ROLLBACK_EVIDENCE_DIR/restore-baseline.tsv" "$ARTIFACT_ROOT/evidence/rollback-baseline.tsv"

cat > "$ARTIFACT_ROOT/evidence/result.txt" <<EOF
captured_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
source_project_ref=mphruawzozrpwcjgejhs
status=RESTORE_AND_MIGRATION_REHEARSAL_PASS
live_database_mutated=false
encrypted_backup_artifact=$(basename "$ENCRYPTED_ARCHIVE")
storage_object_bytes_restored=false
rollback_to_source_baseline=PASS
EOF

# Evidence checksums must be complete and verifiable before reporting PASS.
# Avoid hashing the checksum manifest itself and never mask checksum errors.
(
  cd "$ARTIFACT_ROOT"
  sha256sum ./*.enc ./*.enc.sha256 ./evidence/source-baseline.tsv ./evidence/restore-result.txt ./evidence/restore-baseline.tsv ./evidence/post-migration-gate.tsv ./evidence/rollback-result.txt ./evidence/rollback-baseline.tsv ./evidence/result.txt > ./evidence/SHA256SUMS
  sha256sum -c ./evidence/SHA256SUMS
)

printf 'RESTORE + MIGRATION REHEARSAL PASS\n'
printf 'Live KÖL database was read only. Encrypted backup and sanitized evidence are ready for upload.\n'
\\t' -P footer=off > "$output" <<'SQL'
select 'auth.users', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from auth.users
union all select 'public.partners', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.partners
union all select 'public.stays', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.stays
union all select 'public.rooms', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.rooms
union all select 'public.tours', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.tours
union all select 'public.products', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.products
union all select 'public.bookings', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.bookings
union all select 'public.orders', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.orders
union all select 'public.deliveries', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.deliveries
union all select 'public.payments', count(*), md5(coalesce(string_agg(id::text,',' order by id::text),'')) from public.payments
order by 1;
SQL
}
capture_operational_identity "$RUN_ROOT/pre-migration-entities.tsv"

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
psql_file "Restored-copy role isolation" "supabase/staging/restored_role_isolation_TEST.sql" "$MIGRATION_LOG"

# Machine gate for the production-critical outcomes of the staged package.
# Capture the result explicitly, otherwise set -e exits without exposing SQL diagnostics.
set +e
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
      'partner_booking_action_atomic','partner_order_action_atomic'
    );
  IF v_rpc_count <> 5 THEN
    RAISE EXCEPTION 'restored_live_atomic_rpc_gate_failed: expected 5, got %', v_rpc_count;
  END IF;
END
$$;
SQL
gate_exit=$?
set -e
if (( gate_exit != 0 )); then
  printf '::error title=KOL restored-live security gate failed::Post-migration security assertions failed (psql exit %s)\n' "$gate_exit" >&2
  grep -E '(^|[[:space:]])(psql:|ERROR:|FATAL:|DETAIL:|HINT:)' "$MIGRATION_LOG" \
    | tail -n 12 \
    | cut -c 1-400 >&2 || true
  exit 1
fi

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

# Prove recovery after the staged package has changed the disposable database.
# Only the CLI-managed local stack is discarded; the live source is never reset.
# Restore from the decrypted archive, rather than relying on the first restore.
printf 'Rehearsing rollback to the pre-migration backup on a fresh disposable target...\n'
supabase stop --no-backup
bash scripts/start-local-supabase-with-retry.sh
ROLLBACK_BACKUP_DIR="$ARCHIVE_ROOT/unpacked/$BACKUP_BASENAME"
KOL_RESTORE_DATABASE_URL="$LOCAL_DB_URL" \
KOL_RESTORE_CONFIRM="RESTORE_TO_DISPOSABLE_TARGET" \
  bash scripts/rehearse-live-backup-restore.sh "$ROLLBACK_BACKUP_DIR"
ROLLBACK_EVIDENCE_DIR="$(find "$ROLLBACK_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'restore-evidence-*' -print | head -n 1)"
[[ -n "$ROLLBACK_EVIDENCE_DIR" && -s "$ROLLBACK_EVIDENCE_DIR/result.txt" ]] || fail "rollback evidence missing"
grep -qx 'status=RESTORE_REHEARSAL_PASS' "$ROLLBACK_EVIDENCE_DIR/result.txt" || fail "rollback restore did not report PASS"
cp "$ROLLBACK_EVIDENCE_DIR/result.txt" "$ARTIFACT_ROOT/evidence/rollback-result.txt"
cp "$ROLLBACK_EVIDENCE_DIR/restore-baseline.tsv" "$ARTIFACT_ROOT/evidence/rollback-baseline.tsv"

cat > "$ARTIFACT_ROOT/evidence/result.txt" <<EOF
captured_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
source_project_ref=mphruawzozrpwcjgejhs
status=RESTORE_AND_MIGRATION_REHEARSAL_PASS
live_database_mutated=false
encrypted_backup_artifact=$(basename "$ENCRYPTED_ARCHIVE")
storage_object_bytes_restored=false
rollback_to_source_baseline=PASS
EOF

# Evidence checksums must be complete and verifiable before reporting PASS.
# Avoid hashing the checksum manifest itself and never mask checksum errors.
(
  cd "$ARTIFACT_ROOT"
  sha256sum ./*.enc ./*.enc.sha256 ./evidence/source-baseline.tsv ./evidence/restore-result.txt ./evidence/restore-baseline.tsv ./evidence/post-migration-gate.tsv ./evidence/rollback-result.txt ./evidence/rollback-baseline.tsv ./evidence/result.txt > ./evidence/SHA256SUMS
  sha256sum -c ./evidence/SHA256SUMS
)

printf 'RESTORE + MIGRATION REHEARSAL PASS\n'
printf 'Live KÖL database was read only. Encrypted backup and sanitized evidence are ready for upload.\n'
