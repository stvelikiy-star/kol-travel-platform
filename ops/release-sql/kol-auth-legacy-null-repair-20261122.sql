-- KÖL one-time repair: TEST Supabase project mphruawzozrpwcjgejhs ONLY.
-- Precondition: independent encrypted backup and disposable restore PASS.
-- Supabase Auth officially expects empty strings rather than legacy NULLs.
-- This script updates ONLY four legacy token string columns, not passwords,
-- emails, identities, app metadata, roles, sessions or public business data.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
DO $auth_preflight$
DECLARE v_total integer; v_confirm integer;v_recovery integer;v_change integer;v_change_new integer;
BEGIN
 SELECT count(*),count(*) FILTER (WHERE confirmation_token IS NULL),
 count(*) FILTER (WHERE recovery_token IS NULL),
 count(*) FILTER (WHERE email_change IS NULL),
 count(*) FILTER (WHERE email_change_token_new IS NULL)
 INTO v_total,v_confirm,v_recovery,v_change,v_change_new
 FROM auth.users;
 IF v_total<>5 OR v_confirm<>4 OR v_recovery<>4 OR v_change<>4 OR v_change_new<>4 OR
    (SELECT count(*) FROM auth.sessions)<>0 OR
    (SELECT count(*) FROM auth.users WHERE email LIKE 'kol-qa-%' OR email LIKE 'kol-e2e-%')<>0 THEN
   RAISE EXCEPTION 'auth_repair_precondition_failed' USING ERRCODE='P0001';
 END IF;
END
$auth_preflight$;
UPDATE auth.users
 SET confirmation_token=coalesce(confirmation_token,''),
     recovery_token=coalesce(recovery_token,''),
     email_change=coalesce(email_change,''),
     email_change_token_new=coalesce(email_change_token_new,'')
 WHERE confirmation_token IS NULL OR recovery_token IS NULL
    OR email_change IS NULL OR email_change_token_new IS NULL;
DO $auth_postflight$
BEGIN
 IF (SELECT count(*) FROM auth.users)<>5 OR
   (SELECT count(*) FROM auth.users WHERE confirmation_token IS NULL OR recovery_token IS NULL OR
       email_change IS NULL OR email_change_token_new IS NULL)<>0 OR
   (SELECT count(*) FROM public.user_profiles)<>5 OR
   (SELECT count(*) FROM public.user_roles)<>5 THEN
   RAISE EXCEPTION 'auth_repair_postcondition_failed' USING ERRCODE='P0001';
 END IF;
 RAISE NOTICE 'KOL_AUTH_LEGACY_NULL_REPAIR PASS: four legacy token fields normalized; users and roles unchanged';
END
$auth_postflight$;
COMMIT;
