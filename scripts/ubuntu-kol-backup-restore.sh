#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_REF="mphruawzozrpwcjgejhs"
REPO_URL="https://github.com/stvelikiy-star/kol-travel-platform.git"
OPS_ROOT="${KOL_OPS_ROOT:-$HOME/kol-ops}"
REPO_DIR="$OPS_ROOT/kol-travel-platform"
SECRET_DIR="${KOL_SECRET_DIR:-$HOME/kol-secure}"
SECRET_FILE="${KOL_SECRET_FILE:-$SECRET_DIR/.env}"
BACKUP_ROOT="${KOL_BACKUP_ROOT:-$HOME/kol-backups}"
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
SUPABASE_CLI_VERSION="2.111.0"
STARTED_LOCAL=0

say() { printf '\n==> %s\n' "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ "$STARTED_LOCAL" == "1" ]] && command -v supabase >/dev/null 2>&1; then
    (cd "$REPO_DIR" && supabase stop --no-backup >/dev/null 2>&1) || true
  fi
}
trap cleanup EXIT

need_cmd() { command -v "$1" >/dev/null 2>&1; }

install_apt_packages_if_needed() {
  local packages=()
  need_cmd git || packages+=(git)
  need_cmd curl || packages+=(curl ca-certificates)
  need_cmd psql || packages+=(postgresql-client)
  need_cmd python3 || packages+=(python3)
  need_cmd tar || packages+=(tar)

  if (( ${#packages[@]} > 0 )); then
    need_cmd apt-get || fail "Missing required tools and apt-get is unavailable: ${packages[*]}"
    say "Installing missing Ubuntu packages: ${packages[*]}"
    sudo apt-get update
    sudo apt-get install -y "${packages[@]}"
  fi
}

install_supabase_cli_if_needed() {
  mkdir -p "$HOME/.local/bin"
  export PATH="$HOME/.local/bin:$PATH"

  if need_cmd supabase; then
    return
  fi

  local arch archive_arch tmp archive url
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) archive_arch="amd64" ;;
    aarch64|arm64) archive_arch="arm64" ;;
    *) fail "Unsupported CPU architecture for Supabase CLI: $arch" ;;
  esac

  tmp="$(mktemp -d)"
  archive="$tmp/supabase.tar.gz"
  url="https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_${archive_arch}.tar.gz"

  say "Installing Supabase CLI ${SUPABASE_CLI_VERSION} locally"
  curl --fail --location --silent --show-error --retry 3 --retry-all-errors --output "$archive" "$url"
  tar -xzf "$archive" -C "$tmp"
  install -m 0755 "$tmp/supabase" "$HOME/.local/bin/supabase"
  rm -rf "$tmp"

  [[ "$(supabase --version | tr -d '\r\n')" == "$SUPABASE_CLI_VERSION" ]] || \
    fail "Supabase CLI version verification failed"
}

ensure_docker() {
  need_cmd docker || fail "Docker is not installed. KÖL Ubuntu server is expected to have Docker Engine."
  docker info >/dev/null 2>&1 || fail "Docker is installed but not available to this user. Start Docker and ensure your user can run 'docker ps' without sudo."
}

ensure_secret() {
  mkdir -p "$SECRET_DIR"
  chmod 700 "$SECRET_DIR"

  if [[ ! -s "$SECRET_FILE" ]]; then
    if [[ -t 0 ]]; then
      printf '\nPaste the KÖL Supabase Session pooler connection string.\n'
      printf 'Input is hidden and will be saved only on this Ubuntu server.\n'
      local entered
      read -r -s -p 'KOL_DATABASE_URL: ' entered
      printf '\n'
      [[ -n "$entered" ]] || fail "Connection string was empty"
      printf "KOL_DATABASE_URL='%s'\n" "${entered//\'/\'\\\'\'}" > "$SECRET_FILE"
      chmod 600 "$SECRET_FILE"
      unset entered
    else
      fail "Missing $SECRET_FILE. Run this script interactively once so it can securely prompt for KOL_DATABASE_URL."
    fi
  fi

  chmod 600 "$SECRET_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$SECRET_FILE"
  set +a

  [[ -n "${KOL_DATABASE_URL:-}" ]] || fail "KOL_DATABASE_URL is missing in $SECRET_FILE"
  [[ "$KOL_DATABASE_URL" == *"$PROJECT_REF"* ]] || fail "Connection string does not identify the expected KÖL Supabase project ref"
}

prepare_repo() {
  mkdir -p "$OPS_ROOT"

  if [[ ! -d "$REPO_DIR/.git" ]]; then
    say "Cloning a dedicated KÖL ops copy"
    git clone --quiet "$REPO_URL" "$REPO_DIR"
  fi

  say "Updating dedicated KÖL ops copy to origin/main"
  git -C "$REPO_DIR" fetch --quiet origin main
  git -C "$REPO_DIR" checkout --quiet main
  git -C "$REPO_DIR" reset --hard origin/main >/dev/null
}

psql_file() {
  local label="$1"
  local file="$2"
  local log="$3"
  printf '  - %s\n' "$label"
  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -f "$file" >> "$log" 2>&1
}

