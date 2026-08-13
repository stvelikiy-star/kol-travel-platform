# Stage 14-1 - Admin Delivery Supabase Read Adapter

## Scope

This stage creates a safe read-only Supabase adapter for admin delivery operational order data.

Created/updated files:

- `src/lib/data/admin-delivery-supabase.ts`
- `src/lib/data/admin-delivery-read.ts`
- `src/lib/data/types.ts`
- `docs/ADMIN_DELIVERY_SUPABASE_READ_ADAPTER.md`
- `README.md`

No UI is wired in this stage.

## Adapter

Primary Supabase function:

```ts
getAdminDeliveryOrdersFromSupabase()
```

It reads from `public.orders` and returns a safe result object.

The adapter uses only `GET`.

It does not:

- update orders
- insert audit logs
- assign courier
- cancel orders
- refund orders
- change payment status
- change totals
- touch `alcohol_module_settings`

## Fields Used

From `public.orders`:

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

Optional embedded partner field:

- `partners(title)`

The partner title is used only when the Supabase relationship can be resolved safely. Otherwise, the adapter still returns `business_id`.

## Source Mode Behavior

Wrapper function:

```ts
getAdminDeliveryReadResult()
```

Behavior:

- `DATA_SOURCE_MODE=mock`: returns existing mock admin delivery data.
- `DATA_SOURCE_MODE=supabase`: calls the Supabase adapter.
- If Supabase read fails: returns mock fallback with safe code/message.

Result shape:

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

This stage must not:

- update `orders`
- insert into `audit_logs`
- assign or reassign courier
- cancel/refund
- change `payment_status`
- change `total`
- change delivery completion state
- change `alcohol_module_settings`

Page/UI wiring is intentionally deferred to the next stage.

## Known Limitations

- UI is not connected yet.
- Auth protection is not active yet.
- Production admin reads must later require authenticated admin or super admin.
- Partner title depends on Supabase relationship resolution for `partners(title)`.
- The adapter reads order-level operational data only; delivery-specific tables can be added in a later read-only stage.

## Rollback

Rollback remains:

```env
DATA_SOURCE_MODE=mock
```

No database schema change is required.

Mock data and demo actions remain available.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Adapter does not enable alcohol module.
- Adapter does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol module.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Next Stage

Recommended next stage:

- Stage 14-2 - Admin Delivery UI Wiring
