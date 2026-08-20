-- KÖL / security follow-up
-- TRANSACTION ENTRYPOINT LOCKDOWN — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Recovered direct INSERT policies for orders/bookings only bind client_id to auth.uid().
-- They do not make price, total, inventory/capacity or object/business selection
-- server-authoritative. Creation must therefore fail closed until the atomic RPCs
-- (007 Stay/Tour and 008 Food/Shop) are staged and accepted.

begin;

drop policy if exists "clients create own bookings" on public.bookings;
drop policy if exists "clients create own orders draft" on public.orders;

revoke insert on table public.bookings from anon, authenticated;
revoke insert on table public.orders from anon, authenticated;

commit;

-- This intentionally makes direct client checkout/booking unavailable rather than
-- accepting untrusted monetary/inventory fields. Security-definer atomic RPCs can
-- write as their owner after their own explicit EXECUTE grants are staged.
