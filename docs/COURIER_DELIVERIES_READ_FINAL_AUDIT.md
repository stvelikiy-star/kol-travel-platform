# Stage 15-6 - Courier Deliveries Read Final Audit

## Summary

The Courier Deliveries Supabase Read section is complete at code and documentation level.

Implemented scope:

- courier deliveries read-mode plan
- read-only Supabase adapter for delivery-like courier orders
- mock/fallback read wrapper
- `/courier/deliveries` UI wiring behind `DATA_SOURCE_MODE`
- QA document
- rollback check document

No courier writes, courier assignment, pickup, delivery completion, issue writes, cancellation, refund, payment update, route protection or login UI were added.

## Files Reviewed

Required files:

- `src/lib/data/courier-deliveries-supabase.ts` - exists
- `src/lib/data/courier-deliveries-read.ts` - exists
- `docs/COURIER_DELIVERIES_SUPABASE_READ_MODE_PLAN.md` - exists
- `docs/COURIER_DELIVERIES_SUPABASE_READ_ADAPTER.md` - exists
- `docs/COURIER_DELIVERIES_SUPABASE_READ_UI_WIRING.md` - exists
- `docs/COURIER_DELIVERIES_SUPABASE_READ_QA.md` - exists
- `docs/COURIER_DELIVERIES_READ_ROLLBACK_CHECK.md` - exists

## UI Audit

`/courier/deliveries`:

- reads through `getCourierDeliveriesReadResult()`
- keeps the courier deliveries layout structure
- shows safe mode labels:
  - `Mock data mode`
  - `Supabase read pilot`
  - `Fallback to mock data`
- displays safe code/message when available
- keeps existing courier actions demo-only
- does not expose raw errors in the planned UI surface

## Data Audit

Supabase courier deliveries read uses:

- `orders.business_id`
- not `partner_id`
- optional `partners(title)` join by `orders.business_id = partners.id`

Because no dedicated deliveries table is active in this pilot, `public.orders` is documented as the temporary delivery-like source.

Returned operational fields include:

- delivery/order id
- client id
- business id
- partner title when available
- type
- status
- payment status
- delivery fee
- total
- metadata
- created and updated timestamps

## No-Write Audit

Courier deliveries read mode does not add code paths that:

- update orders
- insert audit logs
- assign courier
- mark picked up
- mark delivering
- mark delivered
- report issue as real write
- cancel order
- refund order
- update payment
- touch `alcohol_module_settings`

The Supabase adapter uses `method: "GET"`.

## Env Audit

Expected behavior:

- `DATA_SOURCE_MODE=mock` remains the safe default.
- `DATA_SOURCE_MODE=supabase` activates only the controlled courier deliveries read pilot.
- `ALCOHOL_MODULE_ENABLED=false` remains required.
- Mock rollback is one env change.

## Error Audit

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

The UI/documentation must never expose:

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
5. Open `/courier/deliveries`.
6. Confirm mock courier delivery data returns.
7. Run `npm run build`.

No schema rollback is required for read-only failures.

## Risks

Remaining manual risks:

- Supabase TEST project may have missing env or RLS restrictions.
- Optional partner title join may fail depending on relationship naming.
- Manual SQL checks are still required to confirm no page-load changes in TEST data.
- A dedicated deliveries table may be required for richer courier assignment/history later.

Mitigation:

- fallback to mock data
- safe codes/messages only
- rollback to `DATA_SOURCE_MODE=mock`
- keep courier mutations in a separate future write stage

## Blockers

No code-level blockers found.

Manual Supabase verification is still required before expanding courier read pilots.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Courier deliveries read mode does not read or write alcohol settings.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol module.
- Future activation requires legal review, licensing, partner verification and super admin approval.

## Final Decision

Safe at code/build/documentation level.

Recommended next section:

- expand read mode only after manual Supabase QA confirms no order/payment/audit/alcohol changes
- keep courier write actions out of scope until a separate backend write stage
