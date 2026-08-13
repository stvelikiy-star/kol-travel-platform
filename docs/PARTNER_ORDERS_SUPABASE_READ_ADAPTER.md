# Stage 13-2 - Partner Orders Supabase Read Adapter

## Scope

This stage adds a read-only partner orders adapter for the Supabase TEST project.

No UI pages are wired yet.

Created files:

- `src/lib/data/partner-orders-supabase.ts`
- `src/lib/data/partner-orders-read.ts`
- `src/lib/data/types.ts`

## Adapter

Primary function:

```ts
getPartnerOrdersFromSupabase(businessId?: string)
```

Behavior:

- reads from `public.orders`
- filters by `orders.business_id`
- if `businessId` is not provided, uses seeded demo business id:
  `20000000-0000-0000-0000-000000000001`
- returns a safe result object
- never writes to Supabase
- never inserts audit logs
- never changes payment, order, courier or alcohol state

## Read Fields

The adapter reads:

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

The current adapter maps rows into the existing `Order` UI shape. `order_items` are not read in this stage, so mapped Supabase orders use an empty `items` array until an order-items read pilot is added.

## Business ID Logic

This schema uses `business_id`, not `partner_id`.

Relevant schema relations:

- `partner_profiles.business_id`
- `orders.business_id`
- `partners.id`

Do not introduce `partner_id` assumptions into partner order reads.

## Safe Result Shape

The Supabase adapter returns:

```ts
{
  ok: boolean,
  source: "supabase",
  orders: [],
  code?: string,
  message?: string
}
```

Safe codes:

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

## Mock Fallback Wrapper

Wrapper function:

```ts
getPartnerOrdersReadResult(businessId?: string)
```

Behavior:

- `DATA_SOURCE_MODE=mock` returns existing mock partner orders.
- `DATA_SOURCE_MODE=supabase` calls the Supabase read adapter.
- if Supabase read fails, returns mock fallback with `fallbackUsed: true`.

This wrapper is prepared for future UI wiring, but `/partner/orders` is not connected in this stage.

## No Writes

This stage does not:

- update `orders`
- insert into `audit_logs`
- change `payment_status`
- change totals
- change order items
- assign courier
- mark pickup or delivery statuses
- touch `alcohol_module_settings`

## Rollback

Rollback remains:

```env
DATA_SOURCE_MODE=mock
```

No database schema change is required.

Mock data and demo actions remain available.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Read adapter does not enable alcohol module.
- Read adapter does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Next Stage

Recommended next stage:

- Stage 13-3 - Partner Orders Supabase Read UI Wiring Pilot
