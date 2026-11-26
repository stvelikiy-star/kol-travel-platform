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
require_command python3
require_command diff
require_command comm
require_command cut
require_command sort
require_command awk
require_command grep

for required in roles.sql schema.sql migration-schema.sql migration-data.sql data.sql SHA256SUMS baseline.sql source-baseline.tsv source-extensions.tsv; do
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
# Never accept a cloud hostname as the target, even when it happens to have
# no public tables. The canonical recovery workflow uses this local endpoint.
[[ "$KOL_RESTORE_DATABASE_URL" == *"@127.0.0.1:54322/"* ]] || fail "restore target is not the reviewed local disposable Supabase endpoint"

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

# Hosted Auth may have new columns in its EMPTY custom OAuth provider table.
# Never alter managed Auth ownership or schema. Preserve the verified original
# dump and project only the two known absent columns out of an EMPTY COPY
# header in a disposable restore copy. Nonempty or other mismatches fail closed.
psql "$KOL_RESTORE_DATABASE_URL" \
  -X -q -v ON_ERROR_STOP=1 -At -F $'\t' \
  -c "select table_schema,table_name,column_name from information_schema.columns where table_schema in ('auth','storage') order by 1,2,3;" \
  > "$EVIDENCE_DIR/target-managed-copy-columns.tsv"

python3 - "$BACKUP_DIR/data.sql" "$EVIDENCE_DIR/target-managed-copy-columns.tsv" "$EVIDENCE_DIR/data-local-restore.sql" "$EVIDENCE_DIR/oauth-copy-compat.txt" <<'PY'
import re,sys
from pathlib import Path
source,catalog,target,evidence=map(Path,sys.argv[1:])
data=source.read_bytes()
lines=data.splitlines(keepends=True)
known={line.split('\t')[2] for line in catalog.read_text().splitlines() if line.startswith('auth\tcustom_oauth_providers\t')}
pattern=re.compile(rb'COPY "auth"\."custom_oauth_providers" \(([^\r\n]+)\) FROM stdin;\r?\n')
headers=[(i,m) for i,line in enumerate(lines) if (m:=pattern.fullmatch(line))]
note='none'
if len(headers)==1 and known:
    i,m=headers[0]
    fields=m[1].split(b',')
    names=[v.strip().strip(b'"').decode('ascii') for v in fields]
    missing=set(names)-known
    allowed={'client_assertion_audience','client_auth_method'}
    if missing and missing<=allowed and i+1<len(lines) and lines[i+1].rstrip(b'\r\n')==b'\\.':
        keep=[v for v,n in zip(fields,names) if n not in missing]
        if not keep:
            raise SystemExit('No compatible OAuth columns')
        lines[i]=lines[i][:m.start(1)]+b','.join(keep)+lines[i][m.end(1):]
        note='empty_provider_copy_header_projected='+','.join(sorted(missing))
