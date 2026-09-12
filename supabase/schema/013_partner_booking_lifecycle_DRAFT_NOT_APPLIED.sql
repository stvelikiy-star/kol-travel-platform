-- KÖL / kol-travel-platform
-- PARTNER BOOKING LIFECYCLE — DRAFT / NOT APPLIED
-- Prepared: 2026-08-31
-- Hardened: 2026-09-12
--
-- Scope:
-- - partner may confirm or reject a pending booking;
-- - rejecting an atomically-created pending Stay/Tour booking releases exactly the
--   inventory that booking reserved, in the same transaction as the status change;
-- - Stay may transition confirmed -> checked_in -> completed;
-- - Tour may transition confirmed -> completed and never uses checked_in;
-- - partner may report a booking issue without mutating booking/payment truth;
-- - partner may request cancellation of a confirmed booking without performing cancellation/refund;
-- - every accepted action is ownership-scoped and audited;
-- - direct authenticated booking/history mutation stays closed.
--
-- Explicitly excluded:
-- - cancellation execution;
-- - refund/no-show/payout policy;
-- - payment status mutation;
-- - arbitrary/manual repair of legacy bookings that do not carry the atomic
--   inventory metadata contract;
-- - live/production apply.

begin;

create schema if not exists private;

-- The recovered RLS policy is broader than the operational contract because it
-- permits generic row UPDATE. Partner booking mutation is now RPC-only.
drop policy if exists "partners update own bookings" on public.bookings;
revoke update, delete on table public.bookings from anon, authenticated;
revoke insert, update, delete on table public.booking_status_history from anon, authenticated;

