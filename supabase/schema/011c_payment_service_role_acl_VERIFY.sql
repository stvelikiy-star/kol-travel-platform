-- KÖL / kol-travel-platform
-- PAYMENT SERVICE ROLE ACL DEPENDENCY — READ-ONLY VERIFY

DO $$
BEGIN
  if not pg_catalog.has_table_privilege('service_role','public.orders','SELECT')
     or not pg_catalog.has_table_privilege('service_role','public.orders','UPDATE') then
    raise exception '011c_acl_missing: service_role needs SELECT,UPDATE on public.orders';
  end if;

  if not pg_catalog.has_table_privilege('service_role','public.bookings','SELECT')
     or not pg_catalog.has_table_privilege('service_role','public.bookings','UPDATE') then
    raise exception '011c_acl_missing: service_role needs SELECT,UPDATE on public.bookings';
  end if;

  if not pg_catalog.has_table_privilege('service_role','public.payments','SELECT')
     or not pg_catalog.has_table_privilege('service_role','public.payments','INSERT')
     or not pg_catalog.has_table_privilege('service_role','public.payments','UPDATE') then
    raise exception '011c_acl_missing: service_role needs SELECT,INSERT,UPDATE on public.payments';
  end if;

  if not pg_catalog.has_table_privilege('service_role','public.order_payments','SELECT')
     or not pg_catalog.has_table_privilege('service_role','public.order_payments','INSERT') then
    raise exception '011c_acl_missing: service_role needs SELECT,INSERT on public.order_payments';
  end if;

  if not pg_catalog.has_table_privilege('service_role','public.audit_logs','INSERT') then
    raise exception '011c_acl_missing: service_role needs INSERT on public.audit_logs';
  end if;

  if not pg_catalog.has_schema_privilege('service_role','private','USAGE')
     or not pg_catalog.has_table_privilege('service_role','private.payment_provider_events','SELECT')
     or not pg_catalog.has_table_privilege('service_role','private.payment_provider_events','INSERT')
     or not pg_catalog.has_table_privilege('service_role','private.payment_provider_events','UPDATE') then
    raise exception '011c_acl_missing: service_role payment-event ledger dependency is incomplete';
  end if;

  if not pg_catalog.has_function_privilege(
       'service_role',
       'public.create_payment_attempt_atomic(text,uuid,text,text,text)',
       'EXECUTE'
     )
     or not pg_catalog.has_function_privilege(
       'service_role',
       'public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb)',
       'EXECUTE'
     ) then
    raise exception '011c_acl_missing: service_role payment RPC EXECUTE dependency is incomplete';
  end if;

  if pg_catalog.has_table_privilege('anon','public.payments','INSERT')
     or pg_catalog.has_table_privilege('anon','public.payments','UPDATE')
     or pg_catalog.has_table_privilege('anon','public.payments','DELETE')
     or pg_catalog.has_table_privilege('authenticated','public.payments','INSERT')
     or pg_catalog.has_table_privilege('authenticated','public.payments','UPDATE')
     or pg_catalog.has_table_privilege('authenticated','public.payments','DELETE')
     or pg_catalog.has_table_privilege('anon','public.order_payments','INSERT')
     or pg_catalog.has_table_privilege('authenticated','public.order_payments','INSERT')
     or pg_catalog.has_table_privilege('anon','public.audit_logs','INSERT')
     or pg_catalog.has_table_privilege('authenticated','public.audit_logs','INSERT') then
    raise exception '011c_browser_write_lockdown_regressed';
  end if;
END
$$;

select
  pg_catalog.has_table_privilege('service_role','public.orders','SELECT,UPDATE') as orders_parent_acl,
  pg_catalog.has_table_privilege('service_role','public.bookings','SELECT,UPDATE') as bookings_parent_acl,
  pg_catalog.has_table_privilege('service_role','public.payments','SELECT,INSERT,UPDATE') as payments_acl,
  pg_catalog.has_table_privilege('service_role','public.order_payments','SELECT,INSERT') as order_projection_acl,
  pg_catalog.has_table_privilege('service_role','public.audit_logs','INSERT') as audit_insert;
