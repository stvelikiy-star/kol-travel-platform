-- KÖL STAGING FINAL DATA API PRIVILEGE ASSERTION — VERIFY / READ-ONLY
-- Runs after 012b. It performs no data/schema mutation; it only raises on drift.

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
    raise exception 'postflight_api_acl_failed: anon has % non-SELECT public table grants', v_count;
  end if;

  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type = 'SELECT'
    and table_name not in (
      'partners','categories','tours','stays',
      'menu_items','products','restaurants','shops'
    );
  if v_count <> 0 then
    raise exception 'postflight_api_acl_failed: anon SELECT outside catalog allowlist (% rows)', v_count;
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
    raise exception 'postflight_api_acl_failed: % required anon catalog SELECT grants are missing', v_count;
  end if;

  select count(*) into v_count
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
  if v_count <> 0 then
    raise exception 'postflight_api_acl_failed: authenticated retains % unsafe public table grants', v_count;
  end if;
END
$$;

select table_name, string_agg(privilege_type, ',' order by privilege_type) as anon_privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon'
group by table_name
order by table_name;
