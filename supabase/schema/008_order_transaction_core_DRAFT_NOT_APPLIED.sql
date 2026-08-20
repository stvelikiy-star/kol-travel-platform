-- KÖL / kol-travel-platform
-- ATOMIC FOOD + SHOP ORDER CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Depends on the recovered schema and the staged security baseline.
-- This file MUST NOT be applied to the live database before backup + staging proof.
--
-- Goals:
-- - caller identity comes from auth.uid();
-- - caller cannot set subtotal/discount/total/payment status;
-- - all items must belong to one approved business;
-- - prices are read and snapshotted inside the DB transaction;
-- - shop stock is row-locked and decremented atomically;
-- - food does not invent ingredient inventory that the schema does not contain;
-- - idempotent retry does not create/decrement twice;
-- - order + items + initial status history + audit commit together;
-- - partner ready-for-pickup transition + history + audit commit together;
-- - direct authenticated order writes are removed from the Data API surface.
--
-- Deliberately excluded:
-- - delivery-fee calculation (no authoritative fee model exists yet);
-- - discounts/promos;
-- - payment capture/refunds;
-- - cancellation/restock;
-- - food ingredient inventory;
-- - courier dispatch.
--
-- Until a server-authoritative delivery price model exists, create_order_atomic
-- accepts pickup only and rejects delivery requests fail-closed.

begin;

-- ---------------------------------------------------------------------------
-- 1. Client-scoped idempotency
-- ---------------------------------------------------------------------------

create unique index if not exists uq_orders_client_id_idempotency_key
on public.orders (client_id, ((metadata ->> 'idempotency_key')))
where metadata ? 'idempotency_key';

-- ---------------------------------------------------------------------------
-- 2. Remove direct authenticated order mutation surface
-- ---------------------------------------------------------------------------
-- Existing live policy only checked client_id on INSERT and therefore allowed a
-- caller to submit arbitrary monetary fields. Transactional writes move to RPC.

drop policy if exists "clients create own orders draft" on public.orders;

revoke insert, update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_items from anon, authenticated;
revoke insert, update, delete on table public.order_status_history from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Atomic order creation
-- ---------------------------------------------------------------------------

