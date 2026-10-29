#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

PROJECT_REF="mphruawzozrpwcjgejhs"
REPO_URL="https://github.com/stvelikiy-star/kol-travel-platform.git"
RELEASE_REF="${KOL_RELEASE_REF:-release/kol-approved-ui-rc1-20261022}"
RELEASE_COMMIT="${KOL_RELEASE_COMMIT:-884bcf98fc5cf06f4c4eb765fe2f8d042ccfea92}"
OPS_ROOT="${KOL_OPS_ROOT:-$HOME/kol-ops}"
REPO_DIR="$OPS_ROOT/kol-travel-platform"
SECRET_DIR="${KOL_SECRET_DIR:-$HOME/kol-secure}"
SECRET_FILE="${KOL_SECRET_FILE:-$SECRET_DIR/.env}"
BACKUP_ROOT="${KOL_BACKUP_ROOT:-$HOME/kol-backups}"
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
# v2.117.0 pins storage-api v1.72.1. That Storage release contains tenant
# migrations through 0067, matching the current hosted KÖL Storage schema.
SUPABASE_CLI_VERSION="2.117.0"
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
  local cli_dir="$OPS_ROOT/toolchain/supabase-$SUPABASE_CLI_VERSION"
  mkdir -p "$cli_dir"
  export PATH="$cli_dir:$PATH"

  local current_version=""
  if [[ -x "$cli_dir/supabase" ]]; then
    current_version="$("$cli_dir/supabase" --version 2>/dev/null | tr -d '\r\n' || true)"
    if [[ "$current_version" == "$SUPABASE_CLI_VERSION" ]]; then
      return
    fi
    say "Replacing Supabase CLI inside the isolated KÖL toolchain: ${current_version:-unknown} -> ${SUPABASE_CLI_VERSION}"
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
  install -m 0755 "$tmp/supabase" "$cli_dir/supabase"
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
  local fresh_clone=0
  mkdir -p "$OPS_ROOT"

  if [[ ! -d "$REPO_DIR/.git" ]]; then
    say "Cloning a dedicated KÖL ops copy"
    git clone --quiet --no-checkout "$REPO_URL" "$REPO_DIR"
    fresh_clone=1
  fi

  [[ "$(git -C "$REPO_DIR" remote get-url origin)" == "$REPO_URL" ]] || \
    fail "Ops checkout origin does not match the dedicated KÖL repository"
  # A new --no-checkout clone has no index yet. Once files are checked out,
  # refuse both tracked and untracked changes instead of deleting them.
  if [[ "$fresh_clone" == "0" ]] && \
     [[ -n "$(git -C "$REPO_DIR" status --porcelain --untracked-files=normal)" ]]; then
    fail "Dedicated KÖL ops checkout has local changes; nothing was discarded"
  fi
  [[ "$RELEASE_COMMIT" =~ ^[0-9a-f]{40}$ ]] || fail "A full verified KÖL release SHA is required"
  say "Preparing the verified KÖL release commit"
  git -C "$REPO_DIR" fetch --quiet origin "$RELEASE_REF"
  git -C "$REPO_DIR" merge-base --is-ancestor "$RELEASE_COMMIT" FETCH_HEAD || \
    fail "Verified KÖL release commit is not in the selected release branch"
  git -C "$REPO_DIR" checkout --quiet --detach "$RELEASE_COMMIT"
  [[ "$(git -C "$REPO_DIR" rev-parse HEAD)" == "$RELEASE_COMMIT" ]] || fail "KÖL release SHA mismatch"
}

