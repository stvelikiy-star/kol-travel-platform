-- Read-only verification for Partner Stop runtime.
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
  select relrowsecurity into v_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='partner_stop_statuses';
  if v_rls is distinct from true then raise exception 'partner_stop_rls_missing'; end if;

  select has_table_privilege('anon','public.partner_stop_statuses','SELECT'),
         has_table_privilege('authenticated','public.partner_stop_statuses','SELECT')
    into v_anon_table, v_auth_select;
  if v_anon_table or not v_auth_select then raise exception 'partner_stop_table_acl_failed'; end if;

  select has_function_privilege('anon','public.partner_stop_action_atomic(text,text,text,text,timestamptz)','EXECUTE'),
         has_function_privilege('authenticated','public.partner_stop_action_atomic(text,text,text,text,timestamptz)','EXECUTE')
    into v_anon_rpc, v_auth_rpc;
  if v_anon_rpc or not v_auth_rpc then raise exception 'partner_stop_rpc_acl_failed'; end if;

  select p.prosecdef into v_public_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='partner_stop_action_atomic';
  select p.prosecdef into v_private_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='partner_stop_action_atomic_internal';
  if v_public_definer is distinct from false or v_private_definer is distinct from true then
    raise exception 'partner_stop_function_security_contract_failed';
  end if;

  select count(*) into v_trigger_count from pg_trigger t join pg_class c on c.oid=t.tgrelid
  where not t.tgisinternal and t.tgname in ('reject_paused_partner_orders','reject_paused_partner_bookings')
    and c.relname in ('orders','bookings');
  if v_trigger_count <> 2 then raise exception 'partner_stop_demand_guards_missing'; end if;
end $$;

select business_id, scope_type, is_paused, resume_at, updated_at
from public.partner_stop_statuses order by business_id, scope_type;
