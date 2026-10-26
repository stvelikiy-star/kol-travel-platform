#!/usr/bin/env bash
# KÖL Ubuntu infrastructure inspection — READ ONLY, no sudo, no network writes.
# Does not create containers, alter existing projects, test passwords or dump data.
set -Eeuo pipefail

echo "KÖL Ubuntu DB host preflight (inspection only)"
date -u '+checked_utc=%Y-%m-%dT%H:%M:%SZ'
printf '\nOperating system:\n'
if [[ -r /etc/os-release ]]; then
  grep -E '^(NAME|VERSION_ID)=' /etc/os-release || true
fi
printf '\nCPU / memory:\n'
if command -v nproc >/dev/null 2>&1; then nproc; fi
if command -v free >/dev/null 2>&1; then free -h; fi
printf '\nFilesystem capacity:\n'
df -hP / /var/lib/docker 2>/dev/null || df -hP /
printf '\nDocker / Compose availability:\n'
if command -v docker >/dev/null 2>&1; then
  docker --version
  docker compose version 2>/dev/null || true
  docker info --format 'server_version={{.ServerVersion}} rootless={{.SecurityOptions}}' 2>/dev/null || echo 'Docker server not readable by this user'
else
  echo 'Docker CLI unavailable'
fi
printf '\nLikely KÖL/HTTPS/PostgreSQL port listeners (inspect collisions, do not stop):\n'
if command -v ss >/dev/null 2>&1; then
  ss -ltn '( sport = :3100 or sport = :5432 or sport = :54321 or sport = :54322 or sport = :54323 or sport = :80 or sport = :443 )' 2>/dev/null || true
else
  echo 'ss unavailable; port inspection skipped'
fi
printf '\nKÖL preview compose validation (no containers created):\n'
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose -f "$repo_root/ops/ubuntu/compose.yaml" config --quiet && echo 'KÖL mock preview compose: VALID'
else
  echo 'Compose unavailable; validation skipped'
fi
printf '\nMANUAL GATES: confirm off-host encrypted backup destination; versions of Supabase-compatible Auth/PostgREST/Storage; actual safe RAM/disk headroom; TLS DNS; source backup/restore evidence.\n'
echo "STATUS=READ_ONLY_PREFLIGHT_COMPLETE_NOT_PRODUCTION_APPROVAL"
