-- KÖL / ADMIN CATALOG GOVERNANCE verification
-- READ-ONLY. Run after 020 on isolated staging/restored database.

-- 1. Category lifecycle column and constraint.
select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='categories' and column_name='status';

select conname,pg_catalog.pg_get_constraintdef(oid) as definition
from pg_catalog.pg_constraint
where conrelid='public.categories'::regclass and conname='categories_status_valid';

-- 2. Category public/admin read policies.
select policyname,roles,cmd,qual
from pg_policies
where schemaname='public' and tablename='categories'
order by policyname;

-- 3. Direct DML must remain absent for anon/authenticated.
select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name in ('categories','menu_items','tours','stays','products')
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by grantee,table_name,privilege_type;
-- Expected: zero rows.

-- 4. Public governance functions exist and are security invoker.
select n.nspname as schema_name,p.proname,p.prosecdef,pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('admin_catalog_governance_atomic','admin_catalog_category_atomic')
order by p.proname;
-- Expected prosecdef=false for both public wrappers.

-- 5. Private implementations exist and are security definer.
select n.nspname as schema_name,p.proname,p.prosecdef,pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
  and p.proname in ('admin_catalog_governance_atomic_internal','admin_catalog_category_atomic_internal')
order by p.proname;
-- Expected prosecdef=true for both.

-- 6. Only authenticated may execute public governance wrappers.
select routine_schema,routine_name,grantee,privilege_type
from information_schema.role_routine_grants
where routine_schema='public'
  and routine_name in ('admin_catalog_governance_atomic','admin_catalog_category_atomic')
order by routine_name,grantee;
-- Expected authenticated EXECUTE; no anon/PUBLIC EXECUTE.

-- 7. Governance audit actions are represented in the implementation source.
select p.proname,
       pg_catalog.pg_get_functiondef(p.oid) like '%admin_catalog_publish%' as has_publish_audit,
       pg_catalog.pg_get_functiondef(p.oid) like '%admin_catalog_unpublish%' as has_unpublish_audit,
       pg_catalog.pg_get_functiondef(p.oid) like '%admin_catalog_archive%' as has_archive_audit,
       pg_catalog.pg_get_functiondef(p.oid) like '%admin_category_%' as has_category_audit,
       pg_catalog.pg_get_functiondef(p.oid) like '%alcohol_%blocked%' as alcohol_fail_closed
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
  and p.proname in ('admin_catalog_governance_atomic_internal','admin_catalog_category_atomic_internal')
order by p.proname;

-- 8. No production/finance mutation should be present in the two implementations.
select p.proname,
       pg_catalog.pg_get_functiondef(p.oid) ~* 'update[[:space:]]+public\\.(orders|bookings|payments|deliveries)' as forbidden_finance_or_ops_update
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
  and p.proname in ('admin_catalog_governance_atomic_internal','admin_catalog_category_atomic_internal')
order by p.proname;
-- Expected false for both.
