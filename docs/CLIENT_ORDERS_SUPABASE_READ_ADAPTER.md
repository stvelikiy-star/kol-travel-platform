# Stage 16-2 - Client Orders Supabase Read Adapter

## Summary

Created a safe read-only Supabase adapter for future client orders read mode.

This stage does not wire client UI yet and does not add client writes, payment actions, refund/cancel actions, order status changes, audit inserts, protected routes, login UI or alcohol module activation.

## Files Created Or Updated

- `src/lib/data/client-orders-supabase.ts`
- `src/lib/data/client-orders-read.ts`
- `src/lib/data/types.ts`
- `docs/CLIENT_ORDERS_SUPABASE_READ_ADAPTER.md`
- `README.md`

## Source Table Used

The adapter reads from `public.orders`.

Schema notes:

- `orders` uses `business_id`, not `partner_id`.
- `audit_logs` uses `action`, `entity_type`, `entity_id`.

## Demo Client ID

If `getClientOrdersFromSupabase(clientId)` receives a `clientId`, the adapter filters by:

- `orders.client_id = clientId`

If no `clientId` is provided, the pilot uses the seeded demo client id:

- `00000000-0000-0000-0000-000000000002`

The adapter must not query all production data without a client filter.

## Fields Used

Read from `orders`:

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

Mapped client order fields:

- `id`
- `clientId`
- `businessId`
- `partnerTitle` when available
- `partnerSlug` when available
- `type`
- `status`
- `paymentStatus`
- `subtotal`
- `deliveryFee`
- `discount`
- `total`
- `metadata`
- `createdAt`
- `updatedAt`

## Partner Title Join Decision

The adapter requests `partners(title,slug)` so the UI can later display partner title and slug if Supabase/PostgREST relationship metadata allows it.

If the join is blocked by schema relationship naming or RLS later, a tiny adapter adjustment can remove the join and keep only `business_id`.

## Source Mode Behavior

`getClientOrdersReadResult()` behavior:

- `DATA_SOURCE_MODE=mock`: returns current mock client order data
- `DATA_SOURCE_MODE=supabase`: calls `getClientOrdersFromSupabase()`
- Supabase read failure: returns mock fallback with safe code/message

Safe result shape:

```ts
{
  ok: boolean,
  source: "mock" | "supabase" | "fallback",
  orders: [],
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
- change status
- change `payment_status`
- change `subtotal`
- change `delivery_fee`
- change `discount`
- change `total`
- cancel or refund order
- touch `alcohol_module_settings`

The Supabase request uses `method: "GET"`.

## Rollback Path

Rollback remains simple:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Open client pages.
5. Confirm mock client order data returns.

No schema rollback is required for read adapter failures.

## Limitations

- UI is not wired in this stage.
- Auth/RLS client ownership is not active yet.
- The pilot uses a seeded demo client id when no client id is passed.
- Partner title/slug join depends on Supabase relationship metadata.
- No client mutation is implemented.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Adapter does not read or write alcohol settings.
- Client, partner, courier and admin cannot enable alcohol.
- AI cannot enable alcohol.
