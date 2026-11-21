#!/usr/bin/env bash
# KÖL historical 29 Oct encrypted archive: offline checksum inspection or
# explicitly authorized disposable localhost restore. NEVER reads the live source.
set -Eeuo pipefail
umask 077
export LC_ALL=C

fail() { printf 'KOL offline recovery: %s\n' "$*" >&2; exit 2; }
if [[ "$#" -lt 2 || "$#" -gt 3 ]]; then
  fail "usage: bash scripts/qa-offline-historical-recovery.sh --inspect|--restore <KOL_ENCRYPTED_RECOVERY_2026-10-29.zip> [local-passphrase-file]"
fi
mode="$1"
archive="$2"
[[ "$mode" == "--inspect" || "$mode" == "--restore" ]] || fail "invalid mode"
[[ -r "$archive" && -f "$archive" ]] || fail "archive file missing or unreadable"
for cmd in unzip sha256sum mktemp python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "required local command absent: $cmd"
done
scratch="$(mktemp -d)"
cleanup() { rm -rf -- "$scratch"; }
trap cleanup EXIT

# Extract ONLY these ten exact known members. No paths from the archive are
# passed to the filesystem, tar or the shell.
name="kol-live-baseline-20261029T152908Z.tar.gz.enc"
expected=(
  evidence/SHA256SUMS
  evidence/post-migration-gate.tsv
  evidence/restore-baseline.tsv
  evidence/restore-result.txt
  evidence/result.txt
  evidence/rollback-baseline.tsv
  evidence/rollback-result.txt
  evidence/source-baseline.tsv
  "$name"
  "$name.sha256"
)
mapfile -t actual < <(unzip -Z -1 "$archive")
[[ "${#actual[@]}" -eq "${#expected[@]}" ]] || fail "unexpected number of ZIP members"
for entry in "${actual[@]}"; do
  matched=false
  for expected_entry in "${expected[@]}"; do
    if [[ "$entry" == "$expected_entry" ]]; then matched=true; break; fi
  done
  [[ "$matched" == true ]] || fail "unrecognized ZIP member; refuse extraction"
done
for entry in "${expected[@]}"; do
  if [[ "$entry" == */* ]]; then mkdir -p "$scratch/${entry%/*}"; fi
  unzip -p "$archive" "$entry" > "$scratch/$entry" || fail "ZIP member unreadable"
done
(cd "$scratch" && sha256sum -c evidence/SHA256SUMS) ||
  fail "9-file historical SHA256 manifest verification failed"
printf 'KOL_OFFLINE_HISTORICAL_ARCHIVE_SHA256_9_OF_9_PASS\n'
if [[ "$mode" == "--inspect" ]]; then
  printf 'RESTORE_NOT_VERIFIED: encrypted content not decrypted; no DB touched\n'
  exit 0
fi

[[ "$#" -eq 3 ]] || fail "restore mode requires the original passphrase in a separate local file"
keyfile="$3"
[[ -f "$keyfile" && -r "$keyfile" ]] || fail "local passphrase file missing"
# Do not print, transmit or put the passphrase in command-line args.
perms="$(stat -c %a "$keyfile")"
[[ "$perms" == 600 || "$perms" == 400 ]] ||
  fail "key file must have chmod 600 or 400"
[[ "${KOL_OFFLINE_RESTORE_CONFIRM:-}" == "DISPOSABLE_LOCAL_POSTGRES_ONLY" ]] ||
  fail "set KOL_OFFLINE_RESTORE_CONFIRM=DISPOSABLE_LOCAL_POSTGRES_ONLY"
[[ "${KOL_ALLOW_LOCAL_DDL:-}" == "true" && "${KOL_CONFIRMED_EPHEMERAL_RESTORED_DB:-}" == "true" ]] ||
  fail "explicit disposable DB DDL confirmations missing"
db_url="${KOL_RESTORE_DATABASE_URL:-}"
[[ -n "$db_url" ]] || fail "KOL_RESTORE_DATABASE_URL missing"
command -v node >/dev/null 2>&1 || fail "Node.js required for URL validation"
command -v openssl >/dev/null 2>&1 || fail "OpenSSL required"
command -v psql >/dev/null 2>&1 || fail "psql required"
node - "$db_url" <<'NODE' || fail "rejecting non-disposable DB URL"
const x = new URL(process.argv[2]);
if (!["postgresql:","postgres:"].includes(x.protocol) ||
    !["127.0.0.1","localhost"].includes(x.hostname) ||
    x.port !== "54322" || x.pathname !== "/postgres" ||
    x.search || x.hash) throw Error("Only local Supabase CLI postgres:54322 allowed");
NODE
# Require empty public/auth/storage data, not just a matching 54322 port.
public_count="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c   "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")" ||
  fail "disposable PostgreSQL target unavailable"
[[ "$public_count" == 0 ]] || fail "restore target has public application tables"
auth_count="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from auth.users")" ||
  fail "disposable Supabase Auth schema missing"
[[ "$auth_count" == 0 ]] || fail "restore target contains Auth users"
objects_count="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from storage.objects")" ||
  fail "disposable Supabase Storage schema missing"
[[ "$objects_count" == 0 ]] || fail "restore target contains Storage objects"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -md sha256   -in "$scratch/$name" -out "$scratch/historical.tar.gz"   -pass "file:$keyfile" >/dev/null 2>&1 ||
  fail "offline decrypt FAILED: wrong or unavailable historical passphrase"
# Reject traversal, device nodes, links and unexpected archive root.
python3 - "$scratch/historical.tar.gz" <<'PY' || fail "unsafe historical TAR structure"
import sys, tarfile, pathlib
with tarfile.open(sys.argv[1], "r:gz") as t:
    members=t.getmembers()
    if not members: raise SystemExit("empty TAR")
    for m in members:
        p=pathlib.PurePosixPath(m.name)
        if (p.is_absolute() or ".." in p.parts or not
            p.parts[0].startswith("kol-live-baseline-20261029") or
            not (m.isfile() or m.isdir())):
            raise SystemExit("unexpected member type or path")
PY
mkdir -p "$scratch/unpacked"
tar -xzf "$scratch/historical.tar.gz" -C "$scratch/unpacked" --no-same-owner --no-same-permissions
backup="$scratch/unpacked/kol-live-baseline-20261029T152908Z"
[[ -d "$backup" && -s "$backup/SHA256SUMS" ]] || fail "restored TAR baseline directory missing"
(cd "$backup" && sha256sum -c SHA256SUMS) || fail "internal backup SHA256 failed"
printf 'KOL_OFFLINE_HISTORICAL_DECRYPT_AND_INTERNAL_SHA256_PASS\n'

# These tools enforce further local-only destination and exact 17-ledger gates.
KOL_RESTORE_CONFIRM=RESTORE_TO_DISPOSABLE_TARGET   bash scripts/rehearse-live-backup-restore.sh "$backup"
KOL_DISPOSABLE_RESTORED_DB_URL="$db_url"   node scripts/qa-disposable-restored-migration-plan.mjs
printf 'KOL_RESTORED_17_BASELINE_AND_FULL_44_MIGRATION_GATE_PASS\n'
