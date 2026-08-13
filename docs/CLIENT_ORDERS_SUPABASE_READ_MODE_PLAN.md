# Stage 16-1 - Client Orders Supabase Read Mode Plan

## Goal

Plan safe read-only Supabase data for client cabinet order pages while keeping client mode mock by default.

This stage does not implement client Supabase reads, add client writes, add payment actions, add refund or cancel actions, change order status, protect routes, create login UI, remove mock data, remove demo actions or enable the alcohol module.

## Target Pages

Requested target shape:

- `/dashboard/client`
- `/dashboard/client/orders` if exists
- any client order/history page if already present

Current project routes found:

- `/client`
- `/client/orders`
- `/client/orders/[id]`

The implementation plan should use the existing `/client/**` route group unless a future route migration explicitly introduces `/dashboard/client/**`.

## First Recommended Pilot

Recommended first pilot:

- `/client/orders`

Why:

- it is the smallest existing client order/history page
- it is focused on order list data
- it can read current seeded `orders` data
- no writes are required
- fallback to mock order data is simple
- detail route `/client/orders/[id]` can be handled later after list read mode is safe

If `/client/orders` becomes unavailable later, use a read-only client order block inside `/client`.

## Data Source Strategy

Expected mode behavior:

- `DATA_SOURCE_MODE=mock`: current mock client dashboard/order data
- `DATA_SOURCE_MODE=supabase`: controlled Supabase read pilot
- Supabase read failure: fallback to mock data
- UI shows safe mode label
- UI never shows raw Supabase, SQL or env errors

`DATA_SOURCE_MODE=mock` remains the safe default.

## Data Availability

If real authenticated client filtering is not ready:

- use a seeded demo `client_id` only for the pilot
- document the demo client id in the adapter/QA stage after verifying seed data
- do not expose production/private data
- do not broaden the read beyond test project data

Production later must filter by authenticated user id and RLS.

Known test order:

- order id: `50000000-0000-0000-0000-000000000001`
- business id: `20000000-0000-0000-0000-000000000001`
- payment status should remain `pending`
- total should remain `800.00`

## Required Read Fields

Read from `public.orders`:

- `id`
- `client_id`
- `business_id`
- `type`
- `status`
- `payment_status`
- `subtotal`
- `delivery_fee`
- `discount`
- `total`
- `metadata`
- `created_at`
- `updated_at`

Schema notes:

- `orders` uses `business_id`, not `partner_id`
- `audit_logs` uses `action`, `entity_type`, `entity_id`

## Optional Partner Info

If safe later:

- join `partners` by `orders.business_id = partners.id`
- display partner title when available

If the join is unstable or RLS blocks it, keep only `business_id` and document the limitation.

## UI Safety

Client read mode must:

- keep existing layout
- show a safe mode label
- not add real payment buttons
- not add real refund buttons
- not add real cancel buttons
- keep demo buttons demo-only
- not mutate data on page load
- not imply any payment/order action was completed

Recommended labels:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

## No-Write Guarantee

Client read mode must not:

- update `orders`
- insert `audit_logs`
- change order status
- change `payment_status`
- change `subtotal`
- change `delivery_fee`
- change `discount`
- change `total`
- cancel order
- refund order
- touch `alcohol_module_settings`

The future adapter should use read-only `GET` behavior.

## Safe Errors

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

Never expose:

- raw Supabase error
- SQL details
- service role key
- auth token
- private env values

## Auth And RLS Note

Production later must:

- require authenticated client
- show only that client's orders
- verify ownership server-side
- use RLS
- keep server-side checks for future mutations

For now this is a test-only read pilot. It does not activate route protection or login UI.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Client, partner, courier and admin cannot enable alcohol.
- AI cannot enable alcohol.
- Client read mode must not touch `alcohol_module_settings`.

## Rollback

Rollback path:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Hard refresh with `Ctrl+F5`.
5. Open client pages.
6. Confirm mock client data returns.

No schema rollback is required for read-only failures.

## Next Stages

- 16-2 Client Orders Supabase Read Adapter
- 16-3 Client Orders Supabase Read UI Wiring
- 16-4 Client Orders Supabase Read QA
- 16-5 Client Orders Read Rollback Check
- 16-6 Client Orders Read Final Audit

## Final Plan Decision

Proceed with `/client/orders` as the first client read pilot.

Use `public.orders` as the read source, keep fallback to mock, and keep all payment, cancellation, refund and order mutation actions out of scope until a separate write stage.
