-- KÖL 050: OWNER-attested accrued expenses and immutable correcting reversals.
-- Does not execute bank payments, does not prove a document upload, does not claim net profit.
CREATE TABLE public.kol_finance_cost_journals_v1 (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 operation text NOT NULL CHECK(operation IN ('expense','reversal')),
 idempotency_key text NOT NULL UNIQUE CHECK(length(idempotency_key) BETWEEN 12 AND 128),
 original_id uuid REFERENCES public.kol_finance_cost_journals_v1(id) ON DELETE RESTRICT,
 business_id uuid REFERENCES public.partners(id) ON DELETE RESTRICT,
 category text NOT NULL CHECK(category IN ('hosting','marketing','staff','logistics','operations','other')),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 document_reference text NOT NULL CHECK(length(btrim(document_reference)) BETWEEN 8 AND 500),
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 approval_reference text NOT NULL CHECK(length(btrim(approval_reference)) BETWEEN 8 AND 500),
 posted_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((operation='expense' AND original_id IS NULL) OR
       (operation='reversal' AND original_id IS NOT NULL))
);
CREATE UNIQUE INDEX kol_cost_one_reversal_v1 ON public.kol_finance_cost_journals_v1(original_id)
 WHERE original_id IS NOT NULL;
CREATE INDEX kol_finance_cost_report_v1 ON public.kol_finance_cost_journals_v1(posted_at,currency,business_id);
CREATE TABLE public.kol_finance_cost_entries_v1(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cost_journal_id uuid NOT NULL REFERENCES public.kol_finance_cost_journals_v1(id) ON DELETE RESTRICT,
 ledger_account text NOT NULL CHECK(ledger_account IN ('operating_expense','accrued_expense_liability')),
 entry_side text NOT NULL CHECK(entry_side IN ('debit','credit')),
 amount numeric(14,2) NOT NULL CHECK(amount>0),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cost_journal_id,ledger_account,entry_side)
);
CREATE INDEX kol_cost_entries_by_journal_v1 ON public.kol_finance_cost_entries_v1(cost_journal_id);
ALTER TABLE public.kol_finance_cost_journals_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_finance_cost_entries_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kol_finance_cost_journals_v1,public.kol_finance_cost_entries_v1
 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON public.kol_finance_cost_journals_v1,public.kol_finance_cost_entries_v1 TO service_role;
CREATE TRIGGER kol_cost_journal_immutable_v1 BEFORE UPDATE OR DELETE ON public.kol_finance_cost_journals_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();
CREATE TRIGGER kol_cost_entries_immutable_v1 BEFORE UPDATE OR DELETE ON public.kol_finance_cost_entries_v1
 FOR EACH ROW EXECUTE FUNCTION private.kol_finance_reject_mutation_v1();

