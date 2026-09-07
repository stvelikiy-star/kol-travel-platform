-- KÖL / kol-travel-platform
-- ADMIN SUPPORT LIFECYCLE — DRAFT / NOT APPLIED
-- Prepared: 2026-09-07
--
-- Scope:
-- - active support_admin or super_admin may reply to an existing support ticket;
-- - active support_admin or super_admin may move ticket status through the verified
--   linear lifecycle open -> in_progress -> resolved -> closed;
-- - replies are public ticket_messages and remain visible to the ticket owner through RLS;
-- - closed tickets reject further replies and status mutation;
-- - request id is payload-bound and idempotent per actor;
-- - every accepted mutation writes immutable audit evidence;
-- - direct table mutation remains closed; writes are RPC-only.
--
-- Explicitly excluded:
-- - reopen/escalated/rejected flows;
-- - assignment/SLA automation;
-- - external CRM/messenger delivery;
-- - payment/refund/cancellation mutation;
-- - live/production apply.

begin;

create schema if not exists private;

create index if not exists idx_audit_admin_support_request
  on public.audit_logs (actor_id, action, request_id)
  where action in ('admin_support_reply','admin_support_status_changed');

create or replace function private.admin_support_lifecycle_atomic_internal(
  p_ticket_id uuid,
  p_action text,
  p_request_id text,
  p_message text default null,
  p_status text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, '')));
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_current_status text;
  v_audit_action text;
  v_existing_after jsonb;
  v_existing_entity uuid;
  v_message_id uuid;
  v_message_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_message, '')));
  v_reason_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_reason, '')));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select ur.role
    into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor
    and ur.is_active = true
    and ur.role in ('support_admin','super_admin')
  order by case ur.role when 'super_admin' then 1 else 2 end
  limit 1;

  if v_actor_role is null then
    raise exception 'admin_support_not_authorized' using errcode = '42501';
  end if;

  if p_ticket_id is null then
    raise exception 'invalid_support_ticket_id' using errcode = '22023';
  end if;
  if v_action not in ('reply','status') then
    raise exception 'invalid_support_admin_action' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_action = 'reply' then
    if length(v_message) < 3 or length(v_message) > 4000 then
      raise exception 'invalid_support_reply' using errcode = '22023';
    end if;
    if v_status <> '' or v_reason <> '' then
      raise exception 'support_reply_payload_ambiguous' using errcode = '22023';
    end if;
    v_audit_action := 'admin_support_reply';
  else
    if v_status not in ('in_progress','resolved','closed') then
      raise exception 'invalid_support_status' using errcode = '22023';
    end if;
    if length(v_reason) < 3 or length(v_reason) > 500 then
      raise exception 'support_status_reason_required' using errcode = '22023';
    end if;
    if v_message <> '' then
      raise exception 'support_status_payload_ambiguous' using errcode = '22023';
    end if;
    v_audit_action := 'admin_support_status_changed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.entity_id, al.after
    into v_existing_entity, v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = v_audit_action
    and al.entity_type = 'support_tickets'
    and al.request_id = v_request_id
  limit 1;

  if v_existing_entity is not null then
    if v_existing_entity <> p_ticket_id
       or coalesce(v_existing_after ->> 'action', '') <> v_action then
      raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
    end if;

    if v_action = 'reply' then
      if coalesce(v_existing_after ->> 'message_md5', '') <> v_message_md5
         or coalesce(v_existing_after ->> 'message_length', '') <> length(v_message)::text then
        raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
      end if;
    else
      if coalesce(v_existing_after ->> 'status', '') <> v_status
         or coalesce(v_existing_after ->> 'reason_md5', '') <> v_reason_md5
         or coalesce(v_existing_after ->> 'reason_length', '') <> length(v_reason)::text then
        raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
      end if;
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', v_existing_entity,
      'status', coalesce(v_existing_after ->> 'status', ''),
      'message_id', nullif(v_existing_after ->> 'message_id', '')::uuid,
      'idempotent', true
    );
  end if;

  select st.status
    into v_current_status
  from public.support_tickets st
  where st.id = p_ticket_id
  for update;

  if v_current_status is null then
    raise exception 'support_ticket_not_found' using errcode = 'P0002';
  end if;

  if v_action = 'reply' then
    if v_current_status = 'closed' then
      raise exception 'closed_support_ticket_is_immutable' using errcode = '22023';
    end if;

    insert into public.ticket_messages (
      ticket_id,
      sender_id,
      message,
      visibility
    ) values (
      p_ticket_id,
      v_actor,
      v_message,
      'public'
    ) returning id into v_message_id;

    update public.support_tickets
    set updated_at = pg_catalog.now()
    where id = p_ticket_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_actor,
      v_actor_role,
      v_audit_action,
      'support_tickets',
      p_ticket_id,
      pg_catalog.jsonb_build_object('status', v_current_status),
      pg_catalog.jsonb_build_object(
        'action', 'reply',
        'status', v_current_status,
        'message_id', v_message_id,
        'message_md5', v_message_md5,
        'message_length', length(v_message)
      ),
      'Support administrator public reply created atomically.',
      v_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', p_ticket_id,
      'status', v_current_status,
      'message_id', v_message_id,
      'idempotent', false
    );
  end if;

  if v_current_status = 'closed' then
    raise exception 'closed_support_ticket_is_immutable' using errcode = '22023';
  end if;

  if not (
    (v_current_status = 'open' and v_status = 'in_progress')
    or (v_current_status = 'in_progress' and v_status = 'resolved')
    or (v_current_status = 'resolved' and v_status = 'closed')
  ) then
    raise exception 'invalid_support_status_transition' using errcode = '22023';
  end if;

  update public.support_tickets
  set status = v_status,
      updated_at = pg_catalog.now()
  where id = p_ticket_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_actor,
    v_actor_role,
    v_audit_action,
    'support_tickets',
    p_ticket_id,
    pg_catalog.jsonb_build_object('status', v_current_status),
    pg_catalog.jsonb_build_object(
      'action', 'status',
      'status', v_status,
      'previous_status', v_current_status,
      'reason_md5', v_reason_md5,
      'reason_length', length(v_reason)
    ),
    v_reason,
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'status', v_status,
    'message_id', null,
    'idempotent', false
  );
end;
$$;

revoke all on function private.admin_support_lifecycle_atomic_internal(uuid,text,text,text,text,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_support_lifecycle_atomic_internal(uuid,text,text,text,text,text) to authenticated;

create or replace function public.admin_support_lifecycle_atomic(
  p_ticket_id uuid,
  p_action text,
  p_request_id text,
  p_message text default null,
  p_status text default null,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_support_lifecycle_atomic_internal(
    p_ticket_id,
    p_action,
    p_request_id,
    p_message,
    p_status,
    p_reason
  );
$$;

revoke all on function public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text) to authenticated;

comment on function public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text) is
  'Support Admin/Super Admin audited reply/status entrypoint. Role, lifecycle, idempotency and audit are DB-authoritative.';

commit;