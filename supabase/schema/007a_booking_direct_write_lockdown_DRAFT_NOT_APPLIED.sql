-- KÖL / booking transaction core follow-up
-- DIRECT BOOKING INSERT LOCKDOWN — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- 007 introduces server-authoritative atomic booking RPCs, but the recovered schema
-- still has a direct client INSERT policy that checks only client_id=auth.uid().
-- That direct path would let callers submit booking total/business/object fields
-- without the inventory/price transaction and therefore bypass 007.

begin;

drop policy if exists "clients create own bookings" on public.bookings;

-- Creation must go through create_stay_booking_atomic/create_tour_booking_atomic.
-- Existing SELECT and partner/admin UPDATE policies are not changed here.
revoke insert on table public.bookings from anon, authenticated;

commit;

-- STAGING PROOF:
-- 1. authenticated direct INSERT into bookings => denied.
-- 2. create_stay_booking_atomic => succeeds for valid initialized inventory.
-- 3. create_tour_booking_atomic => succeeds for valid capacity.
-- 4. client cannot inject total/client_id/business_id through RPC parameters.
