#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_URL="${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
MANIFEST="supabase/staging/migration-plan.json"
APP_PORT="${KOL_LOCAL_PARTNER_ORDER_PORT:-3103}"
APP_BASE_URL="http://127.0.0.1:${APP_PORT}"
APP_LOG="${RUNNER_TEMP:-/tmp}/kol-partner-order-runtime.log"
APP_PID=""

cleanup() {
  if [[ -n "$APP_PID" ]]; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

case "$DB_URL" in
  *"@127.0.0.1:"*|*"@localhost:"*) ;;
  *) echo "Refusing Partner order smoke against non-local database." >&2; exit 1 ;;
esac

touch supabase/seed.sql
supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector
supabase status -o env > /tmp/kol-partner-order-supabase.env
set -a
# shellcheck disable=SC1091
source /tmp/kol-partner-order-supabase.env
set +a

export SUPABASE_URL="${API_URL:-http://127.0.0.1:54321}"
export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
export SUPABASE_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:?local Supabase service credential missing}"
export SUPABASE_ANON_KEY="${ANON_KEY:-${PUBLISHABLE_KEY:-}}"
if [[ -z "$SUPABASE_ANON_KEY" ]]; then
  echo "Local Supabase anon/publishable credential missing." >&2
  exit 1
fi
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"
export DATA_SOURCE_MODE="supabase"
export KOL_DEPLOYMENT_ENV="staging"
export ALCOHOL_MODULE_ENABLED="false"
export NEXT_TELEMETRY_DISABLED="1"

psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/schema/001_initial_schema.sql >/dev/null
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/schema/002_rls_policies_draft.sql >/dev/null
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/schema/003_seed_demo_data_draft_FIXED.sql >/dev/null
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/staging/000_preflight_read_only.sql >/dev/null

mapfile -t migration_rows < <(
  node --input-type=module - "$MANIFEST" <<'NODE'
import fs from 'node:fs';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const migration of manifest.migrations) {
  process.stdout.write(`${migration.id}\t${migration.apply}\n`);
}
NODE
)

for row in "${migration_rows[@]}"; do
  IFS=$'\t' read -r id apply_file <<< "$row"
  if [[ "$id" == "009" ]]; then
    npm run provision:catalog-media-bucket >/dev/null
    npm run check:catalog-media-bucket >/dev/null
  fi
  psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$apply_file" >/dev/null
done

psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/schema/015_partner_order_lifecycle_VERIFY.sql >/dev/null
psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/staging/998_api_role_privilege_postflight_VERIFY.sql >/dev/null

npm run build >/dev/null
npm run start -- -H 127.0.0.1 -p "$APP_PORT" >"$APP_LOG" 2>&1 &
APP_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "${APP_BASE_URL}/api/health" >/dev/null 2>&1; then ready=1; break; fi
  sleep 0.5
done
if [[ "$ready" -ne 1 ]]; then
  echo "KÖL Partner order application did not become ready." >&2
  cat "$APP_LOG" >&2 || true
  exit 1
fi

node scripts/qa-local-partner-order-runtime.mjs "$APP_BASE_URL"
echo "KÖL local Partner order staging smoke: PASS"
