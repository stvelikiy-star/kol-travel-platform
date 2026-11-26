-- Owner-attested settlement evidence attached to the existing recognition journal.
-- No provider calls, payment status changes, or automatic cash movement.
CREATE TABLE public.kol_finance_settlement_evidence_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 journal_id uuid NOT NULL REFERENCES public.kol_finance_journals_v1(id) ON DELETE RESTRICT,
 request_id uuid REFERENCES public.kol_finance_requests_v1(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('payout','collection')),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 evidence_reference text NOT NULL UNIQUE CHECK(length(btrim(evidence_reference)) BETWEEN 8 AND 250),
 evidence_date date NOT NULL,
 recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 reversal_of uuid UNIQUE REFERENCES public.kol_finance_settlement_evidence_v1(id) ON DELETE RESTRICT,
 CHECK((kind='payout' AND request_id IS NOT NULL) OR (kind='collection' AND request_id IS NULL))
);
CREATE INDEX kol_settlement_evidence_journal_v1 ON public.kol_finance_settlement_evidence_v1(journal_id);
CREATE INDEX kol_settlement_evidence_request_v1 ON public.kol_finance_settlement_evidence_v1(request_id);
CREATE INDEX kol_settlement_evidence_actor_v1 ON public.kol_finance_settlement_evidence_v1(recorded_by);
ALTER TABLE public.kol_finance_settlement_evidence_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kol_finance_settlement_evidence_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.kol_finance_settlement_evidence_v1 TO service_role;
CREATE TRIGGER kol_settlement_evidence_immutable_v1 BEFORE UPDATE OR DELETE ON public.kol_finance_settlement_evidence_v1 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();

