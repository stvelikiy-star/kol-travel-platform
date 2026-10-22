-- PROPOSAL ONLY: do NOT apply on active Supabase project.
-- Intended for disposable KOL database after concurrency and duplicate preflight.
-- This constraint prevents one authenticated client's request key from
-- producing two successful booking audit records, even for distinct rooms.
-- The RPC still needs request-key serialization for clean idempotent responses.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kol_client_booking_request
ON public.audit_logs (actor_id, request_id)
WHERE action = 'client_booking_created'
  AND request_id IS NOT NULL;
