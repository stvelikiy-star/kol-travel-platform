CREATE OR REPLACE FUNCTION private.partner_booking_action_atomic_internal(p_booking_id uuid, p_action text, p_request_id text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_client_id uuid;
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

  if not public.kol_active_actor_v1() then
    raise exception 'active_account_required' using errcode = '42501';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id_required' using errcode = '22023';
  end if;

  if p_action not in ('confirm', 'reject', 'check_in', 'complete', 'report_issue', 'request_cancellation', 'cancel') then
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
    b.client_id,
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
      v_client_id,
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

  if p_action = 'cancel' then
    if v_reason is null then
      raise exception 'cancellation_reason_required' using errcode = '22023';
    end if;
    select ur.role into v_actor_role
    from public.user_roles ur join public.admin_profiles ap on ap.user_id=ur.user_id
    where ur.user_id=v_user_id and ur.is_active and ur.role='super_admin';
    if not found then raise exception 'owner_cancellation_required' using errcode='42501'; end if;
  else
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
    when 'cancel' then 'cancelled'
    when 'check_in' then 'checked_in'
    when 'complete' then 'completed'
    else null
  end;

  -- A Tour must never use checked_in, even if a legacy/manual row already
  -- carries that status. Status equality alone is not proof that this RPC ran.
  if p_action = 'check_in' and v_booking_type is distinct from 'stay' then
    raise exception 'invalid_partner_booking_check_in_transition' using errcode = 'P0001';
  end if;

  -- Only a previously audited partner transition may be replayed. A legacy or
  -- admin-mutated row with the target status must not masquerade as an accepted
  -- action (or claim that rejection released inventory). The booking row lock
  -- serializes concurrent transitions; the audit is committed in the same txn.
  if v_status = v_target_status then
    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.action = case when p_action='cancel' then 'admin_booking_cancel' else 'partner_booking_' || p_action end
      and al.entity_type = 'bookings'
      and al.entity_id = p_booking_id
      and al.after ->> 'status' = v_status
      and al.after ->> 'booking_type' = v_booking_type
      and (
        p_action not in ('reject','cancel')
        or al.after ->> 'inventory_released' = 'true'
      )
    limit 1;

    if v_existing_audit_id is null then
      raise exception 'partner_booking_replay_without_audit' using errcode = 'P0001';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', true,
      'inventory_released', p_action in ('reject','cancel')
    );
  end if;

  if p_action = 'cancel' and (v_status not in ('pending','confirmed') or v_start_date <= (now() at time zone 'Asia/Bishkek')::date or v_payment_status not in ('pending','failed','cancelled') or exists(select 1 from public.payments where booking_id=p_booking_id)) then
    raise exception 'cancellation_requires_future_unpaid_booking_without_payment_attempt' using errcode='42501';
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
  if p_action in ('reject','cancel') then
    v_inventory_model := v_metadata ->> 'inventory_model';
    -- Older client-stay RPC used inventory_reserved plus its immutable creation audit.
    if v_booking_type='stay' and v_inventory_model is null and v_metadata->>'inventory_reserved'='true'
       and exists(select 1 from public.audit_logs a where a.entity_type='bookings' and a.entity_id=p_booking_id
       and a.actor_id=v_client_id and a.action='client_booking_created' and a.request_id=v_metadata->>'request_id'
       and a.after->>'room_id'=v_object_id::text and a.after->>'start_date'=v_start_date::text
       and a.after->>'end_date'=v_end_date::text and a.after->>'guests'=v_guests_count::text) then
      v_inventory_model := 'room_availability';
    end if;

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
      set available_count = ra.available_count + 1,
          status = case when ra.status='booked' and ra.available_count=0 then 'available' else ra.status end
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
    case when p_action='cancel' then 'admin_booking_cancel_atomic' else 'partner_booking_' || p_action || '_atomic' end
  );

  v_audit_action := case when p_action='cancel' then 'admin_booking_cancel' else 'partner_booking_' || p_action end;

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
      'inventory_released', p_action in ('reject','cancel'),
      'inventory_model', case when p_action in ('reject','cancel') then v_inventory_model else null end
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
    'inventory_released', p_action in ('reject','cancel')
  );
end;
$function$;
