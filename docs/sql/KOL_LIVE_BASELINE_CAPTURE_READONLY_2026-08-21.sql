-- KÖL live baseline evidence capture
-- Date: 2026-08-21
-- MODE: READ ONLY
--
-- Purpose:
--   Capture a deterministic, human-reviewable pre-migration baseline from the
--   recovered live PostgreSQL/Supabase project before any future authorized SQL apply.
--
-- Safety contract:
--   * No INSERT / UPDATE / DELETE / MERGE / TRUNCATE.
--   * No CREATE / ALTER / DROP / GRANT / REVOKE.
--   * No RPC/business function execution.
--   * No secrets are selected.
--   * The transaction is explicitly READ ONLY.
--
-- Run only with an account authorized to inspect the required system/auth/storage
-- metadata. A permission error is a stop condition; do not weaken live grants just
-- to make this report run.

BEGIN;
SET TRANSACTION READ ONLY;

-- ---------------------------------------------------------------------------
-- 1. Session / server identity
-- ---------------------------------------------------------------------------

SELECT
  now() AT TIME ZONE 'UTC' AS captured_at_utc,
  current_database() AS database_name,
  current_user AS database_user,
  current_setting('server_version') AS server_version,
  current_setting('transaction_read_only') AS transaction_read_only;

-- ---------------------------------------------------------------------------
-- 2. Migration ledger presence
-- ---------------------------------------------------------------------------

SELECT
  to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_ledger_exists,
  to_regclass('supabase_migrations.schema_migrations')::text AS migration_ledger_relation;

-- ---------------------------------------------------------------------------
-- 3. Public base-table inventory and RLS flags
-- ---------------------------------------------------------------------------

SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relkind,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT
  count(*) AS public_base_tables,
  count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled_tables,
  count(*) FILTER (WHERE c.relforcerowsecurity) AS rls_forced_tables
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p');

-- ---------------------------------------------------------------------------
-- 4. RLS policies and policy-less RLS tables
-- ---------------------------------------------------------------------------

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT count(*) AS public_policy_count
FROM pg_policies
WHERE schemaname = 'public';

SELECT
  c.relname AS rls_table_without_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polrelid = c.oid
  )
ORDER BY c.relname;

SELECT count(*) AS rls_tables_without_policy
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1
    FROM pg_policy p
    WHERE p.polrelid = c.oid
  );

-- ---------------------------------------------------------------------------
-- 5. Public functions: identity, SECURITY DEFINER and fixed config/search_path
-- ---------------------------------------------------------------------------

SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  p.prosecdef AS security_definer,
  p.provolatile AS volatility,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname, pg_get_function_identity_arguments(p.oid);

-- Focused check for recovered helper/trigger functions that were flagged in the
-- 2026-08-20 live security audit.
SELECT
  p.proname AS helper_function,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
    WHERE cfg LIKE 'search_path=%'
  ) AS has_fixed_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'set_updated_at',
    'has_role',
    'is_admin',
    'is_finance_admin',
    'is_partner_for',
    'is_assigned_courier'
  )
ORDER BY p.proname;

-- ---------------------------------------------------------------------------
-- 6. Public indexes and validity/readiness
-- ---------------------------------------------------------------------------

SELECT
  tn.nspname AS schema_name,
  tbl.relname AS table_name,
  idx.relname AS index_name,
  i.indisunique AS is_unique,
  i.indisprimary AS is_primary,
  i.indisvalid AS is_valid,
  i.indisready AS is_ready,
  pg_get_indexdef(i.indexrelid) AS index_definition
FROM pg_index i
JOIN pg_class tbl ON tbl.oid = i.indrelid
JOIN pg_namespace tn ON tn.oid = tbl.relnamespace
JOIN pg_class idx ON idx.oid = i.indexrelid
WHERE tn.nspname = 'public'
ORDER BY tbl.relname, idx.relname;

SELECT
  count(*) AS public_index_count,
  count(*) FILTER (WHERE NOT i.indisvalid) AS invalid_indexes,
  count(*) FILTER (WHERE NOT i.indisready) AS not_ready_indexes
FROM pg_index i
JOIN pg_class tbl ON tbl.oid = i.indrelid
JOIN pg_namespace tn ON tn.oid = tbl.relnamespace
WHERE tn.nspname = 'public';

-- ---------------------------------------------------------------------------
-- 7. Single-column public FK leading-index coverage
-- ---------------------------------------------------------------------------

WITH single_column_fk AS (
  SELECT
    con.oid AS constraint_oid,
    con.conname AS constraint_name,
    con.conrelid AS table_oid,
    con.conkey[1] AS fk_attnum,
    rel.relname AS table_name,
    att.attname AS column_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  JOIN pg_attribute att
    ON att.attrelid = con.conrelid
   AND att.attnum = con.conkey[1]
  WHERE con.contype = 'f'
    AND n.nspname = 'public'
    AND array_length(con.conkey, 1) = 1
), coverage AS (
  SELECT
    fk.*,
    EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = fk.table_oid
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts >= 1
        AND i.indkey[0] = fk.fk_attnum
    ) AS has_valid_ready_leading_index
  FROM single_column_fk fk
)
SELECT
  constraint_name,
  table_name,
  column_name,
  has_valid_ready_leading_index
FROM coverage
ORDER BY table_name, constraint_name;

