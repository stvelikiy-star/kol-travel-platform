# KÖL Payment Integrity V2 — 2026-08-20

Source-only provider-neutral payment integrity restack. No provider is selected, no charge/refund is executed, and no live Supabase mutation is performed by this work.

## Fresh live schema facts

- `public.payments`: 0 rows.
- Authenticated currently has direct INSERT/UPDATE/DELETE grants on `payments` in the live baseline.
- Legacy `finance admins manage payments` can UPDATE live payment rows.
- `provider_reference` is not unique in the live baseline.
- `public.order_payments`: 0 rows, no RLS policies, authenticated has direct INSERT/UPDATE/DELETE grants.
- `order_payments.amount/status` default to `0/pending`, so they cannot be treated as an independent source of financial truth.

## 011 — provider-neutral transaction core

The restored 011 layer:

- creates a private provider-event ledger without raw webhook body storage;
- makes `(provider, provider_reference)` unique for provider attempts;
- revokes direct browser/session mutation of `payments`;
- creates service-role-only payment-attempt and verified-event RPCs;
- derives payer and amount from authoritative order/booking rows;
- requires an exact paid-amount match;
- atomically updates payment + parent `payment_status` for a valid paid event;
- never downgrades paid truth on a later failed/cancelled attempt event;
- records refund events but leaves automatic refund application OFF;
- exposes duplicate settlements for manual review instead of hiding them.

## 011a — webhook event replay conflict guard

A repeated `(provider,event_id)` is idempotent only when provider reference, event type, requested status, amount and payload hash match. Conflicting replay fails closed and concurrent replay is transaction-serialized.

## 011b — V2 hardening

V2 adds:

1. **Concurrent provider-reference serialization.** Same `(provider,provider_reference)` retries serialize before attempt creation.
2. **Payload conflict detection.** Reusing a provider reference with a different subject or method fails rather than silently returning an unrelated payment.
3. **Private internal implementation.** The preserved 011 attempt implementation is moved out of the exposed `public` schema; the public service-role RPC is the controlled entrypoint.
4. **Immutable provider payment identity.** Payer, order/booking subject, amount, provider, reference and method cannot be rebound after creation.
5. **Provider row-shape constraints.** Provider/reference must be paired, provider-backed payments must reference exactly one subject, and provider statuses are constrained to the supported integrity states.
6. **SHA-256 event hash contract.** Provider ledger hashes must be 64 lowercase hex characters.
7. **`order_payments` projection integrity.** Browser/session writes are revoked; amount/status are copied from `payments` and automatically synchronized after provider status changes.
8. **Server adapter hardening.** Runtime metadata limits are enforced and raw database error messages are not returned by the provider-integrity helper.

## Provider adapter boundary

A real provider-specific webhook route is intentionally absent. The future provider adapter must:

- obtain the raw provider request body;
- verify the provider's real signature/timestamp/replay requirements using server/Edge secrets;
- hash the verified raw payload with SHA-256;
- map the provider event to the provider-neutral status model;
- call `applyVerifiedProviderPaymentEvent` only after signature verification succeeds.

Provider secrets must never be placed in `NEXT_PUBLIC_*` variables.

## Still owner-gated

- provider selection and merchant credentials;
- customer-visible payment methods;
- commissions/service fee/delivery fee;
- cancellation/refund/no-show rules;
- automatic refund activation;
- production activation/deploy.

## Required staging proof

- concurrent provider-reference retries;
- provider-reference payload conflict;
- exact amount settlement;
- event replay and conflicting replay;
- parent + payment + `order_payments` atomic consistency;
- failed/cancelled non-downgrade semantics;
- refund fail-closed behavior;
- duplicate settlement audit visibility;
- browser/session mutation denial;
- no service-role key in client bundles.
