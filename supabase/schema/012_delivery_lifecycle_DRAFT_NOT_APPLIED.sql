-- KÖL / kol-travel-platform
-- DELIVERY LIFECYCLE CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Scope: courier assignment + physical delivery progress only.
-- Delivery pricing/fee calculation and delivery-row creation remain out of scope
-- until an authoritative delivery-fee contract exists.
--
-- Verified live facts:
-- - 1 demo delivery exists, status=courier_assigned;
-- - live delivery workflow already uses detailed status names;
-- - authenticated has broad table grants on delivery operational tables;
-- - current courier UPDATE policy limits rows but not columns, so a courier can
--   potentially change assignment/address/risk metadata through direct PATCH;
-- - courier profile availability uses online/offline/busy semantics.
--
-- Required before apply: backup + accepted baseline + PR #13 staging + role tests.

begin;

-- ---------------------------------------------------------------------------
-- 1. Close direct mutation entrypoints. Reads remain RLS-scoped.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.deliveries from anon, authenticated;
revoke insert, update, delete on table public.order_delivery from anon, authenticated;
revoke insert, update, delete on table public.courier_assignments from anon, authenticated;
revoke insert, update, delete on table public.delivery_status_history from anon, authenticated;

drop policy if exists "couriers update assigned delivery physical status" on public.deliveries;

-- At most one active assignment record for a delivery.
create unique index if not exists uq_courier_assignments_active_delivery
on public.courier_assignments(delivery_id)
where status in ('assigned','accepted','in_progress');

-- ---------------------------------------------------------------------------
-- 2. Dispatcher assignment RPC.
-- Reassignment is allowed only before courier acceptance. After acceptance/pickup,
-- the existing high-risk/admin approval workflow remains required and is not
-- implemented by this low-risk RPC.
-- ---------------------------------------------------------------------------

create or replace function public.assign_courier_atomic(
  p_delivery_id uuid,
  p_courier_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries%rowtype;
  v_existing_courier uuid;
  v_courier_status text;
  v_assignment_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.has_role('dispatcher') or public.has_role('super_admin')) then
    raise exception 'dispatcher_role_required' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_courier_id is null then
    raise exception 'delivery_and_courier_required' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select d.* into v_delivery
  from public.deliveries as d
  where d.id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  if v_delivery.status in ('courier_accepted','courier_to_partner','arrived_at_partner','picked_up','courier_to_client','arrived_at_client','delivered','delivery_failed') then
    raise exception 'high_risk_reassignment_required' using errcode = 'P0001';
  end if;

  select cp.availability_status into v_courier_status
  from public.courier_profiles as cp
  where cp.user_id = p_courier_id
  for update;

  if v_courier_status is null then
    raise exception 'courier_profile_not_found' using errcode = 'P0001';
  end if;

  if p_courier_id = v_delivery.assigned_courier_id
     and v_delivery.status = 'courier_assigned' then
    select ca.id into v_assignment_id
    from public.courier_assignments as ca
    where ca.delivery_id = p_delivery_id
      and ca.courier_id = p_courier_id
      and ca.status in ('assigned','accepted','in_progress')
    order by ca.created_at desc
    limit 1;

    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'delivery_id',p_delivery_id,
      'courier_id',p_courier_id,
      'assignment_id',v_assignment_id,
      'status','courier_assigned'
    );
  end if;

  if v_courier_status <> 'online' then
    raise exception 'courier_not_available' using errcode = 'P0001';
  end if;

  v_existing_courier := v_delivery.assigned_courier_id;

  update public.courier_assignments
  set status = 'reassigned', updated_at = now()
  where delivery_id = p_delivery_id
    and status in ('assigned','accepted','in_progress');

  insert into public.courier_assignments (
    delivery_id,
    courier_id,
    status,
    assigned_by
  ) values (
    p_delivery_id,
    p_courier_id,
    'assigned',
    v_actor
  )
  returning id into v_assignment_id;

  update public.deliveries
  set assigned_courier_id = p_courier_id,
      status = 'courier_assigned',
      updated_at = now()
  where id = p_delivery_id;

  update public.courier_profiles
  set availability_status = 'busy', updated_at = now()
  where user_id = p_courier_id;

  if v_existing_courier is not null and v_existing_courier <> p_courier_id then
    update public.courier_profiles cp
    set availability_status = 'online', updated_at = now()
    where cp.user_id = v_existing_courier
      and not exists (
        select 1
        from public.deliveries d2
        where d2.assigned_courier_id = v_existing_courier
          and d2.id <> p_delivery_id
          and d2.status not in ('delivered','delivery_failed')
      );
  end if;

  insert into public.delivery_status_history (
    delivery_id, from_status, to_status, changed_by, reason
  ) values (
    p_delivery_id,
    v_delivery.status,
    'courier_assigned',
    v_actor,
    coalesce(nullif(btrim(p_reason),''),'dispatcher_assignment')
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor,
    'dispatcher',
    'assign_courier',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('assigned_courier_id',v_existing_courier,'status',v_delivery.status),
    jsonb_build_object('assigned_courier_id',p_courier_id,'status','courier_assigned','assignment_id',v_assignment_id),
    coalesce(nullif(btrim(p_reason),''),'Courier assigned by dispatcher.'),
    'delivery-assignment-' || v_assignment_id::text
  );

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'delivery_id',p_delivery_id,
    'courier_id',p_courier_id,
    'assignment_id',v_assignment_id,
    'status','courier_assigned'
  );
