-- KÖL / kol-travel-platform
-- ATOMIC BOOKING TRANSACTION CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- This draft is derived from the CURRENT live schema:
--   bookings(client_id,business_id,booking_type,object_id,start_date,end_date,
--            guests_count,total,status,payment_status,metadata)
--   room_availability(room_id,date,status,available_count,price_override)
--     UNIQUE(room_id,date)
--   tour_schedules(tour_id,date,time,capacity,booked_count,status)
--
-- Purpose:
-- - authoritative server-side price calculation;
-- - row locking for concurrency;
-- - no-overbooking / no-oversell within initialized inventory;
-- - caller identity from auth.uid(), never from request input;
-- - idempotent retries;
-- - one transaction for inventory + booking + status history.
--
-- IMPORTANT SAFETY CONDITIONS BEFORE APPLY:
-- 1. authoritative live-schema baseline + logical backup exist;
-- 2. RLS/security baseline is repaired and staging is available;
-- 3. room_availability and tour_schedules inventory is actually initialized;
-- 4. cancellation/refund/release semantics are approved separately;
-- 5. this is tested under real concurrent sessions.
--
-- This draft intentionally does NOT implement cancellation/refund or payment capture.

begin;

-- ---------------------------------------------------------------------------
-- 1. Client-scoped idempotency ledger embedded in booking metadata.
-- ---------------------------------------------------------------------------
-- One idempotency key cannot create multiple bookings for the same client.
-- The functions also verify the booking_type when reusing a key.

create unique index if not exists uq_bookings_client_id_idempotency_key
on public.bookings (client_id, ((metadata ->> 'idempotency_key')))
where metadata ? 'idempotency_key';

-- ---------------------------------------------------------------------------
-- 2. Stay booking RPC
-- Date model: [start_date, end_date), i.e. checkout day is NOT consumed.
-- Inventory rows must already exist for every consumed night.
-- ---------------------------------------------------------------------------

create or replace function public.create_stay_booking_atomic(
  p_room_id uuid,
  p_start_date date,
  p_end_date date,
  p_guests_count integer,
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
  v_existing_type text;
  v_business_id uuid;
  v_room_capacity integer;
  v_base_price numeric;
  v_nights integer;
  v_inventory_rows integer;
  v_available_rows integer;
  v_updated_rows integer;
  v_total numeric;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'invalid_stay_dates' using errcode = '22023';
  end if;

  if p_guests_count is null or p_guests_count < 1 then
    raise exception 'invalid_guests_count' using errcode = '22023';
  end if;

  -- Fast retry path before inventory locking.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select r.business_id, r.capacity, r.price_per_night
    into v_business_id, v_room_capacity, v_base_price
  from public.rooms as r
  where r.id = p_room_id
    and r.status = 'active';

  if v_business_id is null then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  if p_guests_count > v_room_capacity then
    raise exception 'room_capacity_exceeded' using errcode = '22023';
  end if;

  v_nights := p_end_date - p_start_date;

  -- Lock the exact date rows in deterministic order. Missing rows fail closed.
  perform 1
  from public.room_availability as ra
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date
  order by ra.date
  for update;

  -- Concurrent retry path after lock wait.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (where ra.status = 'available' and ra.available_count > 0)::integer,
    coalesce(sum(coalesce(ra.price_override, v_base_price)), 0)
    into v_inventory_rows, v_available_rows, v_total
  from public.room_availability as ra
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date;

  if v_inventory_rows <> v_nights then
    raise exception 'stay_inventory_not_initialized' using errcode = 'P0001';
  end if;

  if v_available_rows <> v_nights then
    raise exception 'stay_not_available' using errcode = 'P0001';
  end if;

  if v_total <= 0 then
    raise exception 'invalid_server_price' using errcode = 'P0001';
  end if;

  update public.room_availability as ra
  set available_count = ra.available_count - 1
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date
    and ra.status = 'available'
    and ra.available_count > 0;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> v_nights then
    raise exception 'stay_inventory_changed' using errcode = '40001';
  end if;

  insert into public.bookings (
    client_id,
    business_id,
    booking_type,
    object_id,
    status,
    start_date,
    end_date,
    guests_count,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    v_business_id,
    'stay',
    p_room_id,
    'pending',
    p_start_date,
    p_end_date,
    p_guests_count,
    v_total,
    'pending',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'inventory_model', 'room_availability',
      'end_date_exclusive', true
    )
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_booking_id,
    v_user_id,
    null,
    'pending',
    'atomic_stay_booking_created'
  );

  return v_booking_id;
