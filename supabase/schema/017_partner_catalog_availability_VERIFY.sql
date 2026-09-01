-- Read-only verification for Partner Catalog availability runtime.
do $$
declare
  v_rls boolean;
  v_anon_table boolean;
  v_auth_select boolean;
  v_anon_rpc boolean;
  v_auth_rpc boolean;
  v_public_definer boolean;
  v_private_definer boolean;
  v_trigger_count integer;
begin
  select relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'partner_catalog_item_availability';
  if v_rls is distinct from true then raise exception 'partner_catalog_availability_rls_missing'; end if;

  select has_table_privilege('anon','public.partner_catalog_item_availability','SELECT'),
         has_table_privilege('authenticated','public.partner_catalog_item_availability','SELECT')
    into v_anon_table, v_auth_select;
  if v_anon_table or not v_auth_select then raise exception 'partner_catalog_availability_table_acl_failed'; end if;

  select has_function_privilege('anon','public.partner_catalog_availability_action(text,uuid,text,text,text)','EXECUTE'),
         has_function_privilege('authenticated','public.partner_catalog_availability_action(text,uuid,text,text,text)','EXECUTE')
    into v_anon_rpc, v_auth_rpc;
  if v_anon_rpc or not v_auth_rpc then raise exception 'partner_catalog_availability_rpc_acl_failed'; end if;

  select p.prosecdef into v_public_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'partner_catalog_availability_action';
  select p.prosecdef into v_private_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'partner_catalog_availability_action_internal';
  if v_public_definer is distinct from false or v_private_definer is distinct from true then
    raise exception 'partner_catalog_availability_function_security_failed';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal
    and t.tgname = 'reject_unavailable_catalog_order_items'
    and c.relname = 'order_items';
  if v_trigger_count <> 1 then raise exception 'partner_catalog_availability_guard_missing'; end if;
end $$;

select business_id, item_type, item_id, availability_state, reason, changed_at
from public.partner_catalog_item_availability
order by business_id, item_type, item_id;
