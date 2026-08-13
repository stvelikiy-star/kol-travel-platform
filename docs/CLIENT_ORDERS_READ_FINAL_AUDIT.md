# Stage 16-6 - Client Orders Read Final Audit

## Summary

The Client Orders Supabase Read section is complete at code and documentation level after the Stage 16-3 UI wiring fix.

Implemented scope:

- client orders read-mode plan
- read-only Supabase adapter
- mock/fallback read wrapper
- `/client/orders` UI wiring behind `DATA_SOURCE_MODE`
- QA document
- rollback check document
- final audit document

No client writes, payment actions, refund/cancel actions, order status changes, audit inserts, protected routes, login UI or alcohol module activation were added.

## Selected Client Page

Selected existing page:

- `/client/orders`

Route note:

- `/dashboard/client` and `/dashboard/client/orders` do not exist in the current app.

## Files Reviewed

Required files:

- `src/lib/data/client-orders-supabase.ts` - exists
- `src/lib/data/client-orders-read.ts` - exists
- `docs/CLIENT_ORDERS_SUPABASE_READ_MODE_PLAN.md` - exists
- `docs/CLIENT_ORDERS_SUPABASE_READ_ADAPTER.md` - exists
- `docs/CLIENT_ORDERS_SUPABASE_READ_UI_WIRING.md` - exists
- `docs/CLIENT_ORDERS_SUPABASE_READ_QA.md` - exists
- `docs/CLIENT_ORDERS_READ_ROLLBACK_CHECK.md` - exists

## UI Audit

`/client/orders`:

- opens in current app build
- imports `getClientOrdersReadResult()`
- calls `getClientOrdersReadResult()`
- shows safe mode labels:
  - `Mock data mode`
  - `Supabase read pilot`
  - `Fallback to mock data`
- displays safe code/message when available
- keeps client actions demo-only
- does not expose raw errors in the planned UI surface

## Data Audit

Supabase client orders read adapter uses:

- `orders.client_id` for client filtering
- `orders.business_id`
- not `partner_id`
- optional `partners(title,slug)` join by `orders.business_id = partners.id`
- seeded demo client id for pilot only: `00000000-0000-0000-0000-000000000002`

The adapter does not broaden reads to all orders when `clientId` is missing. It defaults to the seeded demo client id.

## No-Write Audit

Client orders read mode does not add code paths that:

- update orders
- insert audit logs
- place order
- cancel order
- refund order
- update payment
- change `payment_status`
- change `subtotal`
- change `delivery_fee`
- change `discount`
- change `total`
- touch `alcohol_module_settings`

The Supabase adapter uses `method: "GET"`.

## Env Audit

Expected behavior:

- `DATA_SOURCE_MODE=mock` remains the safe default.
- `DATA_SOURCE_MODE=supabase` activates only the controlled client orders read pilot.
- `ALCOHOL_MODULE_ENABLED=false` remains required.
- Mock rollback is one env change.

## Error Audit

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

The adapter and UI documentation must never expose:

- raw Supabase errors
- SQL details
- service role key
- auth token
- private env values

## Rollback Audit

Rollback path:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Hard refresh with `Ctrl+F5`.
5. Open `/client/orders`.
6. Confirm mock client order data returns.
7. Run `npm run build`.

No schema rollback is required for read-only failures.

## Auth And RLS Audit

Production later must:

- require authenticated client
- show only that client's orders
- use RLS
- verify ownership server-side
- remove seeded demo client fallback from production mode

The current read adapter is test-pilot preparation only.

## Alcohol Audit

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Client, partner, courier and admin cannot enable alcohol.
- AI cannot enable alcohol.
- Client orders read mode must not touch `alcohol_module_settings`.

## Risks

Remaining manual risks:

- seeded test order `client_id` may differ from the planned demo client id and must be verified manually
- optional partner title/slug join may fail depending on relationship metadata or RLS
- manual SQL checks are still required to confirm no page-load changes in TEST data

Mitigation:

- fallback to mock data
- safe codes/messages only
- rollback to `DATA_SOURCE_MODE=mock`
- keep client mutations in a separate future write stage

## Blockers

No code-level blockers found after the Stage 16-3 UI wiring fix.

Manual Supabase verification is still required before expanding client read pilots.

## Final Decision

Safe at code/build/documentation level.

Recommended next section:

- expand read mode only after manual Supabase QA confirms no order/payment/audit/alcohol changes
- keep client write actions out of scope until a separate backend write stage