run_migration_rehearsal() {
  local manifest="$REPO_DIR/supabase/staging/migration-plan.json"
  local log="$1"
  local preaction="$REPO_DIR/supabase/schema/0090_catalog_media_bucket_PRODUCTION_PREACTION.sql"
  local rows_file="$2"

  [[ -s "$manifest" ]] || fail "Migration manifest missing: $manifest"
  [[ -s "$preaction" ]] || fail "Production-safe catalog-media preaction missing: $preaction"

  psql_file "preflight" "$REPO_DIR/supabase/staging/000_preflight_read_only.sql" "$log"

  python3 - "$manifest" > "$rows_file" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    manifest = json.load(f)
for m in manifest['migrations']:
    verifies = '|'.join(m.get('verify') or [])
    print(f"{m['id']}\t{m['apply']}\t{verifies}")
PY

  while IFS=$'\t' read -r id apply_file verify_joined; do
    [[ -n "$id" ]] || continue
    if [[ "$id" == "009" ]]; then
      psql_file "009 storage preaction" "$preaction" "$log"
    fi

    psql_file "$id APPLY" "$REPO_DIR/$apply_file" "$log"

    IFS='|' read -ra verify_files <<< "$verify_joined"
    for verify_file in "${verify_files[@]}"; do
      [[ -n "$verify_file" ]] || continue
      psql_file "$id VERIFY" "$REPO_DIR/$verify_file" "$log"
    done
  done < "$rows_file"

  psql_file "postflight" "$REPO_DIR/supabase/staging/999_postflight_read_only.sql" "$log"

  psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 >> "$log" 2>&1 <<'SQL'
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
      SELECT 1 FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    );
  IF v_bad_search_path <> 0 THEN
    RAISE EXCEPTION 'search_path gate failed: % functions', v_bad_search_path;
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
    RAISE EXCEPTION 'policyless RLS gate failed: % tables', v_policyless;
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
    RAISE EXCEPTION 'direct DML gate failed: % grants', v_direct_dml;
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
    RAISE EXCEPTION 'atomic RPC gate failed: expected 5, got %', v_rpc_count;
  END IF;
END
$$;
SQL
}

main() {
  say "KÖL Ubuntu backup + restore + migration rehearsal"
  install_apt_packages_if_needed
  ensure_docker
  install_supabase_cli_if_needed
  ensure_secret
  prepare_repo

  mkdir -p "$BACKUP_ROOT"
  chmod 700 "$BACKUP_ROOT"

  cd "$REPO_DIR"
  local stamp backup_dir off_target_dir rehearsal_root migration_log rows_file
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_dir="$BACKUP_ROOT/kol-live-baseline-$stamp"
  rehearsal_root="$BACKUP_ROOT/rehearsal-$stamp"
  off_target_dir="$rehearsal_root/kol-live-baseline-$stamp"
  migration_log="$rehearsal_root/migration-rehearsal.log"
  rows_file="$rehearsal_root/migration-rows.tsv"

  say "Starting disposable local Supabase target"
  supabase stop --no-backup >/dev/null 2>&1 || true
  [[ -e supabase/seed.sql ]] || : > supabase/seed.sql
  supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector
  STARTED_LOCAL=1

  local target_tables
  target_tables="$(psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")"
  [[ "$target_tables" == "0" ]] || fail "Disposable local target is not empty: public table count=$target_tables"

  say "Creating real logical backup from live KÖL (read-only source access)"
  KOL_BACKUP_ROOT="$BACKUP_ROOT" KOL_BACKUP_STAMP="$stamp" \
    bash scripts/backup-live-supabase.sh
  [[ -d "$backup_dir" ]] || fail "Expected backup directory not created: $backup_dir"

  say "Copying backup off the live target and verifying checksums"
  mkdir -p "$rehearsal_root"
  cp -a "$backup_dir" "$off_target_dir"
  (cd "$off_target_dir" && sha256sum -c SHA256SUMS)

  say "Restoring backup into disposable local Supabase"
  KOL_RESTORE_DATABASE_URL="$LOCAL_DB_URL" \
  KOL_RESTORE_CONFIRM="RESTORE_TO_DISPOSABLE_TARGET" \
    bash scripts/rehearse-live-backup-restore.sh "$off_target_dir"

  local evidence_dir
  evidence_dir="$(find "$off_target_dir" -mindepth 1 -maxdepth 1 -type d -name 'restore-evidence-*' | sort | tail -n 1)"
  [[ -n "$evidence_dir" && -s "$evidence_dir/result.txt" ]] || fail "Restore evidence missing"
  grep -qx 'status=RESTORE_REHEARSAL_PASS' "$evidence_dir/result.txt" || fail "Restore rehearsal did not PASS"

  say "Running the full staged migration plan on the restored live copy"
  : > "$migration_log"
  run_migration_rehearsal "$migration_log" "$rows_file"

  cat > "$rehearsal_root/FINAL_RESULT.txt" <<EOF
captured_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)
source_project_ref=$PROJECT_REF
status=RESTORE_AND_MIGRATION_REHEARSAL_PASS
live_database_mutated=false
backup_dir=$backup_dir
restore_evidence=$evidence_dir
migration_log=$migration_log
storage_object_bytes_restored=false
EOF
  chmod 600 "$rehearsal_root/FINAL_RESULT.txt" "$migration_log" "$rows_file"

  say "SUCCESS"
  printf 'RESTORE_AND_MIGRATION_REHEARSAL_PASS\n'
  printf 'Live KÖL was READ-ONLY during this run.\n'
  printf 'Backup: %s\n' "$backup_dir"
  printf 'Evidence: %s\n' "$rehearsal_root/FINAL_RESULT.txt"
  printf '\nNext step: apply the already-rehearsed migration package to live KÖL through the controlled Supabase cutover.\n'
}

main "$@"
