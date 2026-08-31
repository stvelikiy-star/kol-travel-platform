-- KÖL / kol-travel-platform
-- PARTNER FOOD + SHOP ORDER LIFECYCLE — DRAFT / NOT APPLIED
-- Prepared: 2026-09-01
--
-- Scope:
-- - partner may accept a new food/shop order;
-- - partner may move accepted orders into preparation;
-- - partner may mark prepared orders ready_for_pickup;
-- - partner may reject a NEW FOOD order only while payment is pending;
-- - partner may report an issue or request cancellation as audit-only evidence;
-- - payment, order items, prices and delivery truth are never mutated by partner actions;
-- - direct authenticated order/history mutation stays closed;
-- - the legacy public SECURITY DEFINER ready_for_pickup entrypoint is disabled.
--
-- Explicitly excluded:
-- - delivery row creation / delivery-fee calculation;
-- - paid-order rejection/refund;
-- - shop rejection/restock contract;
-- - cancellation execution;
-- - payment provider activation;
-- - live/production apply.

begin;

create schema if not exists private;

-- Partner order mutation is RPC-only. The earlier broad policy must not remain an
-- alternate update path even though table grants were already tightened by 008.
drop policy if exists "partners update own order preparation" on public.orders;
revoke update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_status_history from anon, authenticated;

-- Disable the older exposed SECURITY DEFINER pilot entrypoint. The new public
-- entrypoint below is SECURITY INVOKER and delegates to a private implementation.
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from public;
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from anon;
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from authenticated;

create or replace function private.partner_order_action_atomic_internal(
  p_order_id uuid,
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
  v_actor uuid := auth.uid();
  v_business_id uuid;
  v_order_type text;
  v_status text;
  v_payment_status text;
  v_target_status text;
  v_actor_role text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_order_id is null then
    raise exception 'order_id_required' using errcode = '22023';
  end if;

  if p_action not in (
    'accept',
    'reject',
    'start_preparing',
    'mark_ready',
    'report_issue',
    'request_cancellation'
  ) then
    raise exception 'unsupported_partner_order_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select o.business_id, o.type, o.status, o.payment_status
    into v_business_id, v_order_type, v_status, v_payment_status
  from public.orders as o
  where o.id = p_order_id
    and o.type in ('food', 'shop')
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_actor
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_actor
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'order_not_available_for_partner' using errcode = '42501';
  end if;

  -- These actions intentionally persist evidence only. They never alter order,
  -- payment, stock, delivery or item truth.
  if p_action in ('report_issue', 'request_cancellation') then
    if v_status in ('completed', 'rejected', 'cancelled') then
      raise exception 'partner_order_action_not_allowed_for_terminal_order' using errcode = 'P0001';
    end if;

    if p_action = 'request_cancellation'
       and v_status not in ('accepted_by_partner', 'preparing', 'ready_for_pickup') then
      raise exception 'cancellation_request_requires_accepted_order' using errcode = 'P0001';
    end if;

    v_audit_action := case p_action
      when 'report_issue' then 'partner_order_issue_reported'
      else 'partner_order_cancellation_requested'
    end;

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_actor
      and al.action = v_audit_action
      and al.entity_type = 'orders'
      and al.entity_id = p_order_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
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
      v_actor,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      'orders',
      p_order_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'order_type', v_order_type,
        'status', v_status,
        'payment_status', v_payment_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'order_type', v_order_type,
        'status', v_status,
        'payment_status', v_payment_status,
        'request_only', true
      ),
      coalesce(
        v_reason,
        case p_action
          when 'report_issue' then 'Partner reported an order issue for admin review.'
          else 'Partner requested cancellation; order, stock and payment truth were not changed.'
        end
      ),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'order_id', p_order_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', false
    );
  end if;

  if p_action = 'reject' then
    if v_status = 'rejected' then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    if v_status <> 'new' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;

    -- Shop stock is decremented atomically at order creation. Until an explicit
    -- reject/restock contract exists, shop rejection must fail closed.
    if v_order_type = 'shop' then
      raise exception 'shop_reject_restock_contract_required' using errcode = 'P0001';
    end if;

    -- A paid food order would require refund/cancellation policy. Do not invent it.
    if v_payment_status <> 'pending' then
      raise exception 'paid_order_rejection_requires_admin_policy' using errcode = 'P0001';
    end if;

    v_target_status := 'rejected';
  elsif p_action = 'accept' then
    v_target_status := 'accepted_by_partner';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'new' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  elsif p_action = 'start_preparing' then
    v_target_status := 'preparing';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'accepted_by_partner' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  elsif p_action = 'mark_ready' then
    v_target_status := 'ready_for_pickup';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status not in ('accepted_by_partner', 'preparing') then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  end if;

  if v_payment_status not in ('pending', 'paid') then
    raise exception 'order_payment_state_not_operational' using errcode = 'P0001';
  end if;

  update public.orders as o
  set status = v_target_status,
      updated_at = now()
  where o.id = p_order_id;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_order_id,
    v_actor,
    v_status,
    v_target_status,
    'partner_order_' || p_action || '_atomic'
  );

  v_audit_action := 'partner_order_' || p_action;

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
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'order_type', v_order_type,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'order_type', v_order_type,
      'status', v_target_status,
      'payment_status', v_payment_status
    ),
    coalesce(v_reason, 'Partner order lifecycle transition committed atomically.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'action', p_action,
    'status', v_target_status,
    'payment_status', v_payment_status,
    'idempotent', false
  );
end;
$$;

revoke all on function private.partner_order_action_atomic_internal(uuid,text,text,text) from public;
revoke all on function private.partner_order_action_atomic_internal(uuid,text,text,text) from anon;
revoke all on function private.partner_order_action_atomic_internal(uuid,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_order_action_atomic_internal(uuid,text,text,text) to authenticated;

create or replace function public.partner_order_action_atomic(
  p_order_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_order_action_atomic_internal(
    p_order_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.partner_order_action_atomic(uuid,text,text,text) from public;
revoke all on function public.partner_order_action_atomic(uuid,text,text,text) from anon;
grant execute on function public.partner_order_action_atomic(uuid,text,text,text) to authenticated;

comment on function public.partner_order_action_atomic(uuid,text,text,text) is
  'Partner-scoped food/shop lifecycle entrypoint. Never changes payment, delivery, item or price truth; cancellation is request-only.';

commit;