end;
$$;

-- SECURITY DEFINER in public must never inherit default PUBLIC execute.
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from anon;
grant execute on function public.create_stay_booking_atomic(uuid,date,date,integer,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tour schedule booking RPC
-- bookings.object_id remains the tour_id to preserve the recovered contract.
-- schedule_id is recorded in metadata because the current bookings table has no
-- dedicated schedule FK. A future additive migration may normalize that relation.
-- ---------------------------------------------------------------------------

create or replace function public.create_tour_booking_atomic(
  p_tour_schedule_id uuid,
  p_participants integer,
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
  v_existing_type text;
  v_tour_id uuid;
  v_business_id uuid;
  v_date date;
  v_time time;
  v_capacity integer;
  v_booked_count integer;
  v_price numeric;
  v_total numeric;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_participants is null or p_participants < 1 then
    raise exception 'invalid_participants' using errcode = '22023';
  end if;

  -- Fast retry path.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  -- Lock one authoritative capacity row and fetch server-side tour price/business.
  select ts.tour_id, t.business_id, ts.date, ts.time, ts.capacity, ts.booked_count, t.price
    into v_tour_id, v_business_id, v_date, v_time, v_capacity, v_booked_count, v_price
  from public.tour_schedules as ts
  join public.tours as t on t.id = ts.tour_id
  where ts.id = p_tour_schedule_id
    and ts.status = 'available'
    and t.status = 'active'
  for update of ts;

  if v_tour_id is null then
    raise exception 'tour_schedule_not_available' using errcode = 'P0001';
  end if;

  -- Concurrent retry path after lock wait.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  if v_capacity <= 0 or v_booked_count + p_participants > v_capacity then
    raise exception 'tour_capacity_exceeded' using errcode = 'P0001';
  end if;

  if v_price <= 0 then
    raise exception 'invalid_server_price' using errcode = 'P0001';
  end if;

  v_total := v_price * p_participants;

  update public.tour_schedules
  set booked_count = booked_count + p_participants
  where id = p_tour_schedule_id
    and booked_count + p_participants <= capacity;

  if not found then
    raise exception 'tour_capacity_changed' using errcode = '40001';
  end if;

  insert into public.bookings (
    client_id,
    business_id,
    booking_type,
    object_id,
    status,
    start_date,
    end_date,
    guests_count,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    v_business_id,
    'tour',
    v_tour_id,
    'pending',
    v_date,
    null,
    p_participants,
    v_total,
    'pending',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'tour_schedule_id', p_tour_schedule_id,
      'schedule_time', v_time,
      'inventory_model', 'tour_schedules'
    )
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_booking_id,
    v_user_id,
    null,
    'pending',
    'atomic_tour_booking_created'
  );

  return v_booking_id;
end;
$$;

revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from anon;
grant execute on function public.create_tour_booking_atomic(uuid,integer,text) to authenticated;

commit;

-- ---------------------------------------------------------------------------
-- REQUIRED CONCURRENCY VERIFICATION BEFORE LIVE APPLY
-- ---------------------------------------------------------------------------
-- Stay:
-- - initialize a 3-night room availability window with available_count=1;
-- - send 10 simultaneous unique idempotency booking attempts;
-- - exactly one must commit, 9 must fail unavailable;
-- - available_count must become 0 on each consumed night, never negative;
-- - retry the winning idempotency key: same booking id, no second decrement.
--
-- Tour:
-- - initialize schedule capacity=5, booked_count=0;
-- - send concurrent requests totaling >5 participants;
-- - committed participant sum must be <=5 and booked_count equal committed sum;
-- - retry a successful idempotency key: same booking id, no second increment.
--
-- Cross-cutting:
-- - client cannot supply another client_id or total (parameters do not expose them);
-- - unauthenticated execute denied;
-- - public/anon EXECUTE denied;
-- - failed booking transaction leaves inventory unchanged;
-- - booking + initial history row commit together.
