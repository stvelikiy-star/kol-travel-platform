-- KOL 023b: ISOLATED QA ONLY. NEVER run this file against live or shared Supabase.
-- This unique audit invariant protects the legacy public client_stay_booking_create_atomic
-- endpoint, whose private implementation locks by room/date, not by client/request key.
-- A losing concurrent transaction rolls back booking and inventory with SQLSTATE 23505.
BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE action='client_booking_created' AND request_id IS NOT NULL
    GROUP BY actor_id,request_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'existing duplicate legacy booking request keys';
  END IF;
END
$preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_kol_client_booking_request
  ON public.audit_logs(actor_id,request_id)
  WHERE action='client_booking_created' AND request_id IS NOT NULL;

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class idx
      JOIN pg_index i ON i.indexrelid=idx.oid
      WHERE idx.relname='uq_kol_client_booking_request' AND i.indisunique AND i.indisvalid
  ) THEN
    RAISE EXCEPTION 'legacy booking request index is missing or not unique';
  END IF;
END
$verify$;

COMMIT;
