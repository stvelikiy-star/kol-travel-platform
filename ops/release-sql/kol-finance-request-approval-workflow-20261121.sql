-- KOL 049: additive, append-only refund/payout REQUESTS and OWNER decisions.
-- No money is sent, no payout/refund is marked settled by these RPCs.
CREATE TABLE public.kol_finance_requests_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_kind text NOT NULL CHECK(request_kind IN ('refund','payout')),
 payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
 journal_id uuid REFERENCES public.kol_finance_journals_v1(id) ON DELETE RESTRICT,
 business_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 12 AND 128),
 requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 8 AND 1000),
 requested_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT kol_finance_request_source_shape CHECK(
    (request_kind='refund' AND payment_id IS NOT NULL AND journal_id IS NULL)
    OR (request_kind='payout' AND journal_id IS NOT NULL AND payment_id IS NULL))
);
CREATE UNIQUE INDEX kol_finance_one_refund_request_v1
 ON public.kol_finance_requests_v1(payment_id) WHERE request_kind='refund';
CREATE UNIQUE INDEX kol_finance_one_payout_request_v1
 ON public.kol_finance_requests_v1(journal_id) WHERE request_kind='payout';
CREATE INDEX kol_finance_requests_scope_v1
 ON public.kol_finance_requests_v1(business_id,requested_at,request_kind);
CREATE TABLE public.kol_finance_decisions_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES public.kol_finance_requests_v1(id) ON DELETE RESTRICT,
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 decision_reference text NOT NULL CHECK(length(btrim(decision_reference)) BETWEEN 8 AND 500),
 decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.kol_finance_requests_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_finance_decisions_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kol_finance_requests_v1,public.kol_finance_decisions_v1
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.kol_finance_requests_v1,public.kol_finance_decisions_v1
 TO service_role;
CREATE TRIGGER kol_requests_immutable_v1
 BEFORE UPDATE OR DELETE ON public.kol_finance_requests_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();
CREATE TRIGGER kol_decisions_immutable_v1
 BEFORE UPDATE OR DELETE ON public.kol_finance_decisions_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();

