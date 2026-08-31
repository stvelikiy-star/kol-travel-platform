-- KÖL / kol-travel-platform
-- COURIER ACTIVE DELIVERY READ — VERIFICATION

DO $$
DECLARE
  v_oid oid;
  v_security_definer boolean;
  v_search_path_ok boolean;
BEGIN
  SELECT p.oid, p.prosecdef,
         EXISTS (
           SELECT 1
           FROM unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           WHERE cfg = 'search_path=' OR cfg = 'search_path=""'
         )
  INTO v_oid, v_security_definer, v_search_path_ok
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_courier_active_deliveries'
    AND pg_get_function_identity_arguments(p.oid) = '';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'courier_active_delivery_read_rpc_missing';
  END IF;

  IF NOT v_security_definer THEN
    RAISE EXCEPTION 'courier_active_delivery_read_rpc_must_be_security_definer';
  END IF;

  IF NOT v_search_path_ok THEN
    RAISE EXCEPTION 'courier_active_delivery_read_rpc_search_path_not_locked';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'courier_active_delivery_read_rpc_anon_execute_must_be_revoked';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'courier_active_delivery_read_rpc_authenticated_execute_missing';
  END IF;

  IF has_table_privilege('authenticated', 'public.orders', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.orders', 'INSERT')
     OR has_table_privilege('authenticated', 'public.orders', 'DELETE') THEN
    RAISE EXCEPTION 'courier_read_followup_must_not_restore_direct_order_dml';
  END IF;
END
$$;

SELECT
  'courier_active_delivery_read_acl' AS check_name,
  has_function_privilege('authenticated', 'public.get_courier_active_deliveries()', 'EXECUTE') AS authenticated_execute,
  has_function_privilege('anon', 'public.get_courier_active_deliveries()', 'EXECUTE') AS anon_execute;
