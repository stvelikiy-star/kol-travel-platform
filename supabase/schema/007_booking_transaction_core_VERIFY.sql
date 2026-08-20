-- KÖL atomic booking transaction verification
-- READ-ONLY metadata checks. Functional/concurrency test harness must run on staging.

-- 1. Idempotency index exists.
select indexname, indexdef
from pg_indexes
where schemaname='public'
  and indexname='uq_bookings_client_id_idempotency_key';

-- 2. Functions are SECURITY DEFINER with fixed search_path.
select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('create_stay_booking_atomic','create_tour_booking_atomic')
order by p.proname;
-- Expected: security_definer=true; proconfig contains search_path="".

-- 3. Execute privileges: authenticated only among normal API roles.
select
  p.proname,
  r.rolname,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
cross join pg_roles r
where n.nspname='public'
  and p.proname in ('create_stay_booking_atomic','create_tour_booking_atomic')
  and r.rolname in ('anon','authenticated')
order by p.proname, r.rolname;
-- Expected: anon=false, authenticated=true.

-- 4. Inventory invariants that must remain true after concurrency testing.
select room_id, date, available_count, status
from public.room_availability
where available_count < 0
order by room_id, date;
-- Expected: zero rows.

select id, tour_id, booked_count, capacity, status
from public.tour_schedules
where booked_count < 0 or booked_count > capacity
order by id;
-- Expected: zero rows.

-- 5. Idempotency duplicate invariant.
select client_id, metadata ->> 'idempotency_key' as idempotency_key, count(*)
from public.bookings
where metadata ? 'idempotency_key'
group by client_id, metadata ->> 'idempotency_key'
having count(*) > 1;
-- Expected: zero rows.

-- 6. Every atomic-created booking must have its initial history row.
select b.id, b.booking_type
from public.bookings b
where b.metadata ->> 'inventory_model' in ('room_availability','tour_schedules')
  and not exists (
    select 1
    from public.booking_status_history h
    where h.booking_id=b.id
      and h.from_status is null
      and h.to_status='pending'
  )
order by b.id;
-- Expected: zero rows.

-- 7. Functional staging concurrency tests are REQUIRED and cannot be replaced by
-- these metadata queries. See 007_booking_transaction_core_DRAFT_NOT_APPLIED.sql.
