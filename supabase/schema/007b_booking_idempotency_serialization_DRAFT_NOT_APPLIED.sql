-- KÖL / kol-travel-platform
-- BOOKING IDEMPOTENCY SERIALIZATION HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 007_booking_transaction_core_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
-- - serialize all retries for one (authenticated user, idempotency key) before inventory locks;
-- - make same-key/different-payload reuse an explicit conflict instead of silently replaying another booking;
-- - preserve the already-reviewed 007 inventory/price transaction bodies behind non-public internal functions.
--
-- No live apply before backup + staging + concurrency tests.

begin;

-- Preserve the reviewed 007 implementations once, then put strict wrappers back on
-- the public RPC signatures. The DO block makes source re-application safer in a
-- staging reset without pretending this is an applied migration ledger.
do $$
begin
  if to_regprocedure('public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text)') is null then
    alter function public.create_stay_booking_atomic(uuid,date,date,integer,text)
      rename to create_stay_booking_atomic_unlocked;
  end if;

  if to_regprocedure('public.create_tour_booking_atomic_unlocked(uuid,integer,text)') is null then
    alter function public.create_tour_booking_atomic(uuid,integer,text)
      rename to create_tour_booking_atomic_unlocked;
  end if;
end;
$$;

revoke all on function public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text) from anon;
revoke all on function public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text) from authenticated;

revoke all on function public.create_tour_booking_atomic_unlocked(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic_unlocked(uuid,integer,text) from anon;
revoke all on function public.create_tour_booking_atomic_unlocked(uuid,integer,text) from authenticated;

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
  v_existing_object_id uuid;
  v_existing_start_date date;
  v_existing_end_date date;
  v_existing_guests_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  -- Same client + same key always enters one transaction lane, including cross-type
  -- reuse. Hash collisions only over-serialize; they do not weaken correctness.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.object_id, b.start_date, b.end_date, b.guests_count
    into v_existing_id, v_existing_type, v_existing_object_id,
         v_existing_start_date, v_existing_end_date, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay'
       or v_existing_object_id <> p_room_id
       or v_existing_start_date <> p_start_date
       or v_existing_end_date is distinct from p_end_date
       or v_existing_guests_count <> p_guests_count then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_stay_booking_atomic_unlocked(
    p_room_id,
    p_start_date,
    p_end_date,
    p_guests_count,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from anon;
grant execute on function public.create_stay_booking_atomic(uuid,date,date,integer,text) to authenticated;

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
  v_existing_schedule_id text;
  v_existing_guests_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.metadata ->> 'tour_schedule_id', b.guests_count
    into v_existing_id, v_existing_type, v_existing_schedule_id, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour'
       or v_existing_schedule_id is distinct from p_tour_schedule_id::text
       or v_existing_guests_count <> p_participants then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_tour_booking_atomic_unlocked(
    p_tour_schedule_id,
    p_participants,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from anon;
grant execute on function public.create_tour_booking_atomic(uuid,integer,text) to authenticated;

commit;

-- REQUIRED STAGING PROOF:
-- 1. 10 simultaneous identical stay calls with one key => one booking id returned/replayed;
--    inventory decremented exactly once.
-- 2. Same stay key with different room/date/guest payload => payload conflict, no inventory change.
-- 3. Same key reused between stay and tour => payload conflict.
-- 4. 10 simultaneous identical tour calls => one booking id; capacity incremented exactly once.
-- 5. Same tour key with different schedule/participants => payload conflict, no capacity change.
-- 6. authenticated cannot EXECUTE *_unlocked functions directly.
