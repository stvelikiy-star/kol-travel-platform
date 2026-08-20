-- KÖL security hardening verification
-- READ-ONLY. Intended to run after 005_security_hardening_DRAFT_NOT_APPLIED.sql
-- is applied to a staging/restored database.

-- 1. Function search_path must be explicitly fixed.
select
  p.proname,
  p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'has_role',
    'is_admin',
    'is_finance_admin',
    'is_partner_for',
    'is_assigned_courier',
    'set_updated_at'
  )
order by p.proname;

-- Expected: every row has proconfig containing search_path="" (rendering may vary).

-- 2. Recursive base policies must be gone.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_roles', 'partner_staff')
order by tablename, policyname;

-- Expected:
-- user_roles: "users read own roles" -> user_id = (select auth.uid())
-- partner_staff: own-row predicate plus is_admin(); no is_partner_for() predicate.

-- 3. Public catalog policy scopes.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('partners', 'categories', 'tours', 'stays', 'menu_items', 'products')
order by tablename, policyname;

-- Expected:
-- - anon SELECT policies contain only public active/approved predicates;
-- - authenticated SELECT policies may call ownership/admin helpers;
-- - partner mutations are scoped to authenticated and are not FOR ALL policies.

-- 4. Explicit anon Data API grants.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
  and table_name in ('partners', 'categories', 'tours', 'stays', 'menu_items', 'products')
order by table_name, privilege_type;

-- Expected: SELECT only for each listed table from this patch.

-- 5. No migration-side effect on business records.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.payments) as payment_rows,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from storage.objects) as storage_objects;

-- The migration is security metadata only. Counts must not change because of it.

-- 6. Advisor-oriented counts.
select
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as public_tables,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity) as rls_enabled_tables,
  (select count(*) from pg_policies where schemaname='public') as rls_policies,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)) as rls_tables_without_policies;

-- Note: this patch intentionally does not solve all 26 no-policy tables.
-- A later policy-completion migration must reduce rls_tables_without_policies.
