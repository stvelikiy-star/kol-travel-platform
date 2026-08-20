-- KÖL / kol-travel-platform
-- ORDER IDEMPOTENCY PAYLOAD HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Depends on 008_order_transaction_core_DRAFT_NOT_APPLIED.sql.
-- This file MUST NOT be applied to the live database before backup + staging proof.
--
-- Goals:
-- - keep the audited 008 order core intact;
-- - wrap its public entrypoint with stricter replay validation;
-- - serialize the same (client,idempotency_key) before inventory work;
-- - reject reuse of an idempotency key with a different business/type/cart/delivery payload;
-- - normalize duplicate item rows before comparison;
-- - reject an aggregated item quantity above the existing per-item limit;
-- - remove direct authenticated mutation grants from order_delivery.

begin;

-- Preserve the 008 implementation as a private internal implementation exactly once.
do $migration$
begin
  if pg_catalog.to_regprocedure('public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text)') is null then
    if pg_catalog.to_regprocedure('public.create_order_atomic(uuid,text,jsonb,text,text)') is null then
      raise exception '008 create_order_atomic is required before 008a' using errcode = '55000';
    end if;

    alter function public.create_order_atomic(uuid,text,jsonb,text,text)
      rename to create_order_atomic_v1_internal;
  end if;
end
$migration$;

revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text) from public;
revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text) from anon;
revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text) from authenticated;

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
  v_existing_delivery_method text;
  v_incoming_cart jsonb;
  v_existing_cart jsonb;
  v_invalid_items integer;
  v_item_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type is null or p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_delivery_method is distinct from 'pickup' then
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

  -- 008 consolidates duplicate item ids. Enforce the same per-item maximum on
  -- the consolidated cart as well so repeated rows cannot bypass qty <= 99.
  select count(*)::integer
    into v_invalid_items
  from (
    select x.item_id, pg_catalog.sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
  ) as normalized
  where normalized.qty < 1 or normalized.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_normalized_order_item' using errcode = '22023';
  end if;

  -- Serialize all retries before the internal 008 implementation takes any
  -- catalog/inventory row locks. The internal function takes the same xact lock
  -- again for new orders; PostgreSQL releases all transaction-level advisory
  -- locks automatically at transaction end.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select
    o.id,
    o.business_id,
    o.type,
    o.metadata ->> 'delivery_method'
  into
    v_existing_id,
    v_existing_business_id,
    v_existing_type,
    v_existing_delivery_method
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id is distinct from p_business_id
       or v_existing_type is distinct from p_order_type
       or v_existing_delivery_method is distinct from p_delivery_method then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', normalized.item_id::text,
        'qty', normalized.qty
      )
      order by normalized.item_id::text
    )
    into v_incoming_cart
    from (
      select x.item_id, pg_catalog.sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
    ) as normalized;

    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', stored.item_id::text,
        'qty', stored.qty
      )
      order by stored.item_id::text
    )
    into v_existing_cart
    from (
      select oi.item_id, pg_catalog.sum(oi.qty)::integer as qty
      from public.order_items as oi
      where oi.order_id = v_existing_id
      group by oi.item_id
    ) as stored;

    if coalesce(v_existing_cart, '[]'::jsonb) <> coalesce(v_incoming_cart, '[]'::jsonb) then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_order_atomic_v1_internal(
    p_business_id,
    p_order_type,
    p_items,
    p_delivery_method,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from public;
revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from anon;
grant execute on function public.create_order_atomic(uuid,text,jsonb,text,text) to authenticated;

-- order_delivery is part of the transactional order aggregate. Normal clients
-- may read through RLS where permitted but must not mutate it directly.
revoke insert, update, delete on table public.order_delivery from anon, authenticated;

commit;

-- REQUIRED STAGING TESTS BEFORE LIVE APPLY
-- 1. Same idempotency key + same normalized cart => same order id, no second stock decrement.
-- 2. Same key + reordered items / duplicate rows with same aggregate qty => same order id.
-- 3. Same key + changed qty/item/business/type/delivery => idempotency_key_payload_conflict.
-- 4. Concurrent same-key same-payload requests => one order, one stock decrement.
-- 5. Concurrent same-key different-payload requests => one winner, conflicting retry fails.
-- 6. Aggregated duplicate quantity >99 fails before inventory locks/decrement.
-- 7. authenticated direct INSERT/UPDATE/DELETE on order_delivery is denied.
