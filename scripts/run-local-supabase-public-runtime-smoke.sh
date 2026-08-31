#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_PORT="${KOL_LOCAL_PUBLIC_RUNTIME_PORT:-3101}"
APP_BASE_URL="http://127.0.0.1:${APP_PORT}"
APP_LOG="${RUNNER_TEMP:-/tmp}/kol-public-runtime-smoke.log"
PUBLIC_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}}"
LOCAL_DB_URL="${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required for local public runtime smoke}"
if [[ -z "$PUBLIC_KEY" ]]; then
  echo "Local public Supabase key is required for runtime smoke." >&2
  exit 1
fi

case "$NEXT_PUBLIC_SUPABASE_URL" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *)
    echo "Refusing to seed booking runtime fixtures against a non-local Supabase URL." >&2
    exit 1
    ;;
esac
case "$LOCAL_DB_URL" in
  *"@127.0.0.1:"*|*"@localhost:"*) ;;
  *)
    echo "Refusing to seed booking runtime fixtures against a non-local database URL." >&2
    exit 1
    ;;
esac

export DATA_SOURCE_MODE="supabase"
export KOL_DEPLOYMENT_ENV="staging"
export ALCOHOL_MODULE_ENABLED="false"
export NEXT_TELEMETRY_DISABLED="1"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$PUBLIC_KEY"

APP_PID=""
cleanup_app() {
  if [[ -n "$APP_PID" ]]; then
    kill "$APP_PID" >/dev/null 2>&1 || true
    wait "$APP_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup_app EXIT

assert_rest_row() {
  local table="$1"
  local title="$2"
  local status_filter="$3"
  local body

  body="$(curl -fsS --get \
    -H "apikey: ${PUBLIC_KEY}" \
    -H "accept: application/json" \
    --data-urlencode "select=title" \
    --data-urlencode "status=${status_filter}" \
    "${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/${table}")"

  if [[ "$body" != *"\"title\":\"${title}\""* ]]; then
    echo "Anon REST smoke failed for ${table}; expected seeded title '${title}'." >&2
    echo "$body" >&2
    exit 1
  fi
  echo "Anon REST ${table}: PASS"
}

assert_rpc_contains() {
  local function_name="$1"
  local request_body="$2"
  shift 2
  local body

  body="$(curl -fsS \
    -X POST \
    -H "apikey: ${PUBLIC_KEY}" \
    -H "accept: application/json" \
    -H "content-type: application/json" \
    --data "$request_body" \
    "${NEXT_PUBLIC_SUPABASE_URL%/}/rest/v1/rpc/${function_name}")"

  local expected
  for expected in "$@"; do
    if [[ "$body" != *"$expected"* ]]; then
      echo "Anon RPC smoke failed for ${function_name}; expected '${expected}'." >&2
      echo "$body" >&2
      exit 1
    fi
  done
  echo "Anon RPC ${function_name}: PASS"
}

assert_page_contains() {
  local route="$1"
  shift
  local slug="${route#/}"
  local output

  slug="${slug//\//-}"
  output="${RUNNER_TEMP:-/tmp}/kol-public-runtime-${slug}.html"

  curl -fsS "${APP_BASE_URL}${route}" -o "$output"

  local expected
  for expected in "$@"; do
    if ! grep -Fq -- "$expected" "$output"; then
      echo "Supabase-mode page smoke failed for ${route}; expected '${expected}'." >&2
      echo "--- application log ---" >&2
      cat "$APP_LOG" >&2 || true
      exit 1
    fi
  done
  echo "Supabase-mode page ${route}: PASS"
}

# Local-only future inventory fixtures. These are deliberately created after the
# reviewed staging migration sequence and never leave the ephemeral CI database.
echo "::group::Local public booking inventory fixtures"
psql "$LOCAL_DB_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
insert into public.room_availability (room_id, date, status, available_count, price_override)
values (
  '42000000-0000-0000-0000-000000000001',
  current_date + 7,
  'available',
  2,
  5700
)
on conflict (room_id, date) do update
set status = excluded.status,
    available_count = excluded.available_count,
    price_override = excluded.price_override,
    updated_at = now();

insert into public.tour_schedules (id, tour_id, date, time, capacity, booked_count, status)
values (
  '45000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  current_date + 8,
  '11:00',
  12,
  3,
  'available'
)
on conflict (id) do update
set date = excluded.date,
    time = excluded.time,
    capacity = excluded.capacity,
    booked_count = excluded.booked_count,
    status = excluded.status,
    updated_at = now();
SQL
echo "::endgroup::"

# Prove the same anonymous REST surface used by the server-side public adapters.
assert_rest_row "stays" "Demo guest house" "eq.active"
assert_rest_row "tours" "Demo boat trip" "eq.active"
assert_rest_row "menu_items" "Demo beshbarmak" "eq.active"
assert_rest_row "products" "Demo charcoal" "eq.active"

WINDOW_FROM="$(date -u +%F)"
WINDOW_TO="$(date -u -d '+30 days' +%F)"
assert_rpc_contains \
  "get_public_stay_inventory" \
  "{\"p_stay_id\":\"41000000-0000-0000-0000-000000000001\",\"p_from\":\"${WINDOW_FROM}\",\"p_to\":\"${WINDOW_TO}\"}" \
  '"room_title":"Demo family room"' \
  '"available_count":2' \
  '"price_override":5700'
assert_rpc_contains \
  "get_public_tour_schedules" \
  "{\"p_tour_id\":\"40000000-0000-0000-0000-000000000001\",\"p_from\":\"${WINDOW_FROM}\",\"p_to\":\"${WINDOW_TO}\"}" \
  '"schedule_id":"45000000-0000-0000-0000-000000000001"' \
  '"capacity":12' \
  '"booked_count":3' \
  '"remaining_count":9'

# Build and run the real Next application against the isolated local Supabase stack.
npm run build
npm run start -- -H 127.0.0.1 -p "$APP_PORT" >"$APP_LOG" 2>&1 &
APP_PID=$!

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "${APP_BASE_URL}/api/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done

if [[ "$ready" -ne 1 ]]; then
  echo "KÖL Supabase-mode application did not become ready." >&2
  cat "$APP_LOG" >&2 || true
  exit 1
fi

assert_page_contains "/stays" "Demo guest house"
assert_page_contains "/tours" "Demo boat trip"
assert_page_contains "/food" "Demo beshbarmak"
assert_page_contains "/shop" "Demo charcoal"
assert_page_contains \
  "/stays/demo-guest-house" \
  "Demo guest house" \
  "Demo family room" \
  "Доступность и итоговую стоимость проверяет база данных в момент бронирования."
assert_page_contains \
  "/tours/demo-boat-trip" \
  "Demo boat trip" \
  "Свободные места и итоговую стоимость подтверждает база данных в момент бронирования."

echo "::group::Authenticated Supabase Auth/session runtime smoke"
if ! node scripts/qa-local-supabase-auth-runtime.mjs "$APP_BASE_URL"; then
  echo "--- application log after authenticated runtime failure ---" >&2
  cat "$APP_LOG" >&2 || true
  exit 1
fi
echo "::endgroup::"

echo "KÖL local Supabase public runtime smoke: PASS"
