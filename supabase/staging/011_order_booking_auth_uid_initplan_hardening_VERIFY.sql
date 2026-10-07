-- KÖL / staging
-- READ-ONLY verification for order/booking auth.uid() initplan hardening.

DO $$
DECLARE
  v_count integer;
BEGIN
  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'orders'
    and policyname = 'clients create own orders draft'
    and cmd = 'INSERT'
    and with_check ilike '%select auth.uid%';
  if v_count <> 1 then
    raise exception 'order_policy_initplan_verify_failed: orders policy not hardened';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'bookings'
    and policyname = 'clients create own bookings'
    and cmd = 'INSERT'
    and with_check ilike '%select auth.uid%';
  if v_count <> 1 then
    raise exception 'booking_policy_initplan_verify_failed: bookings policy not hardened';
  end if;
END
$$;

select tablename, policyname, cmd, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename in ('orders', 'bookings')
  and policyname in ('clients create own orders draft', 'clients create own bookings')
order by tablename;
