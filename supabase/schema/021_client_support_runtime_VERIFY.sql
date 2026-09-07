-- KÖL / kol-travel-platform
-- CLIENT SUPPORT RUNTIME — VERIFY / READ-ONLY
-- This file performs assertions only and must not mutate schema or data.

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
    and p.proname = 'client_support_ticket_create_atomic'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_category text, p_title text, p_message text, p_request_id text, p_related_order_id uuid, p_related_booking_id uuid';
  if v_count <> 1 then
    raise exception 'client_support_verify_failed: public support RPC missing or ambiguous (% rows)', v_count;
  end if;
  if v_public_security_definer is distinct from false then
    raise exception 'client_support_verify_failed: public support RPC must remain SECURITY INVOKER';
  end if;

  select pg_catalog.pg_get_functiondef(p.oid) into v_def
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'client_support_ticket_create_atomic_internal'
  limit 1;
  if v_def is null
     or v_def not ilike '%SECURITY DEFINER%'
     or v_def not ilike '%ur.role = ''client''%'
     or v_def not ilike '%o.client_id = v_actor%'
     or v_def not ilike '%b.client_id = v_actor%'
     or v_def not ilike '%pg_advisory_xact_lock%'
     or v_def not ilike '%client_support_ticket_created%'
     or v_def not ilike '%support_request_id_payload_conflict%' then
    raise exception 'client_support_verify_failed: internal RPC lost auth/ownership/idempotency/audit guards';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'client_support_verify_failed: anon may execute support RPC';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid)', 'EXECUTE') then
    raise exception 'client_support_verify_failed: authenticated lacks support RPC execute';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.support_tickets', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.support_tickets', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.support_tickets', 'DELETE') then
    raise exception 'client_support_verify_failed: authenticated retains direct support_tickets mutation';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.ticket_messages', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.ticket_messages', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.ticket_messages', 'DELETE') then
    raise exception 'client_support_verify_failed: authenticated retains direct ticket_messages mutation';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('support_tickets','ticket_messages')
    and cmd in ('INSERT','UPDATE','DELETE');
  if v_count <> 0 then
    raise exception 'client_support_verify_failed: direct support mutation RLS policies remain (% rows)', v_count;
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'support_tickets'
    and cmd = 'SELECT';
  if v_count < 1 then
    raise exception 'client_support_verify_failed: support_tickets read RLS missing';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'ticket_messages'
    and cmd = 'SELECT';
  if v_count < 1 then
    raise exception 'client_support_verify_failed: ticket_messages read RLS missing';
  end if;
END
$$;

select n.nspname as schema_name,
       p.proname,
       p.prosecdef as security_definer,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.proname in ('client_support_ticket_create_atomic','client_support_ticket_create_atomic_internal')
order by n.nspname, p.proname;