-- KÖL STAGING PRE-FLIGHT — READ ONLY
-- Run only against a dedicated staging target before any 005→012b apply.
-- This file performs no DDL/DML and intentionally does not mutate migration history.

with baseline as (
  select
    (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')::int as public_tables,
    (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity)::int as rls_enabled,
    (select count(*) from pg_policies where schemaname = 'public')::int as policies,
    (
      select count(*)::int
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relrowsecurity
        and not exists (
          select 1 from pg_policies p
          where p.schemaname = 'public' and p.tablename = c.relname
        )
    ) as rls_tables_zero_policies,
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')::int as public_functions,
    (select count(*) from pg_indexes where schemaname = 'public')::int as public_indexes,
    (select count(*) from public.payments)::int as payments_rows,
    (select count(*) from storage.buckets)::int as storage_buckets,
    (select count(*) from storage.objects)::int as storage_objects,
    (to_regclass('supabase_migrations.schema_migrations') is not null) as migration_ledger_exists
)
select jsonb_build_object(
  'public_tables', public_tables,
  'rls_enabled', rls_enabled,
  'policies', policies,
  'rls_tables_zero_policies', rls_tables_zero_policies,
  'public_functions', public_functions,
  'public_indexes', public_indexes,
  'payments_rows', payments_rows,
  'storage_buckets', storage_buckets,
  'storage_objects', storage_objects,
  'migration_ledger_exists', migration_ledger_exists,
  'matches_recovered_schema_shape', public_tables = 54 and rls_enabled = 54 and public_functions = 6 and public_indexes = 99
) as staging_preflight
from baseline;

-- Stage 21 / 004 remains deliberately excluded from this rollout.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('menu_items','slug'),
    ('products','slug'),
    ('tours','image_url'),
    ('stays','capacity')
  )
order by table_name, column_name;
-- Expected before this rollout: 0 rows. Any row means schema drift; stop and review.

-- Confirm the two known legacy recursion-risk policies still exist before 005.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and (
    (tablename = 'user_roles' and policyname = 'admins read roles')
    or (tablename = 'partner_staff' and policyname = 'partners read own staff')
  )
order by tablename, policyname;

-- Show current helper search_path state; 005 must harden these functions.
select p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_updated_at','has_role','is_admin','is_finance_admin','is_partner_for','is_assigned_courier')
order by p.proname;

-- Browser/API direct-write surface that later migrations are expected to close.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
  and table_name in (
    'bookings','booking_status_history','orders','order_items','order_status_history',
    'payments','order_payments','deliveries','order_delivery','courier_assignments','delivery_status_history','audit_logs'
  )
order by table_name, grantee, privilege_type;

-- STOP CONDITIONS before any apply:
-- 1. target is not dedicated staging;
-- 2. schema-shape check is false without an explained/accepted reason;
-- 3. any Stage 21/004 column is already present unexpectedly;
-- 4. target contains real production payment/customer traffic;
-- 5. backup/baseline/rollback gate has not been accepted.

-- KÖL 2026-10-25: additive drift diagnostics for the EXISTING managed staging DB.
-- The historical exact-shape gate above is deliberately NOT relaxed here.
-- Actual observed shape: 54 tables / 54 RLS / 10 public functions / 151 indexes.
-- Four additional functions were identified as existing onboarding/booking/support RPCs.
-- A false exact-shape result is a STOP for unreviewed migration apply, not proof of damage.
-- These read-only queries identify the drift without creating resources or modifying data.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname, arguments;

-- FK leading-index coverage is a stronger actionable check than comparing raw
-- index counts to an old snapshot. For single-column FKs, expect missing_count=0.
with fk as (
  select con.conrelid, con.conname, con.conkey[1] as attnum
  from pg_constraint con
  where con.connamespace = 'public'::regnamespace
    and con.contype = 'f' and cardinality(con.conkey) = 1
), missing as (
  select fk.* from fk
  where not exists (
    select 1 from pg_index i
    where i.indrelid = fk.conrelid and i.indisvalid and i.indisready
      and i.indkey[0] = fk.attnum
  )
)
select count(*)::int as missing_count from missing;

-- Verify all six original helper functions have a pinned search_path.
select p.proname,
  exists (
    select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
    where cfg like 'search_path=%'
  ) as fixed_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_updated_at', 'has_role', 'is_admin', 'is_finance_admin',
    'is_partner_for', 'is_assigned_courier'
  )
order by p.proname;
-- 2026-10-25 read-only results: missing_count=0; six of six fixed_search_path=true.
-- This does NOT certify RLS role isolation, backup/restore, or deployment readiness.


-- 2026-10-28 managed-staging drift classification, READ ONLY.
-- The historic 6-function / 99-index gate remains unchanged above. Do not
-- interpret matching the observed 10 / 151 counts as authorization to apply.
-- Check identities and structural integrity before an operator accepts drift.
with known_functions(name) as (
  values ('set_updated_at'), ('has_role'), ('is_admin'),
         ('is_finance_admin'), ('is_partner_for'), ('is_assigned_courier'),
         ('admin_support_lifecycle_atomic'),
         ('client_onboarding_complete_atomic'),
         ('client_stay_booking_create_atomic'),
         ('client_support_ticket_create_atomic')
), actual_functions as (
  select p.proname as name, p.oid, p.prosecdef,
         exists (
           select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           where cfg like 'search_path=%'
         ) as fixed_search_path
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
), index_health as (
  select count(*)::int as total,
         count(*) filter (where not i.indisvalid or not i.indisready)::int as unusable
  from pg_index i
  join pg_class t on t.oid = i.indrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
)
select jsonb_build_object(
  'known_functions_present', (select count(*) from actual_functions a join known_functions k using (name)),
  'extra_function_names', (select coalesce(jsonb_agg(name order by name), '[]'::jsonb)
                           from actual_functions a where not exists (select 1 from known_functions k where k.name = a.name)),
  'unexpected_security_definers', (select count(*) from actual_functions where prosecdef),
  'functions_missing_search_path', (select count(*) from actual_functions where not fixed_search_path),
  'public_indexes', index_health.total,
  'unusable_public_indexes', index_health.unusable,
  'known_managed_staging_shape_only_not_release_approval',
    (select count(*) from actual_functions) = 10
    and (select count(*) from actual_functions a join known_functions k using (name)) = 10
    and (select count(*) from actual_functions where prosecdef) = 0
    and (select count(*) from actual_functions where not fixed_search_path) = 0
    and index_health.total = 151 and index_health.unusable = 0
) as managed_staging_drift_diagnostic
from index_health;
-- STOP until migration-ledger overlaps, policy/ACL diffs, isolated rehearsals,
-- original Auth/Storage metadata and rollback have been independently accepted.
