-- Read-only VERIFY after DRAFT 031, disposable Supabase only.
DO $verify$
DECLARE v_core oid := to_regprocedure('private.create_order_for_client_atomic_core(uuid,text,jsonb,text,text,uuid,uuid,text,uuid,text)');
        v_client oid := to_regprocedure('public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text)');
BEGIN
 IF v_core IS NULL OR v_client IS NULL THEN RAISE EXCEPTION '031_order_core_missing'; END IF;
 IF has_function_privilege('anon',v_core,'EXECUTE') OR
    has_function_privilege('authenticated',v_core,'EXECUTE') THEN
   RAISE EXCEPTION '031_private_core_leaked'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_core AND prosecdef AND
    array_to_string(proconfig,',') LIKE '%search_path=%') THEN
   RAISE EXCEPTION '031_core_security'; END IF;
 IF position('delivery_pricing_not_configured' IN pg_get_functiondef(v_client))=0 THEN
   RAISE EXCEPTION '031_client_delivery_fail_closed_missing'; END IF;
 IF position('payment_status' IN pg_get_functiondef(v_core))=0 OR
    position('idempotency_key' IN pg_get_functiondef(v_core))=0 OR
    position('approved_delivery_tariff_missing' IN pg_get_functiondef(v_core))=0 THEN
   RAISE EXCEPTION '031_order_core_missing_invariants'; END IF;
END $verify$;
SELECT '031_SHARED_ORDER_CORE_VERIFY_PASS' AS result;
