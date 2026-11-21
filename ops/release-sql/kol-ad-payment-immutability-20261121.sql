-- KOL 046F: freeze advertisement and promotion payment identity after confirmation.
-- No payment collection, accounting postings, or refunds are enabled.
CREATE OR REPLACE FUNCTION private.ad_payment_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.payment_status='paid' THEN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.price_kgs IS DISTINCT FROM OLD.price_kgs
    OR NEW.payment_evidence IS DISTINCT FROM OLD.payment_evidence
    OR NEW.paid_marked_by IS DISTINCT FROM OLD.paid_marked_by
    OR NEW.paid_marked_at IS DISTINCT FROM OLD.paid_marked_at THEN
   RAISE EXCEPTION 'paid_ad_financial_identity_immutable' USING ERRCODE='42501';
  END IF;
 END IF;
 IF NEW.payment_status='paid' AND (TG_OP='INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
  IF NOT private.can_confirm_content_payment() THEN
   RAISE EXCEPTION 'payment_requires_super_admin' USING ERRCODE='42501';
  END IF;
  IF NEW.payment_evidence IS NULL OR length(btrim(NEW.payment_evidence))<3 THEN
   RAISE EXCEPTION 'payment_evidence_required' USING ERRCODE='23514';
  END IF;
  NEW.paid_marked_by:=auth.uid();NEW.paid_marked_at:=now();
 ELSE
  IF TG_OP='INSERT' THEN
   IF NEW.payment_evidence IS NOT NULL OR NEW.paid_marked_by IS NOT NULL OR NEW.paid_marked_at IS NOT NULL THEN
    RAISE EXCEPTION 'pending_ad_cannot_claim_settlement' USING ERRCODE='42501';
   END IF;
  ELSIF OLD.payment_status='pending' AND NEW.payment_status='pending' THEN
   IF NEW.payment_evidence IS DISTINCT FROM OLD.payment_evidence
      OR NEW.paid_marked_by IS DISTINCT FROM OLD.paid_marked_by
      OR NEW.paid_marked_at IS DISTINCT FROM OLD.paid_marked_at THEN
    RAISE EXCEPTION 'payment_evidence_change_requires_approval' USING ERRCODE='42501';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION private.ad_payment_before() FROM PUBLIC,anon,authenticated;
