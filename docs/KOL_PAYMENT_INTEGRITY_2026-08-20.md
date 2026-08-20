# KÖL — Payment Integrity Core

Prepared: 2026-08-20

## Status

Source-only draft. No payment provider was selected, no charge/refund was executed, and no live Supabase mutation was made.

## Verified live risks

- `public.payments` has zero rows today, so this is still a recovery/demo contour.
- `provider_reference` has no uniqueness contract.
- there is no provider-event idempotency ledger.
- authenticated currently has table-level INSERT/UPDATE/DELETE grants on `payments`.
- the legacy finance UPDATE policy can directly mutate payment rows.

## Integrity model

### Creating a payment attempt

`create_payment_attempt_atomic` is service-role only. The caller supplies only subject, provider identity/reference, and method. The database derives `user_id` and `amount` from the authoritative order/booking row and refuses settled or invalid subjects.

### Applying a provider event

A provider-specific server/Edge adapter must verify the webhook signature first. Only then may it call `apply_verified_payment_event_atomic` through the server-only service-role client.

The database then:

1. records `(provider,event_id)` once;
2. locks the internal payment;
3. matches paid amount to the authoritative payment amount;
4. updates payment + parent payment status atomically for a valid settlement;
5. writes an audit record;
6. treats replay as idempotent;
7. records duplicate settlements for manual review instead of hiding financial truth.

### Refunds

Automatic refund application is intentionally OFF. A provider refund event is recorded and audited but does not mutate payment/booking/order state until the owner-approved refund workflow exists.

## Data minimization

Raw webhook payload is not stored in the new ledger. Provider adapters pass a SHA-256 payload hash plus sanitized non-sensitive metadata. Provider credentials/signature secrets must remain in server/Edge secrets and never enter `NEXT_PUBLIC_*` variables.

## Required staging tests

- provider-reference idempotency;
- event replay idempotency;
- wrong-amount rejection;
- valid paid transition;
- failed/cancelled attempt semantics;
- refund fail-closed behavior;
- concurrent duplicate settlement detection;
- anon/authenticated RPC denial;
- browser roles cannot directly mutate `payments`.

## Owner gates still open

- actual provider;
- payment methods exposed to customers;
- commissions/service fee;
- cancellation/refund/no-show policy;
- provider secrets;
- production activation.
