-- KÖL / CATALOG ACTIVE CATEGORY GUARD verification
-- READ-ONLY. Run after 020a on isolated staging/restored database.

-- 1. Guard function exists, is security definer, and is not exposed to API roles.
select n.nspname as schema_name,p.proname,p.prosecdef,pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='enforce_active_catalog_category';

select routine_schema,routine_name,grantee,privilege_type
from information_schema.role_routine_grants
where routine_schema='private'
  and routine_name='enforce_active_catalog_category'
  and grantee in ('PUBLIC','anon','authenticated')
order by grantee;
-- Expected: zero rows.

-- 2. All four catalog tables have the active-category trigger.
select event_object_table,trigger_name,event_manipulation,action_timing
from information_schema.triggers
where trigger_schema='public'
  and trigger_name in (
    'trg_menu_items_active_category',
    'trg_tours_active_category',
    'trg_stays_active_category',
    'trg_products_active_category'
  )
order by event_object_table,event_manipulation;

-- 3. Function source contains active + domain-scope fail-closed checks.
select
  pg_catalog.pg_get_functiondef(p.oid) like '%catalog_category_not_active%' as has_active_guard,
  pg_catalog.pg_get_functiondef(p.oid) like '%catalog_category_scope_mismatch%' as has_scope_guard,
  pg_catalog.pg_get_functiondef(p.oid) like '%menu_items%food%' as has_food_scope,
  pg_catalog.pg_get_functiondef(p.oid) like '%products%shop%' as has_shop_scope
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='enforce_active_catalog_category';
