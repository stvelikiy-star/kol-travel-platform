#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export LC_ALL=C

fail() { printf 'STOP: %s\n' "$*" >&2; exit 1; }
: "${KOL_RUNTIME_RELEASE_SHA:?Supply the reviewed full KÖL release SHA}"
[[ "$KOL_RUNTIME_RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "A full commit SHA is required"
for tool in python3 curl docker sha256sum; do
  command -v "$tool" >/dev/null || fail "Required tool missing: $tool"
done

kol_live_root="$HOME/kol-live"
python3 - "$kol_live_root" <<'KOL_DIRECTORY_GUARD'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
if root.is_symlink():
    raise SystemExit("STOP: runtime directory is a symbolic link")
if root.exists():
    marker = root / "state.json"
    if marker.exists():
        if marker.is_symlink() or json.loads(marker.read_text()).get("project") != "kol-live":
            raise SystemExit("STOP: existing runtime has an unknown identity")
    elif any(path.name != "releases" for path in root.iterdir()):
        raise SystemExit("STOP: unknown existing directory was preserved")
KOL_DIRECTORY_GUARD

mkdir -p "$kol_live_root/releases"
kol_release_dir="$kol_live_root/releases/$KOL_RUNTIME_RELEASE_SHA"
kol_download_dir=""
cleanup_download() {
  if [[ -n "$kol_download_dir" ]]; then rm -rf -- "$kol_download_dir"; fi
}
trap cleanup_download EXIT

manifest() {
  cat <<'KOL_FILES'
fb80ed8d6a49862de0527cd7effb0d1a8a3a7c8fb080a3ce40dd5bdb7ae945b6  scripts/kol_live_runtime.py
725007bb29274396f9b75c293ed33eb2b9503824fc7c6716102fceeed91a0aa4  ops/ubuntu/live/compose.yaml
7cf3187b29e208b38ccf23753f81ad22c5d07060c1aa94b6aa46e4d5c5b91987  ops/ubuntu/live/db/roles.sql
1d1ad098406779dc67c8934c8fe2edeebe4054a8fc987e144a19c1ca8deecfaf  ops/ubuntu/live/db/jwt.sql
KOL_FILES
}

if [[ ! -e "$kol_release_dir" ]]; then
  kol_download_dir="$(mktemp -d "$kol_live_root/releases/.download.XXXXXX")"
  while read -r expected file; do
    mkdir -p "$kol_download_dir/$(dirname "$file")"
    curl --http1.1 --fail --location --silent --show-error \
      --retry 3 --retry-all-errors --connect-timeout 15 --max-time 120 \
      "https://raw.githubusercontent.com/stvelikiy-star/kol-travel-platform/$KOL_RUNTIME_RELEASE_SHA/$file" \
      -o "$kol_download_dir/$file"
  done < <(manifest)
  (cd "$kol_download_dir" && manifest | sha256sum -c -)
  mv -- "$kol_download_dir" "$kol_release_dir"
  kol_download_dir=""
else
  [[ -d "$kol_release_dir" && ! -L "$kol_release_dir" ]] || fail "Invalid existing release directory"
  (cd "$kol_release_dir" && manifest | sha256sum -c -)
fi

python3 "$kol_release_dir/scripts/kol_live_runtime.py" \
  --root "$kol_live_root" --assets "$kol_release_dir/ops/ubuntu/live"
