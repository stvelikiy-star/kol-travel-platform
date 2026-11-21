-- KOL finance: owner-attested commission terms and read-only NON-POSTING settlement preview.
-- No default rates, no mutation to payments, refunds, payouts, commissions or transactions.
CREATE TABLE IF NOT EXISTS public.kol_finance_terms_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
 service_line text NOT NULL CHECK (service_line IN ('food','shop','stay','tour')),
 currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
 rate_percent numeric(7,4) NOT NULL CHECK (rate_percent>=0 AND rate_percent<=100),
 fixed_fee numeric(12,2) NOT NULL CHECK (fixed_fee>=0),
 collection_model text NOT NULL CHECK (collection_model IN ('platform','partner')),
 valid_from date NOT NULL,
 valid_until date NOT NULL,
 agreement_reference text NOT NULL CHECK (length(btrim(agreement_reference)) BETWEEN 6 AND 250),
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 approved_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT kol_finance_terms_date_check CHECK (valid_until>valid_from)
);
CREATE INDEX IF NOT EXISTS kol_finance_terms_lookup
 ON public.kol_finance_terms_v1(business_id,service_line,currency,valid_from,valid_until);
ALTER TABLE public.kol_finance_terms_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kol_finance_terms_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.kol_finance_terms_v1 TO service_role;
CREATE OR REPLACE FUNCTION private.kol_finance_terms_guard_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $guard$
BEGIN
 IF TG_OP<>'INSERT' THEN
   RAISE EXCEPTION 'contract_append_only' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.user_roles r
   JOIN public.user_profiles u ON u.user_id=r.user_id
   WHERE r.user_id=NEW.approved_by AND r.role='super_admin' AND r.is_active
     AND u.status='active'
 ) THEN
   RAISE EXCEPTION 'active_owner_approval_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
   NEW.business_id::text||'|'||NEW.service_line||'|'||NEW.currency,0));
 IF EXISTS(
   SELECT 1 FROM public.kol_finance_terms_v1 t
   WHERE t.business_id=NEW.business_id AND t.service_line=NEW.service_line
     AND t.currency=NEW.currency
     AND daterange(t.valid_from,t.valid_until,'[)') &&
         daterange(NEW.valid_from,NEW.valid_until,'[)')
 ) THEN
   RAISE EXCEPTION 'overlapping_agreement_period' USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION private.kol_finance_terms_guard_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS kol_finance_terms_guard_v1 ON public.kol_finance_terms_v1;
CREATE TRIGGER kol_finance_terms_guard_v1
 BEFORE INSERT OR UPDATE OR DELETE ON public.kol_finance_terms_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_terms_guard_v1();