end;
$$;

revoke all on function public.assign_courier_atomic(uuid,uuid,text) from public;
revoke all on function public.assign_courier_atomic(uuid,uuid,text) from anon;
grant execute on function public.assign_courier_atomic(uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Courier-owned physical progress RPC.
-- Canonical state machine:
-- courier_assigned -> courier_accepted -> courier_to_partner -> arrived_at_partner
-- -> picked_up -> courier_to_client -> arrived_at_client -> delivered
--
-- Courier cannot change assignment, addresses, risk, payment truth, items, price,
-- or force a failure/cancellation through this RPC.
-- ---------------------------------------------------------------------------

create or replace function public.courier_transition_delivery_atomic(
  p_delivery_id uuid,
  p_to_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries%rowtype;
  v_expected_next text;
  v_old_order_status text;
  v_new_order_status text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_delivery_id is null then
    raise exception 'delivery_required' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select d.* into v_delivery
  from public.deliveries as d
  where d.id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  if v_delivery.assigned_courier_id is distinct from v_actor then
    raise exception 'delivery_not_assigned_to_courier' using errcode = '42501';
  end if;

  v_expected_next := case v_delivery.status
    when 'courier_assigned' then 'courier_accepted'
    when 'courier_accepted' then 'courier_to_partner'
    when 'courier_to_partner' then 'arrived_at_partner'
    when 'arrived_at_partner' then 'picked_up'
    when 'picked_up' then 'courier_to_client'
    when 'courier_to_client' then 'arrived_at_client'
    when 'arrived_at_client' then 'delivered'
    else null
  end;

  if p_to_status = v_delivery.status then
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'delivery_id',p_delivery_id,
      'status',v_delivery.status
    );
  end if;

  if v_expected_next is null or p_to_status is distinct from v_expected_next then
    raise exception 'invalid_delivery_status_transition' using errcode = 'P0001';
  end if;

  update public.deliveries
  set status = p_to_status, updated_at = now()
  where id = p_delivery_id;

  update public.courier_assignments
  set status = case
        when p_to_status = 'courier_accepted' then 'accepted'
        when p_to_status = 'delivered' then 'completed'
        else 'in_progress'
      end,
      updated_at = now()
  where delivery_id = p_delivery_id
    and courier_id = v_actor
    and status in ('assigned','accepted','in_progress');

  insert into public.delivery_status_history (
    delivery_id, from_status, to_status, changed_by, reason
  ) values (
    p_delivery_id,
    v_delivery.status,
    p_to_status,
    v_actor,
    coalesce(nullif(btrim(p_reason),''),'courier_physical_progress')
  );

  -- Keep operational order state coherent without touching payment truth.
  if p_to_status in ('picked_up','delivered') then
    select o.status into v_old_order_status
    from public.orders o
    where o.id = v_delivery.order_id
    for update;

    v_new_order_status := case
      when p_to_status = 'picked_up' and v_old_order_status in ('ready','ready_for_pickup') then 'delivering'
      when p_to_status = 'delivered' and v_old_order_status in ('ready','ready_for_pickup','delivering') then 'completed'
      else null
    end;

    if v_new_order_status is not null and v_new_order_status <> v_old_order_status then
      update public.orders
      set status = v_new_order_status, updated_at = now()
      where id = v_delivery.order_id;

      insert into public.order_status_history (
        order_id, from_status, to_status, changed_by, reason
      ) values (
        v_delivery.order_id,
        v_old_order_status,
        v_new_order_status,
        v_actor,
        'delivery_progress_' || p_to_status
      );
    end if;
  end if;

  if p_to_status = 'delivered' then
    update public.courier_profiles cp
    set availability_status = 'online', updated_at = now()
    where cp.user_id = v_actor
      and not exists (
        select 1
        from public.deliveries d2
        where d2.assigned_courier_id = v_actor
          and d2.id <> p_delivery_id
          and d2.status not in ('delivered','delivery_failed')
      );
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor,
    'courier',
    'courier_delivery_transition',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status',v_delivery.status),
    jsonb_build_object('status',p_to_status),
    coalesce(nullif(btrim(p_reason),''),'Courier physical delivery progress.'),
    'delivery-transition-' || p_delivery_id::text || '-' || p_to_status
  );

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'delivery_id',p_delivery_id,
    'status',p_to_status
  );
end;
$$;

revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from public;
revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from anon;
grant execute on function public.courier_transition_delivery_atomic(uuid,text,text) to authenticated;

commit;

-- STAGING TESTS REQUIRED:
-- - courier direct PATCH cannot mutate deliveries;
-- - non-dispatcher cannot assign a courier;
-- - dispatcher can assign only an online courier;
-- - reassignment after courier acceptance fails closed;
-- - courier can progress only own delivery and only one canonical step at a time;
-- - courier cannot set delivery_failed/cancelled through the progress RPC;
-- - pickup updates eligible order to delivering; delivered updates eligible order to completed;
-- - payment_status is unchanged by all delivery RPCs;
-- - history/audit/assignment changes roll back together on any failure;
-- - courier returns online only when no other active delivery remains.
