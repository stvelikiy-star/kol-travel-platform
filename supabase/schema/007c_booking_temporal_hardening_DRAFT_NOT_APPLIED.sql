-- KÖL / kol-travel-platform
-- BOOKING TEMPORAL HARDENING — DRAFT / NOT APPLIED
-- Prepared: 2026-08-21
-- Depends on: 007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
--   Reject creation of NEW Stay/Tour bookings against inventory dates that are
--   already in the past, even when a stale historical inventory row remains
--   marked available. This is enforced inside the trusted PostgreSQL RPC path,
--   not only in the UI.
--
-- Important idempotency rule:
--   An exact replay of an already-created booking is returned before the temporal
--   check. A booking that was valid when created must remain replay-safe after its
--   service date passes.
--
-- NOT APPLIED to live Supabase.

begin;

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

  if p_start_date is null or p_start_date < current_date then
    raise exception 'stay_start_date_in_past' using errcode = '22023';
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
  v_schedule_date date;
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

  select ts.date
    into v_schedule_date
  from public.tour_schedules as ts
  where ts.id = p_tour_schedule_id
  for update;

  if v_schedule_date is not null and v_schedule_date < current_date then
    raise exception 'tour_schedule_in_past' using errcode = '22023';
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
