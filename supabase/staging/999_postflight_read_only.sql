-- KÖL STAGING POST-FLIGHT — READ ONLY
-- Run only after the complete reviewed 005→012b sequence and Storage bucket provisioning.
-- No DDL/DML is performed here.

-- 1. RLS policy coverage after 005/006 family.
select
  count(*) filter (where c.relrowsecurity)::int as rls_enabled,
  count(*) filter (
    where c.relrowsecurity
      and not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname
      )
  )::int as rls_tables_zero_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';

-- 2. All six public helper/trigger functions must have an explicit search_path setting.
select p.proname, p.proconfig,
       exists (
         select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
         where cfg like 'search_path=%'
       ) as fixed_search_path
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_updated_at','has_role','is_admin','is_finance_admin','is_partner_for','is_assigned_courier')
order by p.proname;
-- Expected: six rows, fixed_search_path=true for all.

-- 3. Protected transactional truth must not be directly writable by anon/authenticated.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
  and table_name in (
    'bookings','booking_status_history','orders','order_items','order_status_history',
    'payments','order_payments','deliveries','order_delivery','courier_assignments','delivery_status_history','audit_logs'
  )
order by table_name, grantee, privilege_type;
-- Expected: only explicitly reviewed low-risk exceptions; ideally 0 for the listed transactional truth tables.

-- 4. Required atomic RPCs must exist.
select n.nspname as schema_name, p.proname,
       pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in (
  'create_stay_booking_atomic','create_tour_booking_atomic',
  'create_order_atomic','partner_mark_order_ready_for_pickup_atomic',
  'create_payment_attempt_atomic','apply_payment_provider_event_atomic',
  'assign_courier_atomic','courier_transition_delivery_atomic'
))
order by n.nspname, p.proname, arguments;

-- 5. Browser roles must not execute payment mutation RPCs.
select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('create_payment_attempt_atomic','apply_payment_provider_event_atomic')
order by p.proname;
-- Expected: anon=false, authenticated=false, service_role=true.

-- 6. FK leading-index coverage after 010. Expected missing_count=0 for single-column public FKs.
-- Keep this logic identical to the already-proven 010 VERIFY query: pg_index.indkey
-- is int2vector and its first element is addressed at index 0.
with fk as (
  select
    con.conrelid,
    con.conname,
    con.conkey[1] as attnum
  from pg_constraint con
  where con.connamespace = 'public'::regnamespace
    and con.contype = 'f'
    and cardinality(con.conkey) = 1
), missing as (
  select fk.*
  from fk
  where not exists (
    select 1
    from pg_index i
    where i.indrelid = fk.conrelid
      and i.indisvalid
      and i.indisready
      and i.indkey[0] = fk.attnum
  )
)
select count(*)::int as missing_count from missing;

-- 7. Storage contract. Bucket must be private and match the API-provisioned limits.
select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'catalog-media';
-- Expected: exactly one private catalog-media bucket, 8 MiB limit, JPEG/PNG/WebP/AVIF only.

-- 8. Delivery normalized-assignment consistency after 012a/012b.
select d.id as delivery_id, d.assigned_courier_id, d.status,
       ca.courier_id as assignment_courier_id, ca.status as assignment_status
from public.deliveries d
left join public.courier_assignments ca
  on ca.delivery_id = d.id
 and ca.status in ('assigned','accepted','in_progress')
where d.status not in ('delivered','delivery_failed')
  and d.assigned_courier_id is not null
  and (ca.id is null or ca.courier_id is distinct from d.assigned_courier_id);
-- Expected: 0 rows.

-- 9. Stage 21/004 remains intentionally absent in this rollout.
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (
    ('menu_items','slug'),('products','slug'),('tours','image_url'),('stays','capacity')
  )
order by table_name, column_name;
-- Expected: 0 rows until Stage 21 gets its own reviewed release.

-- Acceptance still additionally requires role-by-role RLS tests, cross-partner isolation,
-- concurrent booking/order/stock/idempotency tests, payment replay tests, Storage isolation,
-- Security/Performance Advisor review and rollback rehearsal.
