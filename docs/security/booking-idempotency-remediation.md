# KÖL booking idempotency hardening — proposed, NOT deployed

Read-only evidence (2026-10-22):
- public.audit_logs contains **zero** `client_booking_created` records, thus no production evidence of duplication; no concurrency tests yet.
- partial index `idx_audit_client_booking_request` on (actor_id, action, request_id) is NON-UNIQUE.
- booking function serializes by room+exact-date pair, not by (actor_id, request_id).
- `authenticated` has EXECUTE on public wrapper and private SECURITY DEFINER internal function; function internally checks auth.uid and active client role.

## Mandatory isolated race test
- Create two rooms in distinct businesses, eligible dates, one client JWT.
- Fire 2+ simultaneous RPC calls using SAME request ID but different room_id/date. Expect at most one booking record and at most one unique audit idempotency key.
- Repeat with same room overlapping but nonidentical date ranges, distinct IDs. Verify inventory cannot oversell.
- Repeat identical payload and ID and verify return of the original booking.
- Repeat conflicting payload and ID and verify explicit conflict, not a false success.
- Test unauthorized and wrong-role calls including direct `private` invocation.

## Proposed implementation, pending review
1. Introduce a per-client request-ID transaction lock **before** checking the audit table; same client+request ID must share lock regardless of room/date. Keep room-level locking for inventory.
2. Add a partial **unique** index on (actor_id, request_id) WHERE action='client_booking_created' AND request_id IS NOT NULL, after duplicate audit and non-null verification.
3. On uniqueness conflict, return existing result only for identical payload; otherwise return conflict; avoid claiming booking success on failed transaction.
4. Add a concurrent test to CI against a disposable database. Ensure schema policy changes do not modify storefront UI.
5. Verify function privileges; direct private entrypoint should be callable only where explicitly intended.

## Suggested read-only preflight
```sql
select actor_id, request_id, count(*) from public.audit_logs
where action='client_booking_created' and request_id is not null
group by actor_id,request_id having count(*) > 1;
select count(*) from public.audit_logs where action='client_booking_created';
```

Do not execute DDL on the existing database until this plan passes isolated testing.