CREATE OR REPLACE FUNCTION public.kol_finance_settlement_preview_v1(
 p_from date,p_to date,p_business_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $report$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
   RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 WITH subjects AS (
   SELECT 'order'::text AS subject_type,o.id,o.business_id,o.type AS service_line,
     'KGS'::text AS currency,o.total AS gross,o.status,o.payment_status,o.created_at
   FROM public.orders o
   WHERE o.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND o.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND (p_business_id IS NULL OR o.business_id=p_business_id)
   UNION ALL
   SELECT 'booking'::text,b.id,b.business_id,b.booking_type,
     COALESCE(CASE WHEN b.booking_type='stay' THEN NULLIF(btrim(st.currency),'')
       WHEN b.booking_type='tour' THEN NULLIF(btrim(tr.currency),'') END,'UNKNOWN'),
     b.total,b.status,b.payment_status,b.created_at
   FROM public.bookings b
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours tr ON b.booking_type='tour' AND tr.id=b.object_id
   WHERE b.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND b.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND (p_business_id IS NULL OR b.business_id=p_business_id)
 ),
 checks AS (
   SELECT s.*,
     coalesce(paid.paid_count,0) AS paid_count,
     coalesce(paid.verified_count,0) AS verified_count,
     paid.amount AS verified_amount,
     coalesce(paid.has_refund,false) AS has_refund,
     coalesce(term.contract_count,0) AS contract_count,
     term.rate_percent,term.fixed_fee,term.collection_model,
     round((paid.amount * term.rate_percent/100 + term.fixed_fee)::numeric,2) AS projected_fee
   FROM subjects s
   LEFT JOIN LATERAL (
     SELECT count(*) AS paid_count,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM private.payment_provider_events ev
         WHERE ev.payment_id=p.id AND ev.provider=p.provider
           AND ev.provider_reference=p.provider_reference
           AND ev.requested_status='paid' AND ev.processing_status='applied'
           AND ev.amount=p.amount
       )) AS verified_count,
       max(p.amount) FILTER (WHERE EXISTS (
         SELECT 1 FROM private.payment_provider_events ev
         WHERE ev.payment_id=p.id AND ev.provider=p.provider
           AND ev.provider_reference=p.provider_reference
           AND ev.requested_status='paid' AND ev.processing_status='applied'
           AND ev.amount=p.amount
       )) AS amount,
       bool_or(EXISTS(
         SELECT 1 FROM public.refunds rf WHERE rf.payment_id=p.id
       )) AS has_refund
     FROM public.payments p
     WHERE p.status='paid'
       AND ((s.subject_type='order' AND p.order_id=s.id)
         OR (s.subject_type='booking' AND p.booking_id=s.id))
   ) paid ON true
   LEFT JOIN LATERAL (
     SELECT count(*) AS contract_count,min(t.rate_percent) AS rate_percent,
       min(t.fixed_fee) AS fixed_fee,min(t.collection_model) AS collection_model
     FROM public.kol_finance_terms_v1 t
     WHERE t.business_id=s.business_id AND t.service_line=s.service_line
       AND t.currency=s.currency
       AND (s.created_at AT TIME ZONE 'Asia/Bishkek')::date >= t.valid_from
       AND (s.created_at AT TIME ZONE 'Asia/Bishkek')::date < t.valid_until
   ) term ON true
 ),
 marked AS (
   SELECT *,(
     status='completed' AND payment_status='paid' AND paid_count=1
     AND verified_count=1 AND NOT has_refund AND contract_count=1
     AND currency<>'UNKNOWN' AND verified_amount=gross AND gross>=0
     AND projected_fee IS NOT NULL AND projected_fee<=verified_amount
   ) AS is_preview_eligible
   FROM checks
 )
 SELECT jsonb_build_object(
   'schema_version',1,'kind','non_posting_settlement_preview',
   'period_from',p_from,'period_to_exclusive',p_to,
   'timezone','Asia/Bishkek','business_id',p_business_id,
   'counts',jsonb_build_object(
     'subjects',(SELECT count(*) FROM marked),
     'completed',(SELECT count(*) FROM marked WHERE status='completed'),
     'paid_rows',(SELECT count(*) FROM marked WHERE paid_count>0),
     'verified_paid_rows',(SELECT count(*) FROM marked WHERE verified_count=1 AND paid_count=1),
     'preview_eligible',(SELECT count(*) FROM marked WHERE is_preview_eligible),
     'unverified_paid_subjects',(SELECT count(*) FROM marked WHERE paid_count>verified_count),
     'duplicate_paid_subjects',(SELECT count(*) FROM marked WHERE paid_count>1),
     'refund_blocked',(SELECT count(*) FROM marked WHERE has_refund),
     'missing_terms',(SELECT count(*) FROM marked WHERE verified_count=1 AND contract_count=0),
     'ambiguous_terms',(SELECT count(*) FROM marked WHERE contract_count>1),
     'overpriced_fee',(SELECT count(*) FROM marked WHERE projected_fee>verified_amount)
   ),
   'by_currency',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'currency',currency,'eligible_count',n,
     'provider_verified_gross',gross_total,
     'provisional_platform_fee',fee_total,
     'provisional_partner_allocation_if_platform_collects',partner_share,
     'provisional_platform_receivable_if_partner_collects',partner_collected_fee
   ) ORDER BY currency),'[]'::jsonb)
   FROM (
     SELECT currency,count(*) AS n,sum(verified_amount) AS gross_total,
       sum(projected_fee) AS fee_total,
       sum(CASE WHEN collection_model='platform' THEN verified_amount-projected_fee ELSE 0 END)
         AS partner_share,
       sum(CASE WHEN collection_model='partner' THEN projected_fee ELSE 0 END)
         AS partner_collected_fee
     FROM marked WHERE is_preview_eligible GROUP BY currency
   ) t),
   'recognized_revenue',NULL,'actual_partner_payable',NULL,
   'actual_paid_payout',NULL,'profit',NULL,'posted_financial_transactions',0,
   'warning','PROVISIONAL ONLY: contracts and provider events do not substitute for bank reconciliation or a posted ledger.'
 )
 );
END;
$report$;
REVOKE ALL ON FUNCTION public.kol_finance_settlement_preview_v1(date,date,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_finance_settlement_preview_v1(date,date,uuid)
 TO service_role;