CREATE OR REPLACE FUNCTION public.kol_create_finance_request_v1(
 p_kind text,p_source_id uuid,p_amount numeric,p_requested_by uuid,
 p_idempotency_key text,p_reason text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE v_business uuid;v_gross numeric;v_currency text;v_paid_status text;
 v_model text;v_customer uuid;v_payment_id uuid;v_journal_id uuid;
 v_requester_ok boolean;v_existing public.kol_finance_requests_v1%ROWTYPE;
BEGIN
 IF p_kind NOT IN ('refund','payout') OR p_source_id IS NULL OR p_requested_by IS NULL OR
    p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR
    p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 12 AND 128 OR
    p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 1000 THEN
  RAISE EXCEPTION 'invalid_finance_request' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance-request:'||p_kind||p_source_id::text,2));
 IF p_kind='refund' THEN
   SELECT p.id,p.amount,p.status,
     coalesce(o.business_id,b.business_id),
     coalesce(o.client_id,b.client_id),
     CASE WHEN o.id IS NOT NULL THEN 'KGS'
       WHEN b.booking_type='stay' THEN coalesce(nullif(btrim(st.currency),''),'UNKNOWN')
       WHEN b.booking_type='tour' THEN coalesce(nullif(btrim(t.currency),''),'UNKNOWN')
       ELSE 'UNKNOWN' END
   INTO v_payment_id,v_gross,v_paid_status,v_business,v_customer,v_currency
   FROM public.payments p
   LEFT JOIN public.orders o ON o.id=p.order_id
   LEFT JOIN public.bookings b ON b.id=p.booking_id
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours t ON b.booking_type='tour' AND t.id=b.object_id
   WHERE p.id=p_source_id FOR UPDATE OF p;
   IF v_payment_id IS NULL OR v_business IS NULL OR v_currency='UNKNOWN' OR
      v_paid_status<>'paid' OR p_amount>v_gross OR
      EXISTS(SELECT 1 FROM public.refunds rf WHERE rf.payment_id=v_payment_id) OR
      NOT EXISTS(
        SELECT 1 FROM private.payment_provider_events ev
        JOIN public.payments p ON p.id=ev.payment_id
        WHERE ev.payment_id=v_payment_id AND ev.provider=p.provider
          AND ev.provider_reference=p.provider_reference
          AND ev.processing_status='applied' AND ev.requested_status='paid'
          AND ev.amount=p.amount
      ) THEN
      RAISE EXCEPTION 'paid_refund_source_not_eligible' USING ERRCODE='42501';
   END IF;
   v_requester_ok:=p_requested_by=v_customer OR EXISTS(
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id=p_requested_by AND r.is_active AND r.role IN ('super_admin','finance_admin'));
 ELSE
   SELECT j.id,j.business_id,j.partner_allocation,j.currency,j.collection_model,j.payment_id
   INTO v_journal_id,v_business,v_gross,v_currency,v_model,v_payment_id
   FROM public.kol_finance_journals_v1 j WHERE j.id=p_source_id;
   IF v_journal_id IS NULL OR v_model<>'platform' OR p_amount>v_gross OR
     EXISTS(SELECT 1 FROM public.refunds rf WHERE rf.payment_id=v_payment_id) THEN
     RAISE EXCEPTION 'partner_payout_source_not_eligible' USING ERRCODE='42501';
   END IF;
   v_requester_ok:=EXISTS(
    SELECT 1 FROM public.user_roles r WHERE r.user_id=p_requested_by AND r.is_active
      AND r.role IN ('super_admin','finance_admin')
   ) OR EXISTS(
    SELECT 1 FROM public.user_roles r
    JOIN public.partner_profiles p ON p.user_id=r.user_id AND p.business_id=v_business
    WHERE r.user_id=p_requested_by AND r.is_active
      AND r.role IN ('partner_owner','partner_manager')
   );
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u
    WHERE u.user_id=p_requested_by AND u.status='active') OR NOT v_requester_ok THEN
  RAISE EXCEPTION 'requester_not_authorized_for_finance_source' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_existing FROM public.kol_finance_requests_v1
   WHERE (p_kind='refund' AND payment_id=p_source_id)
      OR (p_kind='payout' AND journal_id=p_source_id);
 IF FOUND THEN
   IF v_existing.idempotency_key=p_idempotency_key AND
      v_existing.requested_by=p_requested_by AND v_existing.amount=p_amount AND
      v_existing.reason=p_reason THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'request_id',v_existing.id);
   END IF;
   RAISE EXCEPTION 'request_already_exists_for_source' USING ERRCODE='23505';
 END IF;
 IF EXISTS(SELECT 1 FROM public.kol_finance_requests_v1 WHERE idempotency_key=p_idempotency_key) THEN
   RAISE EXCEPTION 'request_idempotency_key_reuse' USING ERRCODE='23505';
 END IF;
 INSERT INTO public.kol_finance_requests_v1(
   request_kind,payment_id,journal_id,business_id,amount,currency,idempotency_key,
   requested_by,reason
 ) VALUES(p_kind,CASE WHEN p_kind='refund' THEN v_payment_id ELSE NULL END,
   CASE WHEN p_kind='payout' THEN v_journal_id ELSE NULL END,v_business,p_amount,
   v_currency,p_idempotency_key,p_requested_by,p_reason) RETURNING * INTO v_existing;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,reason,request_id,after)
 VALUES(p_requested_by,'kol_finance_request_created','kol_finance_requests_v1',
 v_existing.id,p_reason,p_idempotency_key,jsonb_build_object(
  'kind',p_kind,'business_id',v_business,'amount',p_amount,'currency',v_currency));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'request_id',v_existing.id);
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_create_finance_request_v1(text,uuid,numeric,uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_create_finance_request_v1(text,uuid,numeric,uuid,text,text)
 TO service_role;

CREATE OR REPLACE FUNCTION public.kol_decide_finance_request_v1(
 p_request_id uuid,p_decision text,p_decided_by uuid,p_evidence_ref text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE v_req public.kol_finance_requests_v1%ROWTYPE;
        v_dec public.kol_finance_decisions_v1%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_decision NOT IN ('approved','rejected')
   OR p_decided_by IS NULL OR p_evidence_ref IS NULL OR
   length(btrim(p_evidence_ref)) NOT BETWEEN 8 AND 500 THEN
   RAISE EXCEPTION 'invalid_decision_request' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance-decision:'||p_request_id::text,3));
 SELECT * INTO v_req FROM public.kol_finance_requests_v1
   WHERE id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found' USING ERRCODE='22023';END IF;
 IF v_req.requested_by=p_decided_by OR
   NOT EXISTS(SELECT 1 FROM public.user_roles r
     JOIN public.user_profiles u ON u.user_id=r.user_id
     WHERE r.user_id=p_decided_by AND r.role='super_admin' AND r.is_active
      AND u.status='active') THEN
  RAISE EXCEPTION 'independent_owner_approval_required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_dec FROM public.kol_finance_decisions_v1 WHERE request_id=p_request_id;
 IF FOUND THEN
  IF v_dec.decision=p_decision AND v_dec.decided_by=p_decided_by
     AND v_dec.decision_reference=p_evidence_ref THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,
     'decision_id',v_dec.id,'money_transferred',false);
  END IF;
  RAISE EXCEPTION 'request_already_decided' USING ERRCODE='23505';
 END IF;
 IF p_decision='approved' THEN
  IF v_req.request_kind='refund' AND
    (NOT EXISTS(SELECT 1 FROM public.payments p
       WHERE p.id=v_req.payment_id AND p.status='paid') OR
     EXISTS(SELECT 1 FROM public.refunds r WHERE r.payment_id=v_req.payment_id)) THEN
    RAISE EXCEPTION 'refund_source_changed' USING ERRCODE='42501';
  END IF;
  IF v_req.request_kind='payout' AND
    EXISTS(SELECT 1 FROM public.refunds r
      JOIN public.kol_finance_journals_v1 j ON j.payment_id=r.payment_id
      WHERE j.id=v_req.journal_id) THEN
    RAISE EXCEPTION 'payout_source_refunded' USING ERRCODE='42501';
  END IF;
 END IF;
 INSERT INTO public.kol_finance_decisions_v1(request_id,decision,decided_by,decision_reference)
  VALUES(p_request_id,p_decision,p_decided_by,p_evidence_ref)
  RETURNING * INTO v_dec;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,after)
 VALUES(p_decided_by,'super_admin','kol_finance_request_decided','kol_finance_decisions_v1',
  v_dec.id,p_evidence_ref,
  jsonb_build_object('request_id',p_request_id,'decision',p_decision,
   'money_transferred',false));
 RETURN jsonb_build_object('ok',true,'duplicate',false,
    'decision_id',v_dec.id,'money_transferred',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_decide_finance_request_v1(uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_decide_finance_request_v1(uuid,text,uuid,text)
 TO service_role;

CREATE OR REPLACE FUNCTION public.kol_finance_requests_report_v1(
 p_from date,p_to date,p_business_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $body$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
   RAISE EXCEPTION 'invalid_reporting_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 SELECT jsonb_build_object(
   'schema_version',1,'kind','approval_workflow_not_transfer',
   'period_from',p_from,'period_to_exclusive',p_to,
   'business_id',p_business_id,'timezone','Asia/Bishkek',
   'requests',(SELECT count(*) FROM public.kol_finance_requests_v1 r
     WHERE r.requested_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND r.requested_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND (p_business_id IS NULL OR r.business_id=p_business_id)),
   'by_kind_and_decision',(
     SELECT coalesce(jsonb_agg(jsonb_build_object(
       'kind',kind,'decision',decision,'count',n) ORDER BY kind,decision),'[]'::jsonb)
     FROM (
       SELECT r.request_kind kind,coalesce(d.decision,'pending') decision,count(*) n
       FROM public.kol_finance_requests_v1 r
       LEFT JOIN public.kol_finance_decisions_v1 d ON d.request_id=r.id
       WHERE r.requested_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
         AND r.requested_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
         AND (p_business_id IS NULL OR r.business_id=p_business_id)
       GROUP BY r.request_kind,coalesce(d.decision,'pending')
     ) v),
   'actual_refund_executed',NULL,'actual_payout_transferred',NULL,
   'warning','Approval is not evidence that funds moved. No settlement is executed.'
 )
 );
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_finance_requests_report_v1(date,date,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_finance_requests_report_v1(date,date,uuid)
 TO service_role;
