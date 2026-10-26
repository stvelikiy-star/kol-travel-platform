#!/usr/bin/env bash
# Retry disposable local Supabase startup when a container registry is throttled.
# Called by local-only smoke scripts BEFORE loading any fixtures/migrations.
set -Eeuo pipefail
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI missing" >&2; exit 1
fi
for attempt in 1 2 3 4; do
  if supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector; then
    echo "Local Supabase started (attempt ${attempt})."
    exit 0
  fi
  if [[ "${attempt}" == "4" ]]; then
    echo "Local Supabase start failed after four attempts; smoke test NOT passed." >&2
    exit 1
  fi
  echo "Local Supabase startup failed; clearing disposable partial startup and retrying after backoff (${attempt}/4)." >&2
  supabase stop --no-backup >/dev/null 2>&1 || true
  sleep "$((attempt * 25))"
done
