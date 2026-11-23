-- KÖL / QA ONLY. Runs exclusively on kol-travel-platform-test.
-- Full transaction is ALWAYS rolled back. Never counts as a bank/provider transfer.
-- Private provider evidence below is an isolated SYNTHETIC fixture for SQL testing.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
DO $finance_qa$
DECLARE
  v_client uuid;
  v_owner uuid;
  v_business uuid;
  v_order uuid;
  v_payment uuid;
  v_key text := 'qa-finance-' || txid_current()::text;
  v_ref text := 'qa-provider-event-' || txid_current()::text;
  v_created jsonb;
  v_repeat jsonb;
  v_req uuid;
  v_approved jsonb;
  v_approved_again jsonb;
BEGIN
  SELECT ur.user_id INTO v_client FROM public.user_roles ur
    JOIN public.user_profiles up ON up.user_id=ur.user_id
    WHERE ur.role='client' AND ur.is_active AND up.status='active'
    ORDER BY ur.created_at LIMIT 1;
  SELECT ur.user_id INTO v_owner FROM public.user_roles ur
    JOIN public.user_profiles up ON up.user_id=ur.user_id
    WHERE ur.role='super_admin' AND ur.is_active AND up.status='active'
    ORDER BY ur.created_at LIMIT 1;
  SELECT p.id INTO v_business FROM public.partners p
    WHERE p.status='approved' AND NOT EXISTS(
      SELECT 1 FROM public.partner_stop_statuses ps WHERE ps.business_id=p.id
        AND ps.scope_type='new_orders' AND ps.is_paused
        AND (ps.resume_at IS NULL OR ps.resume_at>now()))
    ORDER BY p.created_at LIMIT 1;
  IF v_client IS NULL OR v_owner IS NULL OR v_business IS NULL OR v_client=v_owner THEN
    RAISE EXCEPTION 'qa_finance_missing_isolated_baseline';
  END IF;

  INSERT INTO public.orders(client_id,business_id,type,status,subtotal,delivery_fee,
    discount,total,payment_status,metadata)
    VALUES(v_client,v_business,'food','new',2,0,0,2,'pending',
      jsonb_build_object('qa_only_rollback',true))
    RETURNING id INTO v_order;
  INSERT INTO public.payments(user_id,order_id,method,status,amount,provider,provider_reference,
    metadata)
    VALUES(v_client,v_order,'qa-only','paid',2,'qa-fixture-only',v_ref,
      jsonb_build_object('qa_only_rollback',true))
    RETURNING id INTO v_payment;
  INSERT INTO private.payment_provider_events(
    provider,event_id,provider_reference,event_type,requested_status,
    amount,payload_hash,processing_status,payment_id,metadata,processed_at)
    VALUES('qa-fixture-only',v_key,v_ref,'qa_synthetic_paid_event','paid',2,
      repeat('a',64),'applied',v_payment,
      jsonb_build_object('qa_only_rollback',true),now());

  v_created := public.kol_create_finance_request_v1(
    'refund',v_payment,1,v_client,v_key||'-refund',
    'QA ONLY synthetic refundable source; no bank transfer');
  IF v_created->>'ok' IS DISTINCT FROM 'true' OR
     v_created->>'duplicate' IS DISTINCT FROM 'false' THEN
     RAISE EXCEPTION 'qa_finance_request_not_created';
  END IF;
  v_req := (v_created->>'request_id')::uuid;
  v_repeat := public.kol_create_finance_request_v1(
    'refund',v_payment,1,v_client,v_key||'-refund',
    'QA ONLY synthetic refundable source; no bank transfer');
  IF v_repeat->>'duplicate' IS DISTINCT FROM 'true' OR
     (v_repeat->>'request_id')::uuid IS DISTINCT FROM v_req THEN
     RAISE EXCEPTION 'qa_finance_request_not_idempotent';
  END IF;

  BEGIN
    PERFORM public.kol_create_finance_request_v1(
      'refund',v_payment,1.25,v_client,v_key||'-refund-conflict',
      'QA ONLY conflicting request amount');
    RAISE EXCEPTION 'qa_finance_duplicate_source_accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM public.kol_decide_finance_request_v1(
      v_req,'approved',v_client,'QA ONLY requester cannot approve');
    RAISE EXCEPTION 'qa_finance_self_approval_accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%independent_owner_approval_required%' THEN RAISE; END IF;
  END;

  v_approved := public.kol_decide_finance_request_v1(
    v_req,'approved',v_owner,'QA ONLY approved for SQL test; NOT PAID');
  IF v_approved->>'ok' IS DISTINCT FROM 'true'
      OR v_approved->>'duplicate' IS DISTINCT FROM 'false'
      OR v_approved->>'money_transferred' IS DISTINCT FROM 'false' THEN
     RAISE EXCEPTION 'qa_finance_decision_wrong_state';
  END IF;
  v_approved_again := public.kol_decide_finance_request_v1(
    v_req,'approved',v_owner,'QA ONLY approved for SQL test; NOT PAID');
  IF v_approved_again->>'duplicate' IS DISTINCT FROM 'true'
     OR (v_approved_again->>'decision_id')::uuid IS DISTINCT FROM
        (v_approved->>'decision_id')::uuid
     OR v_approved_again->>'money_transferred' IS DISTINCT FROM 'false' THEN
     RAISE EXCEPTION 'qa_finance_approval_not_idempotent';
  END IF;

  BEGIN
    PERFORM public.kol_decide_finance_request_v1(
      v_req,'rejected',v_owner,'QA ONLY conflicting decision blocked');
    RAISE EXCEPTION 'qa_finance_conflicting_decision_accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.kol_finance_requests_v1
      SET reason='QA test bypass immutability' WHERE id=v_req;
    RAISE EXCEPTION 'qa_finance_request_mutation_accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM NOT LIKE '%finance_journal_append_only%' THEN RAISE; END IF;
  END;

  IF (SELECT count(*) FROM public.refunds WHERE payment_id=v_payment)<>0 OR
     (SELECT count(*) FROM public.payouts WHERE status='paid')<>0 THEN
    RAISE EXCEPTION 'qa_finance_false_money_execution';
  END IF;
  RAISE NOTICE 'QA_FINANCE_TRANSACTION PASS: synthetic refund request, independent approval, repeat/conflict guards, immutable entries, money_transferred=false';
END
$finance_qa$;
-- Never commit synthetic provider evidence or ledger records.
ROLLBACK;
SELECT 'QA_FINANCE_ROLLBACK_FINAL PASS: synthetic finance transaction not persisted' AS result;
