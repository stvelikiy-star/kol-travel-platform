-- KÖL / kol-travel-platform
-- PUBLIC BOOKING INVENTORY READ CONTRACT — DRAFT / NOT APPLIED
-- Prepared: 2026-08-21
-- Depends on: 006d_api_role_privilege_hardening_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
--   Expose the minimum booking-inventory projection needed by public Stay/Tour
--   detail pages without granting anon direct SELECT on rooms,
--   room_availability or tour_schedules.
--
-- Security model:
--   - raw booking inventory tables remain outside the anon table allowlist;
--   - SECURITY DEFINER functions expose only explicit columns;
--   - only active stays/tours and active rooms are eligible;
--   - Stay output includes future-window room availability and authoritative
--     room/override prices but no customer/booking data;
--   - Tour output includes only currently available schedules in the requested
--     date window and no customer/booking data;
--   - date windows are fail-closed when invalid or larger than 366 days;
--   - function search_path is fixed to an empty path and all objects are schema-qualified.
--
-- NOT APPLIED to live Supabase.

begin;

create or replace function public.get_public_stay_inventory(
  p_stay_id uuid,
  p_from date,
  p_to date
)
returns table (
  room_id uuid,
  stay_id uuid,
  room_title text,
  room_capacity integer,
  room_price_per_night numeric,
  room_status text,
  availability_date date,
  availability_status text,
  available_count integer,
  price_override numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id as room_id,
    r.stay_id,
    r.title as room_title,
    r.capacity as room_capacity,
    r.price_per_night as room_price_per_night,
    r.status as room_status,
    ra.date as availability_date,
    ra.status as availability_status,
    ra.available_count,
    ra.price_override
  from public.stays as s
  join public.rooms as r
    on r.stay_id = s.id
   and r.status = 'active'
  left join public.room_availability as ra
    on ra.room_id = r.id
   and ra.date >= p_from
   and ra.date < p_to
  where p_stay_id is not null
    and p_from is not null
    and p_to is not null
    and p_to > p_from
    and (p_to - p_from) <= 366
    and s.id = p_stay_id
    and s.status = 'active'
  order by r.title, ra.date;
$$;

revoke all on function public.get_public_stay_inventory(uuid,date,date) from public;
grant execute on function public.get_public_stay_inventory(uuid,date,date) to anon, authenticated;

create or replace function public.get_public_tour_schedules(
  p_tour_id uuid,
  p_from date,
  p_to date
)
returns table (
  schedule_id uuid,
  tour_id uuid,
  schedule_date date,
  start_time time,
  capacity integer,
  booked_count integer,
  remaining_count integer,
  schedule_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ts.id as schedule_id,
    ts.tour_id,
    ts.date as schedule_date,
    ts.time as start_time,
    ts.capacity,
    ts.booked_count,
    greatest(ts.capacity - ts.booked_count, 0) as remaining_count,
    ts.status as schedule_status
  from public.tours as t
  join public.tour_schedules as ts
    on ts.tour_id = t.id
  where p_tour_id is not null
    and p_from is not null
    and p_to is not null
    and p_to > p_from
    and (p_to - p_from) <= 366
    and t.id = p_tour_id
    and t.status = 'active'
    and ts.status = 'available'
    and ts.date >= p_from
    and ts.date < p_to
    and ts.capacity > ts.booked_count
  order by ts.date, ts.time, ts.id;
$$;

revoke all on function public.get_public_tour_schedules(uuid,date,date) from public;
grant execute on function public.get_public_tour_schedules(uuid,date,date) to anon, authenticated;

commit;
