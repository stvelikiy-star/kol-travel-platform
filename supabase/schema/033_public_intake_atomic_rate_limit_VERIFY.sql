-- VERIFY: run only against disposable restored local database after DRAFT migration.
do $$
declare
  v_oid oid;
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='kol_public_intake_atomic';
  if v_oid is null then raise exception 'intake RPC missing'; end if;
  if has_function_privilege('anon',v_oid,'EXECUTE')
      or has_function_privilege('authenticated',v_oid,'EXECUTE')
      or not has_function_privilege('service_role',v_oid,'EXECUTE') then
    raise exception 'intake RPC privilege gate failed';
  end if;
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='support_tickets'
      and column_name='request_payload' and data_type='jsonb') then
    raise exception 'intake request_payload prerequisite missing';
  end if;
end $$;
