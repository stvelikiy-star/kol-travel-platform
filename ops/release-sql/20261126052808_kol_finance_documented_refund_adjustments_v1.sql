-- Documented refund adjustments, linked to the existing recognition journal.
-- No provider call, no payment/refund status mutation. Commission allocation is owner-attested, never assumed.
CREATE TABLE public.kol_finance_refund_adjustments_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 journal_id uuid NOT NULL REFERENCES public.kol_finance_journals_v1(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL REFERENCES public.kol_finance_requests_v1(id) ON DELETE RESTRICT,
 gross_amount numeric(14,2) NOT NULL CHECK(gross_amount>0),
 fee_reduction numeric(14,2) NOT NULL CHECK(fee_reduction>=0 AND fee_reduction<=gross_amount),
 evidence_reference text NOT NULL UNIQUE CHECK(length(btrim(evidence_reference)) BETWEEN 8 AND 250),
 evidence_date date NOT NULL,
 recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 reversal_of uuid UNIQUE REFERENCES public.kol_finance_refund_adjustments_v1(id) ON DELETE RESTRICT
);
CREATE INDEX kol_refund_adjustments_journal_v1 ON public.kol_finance_refund_adjustments_v1(journal_id);
CREATE INDEX kol_refund_adjustments_request_v1 ON public.kol_finance_refund_adjustments_v1(request_id);
CREATE INDEX kol_refund_adjustments_actor_v1 ON public.kol_finance_refund_adjustments_v1(recorded_by);
ALTER TABLE public.kol_finance_refund_adjustments_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kol_finance_refund_adjustments_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.kol_finance_refund_adjustments_v1 TO service_role;
CREATE TRIGGER kol_refund_adjustments_immutable_v1 BEFORE UPDATE OR DELETE ON public.kol_finance_refund_adjustments_v1 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();
CREATE OR REPLACE FUNCTION public.kol_record_refund_adjustment_v1(
 p_request_id uuid,p_fee_reduction numeric,p_reference text,p_evidence_date date,p_actor uuid,p_reversal_of uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE r public.kol_finance_requests_v1%ROWTYPE;
 j public.kol_finance_journals_v1%ROWTYPE;
 o public.kol_finance_refund_adjustments_v1%ROWTYPE;
 e public.kol_finance_refund_adjustments_v1%ROWTYPE;
 v_id uuid; v_ref text:=btrim(p_reference);
BEGIN
 IF p_request_id IS NULL OR p_actor IS NULL OR p_fee_reduction IS NULL OR p_fee_reduction<0 OR p_fee_reduction<>round(p_fee_reduction,2)
 OR v_ref IS NULL OR length(v_ref) NOT BETWEEN 8 AND 250 OR p_evidence_date IS NULL OR p_evidence_date>(now() AT TIME ZONE 'Asia/Bishkek')::date THEN
  RAISE EXCEPTION 'invalid_refund_adjustment' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u JOIN public.user_roles ur ON ur.user_id=u.user_id WHERE u.user_id=p_actor AND u.status='active' AND ur.is_active AND ur.role='super_admin') THEN
  RAISE EXCEPTION 'owner_required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM public.kol_finance_requests_v1 WHERE id=p_request_id AND request_kind='refund';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.kol_finance_decisions_v1 d WHERE d.request_id=r.id AND d.decision='approved') THEN
  RAISE EXCEPTION 'approved_refund_required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO STRICT j FROM public.kol_finance_journals_v1 WHERE payment_id=r.payment_id AND journal_kind='recognition';
 PERFORM pg_advisory_xact_lock(hashtextextended('settlement-evidence:'||j.id::text,0));
 IF r.business_id<>j.business_id OR r.currency<>j.currency OR r.amount>j.gross_amount
 OR p_fee_reduction>least(r.amount,j.platform_fee) OR r.amount-p_fee_reduction>j.partner_allocation
 OR p_evidence_date<(j.recognized_at AT TIME ZONE 'Asia/Bishkek')::date THEN
  RAISE EXCEPTION 'invalid_refund_allocation' USING ERRCODE='22023';
 END IF;
 SELECT * INTO e FROM public.kol_finance_refund_adjustments_v1 WHERE evidence_reference=v_ref;
 IF FOUND THEN
  IF e.request_id=r.id AND e.fee_reduction=p_fee_reduction AND e.evidence_date=p_evidence_date AND e.recorded_by=p_actor AND e.reversal_of IS NOT DISTINCT FROM p_reversal_of THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'id',e.id,'money_transferred',false);
  END IF;
  RAISE EXCEPTION 'reference_reused' USING ERRCODE='23505';
 END IF;
 IF p_reversal_of IS NOT NULL THEN
  SELECT * INTO o FROM public.kol_finance_refund_adjustments_v1 WHERE id=p_reversal_of;
  IF NOT FOUND OR o.request_id<>r.id OR o.journal_id<>j.id OR o.reversal_of IS NOT NULL OR o.fee_reduction<>p_fee_reduction OR p_evidence_date<o.evidence_date THEN
   RAISE EXCEPTION 'invalid_adjustment_reversal' USING ERRCODE='22023';
  END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.kol_finance_refund_adjustments_v1 a WHERE a.journal_id=j.id AND a.reversal_of IS NULL AND NOT EXISTS(SELECT 1 FROM public.kol_finance_refund_adjustments_v1 v WHERE v.reversal_of=a.id)) THEN
   RAISE EXCEPTION 'refund_adjustment_exists' USING ERRCODE='23505';
  END IF;
 END IF;
 INSERT INTO public.kol_finance_refund_adjustments_v1(journal_id,request_id,gross_amount,fee_reduction,evidence_reference,evidence_date,recorded_by,reversal_of)
 VALUES(j.id,r.id,r.amount,p_fee_reduction,v_ref,p_evidence_date,p_actor,p_reversal_of) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,after)
 VALUES(p_actor,'super_admin','kol_refund_adjustment_recorded','kol_finance_refund_adjustments_v1',v_id,v_ref,
 jsonb_build_object('journal_id',j.id,'request_id',r.id,'amount',r.amount,'fee_reduction',p_fee_reduction,'currency',j.currency,'reversal_of',p_reversal_of,'money_transferred',false));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'id',v_id,'money_transferred',false);
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_record_refund_adjustment_v1(uuid,numeric,text,date,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_record_refund_adjustment_v1(uuid,numeric,text,date,uuid,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.kol_refund_adjustments_report_v1(p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$
 SELECT jsonb_build_object('kind','owner_attested_refund_adjustments','business_id',p_business_id,'money_transferred',false,
 'sources',coalesce((SELECT jsonb_agg(to_jsonb(s)) FROM (
 SELECT r.id request_id,j.id journal_id,j.currency,r.amount gross_amount,
 greatest(r.amount-j.partner_allocation,0) min_fee_reduction,least(r.amount,j.platform_fee) max_fee_reduction
 FROM public.kol_finance_requests_v1 r JOIN public.kol_finance_decisions_v1 d ON d.request_id=r.id AND d.decision='approved'
 JOIN public.kol_finance_journals_v1 j ON j.payment_id=r.payment_id
 WHERE r.request_kind='refund' AND r.currency=j.currency AND r.business_id=j.business_id AND r.amount<=j.gross_amount
 AND (p_business_id IS NULL OR j.business_id=p_business_id)
 AND NOT EXISTS(SELECT 1 FROM public.kol_finance_refund_adjustments_v1 a WHERE a.journal_id=j.id AND a.reversal_of IS NULL AND NOT EXISTS(SELECT 1 FROM public.kol_finance_refund_adjustments_v1 v WHERE v.reversal_of=a.id))
 ORDER BY r.requested_at DESC LIMIT 100) s),'[]'::jsonb),
 'recent',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
 SELECT a.id,a.request_id,a.gross_amount,a.fee_reduction,a.evidence_reference,a.evidence_date,a.reversal_of,j.currency,
 EXISTS(SELECT 1 FROM public.kol_finance_refund_adjustments_v1 v WHERE v.reversal_of=a.id) reversed
 FROM public.kol_finance_refund_adjustments_v1 a JOIN public.kol_finance_journals_v1 j ON j.id=a.journal_id
 WHERE p_business_id IS NULL OR j.business_id=p_business_id ORDER BY a.recorded_at DESC LIMIT 100) t),'[]'::jsonb));
