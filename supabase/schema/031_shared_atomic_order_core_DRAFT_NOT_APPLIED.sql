-- KOL 031 — shared atomic client/verified operator core; DRAFT NOT APPLIED.
-- Depends on 008, 008a, 012 and 028, 029, 030. Isolated staging only.
-- The existing public create_order_atomic wrapper retains client pickup-only policy.
-- No payment capture, zero default delivery tariff or JWT impersonation.
begin;
create or replace function private.create_order_for_client_atomic_core(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text,
  p_client_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_delivery_tariff_id uuid default null,
  p_delivery_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_client_id;
  v_delivery_fee numeric(12,2) := 0;
  v_tariff record;
  v_delivery_id uuid;
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

  if p_actor_id is null or p_actor_role not in ('client','support_admin','super_admin') then
    raise exception 'invalid_order_actor' using errcode = '42501';
  end if;
  if p_delivery_method not in ('pickup','delivery') then
    raise exception 'unsupported_delivery_method' using errcode = '22023';
  end if;
  if p_delivery_method='pickup' and
     (p_delivery_tariff_id is not null or p_delivery_address is not null) then
    raise exception 'pickup_payload_has_delivery_fields' using errcode = '22023';
  end if;
  if p_delivery_method='delivery' then
    if p_delivery_tariff_id is null or p_delivery_address is null or
       length(pg_catalog.btrim(p_delivery_address)) < 8 or
       length(pg_catalog.btrim(p_delivery_address)) > 500 then
      raise exception 'delivery_price_or_address_missing' using errcode = 'P0001';
    end if;
    select t.id,t.fee_som,t.currency,t.zone_code into v_tariff
      from private.kol_delivery_tariffs t
      where t.id=p_delivery_tariff_id and t.business_id=p_business_id
        and t.active and t.currency='KGS'
        and t.valid_from<=pg_catalog.now()
        and (t.valid_until is null or t.valid_until>pg_catalog.now())
        and exists(select 1 from public.user_roles ar where
          ar.user_id=t.approved_by and ar.is_active
          and ar.role in ('support_admin','super_admin'))
      for share of t;
    if not found then
      raise exception 'approved_delivery_tariff_missing' using errcode = 'P0001';
    end if;
    v_delivery_fee:=v_tariff.fee_som;
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
    v_delivery_fee,
    0,
    v_subtotal+v_delivery_fee,
    'pending',
    pg_catalog.jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'pricing_authority', 'database',
      'delivery_method', p_delivery_method,
      'delivery_fee_model',case when p_delivery_method='pickup' then 'pickup_zero' else 'approved_zone_tariff' end,
      'delivery_tariff_id',p_delivery_tariff_id,
      'delivery_zone',v_tariff.zone_code,
      'currency','KGS'
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
    p_delivery_method,
    v_partner_address,
    case when p_delivery_method='delivery' then pg_catalog.btrim(p_delivery_address) else null end
  );

  if p_delivery_method='delivery' then
    insert into public.deliveries
      (order_id,status,pickup_address,dropoff_address,metadata)
    values (v_order_id,'delivery_pending',v_partner_address,
      pg_catalog.btrim(p_delivery_address),
      pg_catalog.jsonb_build_object('tariff_id',v_tariff.id,
        'zone_code',v_tariff.zone_code,'fee_som',v_delivery_fee,'currency','KGS'))
    returning id into v_delivery_id;
    update public.order_delivery set delivery_id=v_delivery_id
      where order_id=v_order_id;
    insert into public.delivery_status_history
      (delivery_id,from_status,to_status,changed_by,reason)
    values (v_delivery_id,null,'delivery_pending',p_actor_id,
      'approved_delivery_order_created');
  end if;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_order_id,
    p_actor_id,
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
    p_actor_id,
    p_actor_role,
    'create_order_atomic',
    'orders',
    v_order_id,
    null,
    pg_catalog.jsonb_build_object(
      'business_id', p_business_id,
      'type', p_order_type,
      'subtotal', v_subtotal,
      'delivery_fee', v_delivery_fee,
      'delivery_id',v_delivery_id,
      'client_id',v_user_id,
      'payment_status', 'pending'
    ),
    'Atomic order created from server-authoritative catalog values.',
    'create-order-' || p_idempotency_key
  );

  return v_order_id;
end;
$$;
revoke all on function private.create_order_for_client_atomic_core(
  uuid,text,jsonb,text,text,uuid,uuid,text,uuid,text)
  from public,anon,authenticated;
-- This internal function is only callable from SECURITY DEFINER wrappers
-- owned by the migration administrator; direct Data API execution denied.
create or replace function public.create_order_atomic_v1_internal(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  -- Preserve client route as pickup-only until a separate accepted UX/fee flow.
  if p_delivery_method is distinct from 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode='P0001';
  end if;
  return private.create_order_for_client_atomic_core(
    p_business_id,p_order_type,p_items,p_delivery_method,p_idempotency_key,
    v_actor,v_actor,'client',null,null);
end;
$$;
revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text)
  from public,anon,authenticated;

commit;
