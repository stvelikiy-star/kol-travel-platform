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
43cac7ce45f1549799eecbafa8e8a56c74b1e796ba3e3d7818c9183f760fa747  scripts/kol_live_runtime.py
312977faafb59e3f86ed2e5dc4b5b09e062e30d2dfd3eb49b0aa422a9beb4015  ops/ubuntu/live/compose.yaml
4db29611b7a3ef8a182472d608993cad47a61bb54f9f072c3a421be4d31b5bc7  ops/ubuntu/live/db/roles.sql
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
