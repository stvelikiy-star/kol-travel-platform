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

require_command supabase
require_command psql

STAMP="${KOL_BACKUP_STAMP:-$(date -u +%Y%m%dT%H%M%SZ)}"
ROOT="${KOL_BACKUP_ROOT:-$PWD/.kol-backups}"
OUT="$ROOT/kol-live-baseline-$STAMP"

[[ ! -e "$OUT" ]] || fail "backup output already exists: $OUT"
mkdir -p "$OUT"

printf 'KÖL live Supabase logical backup\n' > "$OUT/metadata.txt"
printf 'captured_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT/metadata.txt"
printf 'format=supabase-cli-roles-schema-data\n' >> "$OUT/metadata.txt"
printf 'supabase_cli_version=%s\n' "$(supabase --version | tr -d '\r\n')" >> "$OUT/metadata.txt"
printf 'restore_mode=single-transaction-psql\n' >> "$OUT/metadata.txt"

# Store only non-secret source identity. Never print or persist the connection URL.
psql "$KOL_DATABASE_URL" \
  -X -v ON_ERROR_STOP=1 -At \
  -c "select 'database='||current_database(); select 'server_version='||current_setting('server_version');" \
  >> "$OUT/metadata.txt"

cat > "$OUT/baseline.sql" <<'SQL'
select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as public_tables,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_enabled_tables,
  (select count(*) from pg_policies where schemaname='public') as public_policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as public_functions,
  (select count(*) from pg_indexes where schemaname='public') as public_indexes,
  (select md5(coalesce(string_agg(concat_ws(':', table_schema, table_name, ordinal_position::text, column_name, data_type, coalesce(udt_schema,''), coalesce(udt_name,''), is_nullable, coalesce(column_default,'')), '|' order by table_schema, table_name, ordinal_position),'')) from information_schema.columns where table_schema='public') as public_columns_fingerprint_v1,
  (select md5(coalesce(string_agg(concat_ws(':', schemaname, tablename, policyname, permissive, coalesce(array_to_string(roles,','),''), cmd, coalesce(qual,''), coalesce(with_check,'')), '|' order by tablename, policyname),'')) from pg_policies where schemaname='public') as public_policies_fingerprint_v1,
  (select md5(coalesce(string_agg(pg_get_functiondef(p.oid), E'\n--FUNCTION--\n' order by p.proname, pg_get_function_identity_arguments(p.oid)),'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as public_functions_fingerprint_v1,
  (select md5(coalesce(string_agg(pg_get_indexdef(i.indexrelid), E'\n--INDEX--\n' order by tbl.relname, idx.relname),'')) from pg_index i join pg_class tbl on tbl.oid=i.indrelid join pg_namespace n on n.oid=tbl.relnamespace join pg_class idx on idx.oid=i.indexrelid where n.nspname='public') as public_indexes_fingerprint_v1,
  (select count(*) from public.bookings) as bookings,
  (select count(*) from public.booking_status_history) as booking_status_history,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.order_items) as order_items,
  (select count(*) from public.order_status_history) as order_status_history,
  (select count(*) from public.payments) as payments,
  (select count(*) from public.order_payments) as order_payments,
  (select count(*) from public.transactions) as transactions,
  (select count(*) from public.delivery_status_history) as delivery_status_history,
  (select count(*) from public.courier_assignments) as courier_assignments,
  (select count(*) from public.media_files) as media_files,
  (select count(*) from public.room_availability) as room_availability,
  (select count(*) from auth.users) as auth_users,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from storage.objects) as storage_objects;
SQL

psql "$KOL_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -A -F $'\t' -P footer=off \
  -f "$OUT/baseline.sql" \
  > "$OUT/source-baseline.tsv"

psql "$KOL_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -At -F $'\t' \
  -c "select extname, extversion from pg_extension order by extname;" \
  > "$OUT/source-extensions.tsv"

# Supabase CLI wraps pg_dump with Supabase-specific filtering. Raw pg_dump is not
# used here because it can include managed/internal schemas that should not be
# replayed as ordinary application-owned schema during a portable restore.
supabase db dump --db-url "$KOL_DATABASE_URL" -f "$OUT/roles.sql" --role-only
supabase db dump --db-url "$KOL_DATABASE_URL" -f "$OUT/schema.sql"
supabase db dump \
  --db-url "$KOL_DATABASE_URL" \
  -f "$OUT/data.sql" \
  --use-copy \
  --data-only \
  -x "storage.buckets_vectors" \
  -x "storage.vector_indexes"

for required in \
  metadata.txt \
  baseline.sql \
  source-baseline.tsv \
  source-extensions.tsv \
  roles.sql \
  schema.sql \
  data.sql; do
  [[ -s "$OUT/$required" ]] || fail "backup artifact is missing or empty: $required"
done

(
  cd "$OUT"
  for artifact in metadata.txt baseline.sql source-baseline.tsv source-extensions.tsv roles.sql schema.sql data.sql; do
    sha256_file "$artifact"
  done
) > "$OUT/SHA256SUMS"

[[ -s "$OUT/SHA256SUMS" ]] || fail "SHA256SUMS was not created"
chmod 600 "$OUT"/*

printf 'Backup artifact created: %s\n' "$OUT"
printf 'Next gate: copy this directory off-target, verify checksums there, then run the isolated restore rehearsal.\n'
printf 'Storage object bytes are NOT restored by this database dump and must remain a separate recovery stream.\n'