ensure_disposable_target_available() {
  local containers port
  containers="$(docker ps -a --filter 'label=com.supabase.cli.project=kol-travel-platform' --format '{{.Names}}')"
  [[ -z "$containers" ]] || fail "Existing KÖL Supabase containers found; refusing to stop or reuse them"
  # Older CLI versions use names rather than the project label.
  containers="$(docker ps -a --format '{{.Names}}' | awk '/^supabase_.*_kol-travel-platform$/')"
  [[ -z "$containers" ]] || fail "Existing KÖL Supabase container names found; refusing to reuse them"
  containers="$(docker volume ls --format '{{.Name}}' | awk '/^supabase_.*_kol-travel-platform$/')"
  [[ -z "$containers" ]] || fail "Existing KÖL Supabase volumes found; refusing to reuse or delete them"
  need_cmd ss || fail "ss is required to check disposable-target port collisions"
  for port in 54320 54321 54322 54323 54324 54327 54328 54329; do
    [[ -z "$(ss -H -ltn "sport = :$port")" ]] || \
      fail "Disposable target port $port is already in use; no services were stopped"
  done
}

verify_storage_schema_compatibility() {
  local source_state target_state source_max target_max

  source_state="$(psql "$KOL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' \
    -c "select id, name, hash from storage.migrations order by id;")"
  target_state="$(psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -At -F $'\t' \
    -c "select id, name, hash from storage.migrations order by id;")"

  [[ -n "$source_state" ]] || fail "Hosted KÖL storage.migrations state is empty or unavailable"
  [[ -n "$target_state" ]] || fail "Local Supabase storage.migrations state is empty or unavailable"

  source_max="$(psql "$KOL_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select max(id) from storage.migrations;")"
  target_max="$(psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "select max(id) from storage.migrations;")"

  if [[ "$source_state" != "$target_state" ]]; then
    fail "Local Supabase Storage schema does not match live KÖL (live max migration=${source_max:-unknown}, local=${target_max:-unknown}). Refusing backup/restore rehearsal until the pinned local stack matches hosted Storage."
  fi

  # Guard the specific object-versioning columns that caused the previous
  # incompatibility, even if a future migration ledger were malformed.
  local required_column_count
  required_column_count="$(psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 -Atqc "
    select count(*)
    from information_schema.columns
    where table_schema = 'storage'
      and (table_name, column_name) in (
        ('buckets','versioning_status'),
        ('objects','archived_at'),
        ('objects','is_delete_marker'),
        ('objects','is_versioned')
      );")"
  [[ "$required_column_count" == "4" ]] || \
    fail "Local Supabase Storage is missing required object-versioning columns"

  printf 'Storage schema compatible: live/local migration max=%s\n' "$source_max"
}

main() {
  say "KÖL Ubuntu backup + restore + migration rehearsal"
  install_apt_packages_if_needed
  ensure_docker
  ensure_disposable_target_available
  install_supabase_cli_if_needed
  ensure_secret
  prepare_repo

  mkdir -p "$BACKUP_ROOT"
  chmod 700 "$BACKUP_ROOT"

  cd "$REPO_DIR"
  local stamp recovery_dir
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  recovery_dir="$BACKUP_ROOT/recovery-$stamp"

  for required in node npm openssl sha256sum; do
    need_cmd "$required" || fail "Required recovery command missing: $required"
  done
  node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)' || \
    fail "Node.js 22 or newer is required for the verified recovery procedure"

  say "Starting our own disposable local Supabase target"
  [[ -e supabase/seed.sql ]] || : > supabase/seed.sql
  STARTED_LOCAL=1
  supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector
  verify_storage_schema_compatibility

  say "Running the same source recovery, migration, isolation and rollback gates as CI"
  bash scripts/run-live-backup-restore-rehearsal-ci.sh
  grep -qx 'status=RESTORE_AND_MIGRATION_REHEARSAL_PASS' .kol-ci-artifacts/evidence/result.txt || \
    fail "Canonical recovery evidence is missing or did not pass"
  (cd .kol-ci-artifacts && sha256sum -c evidence/SHA256SUMS)
  mkdir -m 700 "$recovery_dir"
  cp -a .kol-ci-artifacts/. "$recovery_dir/"
  say "Recovery proof saved: $recovery_dir"
  printf 'Live KÖL was READ-ONLY. No production database was deployed.\n'

}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
