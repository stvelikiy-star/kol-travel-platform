#!/usr/bin/env bash
# Retry disposable local Supabase startup when a container registry is throttled.
# Called by local-only smoke scripts BEFORE loading any fixtures/migrations.
set -Eeuo pipefail
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI missing" >&2; exit 1
fi
# GitHub-hosted runners have fresh image caches and pull multiple Supabase
# services in parallel. Throttle Docker downloads at the daemon, not by skipping
# database tests. Never change Docker configuration on a user's Ubuntu machine.
if [[ "${GITHUB_ACTIONS:-}" == "true" && "${RUNNER_ENVIRONMENT:-}" == "github-hosted" ]]; then
  if command -v sudo >/dev/null 2>&1 && command -v python3 >/dev/null 2>&1; then
    sudo python3 - <<'PY'
import json
from pathlib import Path
path = Path("/etc/docker/daemon.json")
data = json.loads(path.read_text()) if path.exists() else {}
if not isinstance(data, dict):
    raise SystemExit("Refusing to replace unexpected Docker daemon configuration")
data["max-concurrent-downloads"] = 1
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(data, indent=2) + chr(10))
PY
    sudo systemctl restart docker
    docker info >/dev/null
    echo "Ephemeral GitHub runner: Docker image downloads limited to 1."
  fi
fi
# The recovered KÖL baseline is loaded by the caller AFTER Supabase starts.
# This hosted migration is registered in QA with an exact SQL payload and must
# not be rewritten to silently succeed on an empty database. Temporarily keep
# ONLY this known dependent migration out of CLI auto-discovery during startup.
# The file is restored byte-for-byte on all normal/failure exits. This helper
# never runs db push and never changes the cloud migration history.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOM_MIGRATION="$ROOT/supabase/migrations/20261126133626_kol_room_moderation_guarded_v1.sql"
HOLD_DIR=""
restore_room_migration() {
  if [[ -n "$HOLD_DIR" ]]; then
    local saved="$HOLD_DIR/$(basename "$ROOM_MIGRATION")"
    if [[ -e "$saved" ]]; then
      if [[ -e "$ROOM_MIGRATION" ]]; then
        echo "Refusing to overwrite room migration; original preserved at $saved" >&2
        return 1
      fi
      mv -- "$saved" "$ROOM_MIGRATION" || return 1
    fi
    rmdir -- "$HOLD_DIR" || return 1
  fi
}
trap 'rc=$?; restore_room_migration || rc=1; exit "$rc"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ -f "$ROOM_MIGRATION" ]]; then
  HOLD_DIR="$(mktemp -d "$ROOT/supabase/.kol-room-migration-hold.XXXXXX")"
  mv -- "$ROOM_MIGRATION" "$HOLD_DIR/"
  echo "Deferred hosted room moderation migration until the recovered baseline exists."
fi
for attempt in 1 2 3 4; do
  # Supabase CLI supports the Docker Hub image namespace explicitly.
  # If GHCR is throttled, use the alternate registry on subsequent attempts
  # rather than hammering the same remote endpoint four times.
  if [[ "${attempt}" -gt 1 && "${GITHUB_ACTIONS:-}" == "true" ]]; then
    export SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io
    echo "Retrying local Supabase from Docker Hub (different image registry)."
  fi
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
