-- KÖL 046A secure content, campaigns, promotions. No existing payment changes.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.can_manage_content() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.user_profiles p ON p.user_id=r.user_id
 WHERE r.user_id=auth.uid() AND r.is_active AND p.status='active'
 AND r.role IN ('super_admin','content_manager')) $$;
REVOKE ALL ON FUNCTION private.can_manage_content() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_manage_content() TO authenticated;
CREATE OR REPLACE FUNCTION private.can_confirm_content_payment() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.user_profiles p ON p.user_id=r.user_id
 WHERE r.user_id=auth.uid() AND r.is_active AND p.status='active' AND r.role='super_admin') $$;
REVOKE ALL ON FUNCTION private.can_confirm_content_payment() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_confirm_content_payment() TO authenticated;
CREATE TABLE IF NOT EXISTS public.site_content(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_key text NOT NULL CHECK(content_key ~ '^[a-z0-9_.-]{3,80}$'),
 locale text NOT NULL CHECK(locale IN ('ru','ky','en')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 value text NOT NULL CHECK(length(value)<=2000),
 is_machine_suggestion boolean NOT NULL DEFAULT false,
 version integer NOT NULL DEFAULT 1 CHECK(version>=1),
 published_at timestamptz,
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(content_key,locale,status),
 CHECK(status <> 'published' OR (published_at IS NOT NULL AND NOT is_machine_suggestion))
);
CREATE TABLE IF NOT EXISTS public.site_content_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 content_key text NOT NULL,locale text NOT NULL CHECK(locale IN ('ru','ky','en')),
 value text NOT NULL,version integer NOT NULL,
 published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 published_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(content_key,locale,version)
);
CREATE TABLE IF NOT EXISTS public.site_ad_slots(
 code text PRIMARY KEY CHECK(code ~ '^[a-z0-9_]{3,40}$'),title text NOT NULL,
 width integer,height integer,is_active boolean NOT NULL DEFAULT true
);
INSERT INTO public.site_ad_slots(code,title,width,height) VALUES
 ('top_strip','Полоса над шапкой',1440,48),('home_between','Между разделами главной',1240,280),
 ('catalog_inline','Вставка в каталоге',NULL,NULL),('detail_side','Боковой блок карточки',340,420),
 ('cart_banner','Баннер в корзине',340,160)
