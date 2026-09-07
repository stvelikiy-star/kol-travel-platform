-- KÖL / kol-travel-platform
-- CLIENT SUPPORT RUNTIME — DRAFT / NOT APPLIED
-- Prepared: 2026-09-07
--
-- Scope:
-- - authenticated active Client creates a support ticket + first public message atomically;
-- - optional related order/booking must belong to the caller and cannot both be set;
-- - priority is server-owned and starts as `medium`;
-- - status is server-owned and starts as `open`;
-- - request id is payload-bound and idempotent;
-- - accepted creation writes immutable audit evidence;
-- - direct authenticated support INSERT/UPDATE/DELETE is closed; writes are RPC-only;
-- - Admin continues to read the queue through existing RLS.
--
-- Explicitly excluded:
-- - Admin status/reply workflow;
-- - external CRM/messenger delivery;
-- - payment/refund/cancellation mutation;
-- - live/production apply.

begin;

create schema if not exists private;

-- Move support mutation authority behind one audited transactional RPC.
drop policy if exists "users create own support tickets" on public.support_tickets;
drop policy if exists "users create own ticket messages" on public.ticket_messages;

revoke insert, update, delete on table public.support_tickets from anon, authenticated;
revoke insert, update, delete on table public.ticket_messages from anon, authenticated;

create index if not exists idx_audit_client_support_request
  on public.audit_logs (actor_id, action, request_id)
  where action = 'client_support_ticket_created';

create or replace function private.client_support_ticket_create_atomic_internal(
  p_category text,
  p_title text,
  p_message text,
  p_request_id text,
  p_related_order_id uuid default null,
  p_related_booking_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_category text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_category, '')));
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_ticket_id uuid;
  v_existing_after jsonb;
  v_message_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_message, '')));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_support_not_authorized' using errcode = '42501';
  end if;

  if v_category !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'invalid_support_category' using errcode = '22023';
  end if;
  if length(v_title) < 3 or length(v_title) > 160 then
    raise exception 'invalid_support_title' using errcode = '22023';
  end if;
  if length(v_message) < 3 or length(v_message) > 4000 then
    raise exception 'invalid_support_message' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if p_related_order_id is not null and p_related_booking_id is not null then
    raise exception 'support_reference_ambiguous' using errcode = '22023';
  end if;

  if p_related_order_id is not null and not exists (
    select 1 from public.orders o
    where o.id = p_related_order_id and o.client_id = v_actor
  ) then
    raise exception 'support_order_not_available' using errcode = '42501';
  end if;

  if p_related_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_related_booking_id and b.client_id = v_actor
  ) then
    raise exception 'support_booking_not_available' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.entity_id, al.after
    into v_ticket_id, v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_support_ticket_created'
    and al.entity_type = 'support_tickets'
    and al.request_id = v_request_id
  limit 1;

  if v_ticket_id is not null then
    if coalesce(v_existing_after ->> 'category', '') <> v_category
       or coalesce(v_existing_after ->> 'title', '') <> v_title
       or coalesce(v_existing_after ->> 'message_md5', '') <> v_message_md5
       or coalesce(v_existing_after ->> 'message_length', '') <> length(v_message)::text
       or coalesce(v_existing_after ->> 'related_order_id', '') <> coalesce(p_related_order_id::text, '')
       or coalesce(v_existing_after ->> 'related_booking_id', '') <> coalesce(p_related_booking_id::text, '') then
      raise exception 'support_request_id_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', v_ticket_id,
      'status', coalesce(v_existing_after ->> 'status', 'open'),
      'idempotent', true
    );
  end if;

  insert into public.support_tickets (
    created_by,
    related_order_id,
    related_booking_id,
    category,
    priority,
    status,
    title
  ) values (
    v_actor,
    p_related_order_id,
    p_related_booking_id,
    v_category,
    'medium',
    'open',
    v_title
  ) returning id into v_ticket_id;

  insert into public.ticket_messages (
    ticket_id,
    sender_id,
    message,
    visibility
  ) values (
    v_ticket_id,
    v_actor,
    v_message,
    'public'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    'client',
    'client_support_ticket_created',
    'support_tickets',
    v_ticket_id,
    null,
    pg_catalog.jsonb_build_object(
      'category', v_category,
      'title', v_title,
      'message_md5', v_message_md5,
      'message_length', length(v_message),
      'related_order_id', p_related_order_id,
      'related_booking_id', p_related_booking_id,
      'priority', 'medium',
      'status', 'open'
    ),
    'Client support ticket and initial message created atomically.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ticket_id', v_ticket_id,
    'status', 'open',
    'idempotent', false
  );
end;
$$;

revoke all on function private.client_support_ticket_create_atomic_internal(text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_support_ticket_create_atomic_internal(text,text,text,text,uuid,uuid) to authenticated;

create or replace function public.client_support_ticket_create_atomic(
  p_category text,
  p_title text,
  p_message text,
  p_request_id text,
  p_related_order_id uuid default null,
  p_related_booking_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.client_support_ticket_create_atomic_internal(
    p_category,
    p_title,
    p_message,
    p_request_id,
    p_related_order_id,
    p_related_booking_id
  );
$$;

revoke all on function public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid) from public, anon;
grant execute on function public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid) to authenticated;

comment on function public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid) is
  'Authenticated Client support entrypoint. Identity, ownership, priority/status, idempotency and audit are DB-authoritative.';

commit;