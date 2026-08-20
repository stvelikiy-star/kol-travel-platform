-- KÖL / kol-travel-platform
-- DELIVERY ASSIGNMENT CONSISTENCY — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql
--
-- Recovery issue verified in the current demo DB:
-- - deliveries.assigned_courier_id is populated for an active delivery;
-- - courier_assignments has no matching active row;
-- - the assigned courier profile is still marked online.
--
-- This candidate repairs that derived operational consistency without hardcoded IDs.
-- It fails closed if an existing active assignment contradicts deliveries.

begin;

-- Abort instead of guessing when the normalized assignment table disagrees with
-- the delivery row that is currently the recovered operational source.
do $$
begin
  if exists (
    select 1
    from public.deliveries d
    join public.courier_assignments ca
      on ca.delivery_id = d.id
     and ca.status in ('assigned','accepted','in_progress')
    where d.status not in ('delivered','delivery_failed')
      and d.assigned_courier_id is not null
      and ca.courier_id is distinct from d.assigned_courier_id
  ) then
    raise exception 'conflicting_active_delivery_assignment_requires_review';
  end if;
end;
$$;

-- Backfill only missing normalized assignment rows for currently active deliveries.
insert into public.courier_assignments (
  delivery_id,
  courier_id,
  status,
  assigned_by
)
select
  d.id,
  d.assigned_courier_id,
  case
    when d.status = 'courier_assigned' then 'assigned'
    when d.status = 'courier_accepted' then 'accepted'
    else 'in_progress'
  end,
  null
from public.deliveries d
where d.assigned_courier_id is not null
  and d.status in (
    'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
    'picked_up','courier_to_client','arrived_at_client'
  )
  and not exists (
    select 1
    from public.courier_assignments ca
    where ca.delivery_id = d.id
      and ca.status in ('assigned','accepted','in_progress')
  );

-- Any courier who currently owns an active delivery is operationally busy.
update public.courier_profiles cp
set availability_status = 'busy',
    updated_at = now()
where exists (
  select 1
  from public.deliveries d
  where d.assigned_courier_id = cp.user_id
    and d.status in (
      'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
      'picked_up','courier_to_client','arrived_at_client'
    )
)
and cp.availability_status <> 'busy';

commit;

-- STAGING VERIFY:
-- 1. every active delivery with assigned_courier_id has exactly one active
--    courier_assignments row for the same courier;
-- 2. all couriers owning active deliveries are busy;
-- 3. no terminal delivery receives a new active assignment;
-- 4. any contradictory pre-existing active assignment aborts the transaction.
