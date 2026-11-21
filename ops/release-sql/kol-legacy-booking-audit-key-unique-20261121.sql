-- KÖL P0: protected legacy client booking request-key uniqueness.
-- Requires independently restored and encrypted Google Drive source backup.
-- Tested on disposable local PostgreSQL with real local client JWTs.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE action='client_booking_created' AND request_id IS NOT NULL
    GROUP BY actor_id, request_id HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'duplicate legacy booking request keys'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname='uq_kol_client_booking_request'
  ) THEN RAISE EXCEPTION 'target index already exists; require review'; END IF;
END
$check$;

CREATE UNIQUE INDEX uq_kol_client_booking_request
ON public.audit_logs(actor_id, request_id)
WHERE action='client_booking_created' AND request_id IS NOT NULL;

DO $verify$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_index i
   JOIN pg_class idx ON idx.oid=i.indexrelid
   JOIN pg_class tbl ON tbl.oid=i.indrelid
   JOIN pg_namespace n ON n.oid=tbl.relnamespace
   WHERE n.nspname='public' AND tbl.relname='audit_logs'
   AND idx.relname='uq_kol_client_booking_request'
   AND i.indisunique AND i.indisvalid AND i.indisready
 ) THEN RAISE EXCEPTION 'unique legacy index verification failed'; END IF;
END
$verify$;
COMMIT;
