-- KOL 048: append-only double-entry recognition ledger. No actual charges/refunds/transfers.
-- Journal posts only an OWNER-approved completed subject and verifiably paid event.
CREATE TABLE public.kol_finance_journals_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 journal_kind text NOT NULL DEFAULT 'recognition' CHECK(journal_kind='recognition'),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 12 AND 128),
 subject_type text NOT NULL CHECK(subject_type IN ('order','booking')),
 subject_id uuid NOT NULL,
 business_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
 payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
 verified_event_id uuid NOT NULL REFERENCES private.payment_provider_events(id) ON DELETE RESTRICT,
 contract_id uuid NOT NULL REFERENCES public.kol_finance_terms_v1(id) ON DELETE RESTRICT,
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 collection_model text NOT NULL CHECK(collection_model IN ('platform','partner')),
 gross_amount numeric(14,2) NOT NULL CHECK(gross_amount>0),
 platform_fee numeric(14,2) NOT NULL CHECK(platform_fee>=0 AND platform_fee<=gross_amount),
 partner_allocation numeric(14,2) NOT NULL CHECK(partner_allocation>=0),
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 8 AND 200),
 recognized_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT kol_recognition_one_per_subject UNIQUE(journal_kind,subject_type,subject_id),
 CONSTRAINT kol_recognition_amount_check CHECK(partner_allocation=gross_amount-platform_fee)
);
CREATE INDEX kol_finance_journals_recognition_date_v1 ON public.kol_finance_journals_v1(recognized_at,business_id);
CREATE TABLE public.kol_finance_entries_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 journal_id uuid NOT NULL REFERENCES public.kol_finance_journals_v1(id) ON DELETE RESTRICT,
 ledger_account text NOT NULL CHECK(ledger_account IN (
   'provider_clearing','partner_payable','partner_receivable','platform_commission_revenue')),
 entry_side text NOT NULL CHECK(entry_side IN ('debit','credit')),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(journal_id,ledger_account,entry_side)
);
CREATE INDEX kol_finance_entries_journal_v1 ON public.kol_finance_entries_v1(journal_id);
ALTER TABLE public.kol_finance_journals_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_finance_entries_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kol_finance_journals_v1,public.kol_finance_entries_v1
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.kol_finance_journals_v1,public.kol_finance_entries_v1
 TO service_role;
CREATE OR REPLACE FUNCTION private.kol_finance_reject_mutation_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
BEGIN
 RAISE EXCEPTION 'finance_journal_append_only' USING ERRCODE='42501';
END;
$guard$;
REVOKE ALL ON FUNCTION private.kol_finance_reject_mutation_v1() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER kol_journals_immutable_v1 BEFORE UPDATE OR DELETE ON public.kol_finance_journals_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();
CREATE TRIGGER kol_entries_immutable_v1 BEFORE UPDATE OR DELETE ON public.kol_finance_entries_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();

