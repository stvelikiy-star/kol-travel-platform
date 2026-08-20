-- KÖL delivery lifecycle verification — READ ONLY
-- Run after staged application of 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql.

-- 1. Browser/session roles must not directly mutate delivery operational tables.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('deliveries','order_delivery','courier_assignments','delivery_status_history')
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by table_name, grantee, privilege_type;
-- Expected: 0 rows.

-- 2. Broad courier direct-update policy must be absent.
select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'deliveries'
  and policyname = 'couriers update assigned delivery physical status';
-- Expected: 0 rows.

-- 3. One active assignment per delivery guard.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'courier_assignments'
  and indexname = 'uq_courier_assignments_active_delivery';

-- 4. Authenticated-only RPC exposure.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('assign_courier_atomic','courier_transition_delivery_atomic')
order by p.proname;
-- Expected: anon=false, authenticated=true. Internal role/ownership checks still gate execution.

-- 5. Current delivery rows should have an allowed lifecycle status.
select id, status
from public.deliveries
where status not in (
  'delivery_pending','courier_searching','courier_assigned','courier_accepted',
  'courier_to_partner','arrived_at_partner','picked_up','courier_to_client',
  'arrived_at_client','delivered','delivery_failed'
);
-- Expected: 0 rows before adding any future status.

-- 6. Functional staging tests required:
-- - non-dispatcher assignment denied;
-- - offline courier assignment denied;
-- - same assignment replay is idempotent;
-- - reassignment before acceptance works and releases previous courier if idle;
-- - reassignment after acceptance fails closed;
-- - wrong courier cannot progress delivery;
-- - status skipping fails;
-- - same status replay is idempotent;
-- - pickup/order-delivering and delivered/order-completed changes commit with history;
-- - payment_status remains byte-for-byte unchanged;
-- - courier availability returns online only after last active delivery completes.