WITH single_column_fk AS (
  SELECT
    con.conrelid AS table_oid,
    con.conkey[1] AS fk_attnum
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = rel.relnamespace
  WHERE con.contype = 'f'
    AND n.nspname = 'public'
    AND array_length(con.conkey, 1) = 1
), coverage AS (
  SELECT
    fk.*,
    EXISTS (
      SELECT 1
      FROM pg_index i
      WHERE i.indrelid = fk.table_oid
        AND i.indisvalid
        AND i.indisready
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnkeyatts >= 1
        AND i.indkey[0] = fk.fk_attnum
    ) AS covered
  FROM single_column_fk fk
)
SELECT
  count(*) AS single_column_public_fks,
  count(*) FILTER (WHERE covered) AS fks_with_valid_ready_leading_index,
  count(*) FILTER (WHERE NOT covered) AS fks_missing_valid_ready_leading_index
FROM coverage;

-- ---------------------------------------------------------------------------
-- 8. Table grants for API/trusted roles
-- ---------------------------------------------------------------------------

SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY grantee, table_name, privilege_type;

-- ---------------------------------------------------------------------------
-- 9. Stage-21 additive-field presence/absence guard
-- ---------------------------------------------------------------------------

WITH expected(schema_name, table_name, column_name) AS (
  VALUES
    ('public', 'menu_items', 'slug'),
    ('public', 'products', 'slug'),
    ('public', 'tours', 'image_url'),
    ('public', 'stays', 'capacity')
)
SELECT
  e.schema_name,
  e.table_name,
  e.column_name,
  EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = e.schema_name
      AND c.table_name = e.table_name
      AND c.column_name = e.column_name
  ) AS column_exists
FROM expected e
ORDER BY e.table_name, e.column_name;

-- ---------------------------------------------------------------------------
-- 10. Critical transactional row counts
-- ---------------------------------------------------------------------------
-- These relations are expected in the recovered baseline. If one is missing, the
-- query should fail rather than silently converting an unexpected schema change to 0.

SELECT 'bookings' AS relation, count(*)::bigint AS row_count FROM public.bookings
UNION ALL
SELECT 'booking_status_history', count(*)::bigint FROM public.booking_status_history
UNION ALL
SELECT 'orders', count(*)::bigint FROM public.orders
UNION ALL
SELECT 'order_items', count(*)::bigint FROM public.order_items
UNION ALL
SELECT 'order_status_history', count(*)::bigint FROM public.order_status_history
UNION ALL
SELECT 'payments', count(*)::bigint FROM public.payments
UNION ALL
SELECT 'order_payments', count(*)::bigint FROM public.order_payments
UNION ALL
SELECT 'transactions', count(*)::bigint FROM public.transactions
UNION ALL
SELECT 'delivery_status_history', count(*)::bigint FROM public.delivery_status_history
UNION ALL
SELECT 'courier_assignments', count(*)::bigint FROM public.courier_assignments
UNION ALL
SELECT 'media_files', count(*)::bigint FROM public.media_files
ORDER BY relation;

-- ---------------------------------------------------------------------------
-- 11. Auth and Storage non-secret inventory
-- ---------------------------------------------------------------------------

SELECT count(*)::bigint AS auth_user_count
FROM auth.users;

SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
ORDER BY id;

SELECT count(*)::bigint AS storage_bucket_count
FROM storage.buckets;

SELECT
  bucket_id,
  count(*)::bigint AS object_count
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;

SELECT count(*)::bigint AS storage_object_count
FROM storage.objects;

-- ---------------------------------------------------------------------------
-- 12. Deterministic V1 metadata fingerprints
-- ---------------------------------------------------------------------------
-- These fingerprints define a NEW explicit methodology for future baseline-to-
-- rehearsal comparisons. Do not compare them numerically to older fingerprints
-- unless the older capture used the same expressions.

SELECT
  md5(COALESCE(string_agg(
    concat_ws(':',
      table_schema,
      table_name,
      ordinal_position::text,
      column_name,
      data_type,
      COALESCE(udt_schema, ''),
      COALESCE(udt_name, ''),
      is_nullable,
      COALESCE(column_default, '')
    ),
    '|' ORDER BY table_schema, table_name, ordinal_position
  ), '')) AS public_columns_fingerprint_v1
FROM information_schema.columns
WHERE table_schema = 'public';

SELECT
  md5(COALESCE(string_agg(
    concat_ws(':',
      schemaname,
      tablename,
      policyname,
      permissive,
      COALESCE(array_to_string(roles, ','), ''),
      cmd,
      COALESCE(qual, ''),
      COALESCE(with_check, '')
    ),
    '|' ORDER BY tablename, policyname
  ), '')) AS public_policies_fingerprint_v1
FROM pg_policies
WHERE schemaname = 'public';

SELECT
  md5(COALESCE(string_agg(
    pg_get_functiondef(p.oid),
    E'\n--FUNCTION--\n' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)
  ), '')) AS public_functions_fingerprint_v1
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

SELECT
  md5(COALESCE(string_agg(
    pg_get_indexdef(i.indexrelid),
    E'\n--INDEX--\n' ORDER BY tbl.relname, idx.relname
  ), '')) AS public_indexes_fingerprint_v1
FROM pg_index i
JOIN pg_class tbl ON tbl.oid = i.indrelid
JOIN pg_namespace n ON n.oid = tbl.relnamespace
JOIN pg_class idx ON idx.oid = i.indexrelid
WHERE n.nspname = 'public';

-- ---------------------------------------------------------------------------
-- 13. Final read-only assertion
-- ---------------------------------------------------------------------------

SELECT current_setting('transaction_read_only') AS transaction_read_only_final;

COMMIT;
