-- KÖL delivery role/consistency verification — READ ONLY
-- Run after staged application of 012, 012a, then 012b.

-- 1. Public wrappers exist; internal V1 implementations are private.
select n.nspname as schema_name, p.proname, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname='public' and p.proname in ('assign_courier_atomic','courier_transition_delivery_atomic','is_assigned_courier'))
   or (n.nspname='private' and p.proname in ('assign_courier_atomic_v1','courier_transition_delivery_atomic_v1'))
order by n.nspname,p.proname;

-- 2. Internal implementations must not be executable by browser/session roles.
select n.nspname,p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private'
  and p.proname in ('assign_courier_atomic_v1','courier_transition_delivery_atomic_v1')
order by p.proname;
-- Expected: anon=false, authenticated=false.

-- 3. Public wrappers remain authenticated entrypoints; anon must be denied.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('assign_courier_atomic','courier_transition_delivery_atomic')
order by p.proname;
-- Expected: anon=false, authenticated=true.

-- 4. Read helper must use in_progress, not stale active assignment status.
select pg_get_functiondef('public.is_assigned_courier(uuid)'::regprocedure) as helper_definition;

-- 5. Every active delivery has exactly one matching active assignment,
--    an active courier role, a courier profile, and busy availability.
with active_delivery as (
  select d.id,d.assigned_courier_id
  from public.deliveries d
  where d.status in (
    'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
    'picked_up','courier_to_client','arrived_at_client'
  )
), assignment_count as (
  select ad.id,ad.assigned_courier_id,
         count(ca.id) filter (where ca.status in ('assigned','accepted','in_progress')) as active_count,
         count(ca.id) filter (
           where ca.status in ('assigned','accepted','in_progress')
             and ca.courier_id=ad.assigned_courier_id
         ) as matching_count
  from active_delivery ad
  left join public.courier_assignments ca on ca.delivery_id=ad.id
  group by ad.id,ad.assigned_courier_id
)
select ac.id,ac.assigned_courier_id,ac.active_count,ac.matching_count,
       cp.availability_status,
       exists(
         select 1 from public.user_roles ur
         where ur.user_id=ac.assigned_courier_id
           and ur.role='courier' and ur.is_active=true
       ) as active_courier_role
from assignment_count ac
left join public.courier_profiles cp on cp.user_id=ac.assigned_courier_id
where ac.assigned_courier_id is null
   or ac.active_count <> 1
   or ac.matching_count <> 1
   or cp.user_id is null
   or cp.availability_status <> 'busy'
   or not exists(
     select 1 from public.user_roles ur
     where ur.user_id=ac.assigned_courier_id
       and ur.role='courier' and ur.is_active=true
   );
-- Expected: 0 rows.

-- 6. Terminal/pending delivery rows cannot have an active normalized assignment.
select d.id,d.status,ca.id as assignment_id,ca.courier_id,ca.status as assignment_status
from public.deliveries d
join public.courier_assignments ca on ca.delivery_id=d.id
where ca.status in ('assigned','accepted','in_progress')
  and d.status in ('delivery_pending','courier_searching','delivered','delivery_failed');
-- Expected: 0 rows.

-- 7. Deferred constraint triggers exist.
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema='public'
  and trigger_name in (
    'trg_delivery_assignment_consistency_on_delivery',
    'trg_delivery_assignment_consistency_on_assignment',
    'trg_courier_profile_delivery_consistency'
  )
order by trigger_name,event_manipulation;

-- Functional staging scenarios still required:
-- A. non-dispatcher assignment denied;
-- B. target without active courier role/profile denied;
-- C. same assignment replay requires one normalized active assignment;
-- D. revoked courier role cannot progress delivery;
-- E. skipped status transition denied;
-- F. active delivery cannot commit without matching assignment/busy profile;
-- G. delivered delivery cannot retain active assignment;
-- H. payment_status remains unchanged through every delivery transition.
