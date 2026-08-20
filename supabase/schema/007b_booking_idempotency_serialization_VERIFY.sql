-- KÖL / 007b booking idempotency serialization verification — READ ONLY

-- 1. Public wrappers and internal reviewed implementations must all exist.
select
  p.proname,
  p.prosecdef as security_definer,
  p.proconfig,
  pg_get_function_identity_arguments(p.oid) as identity_args
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'create_stay_booking_atomic',
    'create_stay_booking_atomic_unlocked',
    'create_tour_booking_atomic',
    'create_tour_booking_atomic_unlocked'
  )
order by p.proname;
-- Expected: four rows, all SECURITY DEFINER, fixed search_path.

-- 2. Normal API roles may execute wrappers, never unlocked implementations.
select
  p.proname,
  r.rolname,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as can_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
cross join pg_roles r
where n.nspname='public'
  and p.proname in (
    'create_stay_booking_atomic',
    'create_stay_booking_atomic_unlocked',
    'create_tour_booking_atomic',
    'create_tour_booking_atomic_unlocked'
  )
  and r.rolname in ('anon','authenticated')
order by p.proname,r.rolname;
-- Expected:
-- wrappers: anon=false, authenticated=true
-- *_unlocked: anon=false, authenticated=false

-- 3. Wrapper definitions must contain transaction advisory locking.
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('create_stay_booking_atomic','create_tour_booking_atomic')
order by p.proname;
-- Review for pg_advisory_xact_lock + hashtextextended and payload-conflict checks.

-- 4. Duplicate invariant remains enforced by 007 unique index.
select client_id, metadata ->> 'idempotency_key' as idempotency_key, count(*)
from public.bookings
where metadata ? 'idempotency_key'
group by client_id, metadata ->> 'idempotency_key'
having count(*) > 1;
-- Expected: zero rows.

-- 5. Functional concurrency proof is mandatory on staging and cannot be replaced
-- by metadata inspection. See 007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql.
