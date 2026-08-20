-- KÖL / security follow-up
-- AUDIT LOG WRITE LOCKDOWN — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Live policy "authenticated users create audit logs draft" only checks that
-- auth.uid() is non-null. That permits an authenticated caller to fabricate actor,
-- action, entity and before/after audit content.
--
-- Current generic source audit helper is still a no-op/TODO, while new transaction
-- RPCs write audit rows inside trusted DB transactions. Therefore direct Data API
-- audit mutation should remain closed.

begin;

drop policy if exists "authenticated users create audit logs draft" on public.audit_logs;

revoke insert, update, delete on table public.audit_logs from anon, authenticated;

commit;

-- STAGING PROOF:
-- 1. client/partner direct INSERT audit_logs => denied.
-- 2. authenticated users retain only RLS-authorized SELECT, if any.
-- 3. security-definer transactional RPCs can still append their audit row.
-- 4. audit rows cannot be updated/deleted through normal API roles.
