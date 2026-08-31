-- KÖL / kol-travel-platform
-- VERIFY 006f — READ-ONLY / FAIL-CLOSED

DO $$
DECLARE
  v_count integer;
BEGIN
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_count <> 0 then
    raise exception '006f verification failed: % public base tables do not have RLS enabled', v_count;
  end if;

  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not has_table_privilege('authenticated', c.oid, 'SELECT');

  if v_count <> 0 then
    raise exception '006f verification failed: % RLS public tables are missing authenticated SELECT', v_count;
  end if;

  select count(*) into v_count
  from information_schema.role_table_grants g
  join pg_class c on c.relname = g.table_name
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = g.table_schema
  where g.table_schema = 'public'
    and g.grantee = 'authenticated'
    and g.privilege_type = 'SELECT'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_count <> 0 then
    raise exception '006f verification failed: authenticated SELECT reaches % non-RLS public base tables', v_count;
  end if;
END
$$;

select
  count(*) filter (where c.relrowsecurity) as rls_public_tables,
  count(*) filter (where c.relrowsecurity and has_table_privilege('authenticated', c.oid, 'SELECT')) as authenticated_select_rls_tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r';
