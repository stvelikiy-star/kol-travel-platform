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

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1"
  else
    fail "sha256sum or shasum is required"
  fi
}

: "${KOL_DATABASE_URL:?KOL_DATABASE_URL must be supplied securely outside Git}"

require_command pg_dump
require_command pg_restore
require_command psql

STAMP="${KOL_BACKUP_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
ROOT="${KOL_BACKUP_ROOT:-$PWD/.kol-backups}"
OUT="$ROOT/kol-live-baseline-$STAMP"

[[ ! -e "$OUT" ]] || fail "backup output already exists: $OUT"
mkdir -p "$OUT"

printf 'KÖL live logical backup\n' > "$OUT/metadata.txt"
printf 'captured_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/metadata.txt"
printf 'format=postgres-custom-plus-schema\n' >> "$OUT/metadata.txt"
printf 'owner_acl_restored=false\n' >> "$OUT/metadata.txt"

# Capture a non-secret source identity/baseline before the dump. This intentionally
# does not print or persist the connection string.
psql "$KOL_DATABASE_URL" \
  -X -v ON_ERROR_STOP=1 -At \
  -c "select 'database='||current_database(); select 'server_version='||current_setting('server_version');" \
  >> "$OUT/metadata.txt"

psql "$KOL_DATABASE_URL" \
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
  > "$OUT/public-baseline.tsv"

pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file "$OUT/database.custom.dump" \
  "$KOL_DATABASE_URL"

pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file "$OUT/schema.sql" \
  "$KOL_DATABASE_URL"

pg_restore --list "$OUT/database.custom.dump" > "$OUT/database.restore-list.txt"

for required in \
  metadata.txt \
  public-baseline.tsv \
  database.custom.dump \
  schema.sql \
  database.restore-list.txt; do
  [[ -s "$OUT/$required" ]] || fail "backup artifact is missing or empty: $required"
done

(
  cd "$OUT"
  for artifact in metadata.txt public-baseline.tsv database.custom.dump schema.sql database.restore-list.txt; do
    sha256_file "$artifact"
  done
) > "$OUT/SHA256SUMS"

[[ -s "$OUT/SHA256SUMS" ]] || fail "SHA256SUMS was not created"
chmod 600 "$OUT"/*

printf 'Backup artifact created: %s\n' "$OUT"
printf 'Next gate: copy this directory off-target, verify checksums there, then run the isolated restore rehearsal.\n'