target.write_bytes(b''.join(lines) if note!='none' else data)
evidence.write_text(note+'\n')
print('KOL_OAUTH_COPY_COMPAT '+note)
PY
if ! grep -qx 'none' "$EVIDENCE_DIR/oauth-copy-compat.txt"; then
  [[ "$(psql "$KOL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc 'SELECT count(*) FROM auth.custom_oauth_providers')" == '0' ]] || fail "disposable OAuth provider target is not empty"
fi
python3 "$(dirname "$0")/check-kol-managed-copy-columns.py" \
  "$EVIDENCE_DIR/data-local-restore.sql" "$EVIDENCE_DIR/target-managed-copy-columns.tsv" || \
  fail "managed Auth/Storage COPY schema incompatible with backup; refuse restore"

# The hosted Supabase migration ledger has columns not present in a freshly
# bootstrapped local CLI ledger (created_by, idempotency_key, rollback).
# Reconcile ONLY this disposable target, after the no-public-tables guard and
# managed Auth/Storage checks. Never change the live/source connection.
psql "$KOL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
ALTER TABLE supabase_migrations.schema_migrations
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS rollback text[];
DO $kol_migration_columns$
DECLARE
  v_matched integer;
BEGIN
  SELECT count(*) INTO v_matched
  FROM information_schema.columns
  WHERE table_schema='supabase_migrations'
    AND table_name='schema_migrations'
    AND ((column_name='version' AND udt_name='text')
      OR (column_name='statements' AND udt_name='_text')
      OR (column_name='name' AND udt_name='text')
      OR (column_name='created_by' AND udt_name='text')
      OR (column_name='idempotency_key' AND udt_name='text')
      OR (column_name='rollback' AND udt_name='_text'));
  IF v_matched <> 6 THEN
    RAISE EXCEPTION 'Disposable Supabase migration ledger columns are incompatible';
  END IF;
END
$kol_migration_columns$;
SQL

# Supabase documents that logical schema dumps can contain ALTER ... OWNER TO
# "supabase_admin" statements that fail on a pre-provisioned target. Preserve
# the checksum-protected original schema.sql, record exactly what is filtered,
# and build a local-only restore copy with only those ownership statements
# commented out. Baseline fingerprints below still validate application schema.
grep -hE '^[[:space:]]*ALTER .* OWNER TO "?supabase_admin"?;[[:space:]]*$' \
  "$BACKUP_DIR/schema.sql" "$BACKUP_DIR/migration-schema.sql" > "$EVIDENCE_DIR/filtered-supabase-admin-owner-lines.txt" || true

awk '
  /^[[:space:]]*ALTER .* OWNER TO "?supabase_admin"?;[[:space:]]*$/ {
    print "-- KOL disposable restore filtered reserved owner statement: " $0
    next
  }
  { print }
' "$BACKUP_DIR/schema.sql" "$BACKUP_DIR/migration-schema.sql" > "$EVIDENCE_DIR/schema-local-restore.sql"

[[ -s "$EVIDENCE_DIR/schema-local-restore.sql" ]] || fail "local restore schema copy was not created"

# The role dump remains checksum-protected in the recovery artifact, but for a
# pre-provisioned local Supabase target we restore the sanitized schema + data
# only. Managed roles are validated above and are intentionally not
# ALTERed/recreated.
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --command 'ALTER TABLE supabase_migrations.schema_migrations DROP CONSTRAINT IF EXISTS schema_migrations_pkey' \
  --file "$EVIDENCE_DIR/schema-local-restore.sql" \
  --command 'SET session_replication_role = replica' \
  --command 'TRUNCATE TABLE supabase_migrations.schema_migrations' \
  --file "$BACKUP_DIR/migration-data.sql" \
  --file "$EVIDENCE_DIR/data-local-restore.sql" \
  --dbname "$KOL_RESTORE_DATABASE_URL" \
  > "$EVIDENCE_DIR/restore.log" 2>&1 || {
    tail -n 80 "$EVIDENCE_DIR/restore.log" >&2 || true
    fail "restore failed; target transaction was aborted"
  }

# The hosted migration-schema dump re-creates the migration ledger primary
# key. A fresh local Supabase already has that constraint; drop only its
# disposable copy inside the same atomic transaction. Never touch source DB.
restored_ledger_constraints="$(psql "$KOL_RESTORE_DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc "select count(*) from pg_constraint where conrelid='supabase_migrations.schema_migrations'::regclass and conname in ('schema_migrations_pkey','schema_migrations_idempotency_key_key')")"
[[ "$restored_ledger_constraints" == "2" ]] || fail "restored migration ledger primary/unique constraints are missing"

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
printf 'supabase_admin_owner_statements_filtered=%s\n' "$(wc -l < "$EVIDENCE_DIR/filtered-supabase-admin-owner-lines.txt" | tr -d ' ')" >> "$EVIDENCE_DIR/result.txt"
printf 'storage_object_bytes_restored=false\n' >> "$EVIDENCE_DIR/result.txt"
printf 'oauth_copy_compat=%s\n' "$(cat "$EVIDENCE_DIR/oauth-copy-compat.txt")" >> "$EVIDENCE_DIR/result.txt"

(
  cd "$EVIDENCE_DIR"
  for artifact in target-extensions-before.tsv source-extension-names.txt target-extension-names.txt missing-extensions.txt required-managed-role-names.txt target-managed-role-names.txt missing-managed-roles.txt target-managed-copy-columns.tsv oauth-copy-compat.txt data-local-restore.sql filtered-supabase-admin-owner-lines.txt schema-local-restore.sql restore.log restore-baseline.tsv baseline.diff target-extensions-after.tsv result.txt; do
    [[ -e "$artifact" ]] && sha256_file "$artifact"
  done
) > "$EVIDENCE_DIR/SHA256SUMS"
chmod 600 "$EVIDENCE_DIR"/*

printf 'RESTORE REHEARSAL PASS: schema fingerprints and critical application/Auth/Storage metadata counts match the source backup baseline.\n'
printf 'Evidence: %s\n' "$EVIDENCE_DIR"
printf 'Target remains isolated; do not reuse it as production. Storage object bytes require separate recovery validation.\n'
