-- KÖL / kol-travel-platform
-- ADMIN SUPPORT LIFECYCLE — VERIFY / READ-ONLY
-- Assertions only; this file must not mutate schema or data.

DO $$
DECLARE
  v_count integer;
  v_def text;
  v_public_security_definer boolean;
BEGIN
  select count(*), bool_or(p.prosecdef)
    into v_count, v_public_security_definer
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_support_lifecycle_atomic'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_ticket_id uuid, p_action text, p_request_id text, p_message text, p_status text, p_reason text';
  if v_count <> 1 then
    raise exception 'admin_support_verify_failed: public lifecycle RPC missing or ambiguous (% rows)', v_count;
  end if;
  if v_public_security_definer is distinct from false then
    raise exception 'admin_support_verify_failed: public lifecycle RPC must remain SECURITY INVOKER';
  end if;

  select pg_catalog.pg_get_functiondef(p.oid) into v_def
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'admin_support_lifecycle_atomic_internal'
  limit 1;

  if v_def is null
     or v_def not ilike '%SECURITY DEFINER%'
     or v_def not ilike '%ur.role in (''support_admin'', ''super_admin'')%'
     or v_def not ilike '%pg_advisory_xact_lock%'
     or v_def not ilike '%admin_support_request_id_payload_conflict%'
     or v_def not ilike '%admin_support_reply%'
     or v_def not ilike '%admin_support_status_changed%'
     or v_def not ilike '%closed_support_ticket_is_immutable%'
     or v_def not ilike '%v_current_status = ''open'' and v_status = ''in_progress''%'
     or v_def not ilike '%v_current_status = ''in_progress'' and v_status = ''resolved''%'
     or v_def not ilike '%v_current_status = ''resolved'' and v_status = ''closed''%' then
    raise exception 'admin_support_verify_failed: internal RPC lost role/lifecycle/idempotency/audit guards';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text)', 'EXECUTE') then
    raise exception 'admin_support_verify_failed: anon may execute lifecycle RPC';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text)', 'EXECUTE') then
    raise exception 'admin_support_verify_failed: authenticated lacks lifecycle RPC execute';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.support_tickets', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.support_tickets', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.support_tickets', 'DELETE') then
    raise exception 'admin_support_verify_failed: authenticated retains direct support_tickets mutation';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.ticket_messages', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.ticket_messages', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.ticket_messages', 'DELETE') then
    raise exception 'admin_support_verify_failed: authenticated retains direct ticket_messages mutation';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('support_tickets','ticket_messages')
    and cmd in ('INSERT','UPDATE','DELETE');
  if v_count <> 0 then
    raise exception 'admin_support_verify_failed: direct support mutation RLS policies remain (% rows)', v_count;
  end if;
END
$$;

select n.nspname as schema_name,
       p.proname,
       p.prosecdef as security_definer,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.proname in ('admin_support_lifecycle_atomic','admin_support_lifecycle_atomic_internal')
order by n.nspname, p.proname;