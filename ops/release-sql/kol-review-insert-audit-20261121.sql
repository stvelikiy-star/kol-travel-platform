-- KOL 046E: log every new guest or sourced review in existing audit_logs.
-- Guest content remains immutable, review moderation and source guard unchanged.
DROP TRIGGER IF EXISTS reviews_insert_audit ON public.reviews;
CREATE TRIGGER reviews_insert_audit AFTER INSERT ON public.reviews
 FOR EACH ROW EXECUTE FUNCTION private.site_audit();
