#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_PORT="${KOL_LOCAL_PUBLIC_RUNTIME_PORT:-3101}"
APP_BASE_URL="http://127.0.0.1:${APP_PORT}"
APP_LOG="${RUNNER_TEMP:-/tmp}/kol-public-runtime-smoke.log"
PUBLIC_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}}"

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required for local public runtime smoke}"
if [[ -z "$PUBLIC_KEY" ]]; then
  echo "Local public Supabase key is required for runtime smoke." >&2
  exit 1
fi

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

assert_page_contains() {
  local route="$1"
  local expected="$2"
  local slug="${route#/}"
  local output

  slug="${slug//\//-}"
  output="${RUNNER_TEMP:-/tmp}/kol-public-runtime-${slug}.html"

  curl -fsS "${APP_BASE_URL}${route}" -o "$output"
  if ! grep -Fq -- "$expected" "$output"; then
    echo "Supabase-mode page smoke failed for ${route}; expected '${expected}'." >&2
    echo "--- application log ---" >&2
    cat "$APP_LOG" >&2 || true
    exit 1
  fi
  echo "Supabase-mode page ${route}: PASS"
}

# Prove the same anonymous REST surface used by the server-side public adapters.
assert_rest_row "stays" "Demo guest house" "eq.active"
assert_rest_row "tours" "Demo boat trip" "eq.active"
assert_rest_row "menu_items" "Demo beshbarmak" "eq.active"
assert_rest_row "products" "Demo charcoal" "eq.active"

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

echo "KÖL local Supabase public runtime smoke: PASS"
