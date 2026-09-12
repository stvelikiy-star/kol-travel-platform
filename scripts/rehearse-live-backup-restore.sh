#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

hash_text() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
  else
    fail "sha256sum or shasum is required"
  fi
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

[[ $# -eq 1 ]] || fail "usage: $0 <backup-directory>"
BACKUP_DIR="$1"
[[ -d "$BACKUP_DIR" ]] || fail "backup directory not found: $BACKUP_DIR"

: "${KOL_DATABASE_URL:?KOL_DATABASE_URL must point to the backed-up source database}"
: "${KOL_RESTORE_DATABASE_URL:?KOL_RESTORE_DATABASE_URL must point to an isolated disposable restore target}"
[[ "${KOL_RESTORE_CONFIRM:-}" == "RESTORE_TO_DISPOSABLE_TARGET" ]] || \
  fail "set KOL_RESTORE_CONFIRM=RESTORE_TO_DISPOSABLE_TARGET after verifying the target is disposable"

require_command pg_restore
require_command psql
require_command diff

for required in database.custom.dump SHA256SUMS public-baseline.tsv; do
  [[ -s "$BACKUP_DIR/$required" ]] || fail "required backup artifact is missing or empty: $required"
done

verify_checksums "$BACKUP_DIR"

SOURCE_HASH="$(hash_text "$KOL_DATABASE_URL")"
TARGET_HASH="$(hash_text "$KOL_RESTORE_DATABASE_URL")"
[[ "$SOURCE_HASH" != "$TARGET_HASH" ]] || fail "restore target resolves to the same connection string as the source"
unset SOURCE_HASH TARGET_HASH

# Never clean/drop a target automatically. The rehearsal accepts only a target with
# zero public base tables so a wrong target fails before pg_restore can mutate it.
TARGET_PUBLIC_TABLES="$(psql "$KOL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")"
[[ "$TARGET_PUBLIC_TABLES" == "0" ]] || fail "restore target is not empty: public table count is $TARGET_PUBLIC_TABLES"

pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --dbname "$KOL_RESTORE_DATABASE_URL" \
  "$BACKUP_DIR/database.custom.dump"

psql "$KOL_RESTORE_DATABASE_URL" \
  -X -v ON_ERROR_STOP=1 -A -F $'\t' \
  -c "select
        (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as public_tables,
        (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_enabled_tables,
        (select count(*) from pg_policies where schemaname='public') as public_policies,
        (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as public_functions,
        (select count(*) from pg_indexes where schemaname='public') as public_indexes,
        (select count(*) from public.bookings) as bookings,
        (select count(*) from public.orders) as orders,
        (select count(*) from public.payments) as payments,
        (select count(*) from public.room_availability) as room_availability;" \
  > "$BACKUP_DIR/restore-public-baseline.tsv"

if ! diff -u "$BACKUP_DIR/public-baseline.tsv" "$BACKUP_DIR/restore-public-baseline.tsv"; then
  fail "restored public baseline does not match the source baseline"
fi

printf 'RESTORE REHEARSAL PASS: public schema and critical row counts match the backup baseline.\n'
printf 'Target remains isolated; do not reuse it as production.\n'