$body$;
REVOKE ALL ON FUNCTION public.kol_refund_adjustments_report_v1(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_refund_adjustments_report_v1(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.kol_refund_adjustment_period_v1(p_from date,p_to date,p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $body$
 SELECT jsonb_build_object('kind','owner_attested_refund_period','business_id',p_business_id,'period_from',p_from,'period_to_exclusive',p_to,
 'by_currency',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
 SELECT j.currency,sum(CASE WHEN a.reversal_of IS NULL THEN a.gross_amount ELSE -a.gross_amount END) gross_reduction,
 sum(CASE WHEN a.reversal_of IS NULL THEN a.fee_reduction ELSE -a.fee_reduction END) fee_reduction
 FROM public.kol_finance_refund_adjustments_v1 a JOIN public.kol_finance_journals_v1 j ON j.id=a.journal_id
 WHERE a.recorded_at>=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek') AND a.recorded_at<(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
 AND (p_business_id IS NULL OR j.business_id=p_business_id) GROUP BY j.currency) t),'[]'::jsonb));
$body$;
REVOKE ALL ON FUNCTION public.kol_refund_adjustment_period_v1(date,date,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_refund_adjustment_period_v1(date,date,uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.kol_settlement_evidence_report_v1(p_business_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $report$
 WITH ev AS (
 SELECT journal_id, sum(CASE WHEN reversal_of IS NULL THEN amount ELSE -amount END) recorded
 FROM public.kol_finance_settlement_evidence_v1 GROUP BY journal_id
 ), adjustments AS (
 SELECT journal_id,sum(CASE WHEN reversal_of IS NULL THEN fee_reduction ELSE -fee_reduction END) fee_reduction,
 sum(CASE WHEN reversal_of IS NULL THEN gross_amount-fee_reduction ELSE -(gross_amount-fee_reduction) END) partner_reduction
 FROM public.kol_finance_refund_adjustments_v1 GROUP BY journal_id
 ), base AS (
 SELECT j.id,j.business_id,j.currency,j.collection_model,j.recognized_at,
  CASE WHEN j.collection_model='platform' THEN j.partner_allocation-coalesce(a.partner_reduction,0) ELSE j.platform_fee-coalesce(a.fee_reduction,0) END AS obligation,
  coalesce(ev.recorded,0) AS recorded,
  CASE WHEN j.collection_model='platform' THEN 'payout' ELSE 'collection' END AS kind,
  CASE WHEN j.collection_model='platform' THEN least(coalesce(r.amount,0),j.partner_allocation) ELSE j.platform_fee END AS eligible,
  (EXISTS(SELECT 1 FROM public.refunds f WHERE f.payment_id=j.payment_id) OR EXISTS(SELECT 1 FROM public.kol_finance_requests_v1 q WHERE q.payment_id=j.payment_id AND q.request_kind='refund')) AS refund_review
 FROM public.kol_finance_journals_v1 j LEFT JOIN ev ON ev.journal_id=j.id LEFT JOIN adjustments a ON a.journal_id=j.id
 LEFT JOIN public.kol_finance_requests_v1 r ON r.journal_id=j.id AND r.request_kind='payout' AND EXISTS(SELECT 1 FROM public.kol_finance_decisions_v1 d WHERE d.request_id=r.id AND d.decision='approved')
 WHERE p_business_id IS NULL OR j.business_id=p_business_id
 ), sums AS (
 SELECT currency,kind,sum(obligation) obligation,sum(recorded) recorded,sum(greatest(obligation-recorded,0)) remaining,sum(greatest(recorded-obligation,0)) excess
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
