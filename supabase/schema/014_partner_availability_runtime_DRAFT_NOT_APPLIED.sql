-- KÖL / kol-travel-platform
-- PARTNER AVAILABILITY RUNTIME — DRAFT / NOT APPLIED
-- Prepared: 2026-09-01
--
-- Scope:
-- - partner may close/open an owned room availability date;
-- - partner may close/open an owned tour schedule;
-- - partner may report an availability conflict as audit evidence;
-- - status changes affect only future/new booking attempts;
-- - existing booking/payment truth and inventory counters are never rewritten;
-- - direct authenticated availability DML is closed.
--
-- Explicitly excluded:
-- - price_override mutation;
-- - room available_count mutation;
-- - tour capacity/booked_count mutation;
-- - cancellation/refund/no-show/payout policy;
-- - live/production apply.

begin;

create schema if not exists private;

-- Replace the recovered broad FOR ALL policies with read-only ownership policies.
-- Operational mutations become RPC-only.
drop policy if exists "partners manage room availability" on public.room_availability;
drop policy if exists "partners manage tour schedules" on public.tour_schedules;

create policy "partners read own room availability"
on public.room_availability for select
to authenticated
using (
  exists (
    select 1
    from public.rooms as r
    where r.id = room_availability.room_id
      and (public.is_partner_for(r.business_id) or public.is_admin())
  )
);

create policy "partners read own tour schedules"
on public.tour_schedules for select
to authenticated
using (
  exists (
    select 1
    from public.tours as t
    where t.id = tour_schedules.tour_id
      and (public.is_partner_for(t.business_id) or public.is_admin())
  )
);

revoke insert, update, delete on table public.room_availability from anon, authenticated;
revoke insert, update, delete on table public.tour_schedules from anon, authenticated;

create or replace function private.partner_availability_action_atomic_internal(
  p_scope_type text,
  p_scope_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_entity_type text;
  v_status text;
  v_target_status text;
  v_date date;
  v_parent_id uuid;
  v_available_count integer;
  v_price_override numeric;
  v_capacity integer;
  v_booked_count integer;
  v_time time;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_scope_id is null then
    raise exception 'availability_scope_id_required' using errcode = '22023';
  end if;

  if p_scope_type not in ('room_date', 'tour_schedule') then
    raise exception 'unsupported_availability_scope_type' using errcode = '22023';
  end if;

  if p_action not in ('close', 'open', 'report_conflict') then
    raise exception 'unsupported_partner_availability_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  if p_scope_type = 'room_date' then
    select r.business_id, ra.room_id, ra.date, ra.status, ra.available_count, ra.price_override
      into v_business_id, v_parent_id, v_date, v_status, v_available_count, v_price_override
    from public.room_availability as ra
    join public.rooms as r on r.id = ra.room_id
    where ra.id = p_scope_id
    for update of ra;

    if not found then
      raise exception 'room_availability_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'room_availability';
  else
    select t.business_id, ts.tour_id, ts.date, ts.time, ts.status, ts.capacity, ts.booked_count
      into v_business_id, v_parent_id, v_date, v_time, v_status, v_capacity, v_booked_count
    from public.tour_schedules as ts
    join public.tours as t on t.id = ts.tour_id
    where ts.id = p_scope_id
    for update of ts;

    if not found then
      raise exception 'tour_schedule_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'tour_schedules';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'availability_not_available_for_partner' using errcode = '42501';
  end if;

  if p_action = 'report_conflict' then
    v_audit_action := 'partner_availability_conflict_reported';

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_user_id
      and al.action = v_audit_action
      and al.entity_type = v_entity_type
      and al.entity_id = p_scope_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'scope_type', p_scope_type,
        'scope_id', p_scope_id,
        'action', p_action,
        'status', v_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_user_id,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      v_entity_type,
      p_scope_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'parent_id', v_parent_id,
        'date', v_date,
        'status', v_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'parent_id', v_parent_id,
        'date', v_date,
        'status', v_status,
        'report_only', true
      ),
      coalesce(v_reason, 'Partner reported an availability conflict for operational review.'),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'action', p_action,
      'status', v_status,
      'idempotent', false
    );
  end if;

  if v_date < current_date then
    raise exception 'availability_date_in_past' using errcode = '22023';
  end if;

  v_target_status := case p_action
    when 'close' then 'closed'
    when 'open' then 'available'
    else null
  end;

  if v_status = v_target_status then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'action', p_action,
      'status', v_status,
      'idempotent', true
    );
  end if;

  -- Opening never creates capacity. Existing authoritative counters must still
  -- show at least one unit/seat available for a new booking attempt.
  if p_action = 'open' and p_scope_type = 'room_date' and v_available_count <= 0 then
    raise exception 'room_availability_capacity_exhausted' using errcode = 'P0001';
  end if;

  if p_action = 'open' and p_scope_type = 'tour_schedule' and v_booked_count >= v_capacity then
    raise exception 'tour_schedule_capacity_exhausted' using errcode = 'P0001';
  end if;

  if p_scope_type = 'room_date' then
    update public.room_availability as ra
    set status = v_target_status
    where ra.id = p_scope_id;
  else
    update public.tour_schedules as ts
    set status = v_target_status
    where ts.id = p_scope_id;
  end if;

  v_audit_action := 'partner_availability_' || p_scope_type || '_' || p_action;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_user_id,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    v_entity_type,
    p_scope_id,
    case
      when p_scope_type = 'room_date' then pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'room_id', v_parent_id,
        'date', v_date,
        'status', v_status,
        'available_count', v_available_count,
        'price_override', v_price_override
      )
      else pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'tour_id', v_parent_id,
        'date', v_date,
        'time', v_time,
        'status', v_status,
        'capacity', v_capacity,
        'booked_count', v_booked_count
      )
    end,
    case
      when p_scope_type = 'room_date' then pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'room_id', v_parent_id,
        'date', v_date,
        'status', v_target_status,
        'available_count', v_available_count,
        'price_override', v_price_override
      )
      else pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'tour_id', v_parent_id,
        'date', v_date,
        'time', v_time,
        'status', v_target_status,
        'capacity', v_capacity,
        'booked_count', v_booked_count
      )
    end,
    coalesce(v_reason, 'Partner availability status changed atomically; inventory counters and accepted bookings remain unchanged.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'scope_type', p_scope_type,
    'scope_id', p_scope_id,
    'action', p_action,
    'status', v_target_status,
    'idempotent', false
  );
end;
$$;

revoke all on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) from public;
revoke all on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) from anon;
revoke all on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) to authenticated;

create or replace function public.partner_availability_action_atomic(
  p_scope_type text,
  p_scope_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_availability_action_atomic_internal(
    p_scope_type,
    p_scope_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.partner_availability_action_atomic(text,uuid,text,text,text) from public;
revoke all on function public.partner_availability_action_atomic(text,uuid,text,text,text) from anon;
grant execute on function public.partner_availability_action_atomic(text,uuid,text,text,text) to authenticated;

comment on function public.partner_availability_action_atomic(text,uuid,text,text,text) is
  'Partner-scoped room/tour availability status entrypoint. Never changes capacity, price, booking status or payment truth.';

commit;
