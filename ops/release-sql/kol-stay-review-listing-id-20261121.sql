-- KÖL 052: stay reviews map room booking to parent stay listing UUID.
DO $pre$ BEGIN
 IF EXISTS(SELECT 1 FROM public.reviews WHERE target_type='stay') THEN
  RAISE EXCEPTION 'existing_stay_reviews_require_explicit_data_migration';
 END IF;
END $pre$;
CREATE OR REPLACE FUNCTION private.reviews_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE b record; v_exists boolean; v_stay_id uuid;
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
   NEW.target_type:=b.booking_type;
   IF b.booking_type='stay' THEN
      SELECT rm.stay_id INTO v_stay_id FROM public.rooms rm
       WHERE rm.id=b.object_id AND rm.business_id=b.business_id;
      IF v_stay_id IS NULL THEN RAISE EXCEPTION 'booking_room_stay_relation_invalid' USING ERRCODE='42501';END IF;
      NEW.target_id:=v_stay_id;
   ELSE
      NEW.target_id:=b.object_id;
   END IF;
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
   SELECT EXISTS(SELECT 1 FROM public.stays st
     WHERE st.id=NEW.target_id AND st.business_id=NEW.business_id) INTO v_exists;
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
END;$function$;
