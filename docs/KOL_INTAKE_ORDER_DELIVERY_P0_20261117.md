# KÖL — P0 unified intake → order → delivery contract (17.11.2026)

**Status:** implementation in separate Draft branch; NOT a full delivery release. Protected production and accepted 4-scene animated homepage must remain unchanged.

## Confirmed release reality (source SHA `7b8362f7b7caf460c0c02aa647746784fd2640f0`)

- Public `/checkout` submits an `order_request` in `public.support_tickets`, with contact and untrusted cart data. It does **not** create `public.orders`, charge money or promise delivery. Anonymous tickets have `created_by = NULL`.
- Existing `public.create_order_atomic` creates **authenticated client** food/shop orders with database-authoritative prices, inventory locks, normalized items and idempotency, but it permits **pickup only**. An unknown delivery fee is not zero.
- Support Admin may reply/change ticket status through `admin_support_lifecycle_atomic`. Partner, Admin Delivery and Courier each have tested transactional RPC and browser workflows, but the lifecycle was previously demonstrated on **separate test orders**, not one original public ticket.
- `support_tickets.related_order_id`, `orders.id`, `deliveries.order_id` already provide a relational trace. A correlation identifier may be the original `support_tickets.id`; do not force all entity primary keys to be equal.

## Stage 1 — safe existing-order binding (in this branch)

`028_admin_intake_pickup_order_link_DRAFT_NOT_APPLIED.sql` provides
`admin_link_intake_pickup_order_atomic(ticket,order,request_id)`.

Rules:
1. Only active `support_admin` / `super_admin` may link.
2. Only open/in-progress `order_request` with a verified non-null `created_by`; no anonymous ownership inference from a phone number.
3. The order must belong to that exact client and be an existing database-priced `pickup` food/shop order, created through the authorized order path with `metadata.idempotency_key = 'intake-' || ticket.id`.
4. The stored cart item UUIDs, types and normalized quantities must match the actual `order_items`; client-supplied prices are **not** trusted.
5. A ticket cannot link to multiple orders; an order cannot be claimed by multiple tickets. Exact replay is idempotent, changed `request_id` payload is rejected and the linking actor is audited.
6. A disabled/missing delivery tariff, multi-merchant cart, free-form cart or anonymous request must **fail closed**, not be silently converted.

Operator UI adds a guarded form to link an *existing* pickup order by ID. It **does not create** an order, impersonate the client or enable delivery. The new SQL has been independently applied/verified on an extracted no-network PostgreSQL backup; schema/ACL and rollback-only positive/replay/role-denial tests passed. The full browser test is maintained in `qa-local-admin-support-runtime.mjs` and the disposable local smoke script.

## Stage 2 — still required for owner-requested end-to-end

- **Identity and consent:** give anonymous requesters a verified identity using the existing Auth/magic-link process or an explicitly approved guest flow. Never create `orders.client_id` from an unverified phone number. The operator must confirm request contents and contact preferences.
- **Trusted operator conversion:** refactor the atomic order core to expose a narrowly authorized internal entrypoint with explicit, validated client identity (NOT spoofed JWT). Preserve price/stock authority, business scoping, idempotency and one-operation rollback. Support both `food` and `shop`, and define how to split multi-partner baskets before implementation.
- **Delivery fees:** define a server-owned rate by route/zone/business and confirmed address. The production `create_order_atomic` currently rejects `delivery`; do not remove that guard until tariff, cancellation/refund and delivery-specific accounting have been verified in SQL and tests. Payment remains `pending` until verified provider evidence.
- **One-order E2E:** submit public ticket; operator confirms; order created and linked; partner accepts/prepares; dispatcher creates/assigns delivery; courier completes; test that **the same `order_id`** persists through `orders`, `order_items`, `support_tickets`, `order_delivery`, `deliveries`, history and audit logs.
- **Negative E2E:** duplicate request at every boundary, changed-payload conflict, wrong operator/partner/client/courier roles, unapproved catalogue item, out-of-stock race, invalid fee or route, lost network/timeout, payment mismatch, cancellation and replay.
- **Release gates:** signed JWT/browser/API/DB tests, independent CI on one SHA, fresh off-host backup, rollback/restore rehearsal and authoritative production database parity. Production, Vercel domain, and other projects remain untouched.

**GO status:** Stage 1 is **pickup-only draft**; Stage 2 is required before promising an automatic public order + delivery workflow.