CREATE OR REPLACE FUNCTION public.kol_post_verified_recognition_v1(
 p_subject_type text,p_subject_id uuid,p_idempotency_key text,
 p_approved_by uuid,p_approval_reference text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $body$
DECLARE
 v_existing public.kol_finance_journals_v1%ROWTYPE;
 v_business uuid;v_type text;v_currency text;v_gross numeric;v_status text;
 v_payment_status text;v_created_at timestamptz;
 v_payment_count int;v_payment_id uuid;v_paid_amount numeric;v_provider text;v_provider_ref text;
 v_event_id uuid;v_term_count int;v_term_id uuid;v_rate numeric;v_fixed numeric;v_model text;
 v_fee numeric;v_partner_share numeric;v_journal_id uuid;v_debit numeric;v_credit numeric;
BEGIN
 IF p_subject_type NOT IN ('order','booking') OR p_subject_id IS NULL OR
    p_approved_by IS NULL OR p_idempotency_key IS NULL OR
    length(p_idempotency_key) NOT BETWEEN 12 AND 128 OR
    p_approval_reference IS NULL OR length(btrim(p_approval_reference)) NOT BETWEEN 8 AND 200 THEN
  RAISE EXCEPTION 'invalid_journal_request' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.user_roles r JOIN public.user_profiles u ON u.user_id=r.user_id
   WHERE r.user_id=p_approved_by AND r.role='super_admin'
     AND r.is_active AND u.status='active'
 ) THEN
  RAISE EXCEPTION 'active_owner_approval_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject_type||':'||p_subject_id::text,1));
 SELECT * INTO v_existing FROM public.kol_finance_journals_v1
   WHERE journal_kind='recognition' AND subject_type=p_subject_type AND subject_id=p_subject_id;
 IF FOUND THEN
   IF v_existing.idempotency_key=p_idempotency_key AND
      v_existing.approved_by=p_approved_by AND
      v_existing.approval_reference=p_approval_reference THEN
     RETURN jsonb_build_object('ok',true,'duplicate',true,'journal_id',v_existing.id,
       'gross_amount',v_existing.gross_amount,'platform_fee',v_existing.platform_fee,
       'currency',v_existing.currency,'recognized_at',v_existing.recognized_at);
   END IF;
   RAISE EXCEPTION 'recognition_already_posted_with_other_request' USING ERRCODE='23505';
 END IF;
 IF EXISTS(SELECT 1 FROM public.kol_finance_journals_v1 WHERE idempotency_key=p_idempotency_key) THEN
   RAISE EXCEPTION 'idempotency_key_reused' USING ERRCODE='23505';
 END IF;
 IF p_subject_type='order' THEN
   SELECT o.business_id,o.type,'KGS',o.total,o.status,o.payment_status,o.created_at
    INTO v_business,v_type,v_currency,v_gross,v_status,v_payment_status,v_created_at
   FROM public.orders o WHERE o.id=p_subject_id FOR UPDATE;
 ELSE
   SELECT b.business_id,b.booking_type,
     coalesce(CASE WHEN b.booking_type='stay' THEN nullif(btrim(st.currency),'')
       WHEN b.booking_type='tour' THEN nullif(btrim(t.currency),'') END,'UNKNOWN'),
     b.total,b.status,b.payment_status,b.created_at
    INTO v_business,v_type,v_currency,v_gross,v_status,v_payment_status,v_created_at
   FROM public.bookings b
   LEFT JOIN public.rooms r ON b.booking_type='stay' AND r.id=b.object_id
   LEFT JOIN public.stays st ON st.id=r.stay_id
   LEFT JOIN public.tours t ON b.booking_type='tour' AND t.id=b.object_id
   WHERE b.id=p_subject_id FOR UPDATE OF b;
 END IF;
 IF v_business IS NULL OR v_status<>'completed' OR v_payment_status<>'paid' OR
    v_currency='UNKNOWN' OR v_gross IS NULL OR v_gross<=0 OR
    v_gross<>round(v_gross,2) THEN
  RAISE EXCEPTION 'subject_not_ready_for_recognition' USING ERRCODE='42501';
 END IF;
 SELECT count(*),max(p.id),max(p.amount),max(p.provider),max(p.provider_reference)
  INTO v_payment_count,v_payment_id,v_paid_amount,v_provider,v_provider_ref
 FROM public.payments p WHERE p.status='paid'
   AND ((p_subject_type='order' AND p.order_id=p_subject_id) OR
        (p_subject_type='booking' AND p.booking_id=p_subject_id));
 IF v_payment_count<>1 OR v_paid_amount IS DISTINCT FROM v_gross OR
    v_provider IS NULL OR v_provider_ref IS NULL THEN
  RAISE EXCEPTION 'exactly_one_matching_paid_payment_required' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.refunds f WHERE f.payment_id=v_payment_id) THEN
  RAISE EXCEPTION 'refund_or_dispute_blocks_recognition' USING ERRCODE='42501';
 END IF;
 SELECT e.id INTO v_event_id FROM private.payment_provider_events e
 WHERE e.payment_id=v_payment_id AND e.provider=v_provider
   AND e.provider_reference=v_provider_ref AND e.requested_status='paid'
   AND e.processing_status='applied' AND e.amount=v_gross
 ORDER BY e.processed_at DESC NULLS LAST,e.id DESC LIMIT 1;
 IF v_event_id IS NULL THEN
  RAISE EXCEPTION 'verified_provider_payment_event_required' USING ERRCODE='42501';
 END IF;
 SELECT count(*),max(t.id),max(t.rate_percent),max(t.fixed_fee),max(t.collection_model)
   INTO v_term_count,v_term_id,v_rate,v_fixed,v_model
 FROM public.kol_finance_terms_v1 t
 WHERE t.business_id=v_business AND t.service_line=v_type AND t.currency=v_currency
   AND (v_created_at AT TIME ZONE 'Asia/Bishkek')::date>=t.valid_from
   AND (v_created_at AT TIME ZONE 'Asia/Bishkek')::date<t.valid_until;
 IF v_term_count<>1 THEN
  RAISE EXCEPTION 'exactly_one_owner_approved_contract_required' USING ERRCODE='42501';
 END IF;
 v_fee:=round(v_gross*v_rate/100+v_fixed,2);
 v_partner_share:=v_gross-v_fee;
 IF v_fee<0 OR v_fee>v_gross OR (v_model='partner' AND v_fee=0) THEN
  RAISE EXCEPTION 'invalid_commission_for_posting' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.kol_finance_journals_v1(
   journal_kind,idempotency_key,subject_type,subject_id,business_id,payment_id,
   verified_event_id,contract_id,currency,collection_model,gross_amount,
   platform_fee,partner_allocation,approved_by,approval_reference
 ) VALUES('recognition',p_idempotency_key,p_subject_type,p_subject_id,v_business,v_payment_id,
   v_event_id,v_term_id,v_currency,v_model,v_gross,v_fee,v_partner_share,p_approved_by,p_approval_reference)
 RETURNING id INTO v_journal_id;
 IF v_model='platform' THEN
   INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
    VALUES(v_journal_id,'provider_clearing','debit',v_gross,v_currency);
   IF v_partner_share>0 THEN
     INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
      VALUES(v_journal_id,'partner_payable','credit',v_partner_share,v_currency);
   END IF;
 ELSE
   INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
    VALUES(v_journal_id,'partner_receivable','debit',v_fee,v_currency);
 END IF;
 IF v_fee>0 THEN
   INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
    VALUES(v_journal_id,'platform_commission_revenue','credit',v_fee,v_currency);
 END IF;
 SELECT coalesce(sum(amount) FILTER (WHERE entry_side='debit'),0),
        coalesce(sum(amount) FILTER (WHERE entry_side='credit'),0)
 INTO v_debit,v_credit FROM public.kol_finance_entries_v1 WHERE journal_id=v_journal_id;
 IF v_debit IS DISTINCT FROM v_credit OR v_debit<=0 THEN
   RAISE EXCEPTION 'unbalanced_financial_journal' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,request_id,after)
 VALUES(p_approved_by,'super_admin','kol_finance_recognition_posted','kol_finance_journals_v1',
   v_journal_id,p_approval_reference,p_idempotency_key,
   jsonb_build_object('subject_type',p_subject_type,'subject_id',p_subject_id,
    'payment_id',v_payment_id,'contract_id',v_term_id,
    'gross',v_gross,'fee',v_fee,'currency',v_currency));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'journal_id',v_journal_id,
    'gross_amount',v_gross,'platform_fee',v_fee,'currency',v_currency,
    'recognized_at',(SELECT recognized_at FROM public.kol_finance_journals_v1 WHERE id=v_journal_id));
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_post_verified_recognition_v1(text,uuid,text,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_post_verified_recognition_v1(text,uuid,text,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.kol_finance_journal_report_v1(
 p_from date,p_to date,p_business_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $report$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 WITH journals AS (
  SELECT * FROM public.kol_finance_journals_v1 j
  WHERE j.recognized_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND j.recognized_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR j.business_id=p_business_id)
 ),
 sums AS (
  SELECT j.currency, count(*) AS n,sum(j.gross_amount) gross,
    sum(j.platform_fee) fee,
    sum(CASE WHEN j.collection_model='platform' THEN j.partner_allocation ELSE 0 END) partner_payable,
    sum(CASE WHEN j.collection_model='partner' THEN j.platform_fee ELSE 0 END) partner_receivable
  FROM journals j GROUP BY j.currency
 )
 SELECT jsonb_build_object(
  'schema_version',1,'kind','posted_recognition_journal',
  'period_from',p_from,'period_to_exclusive',p_to,
  'date_basis','recognized_at','timezone','Asia/Bishkek',
  'business_id',p_business_id,
  'journal_count',(SELECT count(*) FROM journals),
  'by_currency',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'currency',currency,'recognitions',n,'verified_provider_gross',gross,
     'recognized_platform_fee',fee,
     'posted_partner_payable_before_payouts',partner_payable,
     'posted_partner_receivable_before_collections',partner_receivable
  ) ORDER BY currency),'[]'::jsonb) FROM sums),
  'bank_settled',NULL,'actual_paid_payout',NULL,'net_profit',NULL,
  'warning','Ledger recognition is approved and source-verified; bank settlement, payouts, costs, and profit require separate postings.'
 )
 );
END;
$report$;
REVOKE ALL ON FUNCTION public.kol_finance_journal_report_v1(date,date,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_finance_journal_report_v1(date,date,uuid) TO service_role;
