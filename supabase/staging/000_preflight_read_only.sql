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
