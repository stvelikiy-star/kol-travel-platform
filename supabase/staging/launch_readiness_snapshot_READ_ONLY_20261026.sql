-- KÖL RELEASE READINESS SNAPSHOT · 2026-10-26
-- READ ONLY. Safe for a live inventory/preflight (no DDL, DML or secrets).
-- IMPORTANT: this does NOT execute a backup, verify role isolation, or authorize production.
BEGIN;
SET TRANSACTION READ ONLY;
WITH atomic_names(name) AS (
 VALUES ('create_stay_booking_atomic'),('create_tour_booking_atomic'),
        ('create_order_atomic'),('partner_update_booking_status_atomic'),
        ('partner_update_order_status_atomic')
), missing_rpcs AS (
 SELECT a.name FROM atomic_names a
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
  'status', CASE WHEN (SELECT count(*) FROM missing_rpcs)=0 AND (SELECT count(*) FROM direct_dml)=0
                       AND (SELECT count(*) FROM policyless)=0
                       AND (SELECT count(*) FROM unpinned_helpers)=0
                       AND (SELECT count(*) FROM missing_fk_indexes)=0
                       AND (SELECT count(*) FROM unsafe_api_grants)=0
                       AND EXISTS (SELECT 1 FROM storage.buckets WHERE id='catalog-media' AND public=false)
                       THEN 'SOURCE_DB_GATES_PASS'
                 ELSE 'SOURCE_DB_GATES_BLOCKED' END,
  'missing_atomic_rpcs', COALESCE((SELECT jsonb_agg(name ORDER BY name) FROM missing_rpcs),'[]'::jsonb),
  'existing_legacy_transaction_rpcs', COALESCE((
    SELECT jsonb_agg(DISTINCT p.proname ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN (
      'client_stay_booking_create_atomic','client_onboarding_complete_atomic',
      'client_support_ticket_create_atomic','admin_support_lifecycle_atomic'
    )
  ),'[]'::jsonb),
  'direct_transaction_dml_grants', (SELECT count(*) FROM direct_dml),
  'rls_tables_without_policies', (SELECT count(*) FROM policyless),
  'helper_functions_without_fixed_search_path', (SELECT count(*) FROM unpinned_helpers),
  'missing_single_column_fk_indexes', (SELECT count(*) FROM missing_fk_indexes),
  'unsafe_data_api_grants', (SELECT count(*) FROM unsafe_api_grants),
  'catalog_media_bucket_ready', EXISTS (SELECT 1 FROM storage.buckets WHERE id='catalog-media' AND public=false),
  'migration_ledger_rows', (SELECT count(*) FROM supabase_migrations.schema_migrations),
  'public_tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'),
  'public_functions', (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'warning', 'Zero counts do not replace role E2E, actual backup/restore, or catalog verification'
)) AS kol_release_readiness;
COMMIT;
