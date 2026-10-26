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
path.write_text(json.dumps(data, indent=2) + "\\n")
PY
    sudo systemctl restart docker
    docker info >/dev/null
    echo "Ephemeral GitHub runner: Docker image downloads limited to 1."
  fi
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
