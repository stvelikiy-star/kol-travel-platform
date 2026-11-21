-- KÖL 046B: reviewed guest ratings + clearly-labelled external reviews.
-- Original archive 046 corrected: source switching cannot bypass immutability.
ALTER TABLE public.reviews ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.reviews
 ADD COLUMN IF NOT EXISTS target_type text CHECK(target_type IN ('stay','tour')),
 ADD COLUMN IF NOT EXISTS target_id uuid,
 ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'site' CHECK(source IN ('site','import')),
 ADD COLUMN IF NOT EXISTS source_label text,
 ADD COLUMN IF NOT EXISTS source_evidence_url text CHECK(source_evidence_url IS NULL OR source_evidence_url ~ '^https://[^[:space:]]+$'),
 ADD COLUMN IF NOT EXISTS hidden_reason text
  CHECK(hidden_reason IN ('spam','abuse','off_topic','personal_data','wrong_object','duplicate','other')),
 ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
 ADD COLUMN IF NOT EXISTS admin_reply text CHECK(admin_reply IS NULL OR length(admin_reply)<=1000),
 ADD COLUMN IF NOT EXISTS admin_reply_at timestamptz;
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_status_contract;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_status_contract CHECK(status IN ('new','published','hidden'));
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_integrity_contract;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_integrity_contract CHECK(
 (source='site' AND client_id IS NOT NULL AND booking_id IS NOT NULL
 AND target_type IS NOT NULL AND target_id IS NOT NULL)
 OR
 (source='import' AND client_id IS NULL AND booking_id IS NULL
 AND target_type IS NOT NULL AND target_id IS NOT NULL
 AND source_label IS NOT NULL AND length(btrim(source_label))>=2
 AND source_evidence_url IS NOT NULL)
);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_hidden_needs_reason;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_hidden_needs_reason CHECK(status<>'hidden' OR hidden_reason IS NOT NULL);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_text_size;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_text_size CHECK(text IS NULL OR length(text)<=2000);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_booking_idx
 ON public.reviews(client_id,booking_id) WHERE source='site';

CREATE OR REPLACE FUNCTION private.reviews_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $$
DECLARE b record; v_exists boolean;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.source='site' THEN
   IF auth.uid() IS NULL OR NEW.client_id IS DISTINCT FROM auth.uid() THEN
     RAISE EXCEPTION 'review_must_belong_to_user' USING ERRCODE='42501';
   END IF;
   SELECT bk.client_id,bk.business_id,bk.status,bk.booking_type,bk.object_id INTO b
    FROM public.bookings bk WHERE bk.id=NEW.booking_id;
   IF NOT FOUND OR b.client_id IS DISTINCT FROM NEW.client_id
      OR b.business_id IS DISTINCT FROM NEW.business_id
      OR b.status<>'completed' OR b.booking_type NOT IN ('stay','tour') THEN
     RAISE EXCEPTION 'review_requires_completed_own_booking' USING ERRCODE='42501';
   END IF;
   NEW.target_type:=b.booking_type;NEW.target_id:=b.object_id;
   NEW.order_id:=NULL;NEW.source_label:=NULL;NEW.source_evidence_url:=NULL;
   NEW.status:='new';NEW.hidden_reason:=NULL;NEW.admin_reply:=NULL;
  ELSE
   IF NOT private.can_manage_content() THEN
    RAISE EXCEPTION 'review_import_not_authorized' USING ERRCODE='42501';END IF;
   IF NEW.source_label IS NULL OR length(btrim(NEW.source_label))<2
      OR NEW.source_evidence_url IS NULL OR NEW.source_evidence_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'review_import_evidence_required' USING ERRCODE='23514';END IF;
   NEW.client_id:=NULL;NEW.booking_id:=NULL;NEW.order_id:=NULL;NEW.status:='new';
  END IF;
  IF NEW.target_type='stay' THEN
   SELECT EXISTS(SELECT 1 FROM public.rooms rm
     WHERE rm.id=NEW.target_id AND rm.business_id=NEW.business_id) INTO v_exists;
  ELSE
   SELECT EXISTS(SELECT 1 FROM public.tours t
     WHERE t.id=NEW.target_id AND t.business_id=NEW.business_id) INTO v_exists;
  END IF;
  IF NOT v_exists THEN RAISE EXCEPTION 'review_target_mismatch' USING ERRCODE='42501';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF NOT private.can_manage_content() THEN
    RAISE EXCEPTION 'review_moderation_not_authorized' USING ERRCODE='42501';
  END IF;
  -- Compare OLD.source and *both* identities: no source-switch or false review.
  IF NEW.source IS DISTINCT FROM OLD.source
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.target_type IS DISTINCT FROM OLD.target_type
    OR NEW.target_id IS DISTINCT FROM OLD.target_id
    OR NEW.rating IS DISTINCT FROM OLD.rating
    OR NEW.text IS DISTINCT FROM OLD.text
    OR NEW.source_label IS DISTINCT FROM OLD.source_label
    OR NEW.source_evidence_url IS DISTINCT FROM OLD.source_evidence_url
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
     RAISE EXCEPTION 'review_content_immutable' USING ERRCODE='42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason
      OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN
    NEW.moderated_by:=auth.uid();NEW.moderated_at:=now();
    IF NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN NEW.admin_reply_at:=now();END IF;
  END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.reviews_guard() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS reviews_guard ON public.reviews;
