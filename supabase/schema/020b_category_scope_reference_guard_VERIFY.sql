-- KÖL / CATEGORY SCOPE REFERENCE GUARD verification
-- READ-ONLY. Run after 020b on isolated staging/restored database.

select n.nspname as schema_name,p.proname,p.prosecdef,pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='guard_category_scope_change';

select event_object_table,trigger_name,event_manipulation,action_timing
from information_schema.triggers
where trigger_schema='public' and trigger_name='trg_categories_scope_reference_guard';

select
  pg_catalog.pg_get_functiondef(p.oid) like '%category_scope_change_blocked_by_catalog_references%' as has_catalog_reference_guard,
  pg_catalog.pg_get_functiondef(p.oid) like '%category_scope_change_blocked_by_active_children%' as has_child_guard,
  pg_catalog.pg_get_functiondef(p.oid) like '%status <> ''archived''%' as ignores_archived_catalog_rows
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and p.proname='guard_category_scope_change';

select routine_schema,routine_name,grantee,privilege_type
from information_schema.role_routine_grants
where routine_schema='private'
  and routine_name='guard_category_scope_change'
  and grantee in ('PUBLIC','anon','authenticated')
order by grantee;
-- Expected: zero rows.
