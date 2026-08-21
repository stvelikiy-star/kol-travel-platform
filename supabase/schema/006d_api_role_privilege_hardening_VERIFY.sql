-- KÖL / kol-travel-platform
-- VERIFY 006d — READ-ONLY / FAIL-CLOSED

DO $$
DECLARE
  v_count integer;
BEGIN
  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type <> 'SELECT';

  if v_count <> 0 then
    raise exception '006d verification failed: anon has % non-SELECT public table grants', v_count;
  end if;

  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type = 'SELECT'
    and table_name not in (
      'partners', 'categories', 'tours', 'stays',
      'menu_items', 'products', 'restaurants', 'shops'
    );

  if v_count <> 0 then
    raise exception '006d verification failed: anon SELECT exists outside public catalog allowlist (% rows)', v_count;
  end if;

  select count(*) into v_count
  from (
    values
      ('partners'), ('categories'), ('tours'), ('stays'),
      ('menu_items'), ('products'), ('restaurants'), ('shops')
  ) as expected(table_name)
  where not exists (
    select 1
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.grantee = 'anon'
      and g.privilege_type = 'SELECT'
      and g.table_name = expected.table_name
  );

  if v_count <> 0 then
    raise exception '006d verification failed: % required anon catalog SELECT grants are missing', v_count;
  end if;

  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and privilege_type in ('TRUNCATE', 'REFERENCES', 'TRIGGER');

  if v_count <> 0 then
    raise exception '006d verification failed: authenticated retains % unsafe public table grants', v_count;
  end if;
END
$$;

select
  grantee,
  privilege_type,
  count(*) as table_count
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated')
group by grantee, privilege_type
order by grantee, privilege_type;

select
  table_name,
  string_agg(privilege_type, ',' order by privilege_type) as anon_privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee = 'anon'
group by table_name
order by table_name;