create or replace function private.partner_booking_action_atomic_internal(
  p_booking_id uuid,
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
  v_status text;
  v_payment_status text;
  v_booking_type text;
  v_object_id uuid;
  v_start_date date;
  v_end_date date;
  v_guests_count integer;
  v_metadata jsonb;
  v_inventory_model text;
  v_target_status text;
  v_actor_role text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_nights integer;
  v_inventory_rows integer;
  v_released_rows integer;
  v_tour_schedule_id uuid;
  v_tour_booked_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id_required' using errcode = '22023';
  end if;

  if p_action not in ('confirm', 'reject', 'check_in', 'complete', 'report_issue', 'request_cancellation') then
    raise exception 'unsupported_partner_booking_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select
    b.business_id,
    b.status,
    b.payment_status,
    b.booking_type,
    b.object_id,
    b.start_date,
    b.end_date,
    b.guests_count,
    coalesce(b.metadata, '{}'::jsonb)
    into
      v_business_id,
      v_status,
      v_payment_status,
      v_booking_type,
      v_object_id,
      v_start_date,
      v_end_date,
      v_guests_count,
      v_metadata
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
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
    raise exception 'booking_not_available_for_partner' using errcode = '42501';
  end if;

  -- Non-transition actions are persisted only as audit/escalation evidence.
  if p_action in ('report_issue', 'request_cancellation') then
    if p_action = 'request_cancellation' and v_status <> 'confirmed' then
      raise exception 'cancellation_request_requires_confirmed_booking' using errcode = 'P0001';
    end if;

    if p_action = 'report_issue' and v_status in ('completed', 'cancelled', 'rejected', 'no_show') then
      raise exception 'issue_report_not_allowed_for_terminal_booking' using errcode = 'P0001';
    end if;

    v_audit_action := case p_action
      when 'report_issue' then 'partner_booking_issue_reported'
      else 'partner_booking_cancellation_requested'
    end;

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_user_id
      and al.action = v_audit_action
      and al.entity_type = 'bookings'
      and al.entity_id = p_booking_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'booking_id', p_booking_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

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
      v_user_id,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      'bookings',
      p_booking_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'status', v_status,
        'payment_status', v_payment_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'status', v_status,
        'payment_status', v_payment_status,
        'request_only', true
      ),
      coalesce(
        v_reason,
        case p_action
          when 'report_issue' then 'Partner reported a booking issue for admin review.'
          else 'Partner requested cancellation; booking and payment truth were not changed.'
        end
      ),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', false
    );
  end if;

  v_target_status := case p_action
    when 'confirm' then 'confirmed'
    when 'reject' then 'rejected'
    when 'check_in' then 'checked_in'
    when 'complete' then 'completed'
    else null
  end;

  -- Exact retry after a committed transition is safe. In particular, a replayed
  -- rejection returns before inventory release, so inventory can never be restored twice.
  if v_status = v_target_status then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', true,
      'inventory_released', p_action = 'reject'
    );
  end if;

  if (p_action in ('confirm', 'reject') and v_status <> 'pending') then
    raise exception 'invalid_partner_booking_status_transition' using errcode = 'P0001';
  end if;

  if p_action = 'check_in' and (v_booking_type <> 'stay' or v_status <> 'confirmed') then
    raise exception 'invalid_partner_booking_check_in_transition' using errcode = 'P0001';
  end if;

  if p_action = 'complete' and not (
    (v_booking_type = 'stay' and v_status = 'checked_in')
    or (v_booking_type = 'tour' and v_status = 'confirmed')
  ) then
    raise exception 'invalid_partner_booking_complete_transition' using errcode = 'P0001';
  end if;

  -- A pending atomic booking has already reserved inventory. Reject must release
  -- that exact reservation in this transaction. Legacy/manual bookings without the
  -- atomic inventory marker fail closed and require an explicit admin repair path.
  if p_action = 'reject' then
    v_inventory_model := v_metadata ->> 'inventory_model';

    if v_booking_type = 'stay' then
      if v_inventory_model is distinct from 'room_availability'
         or v_object_id is null
         or v_start_date is null
         or v_end_date is null
         or v_end_date <= v_start_date then
        raise exception 'stay_rejection_inventory_contract_missing' using errcode = 'P0001';
      end if;

      v_nights := v_end_date - v_start_date;

      perform 1
      from public.room_availability as ra
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date
      order by ra.date
      for update;

      select count(*)::integer
        into v_inventory_rows
      from public.room_availability as ra
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date;

      if v_inventory_rows <> v_nights then
        raise exception 'stay_rejection_inventory_missing' using errcode = 'P0001';
      end if;

      update public.room_availability as ra
      set available_count = ra.available_count + 1
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date;

      get diagnostics v_released_rows = row_count;
      if v_released_rows <> v_nights then
        raise exception 'stay_rejection_inventory_release_changed' using errcode = '40001';
      end if;

    elsif v_booking_type = 'tour' then
      if v_inventory_model is distinct from 'tour_schedules'
         or nullif(v_metadata ->> 'tour_schedule_id', '') is null
         or v_object_id is null
         or v_guests_count is null
         or v_guests_count < 1 then
        raise exception 'tour_rejection_inventory_contract_missing' using errcode = 'P0001';
      end if;

      begin
        v_tour_schedule_id := (v_metadata ->> 'tour_schedule_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'tour_rejection_schedule_id_invalid' using errcode = '22023';
      end;

      select ts.booked_count
        into v_tour_booked_count
      from public.tour_schedules as ts
      where ts.id = v_tour_schedule_id
        and ts.tour_id = v_object_id
      for update;

      if not found then
        raise exception 'tour_rejection_schedule_missing' using errcode = 'P0001';
      end if;

      if v_tour_booked_count < v_guests_count then
        raise exception 'tour_rejection_capacity_inconsistent' using errcode = 'P0001';
      end if;

      update public.tour_schedules as ts
      set booked_count = ts.booked_count - v_guests_count
      where ts.id = v_tour_schedule_id
        and ts.tour_id = v_object_id
        and ts.booked_count >= v_guests_count;

      if not found then
        raise exception 'tour_rejection_capacity_changed' using errcode = '40001';
      end if;

    else
      raise exception 'booking_rejection_type_unsupported' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings as b
  set status = v_target_status
  where b.id = p_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_booking_id,
    v_user_id,
    v_status,
    v_target_status,
    'partner_booking_' || p_action || '_atomic'
  );

  v_audit_action := 'partner_booking_' || p_action;

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
    v_user_id,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    'bookings',
    p_booking_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'booking_type', v_booking_type,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'booking_type', v_booking_type,
      'status', v_target_status,
      'payment_status', v_payment_status,
      'inventory_released', p_action = 'reject',
      'inventory_model', case when p_action = 'reject' then v_inventory_model else null end
    ),
    coalesce(v_reason, 'Partner booking lifecycle transition committed atomically.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'booking_type', v_booking_type,
    'action', p_action,
    'status', v_target_status,
    'payment_status', v_payment_status,
    'idempotent', false,
    'inventory_released', p_action = 'reject'
  );
end;
$$;

revoke all on function private.partner_booking_action_atomic_internal(uuid,text,text,text) from public;
revoke all on function private.partner_booking_action_atomic_internal(uuid,text,text,text) from anon;
revoke all on function private.partner_booking_action_atomic_internal(uuid,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_booking_action_atomic_internal(uuid,text,text,text) to authenticated;

-- Data API entrypoint is invoker-rights only. The privileged implementation stays
-- outside the exposed public schema and performs its own caller/ownership checks.
create or replace function public.partner_booking_action_atomic(
  p_booking_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_booking_action_atomic_internal(
    p_booking_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.partner_booking_action_atomic(uuid,text,text,text) from public;
revoke all on function public.partner_booking_action_atomic(uuid,text,text,text) from anon;
grant execute on function public.partner_booking_action_atomic(uuid,text,text,text) to authenticated;

comment on function public.partner_booking_action_atomic(uuid,text,text,text) is
  'Partner-scoped booking lifecycle entrypoint. Stay supports confirmed->checked_in->completed; Tour supports confirmed->completed. Reject releases trusted reserved inventory. Payment/refund truth is unchanged.';

commit;
