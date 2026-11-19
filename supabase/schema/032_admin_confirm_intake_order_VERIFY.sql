-- Read-only VERIFY after DRAFT 032, disposable Supabase only.
DO $verify$
DECLARE v_oid oid := to_regprocedure('public.admin_confirm_intake_order_atomic(uuid,uuid,numeric,text,text)');
BEGIN
 IF v_oid IS NULL THEN RAISE EXCEPTION '032_operator_confirm_rpc_missing'; END IF;
 IF has_function_privilege('anon',v_oid,'EXECUTE') OR
    NOT has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
   RAISE EXCEPTION '032_operator_confirm_acl'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_oid AND prosecdef AND
    array_to_string(proconfig,',') LIKE '%search_path=%') THEN
   RAISE EXCEPTION '032_operator_confirm_security'; END IF;
 IF position('verified_ticket_client_required' IN pg_get_functiondef(v_oid))=0 OR
    position('related_order_id' IN pg_get_functiondef(v_oid))=0 OR
    position('delivery_quote_changed_require_reconfirmation' IN pg_get_functiondef(v_oid))=0 OR
    position('operator_confirmation_request_conflict' IN pg_get_functiondef(v_oid))=0 THEN
   RAISE EXCEPTION '032_operator_confirm_guards_missing'; END IF;
END $verify$;
SELECT '032_OPERATOR_CONFIRMED_ORDER_VERIFY_PASS' AS result;
