-- KOL 046G: content_manager may attest manual advertising/promotion payment (same as super_admin).
-- Everything else is unchanged: written proof is mandatory, the confirmer (auth.uid()) and time are stored,
-- and confirmed paid advertising stays immutable (kol-ad-payment-immutability-20261121.sql).
-- No payment collection, accounting posting or refund is enabled. Apply after 046F on TEST first.
CREATE OR REPLACE FUNCTION private.can_confirm_content_payment() RETURNS boolean
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.user_profiles p ON p.user_id=r.user_id
 WHERE r.user_id=auth.uid() AND r.is_active AND p.status='active'
   AND r.role IN ('super_admin','content_manager')) $$;
REVOKE ALL ON FUNCTION private.can_confirm_content_payment() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_confirm_content_payment() TO authenticated;
