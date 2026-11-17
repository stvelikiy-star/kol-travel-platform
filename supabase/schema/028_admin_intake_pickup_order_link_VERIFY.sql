-- Execute only after 028 on disposable staging. No production writes.
do $$
declare
  v_oid oid;
  v_missing integer;
  v_bad_priv integer;
begin
  v_oid := pg_catalog.to_regprocedure(
    'public.admin_link_intake_pickup_order_atomic(uuid,uuid,text)');
  if v_oid is null then
    raise exception 'P0 intake order link RPC missing';
  end if;
  select count(*) into v_missing from pg_catalog.pg_indexes
    where schemaname='public' and tablename='support_tickets'
      and indexname='uq_kol_intake_order_link';
  if v_missing <> 1 then
    raise exception 'P0 intake order link unique index missing';
  end if;
  if pg_catalog.has_function_privilege('anon',v_oid,'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated',v_oid,'EXECUTE') then
    raise exception 'P0 intake order link ACL mismatch';
  end if;
  select count(*) into v_bad_priv
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in ('orders','support_tickets')
    and not c.relrowsecurity;
  if v_bad_priv <> 0 then
    raise exception 'P0 intake order link requires RLS on orders and tickets';
  end if;
  if not pg_catalog.pg_get_functiondef(v_oid) like '%intake_delivery_not_configured%' then
    raise exception 'P0 pickup-only fail-closed guard absent';
  end if;
  raise notice 'KOL_INTAKE_ORDER_LINK_SCHEMA_PASS';
end;
$$;
