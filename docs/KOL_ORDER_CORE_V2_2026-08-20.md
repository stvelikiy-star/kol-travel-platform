# KÖL Order Core V2 — 2026-08-20

This source-only restack keeps the audited 008 Food/Shop order transaction core intact and adds a separate 008a replay-hardening layer.

Verified design constraints:

- PostgreSQL remains authoritative for item prices and order totals.
- Shop stock authority is `products.stock_qty`; null stock fails closed.
- Food ingredient inventory is not invented because no authoritative ingredient stock model exists.
- Delivery remains pickup-only until a server-authoritative delivery pricing model exists.
- The public order RPC derives client identity from `auth.uid()` and accepts no caller-supplied monetary fields.
- 008a serializes retries on `(auth.uid(), idempotency_key)` before inventory work.
- Existing order items are compared to a normalized retry cart. Reordering or duplicate rows with the same aggregate quantity are treated as the same payload; changed item/quantity/business/type/delivery is a conflict.
- Aggregated duplicate quantity cannot exceed the existing per-item maximum of 99.
- The original 008 implementation is renamed to a private internal function and is not directly executable by anon/authenticated roles.
- `order_delivery` becomes part of the protected transactional aggregate; direct anon/authenticated INSERT/UPDATE/DELETE is revoked.

Source files:

- `supabase/schema/008_order_transaction_core_DRAFT_NOT_APPLIED.sql`
- `supabase/schema/008_order_transaction_core_VERIFY.sql`
- `supabase/schema/008a_order_idempotency_payload_hardening_DRAFT_NOT_APPLIED.sql`
- `supabase/schema/008a_order_idempotency_payload_hardening_VERIFY.sql`
- `src/lib/data/order-write-supabase.ts`
- `src/app/actions/client/clientOrdersReal.ts`
- `src/app/actions/partner/partnerOrdersReal.ts`

No SQL in this restack has been applied to the live Supabase project. Staging concurrency tests are mandatory before any live apply.
