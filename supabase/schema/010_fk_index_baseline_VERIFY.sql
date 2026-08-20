-- KÖL / 010 FK index baseline verification
-- READ-ONLY. Run after staging apply.

with fk as (
  select
    c.conrelid,
    c.conrelid::regclass::text as table_name,
    c.conname,
    c.conkey[1] as attnum,
    a.attname as fk_column
  from pg_constraint c
  join pg_attribute a
    on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
  where c.connamespace='public'::regnamespace
    and c.contype='f'
    and cardinality(c.conkey)=1
), checked as (
  select
    fk.*,
    exists (
      select 1 from pg_index i
      where i.indrelid=fk.conrelid
        and i.indisvalid
        and i.indisready
        and i.indkey[0]=fk.attnum
    ) as has_leading_index
  from fk
)
select table_name,conname,fk_column,has_leading_index
from checked
where not has_leading_index
order by table_name,conname;

-- Expected after 010 against the 2026-08-20 baseline: zero rows.
-- Before 010 the live baseline was 49 missing of 80 single-column foreign keys.

select indexname,indexdef
from pg_indexes
where schemaname='public'
  and indexname in (
    'idx_booking_guests_booking_id',
    'idx_booking_status_history_booking_id',
    'idx_order_status_history_order_id',
    'idx_courier_assignments_delivery_id',
    'idx_delivery_status_history_delivery_id',
    'idx_payments_order_id',
    'idx_payments_booking_id',
    'idx_ticket_messages_ticket_id'
  )
order by indexname;

-- Then rerun Supabase Performance Advisor.
-- Do NOT drop currently "unused" indexes merely because the restored/demo database
-- has almost no traffic. Index removal needs real workload evidence.
