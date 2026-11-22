-- KÖL Production column-level GRANT parity, reviewed against current QA on 2026-11-22.
-- Runs after kol_production_acl_parity_20261122, which revokes table-wide grants.
-- Re-grant only the column-scoped SELECT/UPDATE permissions from QA.
-- No schema, data, RLS policy or function changes.
BEGIN;
DO $kol_column_acl_preflight$
BEGIN
 IF (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')<>72
 OR (SELECT count(*) FROM auth.users)<>0 THEN
  RAISE EXCEPTION 'KOL_PRODUCTION_COLUMN_ACL_REQUIRES_EMPTY_72_TABLE_SCHEMA';
 END IF;
END;
$kol_column_acl_preflight$;
GRANT SELECT ("created_at", "id", "note", "score", "target_id", "target_type", "updated_at") ON TABLE public.editorial_scores TO anon;
GRANT SELECT ("created_at", "id", "note", "score", "target_id", "target_type", "updated_at") ON TABLE public.editorial_scores TO authenticated;
GRANT UPDATE ("admin_note", "route_hint", "updated_at", "updated_by") ON TABLE public.kol_ai_channels_v1 TO authenticated;
GRANT SELECT ("ends_at", "id", "is_active", "label", "position", "starts_at", "target_id", "target_type") ON TABLE public.listing_promotions TO anon;
GRANT SELECT ("ends_at", "id", "is_active", "label", "position", "starts_at", "target_id", "target_type") ON TABLE public.listing_promotions TO authenticated;
GRANT SELECT ("admin_reply", "created_at", "id", "rating", "source", "source_label", "status", "target_id", "target_type", "text") ON TABLE public.reviews TO anon;
GRANT SELECT ("admin_reply", "admin_reply_at", "booking_id", "business_id", "client_id", "created_at", "hidden_reason", "id", "moderated_at", "rating", "source", "source_label", "status", "target_id", "target_type", "text", "updated_at") ON TABLE public.reviews TO authenticated;
GRANT SELECT ("advertiser_name", "disclosure_label", "ends_at", "id", "image_path", "link_url", "priority", "slot_code", "starts_at", "status", "title_en", "title_ky", "title_ru") ON TABLE public.site_ad_campaigns TO anon;
GRANT SELECT ("advertiser_name", "disclosure_label", "ends_at", "id", "image_path", "link_url", "priority", "slot_code", "starts_at", "status", "title_en", "title_ky", "title_ru") ON TABLE public.site_ad_campaigns TO authenticated;
COMMIT;
