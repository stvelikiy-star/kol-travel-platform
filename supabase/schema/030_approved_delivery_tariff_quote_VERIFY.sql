-- Read-only VERIFY after DRAFT 030, disposable Supabase only.
DO $verify$
DECLARE v_oid oid := to_regprocedure('public.quote_intake_delivery_fee_atomic(uuid,uuid,text)');
        v_table oid := to_regclass('private.kol_delivery_tariffs');
BEGIN
 IF v_table IS NULL OR v_oid IS NULL THEN RAISE EXCEPTION '030_quote_or_tariff_missing'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid=v_table AND relrowsecurity) THEN
   RAISE EXCEPTION '030_tariff_rls_missing'; END IF;
 IF has_table_privilege('anon',v_table,'SELECT') OR
    has_table_privilege('authenticated',v_table,'SELECT') OR
    NOT has_table_privilege('service_role',v_table,'SELECT') THEN
   RAISE EXCEPTION '030_tariff_acl'; END IF;
 IF has_function_privilege('anon',v_oid,'EXECUTE') OR
    NOT has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
   RAISE EXCEPTION '030_quote_rpc_acl'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_oid AND prosecdef AND
   array_to_string(proconfig,',') LIKE '%search_path=%') THEN
   RAISE EXCEPTION '030_quote_rpc_security'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='private' AND
    tablename='kol_delivery_tariffs' AND indexname='idx_kol_delivery_tariffs_active_business') THEN
   RAISE EXCEPTION '030_active_tariff_index_missing'; END IF;
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='private'
    AND table_name='kol_delivery_tariffs' AND column_name='fee_som' AND column_default IS NOT NULL) THEN
   RAISE EXCEPTION '030_fee_must_not_have_default'; END IF;
 IF position('delivery_tariff_not_configured' IN pg_get_functiondef(v_oid))=0 THEN
   RAISE EXCEPTION '030_missing_fail_closed_no_tariff'; END IF;
END $verify$;
SELECT '030_APPROVED_DELIVERY_TARIFF_VERIFY_PASS' AS result;
