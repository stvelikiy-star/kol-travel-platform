-- Read-only VERIFY after DRAFT 029, disposable Supabase only.
DO $verify$
DECLARE v_oid oid := to_regprocedure('public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)');
BEGIN
 IF v_oid IS NULL THEN RAISE EXCEPTION '029_claim_rpc_missing'; END IF;
 IF has_function_privilege('anon',v_oid,'EXECUTE') OR
    NOT has_function_privilege('authenticated',v_oid,'EXECUTE') THEN
   RAISE EXCEPTION '029_claim_rpc_acl'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=v_oid AND prosecdef AND
   array_to_string(proconfig,',') LIKE '%search_path=%') THEN
   RAISE EXCEPTION '029_claim_rpc_security'; END IF;
 IF position('email_confirmed_at' IN pg_get_functiondef(v_oid))=0 OR
    position('intake_email_verification_mismatch' IN pg_get_functiondef(v_oid))=0 OR
    position('intake_owned_by_other_client' IN pg_get_functiondef(v_oid))=0 THEN
   RAISE EXCEPTION '029_claim_missing_verified_identity_guards'; END IF;
END $verify$;
SELECT '029_VERIFIED_EMAIL_CLAIM_VERIFY_PASS' AS result;