create or replace function public.create_order_atomic(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_business_id uuid;
  v_existing_type text;
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_min_order numeric := 0;
  v_title text;
  v_price numeric;
  v_stock integer;
  v_partner_address text;
  v_invalid_items integer;
  v_item_count integer;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_delivery_method <> 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null
     or length(pg_catalog.btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array' using errcode = '22023';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'invalid_item_count' using errcode = '22023';
  end if;

  -- Serialize retries with the same client/idempotency pair before inventory locks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select o.id, o.business_id, o.type
    into v_existing_id, v_existing_business_id, v_existing_type
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id <> p_business_id or v_existing_type <> p_order_type then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select count(*)::integer
    into v_invalid_items
  from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
  where x.item_id is null
     or x.qty is null
     or x.qty < 1
     or x.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_order_item' using errcode = '22023';
  end if;

  select p.address
    into v_partner_address
  from public.partners as p
  where p.id = p_business_id
    and p.status = 'approved';

  if not found then
    raise exception 'business_not_available' using errcode = 'P0001';
  end if;

  if p_order_type = 'food' then
    select r.min_order_amount
      into v_min_order
    from public.restaurants as r
    where r.business_id = p_business_id;

    if not found then
      raise exception 'food_business_not_configured' using errcode = 'P0001';
    end if;

    -- Lock every referenced menu row in deterministic UUID order and calculate
    -- the authoritative subtotal. Duplicate item ids are consolidated.
    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active'
      for update;

      if not found then
        raise exception 'menu_item_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;

    if v_subtotal < coalesce(v_min_order, 0) then
      raise exception 'minimum_order_not_met' using errcode = 'P0001';
    end if;
  else
    -- Shop orders require an actual shop contour and tracked stock. NULL stock
    -- is treated as unknown, never as unlimited.
    perform 1
    from public.shops as s
    where s.business_id = p_business_id;

    if not found then
      raise exception 'shop_business_not_configured' using errcode = 'P0001';
    end if;

    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select p.title, p.price, p.stock_qty
        into v_title, v_price, v_stock
      from public.products as p
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
      for update;

      if not found then
        raise exception 'product_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      if v_stock is null then
        raise exception 'product_stock_not_tracked' using errcode = 'P0001';
      end if;

      if v_stock < v_item.qty then
        raise exception 'insufficient_product_stock' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;
  end if;

  if v_subtotal <= 0 then
    raise exception 'invalid_order_subtotal' using errcode = 'P0001';
  end if;

  insert into public.orders (
    client_id,
    business_id,
    type,
    status,
    subtotal,
    delivery_fee,
    discount,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    p_business_id,
    p_order_type,
    'new',
    v_subtotal,
    0,
    0,
    v_subtotal,
    'pending',
    pg_catalog.jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'pricing_authority', 'database',
      'delivery_method', p_delivery_method,
      'delivery_fee_model', 'not_configured_pickup_only'
    )
  )
  returning id into v_order_id;

  -- Insert snapshots from the still-locked catalog rows. Shop stock decrement is
  -- performed in the same transaction immediately before its item snapshot.
  for v_item in
    select x.item_id, sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
    order by x.item_id
  loop
    if p_order_type = 'food' then
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active';

      if not found then
        raise exception 'menu_item_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'menu_item', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    else
      update public.products as p
      set stock_qty = p.stock_qty - v_item.qty
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
        and p.stock_qty is not null
        and p.stock_qty >= v_item.qty
      returning p.title, p.price into v_title, v_price;

      if not found then
        raise exception 'product_stock_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'product', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    end if;
  end loop;

  insert into public.order_delivery (
    order_id,
    delivery_method,
    pickup_address,
    dropoff_address
  ) values (
    v_order_id,
    'pickup',
    v_partner_address,
    null
  );

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_order_id,
    v_user_id,
    null,
    'new',
    'atomic_order_created'
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
    v_user_id,
    'client',
    'create_order_atomic',
    'orders',
    v_order_id,
    null,
    pg_catalog.jsonb_build_object(
      'business_id', p_business_id,
      'type', p_order_type,
      'subtotal', v_subtotal,
      'payment_status', 'pending'
    ),
    'Atomic order created from server-authoritative catalog values.',
    'create-order-' || p_idempotency_key
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from public;
revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from anon;
grant execute on function public.create_order_atomic(uuid,text,jsonb,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Atomic partner transition: ready_for_pickup
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_ready_for_pickup_atomic(
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_status text;
  v_payment_status text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select o.business_id, o.status, o.payment_status
    into v_business_id, v_status, v_payment_status
  from public.orders as o
  where o.id = p_order_id
    and o.type in ('food', 'shop')
    and exists (
      select 1
      from public.partner_staff as ps
      where ps.business_id = o.business_id
        and ps.user_id = v_user_id
        and ps.is_active = true
    )
  for update;

  if not found then
    raise exception 'order_not_available_for_partner' using errcode = '42501';
  end if;

  -- Idempotent retry after a fully committed previous call.
  if v_status = 'ready_for_pickup' then
    return p_order_id;
  end if;

  if v_status not in ('preparing', 'accepted_by_partner') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'ready_for_pickup'
  where id = p_order_id;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_order_id,
    v_user_id,
    v_status,
    'ready_for_pickup',
    'partner_marked_ready_for_pickup_atomic'
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
    v_user_id,
    'partner',
    'mark_order_ready_for_pickup',
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'status', 'ready_for_pickup',
      'payment_status', v_payment_status
    ),
    'Partner order status transition committed atomically with history and audit.',
    'mark-ready-' || p_order_id::text
  );

  return p_order_id;
end;
$$;

revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from public;
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from anon;
grant execute on function public.mark_order_ready_for_pickup_atomic(uuid) to authenticated;

commit;

-- REQUIRED STAGING TESTS BEFORE LIVE APPLY
--
-- Shop concurrency:
-- - initialize product stock=5;
-- - send concurrent orders whose requested sum >5;
-- - committed item quantity must never exceed 5;
-- - stock_qty must never be negative;
-- - failed transactions must leave orders/items/history/audit unchanged;
-- - retry the winning idempotency key and prove no second decrement.
--
-- Food pricing:
-- - caller supplies only item ids/qty; DB price snapshot drives subtotal/total;
-- - inactive/foreign-business menu items fail;
-- - minimum order amount is enforced;
-- - no ingredient inventory is invented/decremented.
--
-- Security:
-- - caller cannot set client_id, total, payment_status, discount, delivery_fee;
-- - anonymous RPC execute is denied;
-- - authenticated direct INSERT/UPDATE/DELETE on order core tables is denied;
-- - partner A cannot transition partner B order;
-- - ready-for-pickup status/history/audit either all commit or all roll back.
--
-- Delivery requests must fail until an authoritative delivery fee/dispatch model exists.
