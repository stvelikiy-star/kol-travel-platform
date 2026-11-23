#!/usr/bin/env bash
# KÖL: test the reviewed Production application schema on a disposable Supabase.
# This never connects to hosted TEST or Production and never copies QA data.
set -Eeuo pipefail
umask 077
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[[ "${KOL_DISPOSABLE_SCHEMA_REHEARSAL:-}" == "true" ]] || {
  echo "KOL_DISPOSABLE_SCHEMA_REHEARSAL=true is required" >&2; exit 1;
}
for cmd in supabase psql sha256sum; do
  command -v "$cmd" >/dev/null || { echo "Missing required command: $cmd" >&2; exit 1; }
done
RUN_ROOT="$(mktemp -d)"
MIGRATION_HOLD="$RUN_ROOT/original-migrations"
BASELINE="$ROOT/ops/production-baseline/kol-schema-20261122.sql"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
  if [[ -d "$MIGRATION_HOLD" ]]; then
    if [[ -d "$ROOT/supabase/migrations" ]] &&
       [[ -z "$(find "$ROOT/supabase/migrations" -mindepth 1 -print -quit)" ]]; then
      rmdir "$ROOT/supabase/migrations"
      mv "$MIGRATION_HOLD" "$ROOT/supabase/migrations"
    else
      printf 'Refusing to overwrite original migration sources after clean-room test\n' >&2
      return 1
    fi
  fi
  rm -rf "$RUN_ROOT"
}
trap cleanup EXIT

# The canonical 35-migration schema-only source is a pinned Git artifact,
# not a fabricated replay of unavailable historical SQL migration bodies.
printf '%s  %s\n' \
  'd5740eef4fa6bc8f76602900d22e6f856827ec308459c82a0175fc1ce87a6d7d' \
  "$BASELINE" | sha256sum -c -

# Supabase CLI applies versioned migrations automatically on local startup.
# Hold them entirely outside the repo so the target is truly empty.
[[ -d "$ROOT/supabase/migrations" ]] || { echo 'Missing tracked migrations' >&2; exit 1; }
mv "$ROOT/supabase/migrations" "$MIGRATION_HOLD"
mkdir "$ROOT/supabase/migrations"
touch "$ROOT/supabase/seed.sql"
bash scripts/start-local-supabase-with-retry.sh

# Explicitly assert localhost before ANY SQL. No environment-supplied host.
[[ "$DB_URL" == 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' ]] || exit 1
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/ops/production-baseline/kol-production-preflight.sql"

# Single-transaction schema-only baseline. No data restore, demo seed,
# Auth users, payments, orders or QA commercial availability.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$BASELINE"

for migration in \
 '20261122071537_content_policy_prerequisite.sql' \
 '20261122071538_kol_ai_admin_knowledge_hub_v1.sql' \
 '20261122073611_sync_auth_email_for_account_security.sql' \
 '20261122091114_kol_ai_updated_by_fk_indexes.sql'
do
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$MIGRATION_HOLD/$migration"
done

# Restore the exact QA effective RPC, table, sequence and column grants.
# Schema-only pg_dump does not preserve the original hardening by itself.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/ops/production-baseline/kol-production-acl-parity-20261122.sql"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/ops/production-baseline/kol-production-column-acl-parity-20261122.sql"
# Supabase Storage application metadata and five scoped object policies.
# No object bytes, public ACL or QA data are copied.
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/ops/production-baseline/kol-production-catalog-media-storage-20261122.sql"
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT/ops/production-baseline/kol-production-postflight.sql"
echo 'KOL_CLEANROOM_APPLICATION_SCHEMA_REPLAY_PASS tables=72 qa_users_imported=0'
