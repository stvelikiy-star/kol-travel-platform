# Stage 15-2 - Courier Deliveries Supabase Read Adapter

## Summary

Created a safe read-only Supabase adapter for future courier deliveries read mode.

This stage does not wire `/courier/deliveries` UI yet and does not add courier writes, courier assignment, pickup, delivery completion, issue reporting, payment changes, cancellation, refunds, route protection, login UI or alcohol module activation.

## Files Created Or Updated

- `src/lib/data/courier-deliveries-supabase.ts`
- `src/lib/data/courier-deliveries-read.ts`
- `src/lib/data/types.ts`
- `docs/COURIER_DELIVERIES_SUPABASE_READ_ADAPTER.md`
- `README.md`

## Source Table Used

The adapter reads from `public.orders` as the first delivery-like operational source.

Reason:

- dedicated courier `deliveries` table may not be ready for this read pilot
- `orders` already contains delivery-relevant operational status and totals
- no write action is needed for a first courier list pilot

Future stages may introduce a dedicated `deliveries` table for courier assignment, route status, issue flow and history.

## Fields Used

Read from `orders`:

- `id`
- `client_id`
- `business_id`
- `type`
- `status`
- `payment_status`
- `total`
- `delivery_fee`
- `metadata`
- `created_at`
- `updated_at`

Mapped courier delivery fields:

- `id`
- `orderId`
- `clientId`
- `businessId`
- `partnerTitle` when available
- `type`
- `status`
- `paymentStatus`
- `total`
- `deliveryFee`
- `metadata`
- `createdAt`
- `updatedAt`

## Partner Title Join Decision

The adapter requests `partners(title)` so the UI can later display the partner title if Supabase/PostgREST relationship metadata allows it.

If the join is blocked by schema relationship naming or RLS later, the wrapper still supports fallback to mock data. A later tiny adapter adjustment can remove the join and keep only `business_id`.

Schema note:

- use `orders.business_id`
- do not use `partner_id`

## Source Mode Behavior

`getCourierDeliveriesReadResult()` behavior:

- `DATA_SOURCE_MODE=mock`: returns current mock courier deliveries
- `DATA_SOURCE_MODE=supabase`: calls `getCourierDeliveriesFromSupabase()`
- Supabase read failure: returns mock fallback with safe code/message

Safe result shape:

```ts
{
  ok: boolean,
  source: "mock" | "supabase" | "fallback",
  deliveries: [],
  code?: string,
  message?: string
}
```

## Safe Errors

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

The adapter must never expose:

- raw Supabase errors
- SQL details
- service role key
- auth token
- private env values

## No-Write Guarantee

This adapter uses read-only behavior and must not:

- update `orders`
- insert `audit_logs`
- assign courier
- change status
- change payment status
- change total
- touch `alcohol_module_settings`

The Supabase request uses `method: "GET"`.

## Rollback Path

Rollback remains simple:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Open courier pages.
5. Confirm mock courier data returns.

No schema rollback is required for read adapter failures.

## Limitations

- UI is not wired in this stage.
- Auth/RLS courier ownership is not active yet.
- Current pilot reads delivery-like data from `orders`, not a dedicated `deliveries` table.
- Partner title join depends on Supabase relationship metadata.
- No courier mutation is implemented.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Adapter does not read or write alcohol settings.
- Courier, partner and admin cannot enable alcohol.
- AI cannot enable alcohol.
