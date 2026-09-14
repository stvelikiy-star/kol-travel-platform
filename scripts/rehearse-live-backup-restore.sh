#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# GNU sort/comm require both inputs to be ordered under the same collation.
# Force a deterministic bytewise locale so restore checks behave identically
# on Ubuntu hosts regardless of the user's configured language/locale.
export LC_ALL=C

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

verify_checksums() {
  local dir="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$dir" && sha256sum -c SHA256SUMS)
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$dir" && shasum -a 256 -c SHA256SUMS)
  else
    fail "sha256sum or shasum is required"
  fi
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1"
  else
    fail "sha256sum or shasum is required"
  fi
}

[[ $# -eq 1 ]] || fail "usage: $0 <backup-directory>"
BACKUP_DIR="$1"
[[ -d "$BACKUP_DIR" ]] || fail "backup directory not found: $BACKUP_DIR"

: "${KOL_RESTORE_DATABASE_URL:?KOL_RESTORE_DATABASE_URL must point to an isolated disposable Supabase-compatible restore target}"
[[ "${KOL_RESTORE_CONFIRM:-}" == "RESTORE_TO_DISPOSABLE_TARGET" ]] || \
  fail "set KOL_RESTORE_CONFIRM=RESTORE_TO_DISPOSABLE_TARGET after verifying the target is disposable"

require_command psql
require_command diff
require_command comm
require_command cut
require_command sort

for required in roles.sql schema.sql data.sql SHA256SUMS baseline.sql source-baseline.tsv source-extensions.tsv; do
  [[ -s "$BACKUP_DIR/$required" ]] || fail "required backup artifact is missing or empty: $required"
done
[[ -e "$BACKUP_DIR/source-custom-roles.tsv" ]] || fail "required backup artifact is missing: source-custom-roles.tsv"

verify_checksums "$BACKUP_DIR"

# Live KÖL currently has no custom PostgreSQL roles. The local Supabase stack
# already owns and provisions managed roles such as postgres, anon,
# authenticated, service_role and supabase_*. Replaying the managed-role dump
# would attempt to ALTER reserved roles such as supabase_admin and is both
# unnecessary and rejected by the local target. Fail closed if a future backup
# ever contains a truly custom Postgres role.
if [[ -s "$BACKUP_DIR/source-custom-roles.tsv" ]]; then
  printf 'Custom PostgreSQL roles detected in source backup:\n' >&2
  cat "$BACKUP_DIR/source-custom-roles.tsv" >&2
  fail "custom PostgreSQL roles require an explicit restore plan; refusing to skip them"
fi

# Live KÖL currently has public application tables. Requiring zero public base
# tables makes an accidental restore into the source/live database fail before
# any mutating restore command can run, even if a different connection URL form
# points to the same server.
TARGET_PUBLIC_TABLES="$(psql "$KOL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")"
[[ "$TARGET_PUBLIC_TABLES" == "0" ]] || fail "restore target is not empty: public table count is $TARGET_PUBLIC_TABLES"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
EVIDENCE_DIR="$BACKUP_DIR/restore-evidence-$STAMP"
mkdir -p "$EVIDENCE_DIR"

psql "$KOL_RESTORE_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -At -F $'\t' \
  -c "select extname, extversion from pg_extension order by extname;" \
  > "$EVIDENCE_DIR/target-extensions-before.tsv"

cut -f1 "$BACKUP_DIR/source-extensions.tsv" | sort -u > "$EVIDENCE_DIR/source-extension-names.txt"
cut -f1 "$EVIDENCE_DIR/target-extensions-before.tsv" | sort -u > "$EVIDENCE_DIR/target-extension-names.txt"
comm -23 "$EVIDENCE_DIR/source-extension-names.txt" "$EVIDENCE_DIR/target-extension-names.txt" > "$EVIDENCE_DIR/missing-extensions.txt"

if [[ -s "$EVIDENCE_DIR/missing-extensions.txt" ]]; then
  printf 'Missing required target extensions:\n' >&2
  cat "$EVIDENCE_DIR/missing-extensions.txt" >&2
  fail "restore target is not extension-compatible with the source"
fi

cat > "$EVIDENCE_DIR/required-managed-role-names.txt" <<'EOF'
anon
authenticated
authenticator
postgres
service_role
supabase_admin
supabase_auth_admin
supabase_storage_admin
EOF

psql "$KOL_RESTORE_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -At \
  -c "select rolname from pg_roles where rolname in ('anon','authenticated','authenticator','postgres','service_role','supabase_admin','supabase_auth_admin','supabase_storage_admin') order by rolname;" \
  | sort -u > "$EVIDENCE_DIR/target-managed-role-names.txt"

sort -u "$EVIDENCE_DIR/required-managed-role-names.txt" -o "$EVIDENCE_DIR/required-managed-role-names.txt"
comm -23 "$EVIDENCE_DIR/required-managed-role-names.txt" "$EVIDENCE_DIR/target-managed-role-names.txt" > "$EVIDENCE_DIR/missing-managed-roles.txt"

if [[ -s "$EVIDENCE_DIR/missing-managed-roles.txt" ]]; then
  printf 'Missing required Supabase-managed target roles:\n' >&2
  cat "$EVIDENCE_DIR/missing-managed-roles.txt" >&2
  fail "restore target is not Supabase-role-compatible with the source"
fi

# The role dump remains checksum-protected in the recovery artifact, but for a
# pre-provisioned local Supabase target we restore schema + data only. Managed
# roles are validated above and are intentionally not ALTERed/recreated.
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$BACKUP_DIR/schema.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$BACKUP_DIR/data.sql" \
  --dbname "$KOL_RESTORE_DATABASE_URL" \
  > "$EVIDENCE_DIR/restore.log" 2>&1 || {
    tail -n 80 "$EVIDENCE_DIR/restore.log" >&2 || true
    fail "restore failed; target transaction was aborted"
  }

psql "$KOL_RESTORE_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -A -F $'\t' -P footer=off \
  -f "$BACKUP_DIR/baseline.sql" \
  > "$EVIDENCE_DIR/restore-baseline.tsv"

if ! diff -u "$BACKUP_DIR/source-baseline.tsv" "$EVIDENCE_DIR/restore-baseline.tsv" > "$EVIDENCE_DIR/baseline.diff"; then
  cat "$EVIDENCE_DIR/baseline.diff" >&2
  fail "restored application/auth/storage metadata baseline does not match the source baseline"
fi

psql "$KOL_RESTORE_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -At -F $'\t' \
  -c "select extname, extversion from pg_extension order by extname;" \
  > "$EVIDENCE_DIR/target-extensions-after.tsv"

printf 'restored_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$EVIDENCE_DIR/result.txt"
printf 'status=RESTORE_REHEARSAL_PASS\n' >> "$EVIDENCE_DIR/result.txt"
printf 'managed_roles_replayed=false\n' >> "$EVIDENCE_DIR/result.txt"
printf 'custom_postgres_roles=0\n' >> "$EVIDENCE_DIR/result.txt"
printf 'storage_object_bytes_restored=false\n' >> "$EVIDENCE_DIR/result.txt"

(
  cd "$EVIDENCE_DIR"
  for artifact in target-extensions-before.tsv source-extension-names.txt target-extension-names.txt missing-extensions.txt required-managed-role-names.txt target-managed-role-names.txt missing-managed-roles.txt restore.log restore-baseline.tsv baseline.diff target-extensions-after.tsv result.txt; do
    [[ -e "$artifact" ]] && sha256_file "$artifact"
  done
) > "$EVIDENCE_DIR/SHA256SUMS"
chmod 600 "$EVIDENCE_DIR"/*

printf 'RESTORE REHEARSAL PASS: schema fingerprints and critical application/Auth/Storage metadata counts match the source backup baseline.\n'
printf 'Evidence: %s\n' "$EVIDENCE_DIR"
printf 'Target remains isolated; do not reuse it as production. Storage object bytes require separate recovery validation.\n'