CREATE OR REPLACE FUNCTION public.kol_post_finance_cost_v1(
 p_operation text,p_amount numeric,p_currency text,p_category text,p_business_id uuid,
 p_document_reference text,p_approved_by uuid,p_approval_reference text,
 p_idempotency_key text,p_original_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $body$
DECLARE v_old public.kol_finance_cost_journals_v1%ROWTYPE;
 v_prev public.kol_finance_cost_journals_v1%ROWTYPE;
 v_id uuid;v_debits numeric;v_credits numeric;
 v_amount numeric;v_currency text;v_category text;v_business_id uuid;
BEGIN
 IF p_operation NOT IN ('expense','reversal') OR
    p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 12 AND 128 OR
    p_document_reference IS NULL OR length(btrim(p_document_reference)) NOT BETWEEN 8 AND 500 OR
    p_approval_reference IS NULL OR length(btrim(p_approval_reference)) NOT BETWEEN 8 AND 500 OR
    p_approved_by IS NULL THEN
    RAISE EXCEPTION 'invalid_cost_request' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.user_roles r
  JOIN public.user_profiles u ON u.user_id=r.user_id
  WHERE r.user_id=p_approved_by AND r.is_active AND r.role='super_admin'
    AND u.status='active'
 ) THEN
  RAISE EXCEPTION 'active_owner_approval_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kol-cost-key:'||p_idempotency_key,4));
 SELECT * INTO v_prev FROM public.kol_finance_cost_journals_v1 WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF v_prev.operation=p_operation AND v_prev.amount=p_amount
   AND v_prev.currency IS NOT DISTINCT FROM p_currency
   AND v_prev.category IS NOT DISTINCT FROM p_category
   AND v_prev.business_id IS NOT DISTINCT FROM p_business_id
   AND v_prev.document_reference=p_document_reference
   AND v_prev.approved_by=p_approved_by
   AND v_prev.approval_reference=p_approval_reference
   AND v_prev.original_id IS NOT DISTINCT FROM p_original_id THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'journal_id',v_prev.id,
    'operation',v_prev.operation,'recognized_cost',CASE WHEN v_prev.operation='expense' THEN v_prev.amount ELSE -v_prev.amount END);
  END IF;
  RAISE EXCEPTION 'cost_idempotency_conflict' USING ERRCODE='23505';
 END IF;
 IF p_operation='expense' THEN
  IF p_original_id IS NOT NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2)
   OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
   OR p_category NOT IN ('hosting','marketing','staff','logistics','operations','other') THEN
   RAISE EXCEPTION 'invalid_expense_terms' USING ERRCODE='22023';
  END IF;
  v_amount:=p_amount;v_currency:=p_currency;v_category:=p_category;v_business_id:=p_business_id;
 ELSE
  IF p_original_id IS NULL THEN RAISE EXCEPTION 'original_expense_required' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kol-cost-reversal:'||p_original_id::text,5));
  SELECT * INTO v_old FROM public.kol_finance_cost_journals_v1 WHERE id=p_original_id;
  IF NOT FOUND OR v_old.operation<>'expense' THEN
   RAISE EXCEPTION 'expense_to_reverse_not_found' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.kol_finance_cost_journals_v1 WHERE original_id=p_original_id) THEN
   RAISE EXCEPTION 'expense_already_reversed' USING ERRCODE='23505';
  END IF;
  IF p_amount IS DISTINCT FROM v_old.amount OR p_currency IS DISTINCT FROM v_old.currency
    OR p_category IS DISTINCT FROM v_old.category OR p_business_id IS DISTINCT FROM v_old.business_id THEN
   RAISE EXCEPTION 'expense_reversal_amount_or_scope_mismatch' USING ERRCODE='23514';
  END IF;
  v_amount:=v_old.amount;v_currency:=v_old.currency;v_category:=v_old.category;
  v_business_id:=v_old.business_id;
 END IF;
 INSERT INTO public.kol_finance_cost_journals_v1(
  operation,idempotency_key,original_id,business_id,category,amount,currency,
  document_reference,approved_by,approval_reference
 ) VALUES(p_operation,p_idempotency_key,p_original_id,v_business_id,v_category,
  v_amount,v_currency,p_document_reference,p_approved_by,p_approval_reference)
 RETURNING id INTO v_id;
 IF p_operation='expense' THEN
  INSERT INTO public.kol_finance_cost_entries_v1(cost_journal_id,ledger_account,entry_side,amount,currency)
  VALUES(v_id,'operating_expense','debit',v_amount,v_currency),
        (v_id,'accrued_expense_liability','credit',v_amount,v_currency);
 ELSE
  INSERT INTO public.kol_finance_cost_entries_v1(cost_journal_id,ledger_account,entry_side,amount,currency)
  VALUES(v_id,'accrued_expense_liability','debit',v_amount,v_currency),
        (v_id,'operating_expense','credit',v_amount,v_currency);
 END IF;
 SELECT coalesce(sum(amount) FILTER (WHERE entry_side='debit'),0),
        coalesce(sum(amount) FILTER (WHERE entry_side='credit'),0)
 INTO v_debits,v_credits FROM public.kol_finance_cost_entries_v1 WHERE cost_journal_id=v_id;
 IF v_debits<>v_credits OR v_debits<>v_amount THEN
  RAISE EXCEPTION 'unbalanced_cost_posting' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,request_id,after)
 VALUES(p_approved_by,'super_admin','kol_finance_cost_'||p_operation,
  'kol_finance_cost_journals_v1',v_id,p_approval_reference,p_idempotency_key,
  jsonb_build_object('operation',p_operation,'amount',v_amount,'currency',v_currency,
    'category',v_category,'document_reference',p_document_reference,
    'original_id',p_original_id,'business_id',v_business_id));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'journal_id',v_id,
  'operation',p_operation,'recognized_cost',CASE WHEN p_operation='expense' THEN v_amount ELSE -v_amount END);
END;
$body$;
REVOKE ALL ON FUNCTION public.kol_post_finance_cost_v1(
 text,numeric,text,text,uuid,text,uuid,text,text,uuid
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_post_finance_cost_v1(
 text,numeric,text,text,uuid,text,uuid,text,text,uuid
) TO service_role;

CREATE OR REPLACE FUNCTION public.kol_finance_cost_report_v1(
 p_from date,p_to date,p_business_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $report$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 SELECT jsonb_build_object(
   'schema_version',1,'kind','owner_attested_expense_activity',
   'period_from',p_from,'period_to_exclusive',p_to,
   'business_id',p_business_id,'date_basis','posted_at','timezone','Asia/Bishkek',
   'cost_entries',(SELECT count(*) FROM public.kol_finance_cost_journals_v1 j
     WHERE j.posted_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND j.posted_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND (p_business_id IS NULL OR j.business_id=p_business_id)),
   'by_currency',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'currency',currency,'recognized_expense_activity',net_cost,
     'original_expenses',expense_count,'reversals',reversal_count) ORDER BY currency),'[]'::jsonb)
    FROM (
     SELECT currency,
      sum(CASE WHEN operation='expense' THEN amount ELSE -amount END) AS net_cost,
      count(*) FILTER (WHERE operation='expense') AS expense_count,
      count(*) FILTER (WHERE operation='reversal') AS reversal_count
     FROM public.kol_finance_cost_journals_v1 j
     WHERE j.posted_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND j.posted_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND (p_business_id IS NULL OR j.business_id=p_business_id)
     GROUP BY currency
    ) v),
   'actual_bank_outflow',NULL,'net_profit',NULL,
   'warning','Owner-attested accrued costs only. Completeness of expenses, receipts, taxes, bank transfers and net profit not verified.'
 )
 );
END;
$report$;
REVOKE ALL ON FUNCTION public.kol_finance_cost_report_v1(date,date,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.kol_finance_cost_report_v1(date,date,uuid) TO service_role;
