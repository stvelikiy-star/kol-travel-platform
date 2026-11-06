#!/bin/bash
# Run on the user's Mac only, after Tailscale + authenticated SSH are available.
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  printf '%s\n' 'REFUSE: Keychain escrow must run on the separate Mac.' >&2
  exit 2
fi
if [[ $# -ne 1 || "$1" == *[!0-9.]* ]]; then
  printf '%s\n' 'Usage: bash scripts/kol-mac-escrow-from-ubuntu.sh <Ubuntu Tailscale IPv4>' >&2
  exit 2
fi
command -v swiftc >/dev/null
command -v ssh >/dev/null
BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d -t kol-keychain)"
trap 'rm -rf "$TMP"' EXIT
chmod 700 "$TMP"
swiftc "$BASE/kol-mac-recovery-keychain.swift" -o "$TMP/kol-keychain"
# No secret is written to disk or shown on stdout; SSH stdout goes directly
# to the compiled macOS Keychain writer. SSH failures stop the pipeline.
ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 \
  "agent@$1" \
  'KOL_KEY_TRANSPORT_ONLY=1 /usr/bin/python3 /home/agent/kol-unified-20261105/scripts/kol-emit-recovery-key-ssh.py' \
  | "$TMP/kol-keychain"