CREATE TRIGGER reviews_guard BEFORE INSERT OR UPDATE ON public.reviews
 FOR EACH ROW EXECUTE FUNCTION private.reviews_guard();
DROP TRIGGER IF EXISTS reviews_moderation_audit ON public.reviews;
CREATE TRIGGER reviews_moderation_audit AFTER UPDATE ON public.reviews
 FOR EACH ROW WHEN(
  OLD.status IS DISTINCT FROM NEW.status
  OR OLD.admin_reply IS DISTINCT FROM NEW.admin_reply
  OR OLD.hidden_reason IS DISTINCT FROM NEW.hidden_reason)
 EXECUTE FUNCTION private.site_audit();

DROP POLICY IF EXISTS "public reads published reviews" ON public.reviews;
CREATE POLICY "public reads published reviews" ON public.reviews
 FOR SELECT TO anon,authenticated USING(
 status='published' OR client_id=auth.uid() OR private.can_manage_content());
DROP POLICY IF EXISTS "guests insert own review" ON public.reviews;
CREATE POLICY "guests insert own review" ON public.reviews
 FOR INSERT TO authenticated WITH CHECK(source='site' AND client_id=auth.uid());
DROP POLICY IF EXISTS "content managers import reviews" ON public.reviews;
CREATE POLICY "content managers import reviews" ON public.reviews
 FOR INSERT TO authenticated WITH CHECK(source='import' AND private.can_manage_content());
DROP POLICY IF EXISTS "content managers moderate reviews" ON public.reviews;
CREATE POLICY "content managers moderate reviews" ON public.reviews
 FOR UPDATE TO authenticated USING(private.can_manage_content()) WITH CHECK(private.can_manage_content());
GRANT SELECT (id,target_type,target_id,rating,text,source,source_label,admin_reply,created_at,status)
 ON public.reviews TO anon;
GRANT SELECT,INSERT,UPDATE ON public.reviews TO authenticated;
CREATE OR REPLACE VIEW public.public_listing_ratings WITH (security_invoker=true)
 AS SELECT target_type,target_id,round(avg(rating)::numeric,1) AS guest_rating,count(*)::int AS review_count
 FROM public.reviews
 WHERE status='published' AND source='site' AND target_id IS NOT NULL
 GROUP BY target_type,target_id;
GRANT SELECT ON public.public_listing_ratings TO anon,authenticated;