ON CONFLICT(code) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.site_ad_campaigns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slot_code text NOT NULL REFERENCES public.site_ad_slots(code),
 advertiser_name text NOT NULL CHECK(length(advertiser_name) BETWEEN 2 AND 160),
 title_ru text NOT NULL CHECK(length(title_ru) BETWEEN 1 AND 120),title_ky text,title_en text,
 image_path text,link_url text CHECK(link_url IS NULL OR link_url ~ '^(https://|/)[^[:space:]]*$'),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','scheduled','active','paused','ended')),
 priority integer NOT NULL DEFAULT 100,
 price_kgs numeric(12,2) NOT NULL DEFAULT 0 CHECK(price_kgs>=0),
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid')),
 payment_evidence text CHECK(payment_evidence IS NULL OR length(btrim(payment_evidence)) BETWEEN 3 AND 500),
 paid_marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 paid_marked_at timestamptz,disclosure_label text NOT NULL DEFAULT 'Реклама'
 CHECK(length(btrim(disclosure_label))>=3),
 impressions bigint NOT NULL DEFAULT 0 CHECK(impressions>=0),clicks bigint NOT NULL DEFAULT 0 CHECK(clicks>=0),
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at),
 CHECK(price_kgs=0 OR status NOT IN ('scheduled','active') OR
  (payment_status='paid' AND payment_evidence IS NOT NULL AND paid_marked_by IS NOT NULL AND paid_marked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS site_ad_campaigns_slot_active_idx ON public.site_ad_campaigns(slot_code,status,starts_at,ends_at);
CREATE TABLE IF NOT EXISTS public.listing_promotions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_type text NOT NULL CHECK(target_type IN ('stay','tour')),target_id uuid NOT NULL,
 position integer NOT NULL CHECK(position BETWEEN 1 AND 50),
 label text NOT NULL DEFAULT 'recommended' CHECK(label IN ('none','recommended','ad')),
 starts_at timestamptz NOT NULL DEFAULT now(),ends_at timestamptz,
 price_kgs numeric(12,2) NOT NULL DEFAULT 0 CHECK(price_kgs>=0),
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN ('pending','paid')),
 payment_evidence text CHECK(payment_evidence IS NULL OR length(btrim(payment_evidence)) BETWEEN 3 AND 500),
 paid_marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 paid_marked_at timestamptz,is_active boolean NOT NULL DEFAULT false,
 created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at IS NULL OR ends_at>starts_at),CHECK(price_kgs=0 OR label='ad'),
 CHECK(price_kgs=0 OR NOT is_active OR
  (payment_status='paid' AND payment_evidence IS NOT NULL AND paid_marked_by IS NOT NULL AND paid_marked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS listing_promotions_type_pos_idx ON public.listing_promotions(target_type,is_active,position);
CREATE TABLE IF NOT EXISTS public.editorial_scores(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_type text NOT NULL CHECK(target_type IN ('stay','tour')),target_id uuid NOT NULL,
 score numeric(2,1) NOT NULL CHECK(score BETWEEN 1.0 AND 5.0),
 note text CHECK(note IS NULL OR length(note)<=1500),
 updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(target_type,target_id)
);
CREATE OR REPLACE FUNCTION private.site_audit() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o jsonb; n jsonb; ident uuid;
BEGIN
 IF TG_OP='INSERT' THEN n:=to_jsonb(NEW);ident:=(n->>'id')::uuid;
 ELSIF TG_OP='DELETE' THEN o:=to_jsonb(OLD);ident:=(o->>'id')::uuid;
 ELSE n:=to_jsonb(NEW);o:=to_jsonb(OLD);ident:=(n->>'id')::uuid;END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after)
 VALUES(auth.uid(),(SELECT role FROM public.user_roles WHERE user_id=auth.uid() AND is_active AND
 role IN ('super_admin','content_manager') ORDER BY role LIMIT 1),
 TG_TABLE_NAME||'_'||lower(TG_OP),TG_TABLE_NAME,ident,o,n);
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.site_audit() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.content_before() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.content_key IS DISTINCT FROM OLD.content_key
   OR NEW.locale IS DISTINCT FROM OLD.locale THEN
    RAISE EXCEPTION 'content_identity_immutable' USING ERRCODE='42501';
  END IF;
  NEW.version:=OLD.version+1;
 END IF;
 NEW.updated_at:=now();
 IF NEW.status='published' THEN
  IF NEW.is_machine_suggestion THEN RAISE EXCEPTION 'machine_suggestion_not_accepted' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' OR NEW.value IS DISTINCT FROM OLD.value OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.published_at:=now();
  END IF;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.content_before() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.content_history_after() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='published' AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status
 OR NEW.value IS DISTINCT FROM OLD.value) THEN
  INSERT INTO public.site_content_history(content_key,locale,value,version,published_by,published_at)
  VALUES(NEW.content_key,NEW.locale,NEW.value,NEW.version,auth.uid(),now())
  ON CONFLICT(content_key,locale,version) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.content_history_after() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.ad_payment_before() RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.payment_status='paid' AND (TG_OP='INSERT' OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN
  IF NOT private.can_confirm_content_payment() THEN RAISE EXCEPTION 'payment_requires_super_admin' USING ERRCODE='42501';END IF;
  IF NEW.payment_evidence IS NULL OR length(btrim(NEW.payment_evidence))<3 THEN
   RAISE EXCEPTION 'payment_evidence_required' USING ERRCODE='23514';END IF;
  NEW.paid_marked_by:=auth.uid();NEW.paid_marked_at:=now();
 END IF;
 RETURN NEW;
END;$$;
REVOKE ALL ON FUNCTION private.ad_payment_before() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER site_content_before BEFORE INSERT OR UPDATE ON public.site_content FOR EACH ROW EXECUTE FUNCTION private.content_before();
CREATE TRIGGER site_content_after AFTER INSERT OR UPDATE ON public.site_content FOR EACH ROW EXECUTE FUNCTION private.content_history_after();
CREATE TRIGGER site_content_audit AFTER INSERT OR UPDATE OR DELETE ON public.site_content FOR EACH ROW EXECUTE FUNCTION private.site_audit();
CREATE TRIGGER campaign_payment_before BEFORE INSERT OR UPDATE ON public.site_ad_campaigns FOR EACH ROW EXECUTE FUNCTION private.ad_payment_before();
CREATE TRIGGER promotion_payment_before BEFORE INSERT OR UPDATE ON public.listing_promotions FOR EACH ROW EXECUTE FUNCTION private.ad_payment_before();
CREATE TRIGGER site_ad_campaign_audit AFTER INSERT OR UPDATE OR DELETE ON public.site_ad_campaigns FOR EACH ROW EXECUTE FUNCTION private.site_audit();
CREATE TRIGGER site_promotion_audit AFTER INSERT OR UPDATE OR DELETE ON public.listing_promotions FOR EACH ROW EXECUTE FUNCTION private.site_audit();
CREATE TRIGGER editorial_score_audit AFTER INSERT OR UPDATE OR DELETE ON public.editorial_scores FOR EACH ROW EXECUTE FUNCTION private.site_audit();
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['site_content','site_content_history','site_ad_slots','site_ad_campaigns','listing_promotions','editorial_scores'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
REVOKE ALL ON public.site_content,public.site_content_history,public.site_ad_slots,
public.site_ad_campaigns,public.listing_promotions,public.editorial_scores FROM anon,authenticated;
GRANT SELECT ON public.site_content,public.site_ad_slots,public.site_ad_campaigns,
public.listing_promotions,public.editorial_scores TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.site_content,public.site_ad_campaigns,
public.listing_promotions,public.editorial_scores TO authenticated;
GRANT SELECT ON public.site_content_history TO authenticated;
CREATE POLICY site_content_read ON public.site_content FOR SELECT TO anon,authenticated
 USING(status='published' OR private.can_manage_content());
CREATE POLICY site_content_write ON public.site_content FOR ALL TO authenticated
 USING(private.can_manage_content()) WITH CHECK(private.can_manage_content());
CREATE POLICY site_history_read ON public.site_content_history FOR SELECT TO authenticated USING(private.can_manage_content());
CREATE POLICY site_slots_read ON public.site_ad_slots FOR SELECT TO anon,authenticated USING(is_active);
CREATE POLICY site_campaign_read ON public.site_ad_campaigns FOR SELECT TO anon,authenticated
 USING((status='active' AND starts_at<=now() AND ends_at>now()
 AND (price_kgs=0 OR (payment_status='paid' AND paid_marked_by IS NOT NULL AND payment_evidence IS NOT NULL)))
 OR private.can_manage_content());
CREATE POLICY site_campaign_write ON public.site_ad_campaigns FOR ALL TO authenticated
 USING(private.can_manage_content()) WITH CHECK(private.can_manage_content());
CREATE POLICY site_promo_read ON public.listing_promotions FOR SELECT TO anon,authenticated
 USING((is_active AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
 AND (price_kgs=0 OR (payment_status='paid' AND paid_marked_by IS NOT NULL AND payment_evidence IS NOT NULL)))
 OR private.can_manage_content());
CREATE POLICY site_promo_write ON public.listing_promotions FOR ALL TO authenticated
 USING(private.can_manage_content()) WITH CHECK(private.can_manage_content());
CREATE POLICY editorial_read ON public.editorial_scores FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY editorial_write ON public.editorial_scores FOR ALL TO authenticated
 USING(private.can_manage_content()) WITH CHECK(private.can_manage_content());
