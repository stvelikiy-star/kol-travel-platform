-- KÖL RELEASE READINESS SNAPSHOT · 2026-10-26
-- READ ONLY. Safe for a live inventory/preflight (no DDL, DML or secrets).
-- IMPORTANT: this does NOT execute a backup, verify role isolation, or authorize production.
BEGIN;
SET TRANSACTION READ ONLY;
WITH atomic_names(name) AS (
 VALUES ('create_stay_booking_atomic'),('create_tour_booking_atomic'),
        ('create_order_atomic'),('partner_booking_action_atomic'),
        ('partner_order_action_atomic')
), missing_rpcs AS (
 SELECT a.name FROM atomic_names a
 WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=a.name
 )
), public_inventory_names(name) AS (
 VALUES ('get_public_stay_inventory'), ('get_public_tour_schedules')
), missing_public_inventory_rpcs AS (
 SELECT a.name FROM public_inventory_names a
 WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname=a.name
 )
), protected_tables(name) AS (
 VALUES ('bookings'),('booking_status_history'),('orders'),('order_items'),
        ('order_status_history'),('payments'),('order_payments'),('deliveries'),
        ('order_delivery'),('courier_assignments'),('delivery_status_history'),('audit_logs')
), direct_dml AS (
 SELECT g.table_name,g.grantee,g.privilege_type
 FROM information_schema.role_table_grants g JOIN protected_tables p ON p.name=g.table_name
 WHERE g.table_schema='public' AND g.grantee IN ('anon','authenticated')
   AND g.privilege_type IN ('INSERT','UPDATE','DELETE')
), inventory_direct_dml AS (
 SELECT table_name, grantee, privilege_type
 FROM information_schema.role_table_grants
 WHERE table_schema='public'
   AND table_name IN ('rooms','room_availability','tour_schedules')
   AND grantee IN ('anon','authenticated')
   AND privilege_type IN ('INSERT','UPDATE','DELETE')
), unpinned_helpers AS (
 SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
 AND p.proname IN ('set_updated_at','has_role','is_admin','is_finance_admin','is_partner_for','is_assigned_courier')
 AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}'::text[])) setting WHERE setting LIKE 'search_path=%')
), missing_fk_indexes AS (
 SELECT con.conname FROM pg_constraint con
 WHERE con.connamespace='public'::regnamespace AND con.contype='f' AND cardinality(con.conkey)=1
 AND NOT EXISTS (
  SELECT 1 FROM pg_index i WHERE i.indrelid=con.conrelid AND i.indisvalid
    AND i.indisready AND i.indkey[0]=con.conkey[1]
 )
), unsafe_api_grants AS (
 SELECT table_name,grantee,privilege_type
 FROM information_schema.role_table_grants
 WHERE table_schema='public'
 AND ((grantee='anon' AND (privilege_type<>'SELECT'
      OR table_name NOT IN ('partners','categories','tours','stays','menu_items','products','restaurants','shops')))
   OR (grantee='authenticated' AND privilege_type IN ('TRUNCATE','REFERENCES','TRIGGER')))
), policyless AS (
 SELECT c.relname
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
   AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname)
)
SELECT jsonb_pretty(jsonb_build_object(
  'status', CASE WHEN (SELECT count(*) FROM missing_rpcs)=0 AND (SELECT count(*) FROM missing_public_inventory_rpcs)=0 AND (SELECT count(*) FROM direct_dml)=0 AND (SELECT count(*) FROM inventory_direct_dml)=0
                       AND (SELECT count(*) FROM policyless)=0
                       AND (SELECT count(*) FROM unpinned_helpers)=0
                       AND (SELECT count(*) FROM missing_fk_indexes)=0
                       AND (SELECT count(*) FROM unsafe_api_grants)=0
                       AND EXISTS (SELECT 1 FROM storage.buckets WHERE id='catalog-media' AND public=false)
                       AND EXISTS (SELECT 1 FROM public.room_availability WHERE date >= CURRENT_DATE AND status='available' AND available_count>0)
                       AND EXISTS (SELECT 1 FROM public.tour_schedules WHERE date >= CURRENT_DATE AND status='available' AND capacity>booked_count)
                       AND NOT EXISTS (SELECT 1 FROM public.stays WHERE status='active' AND (price_from IS NULL OR price_from<=0))
                       AND NOT EXISTS (SELECT 1 FROM public.tours WHERE status='active' AND (price IS NULL OR price<=0))
                       THEN 'SOURCE_DB_GATES_PASS'
                 ELSE 'SOURCE_DB_GATES_BLOCKED' END,
  'missing_atomic_rpcs', COALESCE((SELECT jsonb_agg(name ORDER BY name) FROM missing_rpcs),'[]'::jsonb),
  'missing_public_inventory_rpcs', COALESCE((SELECT jsonb_agg(name ORDER BY name) FROM missing_public_inventory_rpcs),'[]'::jsonb),
  'existing_legacy_transaction_rpcs', COALESCE((
    SELECT jsonb_agg(DISTINCT p.proname ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'client_stay_booking_create_atomic','client_onboarding_complete_atomic',
      'client_support_ticket_create_atomic','admin_support_lifecycle_atomic'
    )
  ),'[]'::jsonb),
  'direct_transaction_dml_grants', (SELECT count(*) FROM direct_dml),
  'direct_inventory_dml_grants', (SELECT count(*) FROM inventory_direct_dml),
  'rls_tables_without_policies', (SELECT count(*) FROM policyless),
  'helper_functions_without_fixed_search_path', (SELECT count(*) FROM unpinned_helpers),
  'missing_single_column_fk_indexes', (SELECT count(*) FROM missing_fk_indexes),
  'unsafe_data_api_grants', (SELECT count(*) FROM unsafe_api_grants),
  'catalog_media_bucket_ready', EXISTS (SELECT 1 FROM storage.buckets WHERE id='catalog-media' AND public=false),
  'migration_ledger_rows', (SELECT count(*) FROM supabase_migrations.schema_migrations),
  'future_confirmed_room_slots', (SELECT count(*) FROM public.room_availability WHERE date >= CURRENT_DATE AND status='available' AND available_count>0),
  'future_confirmed_tour_slots', (SELECT count(*) FROM public.tour_schedules WHERE date >= CURRENT_DATE AND status='available' AND capacity>booked_count),
  'active_rooms', (SELECT count(*) FROM public.rooms WHERE status='active'),
  'approved_partners', (SELECT count(*) FROM public.partners WHERE status='approved'),
  'active_stays', (SELECT count(*) FROM public.stays WHERE status='active'),
  'active_tours', (SELECT count(*) FROM public.tours WHERE status='active'),
  'active_products', (SELECT count(*) FROM public.products WHERE status='active'),
  'approved_partners_missing_required_content', (
    SELECT count(*) FROM public.partners WHERE status='approved'
      AND (nullif(trim(title),'') IS NULL OR nullif(trim(description),'') IS NULL
           OR (nullif(trim(location),'') IS NULL AND nullif(trim(address),'') IS NULL))
  ),
  'active_stays_missing_required_content_or_price', (
    SELECT count(*) FROM public.stays WHERE status='active'
      AND (nullif(trim(title),'') IS NULL OR nullif(trim(description),'') IS NULL
           OR nullif(trim(location),'') IS NULL OR price_from IS NULL OR price_from<=0)
  ),
  'active_tours_missing_required_content_or_price', (
    SELECT count(*) FROM public.tours WHERE status='active'
      AND (nullif(trim(title),'') IS NULL OR nullif(trim(description),'') IS NULL
           OR nullif(trim(location),'') IS NULL OR price IS NULL OR price<=0)
  ),
  'active_products_missing_required_content_or_price', (
    SELECT count(*) FROM public.products WHERE status='active'
      AND (nullif(trim(title),'') IS NULL OR nullif(trim(description),'') IS NULL
           OR price IS NULL OR price<=0)
  ),
  'public_tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
  'public_functions', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'warning', 'Both future stay and tour capacity are mandatory for this launch gate; zero counts do not replace partner confirmation, role E2E, backup/restore or catalog verification'
)) AS kol_release_readiness;
COMMIT;
