-- KÖL / kol-travel-platform
-- PAYMENT SERVICE ROLE ACL DEPENDENCY — DRAFT NOT APPLIED
-- Prepared: 2026-08-21
-- Depends on: 011, 011a, 011b
--
-- Purpose:
-- Payment RPCs intentionally remain SECURITY INVOKER and executable only by
-- service_role. They therefore need explicit table privileges for the exact
-- parent/payment/audit operations they perform. This layer is additive: it does
-- not grant browser roles any mutation capability, does not choose a provider,
-- and does not enable refunds.

begin;

-- Parent transaction truth read/settlement.
grant select, update on table public.orders to service_role;
grant select, update on table public.bookings to service_role;

-- Provider-backed payment attempt/event truth.
grant select, insert, update on table public.payments to service_role;

-- Order-payment projection is created by the attempt RPC; synchronization after
-- settlement is performed by a trusted SECURITY DEFINER trigger from 011b.
grant insert on table public.order_payments to service_role;

-- Trusted payment RPCs append immutable audit evidence. Browser/session roles
-- remain locked down by 006a.
grant insert on table public.audit_logs to service_role;

commit;

-- No live SQL is executed by committing this file. It remains DRAFT_NOT_APPLIED.