CREATE OR REPLACE FUNCTION public.kol_record_settlement_evidence_v1(
 p_journal_id uuid,p_kind text,p_amount numeric,p_reference text,p_evidence_date date,p_actor uuid,p_reversal_of uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE j public.kol_finance_journals_v1%ROWTYPE;
 req public.kol_finance_requests_v1%ROWTYPE;
 orig public.kol_finance_settlement_evidence_v1%ROWTYPE;
 existing public.kol_finance_settlement_evidence_v1%ROWTYPE;
 v_id uuid; v_limit numeric; v_posted numeric; v_request uuid;
 v_ref text:=btrim(p_reference);
BEGIN
 IF p_journal_id IS NULL OR p_actor IS NULL OR p_kind NOT IN ('payout','collection') OR p_kind IS NULL
 OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_amount>999999999999.99
 OR v_ref IS NULL OR length(v_ref) NOT BETWEEN 8 AND 250 OR p_evidence_date IS NULL
 OR p_evidence_date>(now() AT TIME ZONE 'Asia/Bishkek')::date THEN
  RAISE EXCEPTION 'invalid_settlement_evidence' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u JOIN public.user_roles r ON r.user_id=u.user_id
  WHERE u.user_id=p_actor AND u.status='active' AND r.is_active AND r.role='super_admin') THEN
  RAISE EXCEPTION 'owner_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('settlement-evidence:'||p_journal_id::text,0));
 SELECT * INTO j FROM public.kol_finance_journals_v1 WHERE id=p_journal_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'journal_not_found' USING ERRCODE='22023'; END IF;
 IF p_evidence_date < (j.recognized_at AT TIME ZONE 'Asia/Bishkek')::date THEN
  RAISE EXCEPTION 'evidence_before_recognition' USING ERRCODE='22023';
 END IF;
 SELECT * INTO existing FROM public.kol_finance_settlement_evidence_v1 WHERE evidence_reference=v_ref;
 IF FOUND THEN
  IF existing.journal_id=p_journal_id AND existing.kind=p_kind AND existing.amount=p_amount
   AND existing.evidence_date=p_evidence_date AND existing.recorded_by=p_actor AND existing.reversal_of IS NOT DISTINCT FROM p_reversal_of THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'id',existing.id,'money_transferred',false);
  END IF;
  RAISE EXCEPTION 'evidence_reference_reused' USING ERRCODE='23505';
 END IF;
 IF p_reversal_of IS NOT NULL THEN
  SELECT * INTO orig FROM public.kol_finance_settlement_evidence_v1 WHERE id=p_reversal_of;
  IF NOT FOUND OR orig.journal_id<>j.id OR orig.kind<>p_kind OR orig.amount<>p_amount OR orig.reversal_of IS NOT NULL
   OR p_evidence_date<orig.evidence_date THEN RAISE EXCEPTION 'invalid_evidence_reversal' USING ERRCODE='22023'; END IF;
  v_request:=orig.request_id;
 ELSE
  IF EXISTS(SELECT 1 FROM public.refunds WHERE payment_id=j.payment_id) OR
     EXISTS(SELECT 1 FROM public.kol_finance_requests_v1 WHERE payment_id=j.payment_id AND request_kind='refund') THEN
   RAISE EXCEPTION 'refund_review_required' USING ERRCODE='42501';
  END IF;
  IF p_kind='payout' THEN
   SELECT r.* INTO req FROM public.kol_finance_requests_v1 r JOIN public.kol_finance_decisions_v1 d ON d.request_id=r.id
    WHERE r.journal_id=j.id AND r.request_kind='payout' AND d.decision='approved';
   IF NOT FOUND OR j.collection_model<>'platform' OR req.currency<>j.currency OR req.business_id<>j.business_id THEN
    RAISE EXCEPTION 'approved_payout_required' USING ERRCODE='42501';
   END IF;
   v_limit:=least(req.amount,j.partner_allocation); v_request:=req.id;
  ELSE
   IF j.collection_model<>'partner' THEN RAISE EXCEPTION 'partner_collection_required' USING ERRCODE='42501'; END IF;
   v_limit:=j.platform_fee;
  END IF;
  SELECT coalesce(sum(CASE WHEN reversal_of IS NULL THEN amount ELSE -amount END),0)
  INTO v_posted FROM public.kol_finance_settlement_evidence_v1 WHERE journal_id=j.id AND kind=p_kind;
  IF v_posted<0 OR v_posted+p_amount>v_limit THEN RAISE EXCEPTION 'settlement_exceeds_remaining_amount' USING ERRCODE='23514'; END IF;
 END IF;
 INSERT INTO public.kol_finance_settlement_evidence_v1(journal_id,request_id,kind,currency,amount,evidence_reference,evidence_date,recorded_by,reversal_of)
 VALUES(j.id,v_request,p_kind,j.currency,p_amount,v_ref,p_evidence_date,p_actor,p_reversal_of) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,after)
 VALUES(p_actor,'super_admin','kol_settlement_evidence_recorded','kol_finance_settlement_evidence_v1',v_id,v_ref,
 jsonb_build_object('journal_id',j.id,'kind',p_kind,'amount',p_amount,'currency',j.currency,'reversal_of',p_reversal_of,'money_transferred',false));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'id',v_id,'money_transferred',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_record_settlement_evidence_v1(uuid,text,numeric,text,date,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_record_settlement_evidence_v1(uuid,text,numeric,text,date,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.kol_settlement_evidence_report_v1(p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $report$
 WITH ev AS (
 SELECT journal_id, sum(CASE WHEN reversal_of IS NULL THEN amount ELSE -amount END) recorded
 FROM public.kol_finance_settlement_evidence_v1 GROUP BY journal_id
 ), base AS (
 SELECT j.id,j.business_id,j.currency,j.collection_model,j.recognized_at,
  CASE WHEN j.collection_model='platform' THEN j.partner_allocation ELSE j.platform_fee END AS obligation,
  coalesce(ev.recorded,0) AS recorded,
  CASE WHEN j.collection_model='platform' THEN 'payout' ELSE 'collection' END AS kind,
  CASE WHEN j.collection_model='platform' THEN least(coalesce(r.amount,0),j.partner_allocation) ELSE j.platform_fee END AS eligible,
  (EXISTS(SELECT 1 FROM public.refunds f WHERE f.payment_id=j.payment_id) OR EXISTS(SELECT 1 FROM public.kol_finance_requests_v1 q WHERE q.payment_id=j.payment_id AND q.request_kind='refund')) AS refund_review
 FROM public.kol_finance_journals_v1 j LEFT JOIN ev ON ev.journal_id=j.id
 LEFT JOIN public.kol_finance_requests_v1 r ON r.journal_id=j.id AND r.request_kind='payout' AND EXISTS(SELECT 1 FROM public.kol_finance_decisions_v1 d WHERE d.request_id=r.id AND d.decision='approved')
 WHERE p_business_id IS NULL OR j.business_id=p_business_id
 ), sums AS (
 SELECT currency,kind,sum(obligation) obligation,sum(recorded) recorded,sum(obligation-recorded) remaining
 FROM base GROUP BY currency,kind
 )
 SELECT jsonb_build_object('kind','owner_attested_settlement_evidence','business_id',p_business_id,
 'by_currency',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY currency,kind) FROM sums s),'[]'::jsonb),
 'sources',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY recognized_at DESC,id) FROM (SELECT * FROM base WHERE NOT refund_review AND eligible>recorded ORDER BY recognized_at DESC,id LIMIT 100) b),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY recorded_at DESC,id) FROM (
 SELECT e.id,e.journal_id,e.kind,e.currency,e.amount,e.evidence_date,e.evidence_reference,e.recorded_at,e.reversal_of,
 EXISTS(SELECT 1 FROM public.kol_finance_settlement_evidence_v1 v WHERE v.reversal_of=e.id) AS reversed
 FROM public.kol_finance_settlement_evidence_v1 e JOIN base b ON b.id=e.journal_id ORDER BY e.recorded_at DESC,e.id LIMIT 100
 ) e),'[]'::jsonb),'bank_verified',false,'money_transferred',false);
$report$;
REVOKE ALL ON FUNCTION public.kol_settlement_evidence_report_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_settlement_evidence_report_v1(uuid) TO service_role;
