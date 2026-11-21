-- KOL 046D: public RLS without private helper calls; no exposed payment evidence.
DROP POLICY IF EXISTS site_content_read ON public.site_content;
CREATE POLICY site_content_read ON public.site_content FOR SELECT TO anon,authenticated USING(status='published');
DROP POLICY IF EXISTS site_campaign_read ON public.site_ad_campaigns;
CREATE POLICY site_campaign_read ON public.site_ad_campaigns FOR SELECT TO anon,authenticated USING(
 status='active' AND starts_at<=now() AND ends_at>now()
 AND (price_kgs=0 OR (payment_status='paid' AND paid_marked_by IS NOT NULL AND payment_evidence IS NOT NULL)));
DROP POLICY IF EXISTS site_promo_read ON public.listing_promotions;
CREATE POLICY site_promo_read ON public.listing_promotions FOR SELECT TO anon,authenticated USING(
 is_active AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
 AND (price_kgs=0 OR (payment_status='paid' AND paid_marked_by IS NOT NULL AND payment_evidence IS NOT NULL)));
DROP POLICY IF EXISTS "public reads published reviews" ON public.reviews;
CREATE POLICY "public reads published reviews" ON public.reviews FOR SELECT TO anon,authenticated USING(status='published');
DROP POLICY IF EXISTS "content managers read all reviews" ON public.reviews;
CREATE POLICY "content managers read all reviews" ON public.reviews FOR SELECT TO authenticated USING(private.can_manage_content());
REVOKE SELECT ON public.site_ad_campaigns FROM anon,authenticated;
GRANT SELECT(id,slot_code,advertiser_name,title_ru,title_ky,title_en,image_path,
 link_url,starts_at,ends_at,status,priority,disclosure_label) ON public.site_ad_campaigns TO anon,authenticated;
REVOKE SELECT ON public.listing_promotions FROM anon,authenticated;
GRANT SELECT(id,target_type,target_id,position,label,starts_at,ends_at,is_active) ON public.listing_promotions TO anon,authenticated;
REVOKE SELECT ON public.editorial_scores FROM anon,authenticated;
GRANT SELECT(id,target_type,target_id,score,note,created_at,updated_at) ON public.editorial_scores TO anon,authenticated;
REVOKE SELECT ON public.reviews FROM authenticated;
GRANT SELECT(id,client_id,business_id,booking_id,target_type,target_id,source,
 source_label,rating,text,status,created_at,updated_at,hidden_reason,admin_reply,
 admin_reply_at,moderated_at) ON public.reviews TO authenticated;
