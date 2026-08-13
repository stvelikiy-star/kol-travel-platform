# Stage 13-1 - Supabase Read Mode Pilot Plan

## Goal

Plan a safe migration path from mock reads to Supabase reads.

The pilot must:

- start with the smallest low-risk read path
- keep rollback to mock mode simple
- avoid breaking public pages and dashboards
- avoid new real writes
- keep demo actions available
- keep `DATA_SOURCE_MODE=mock` as the default after the first real write test

## Current State

- The app works in mock mode.
- Supabase TEST project exists.
- SQL schema, RLS draft and seed data are applied.
- First real write pilot succeeded:
  - `markOrderReadyForPickupAction(orderId)` worked.
  - test order id: `50000000-0000-0000-0000-000000000001`
  - order status changed from `preparing` to `ready_for_pickup`
  - `payment_status` remained `pending`
  - `total` remained `800.00`
  - `ALCOHOL_MODULE_ENABLED=false`
- Real write action exists, but UI should return to mock mode after test.
- Demo actions remain available.

## Recommended Read Pilot Order

### 13-2 Partner Orders Supabase Read Pilot Implementation

First recommended pilot.

Reasons:

- we already have real order data
- first real write validated the order path
- order schema is known
- `business_id` relation is known
- `/partner/orders` already has a controlled real-write pilot card
- this avoids mixing public catalog mapping work into the first read test

### 13-3 Partner Orders Read QA

Verify:

- `/partner/orders` opens in mock mode
- `/partner/orders` opens in Supabase mode
- Supabase read data maps safely into existing order UI
- demo fallback remains available
- no write occurs from read mode

### 13-4 Public Catalog Supabase Read Pilot Plan

Plan read-only catalog reads for:

- tours
- stays
- food
- shop
- partners

This remains low risk, but field mapping across multiple catalog tables is broader than the partner orders pilot.

### 13-5 Admin Delivery Supabase Read Pilot

Read operational order/delivery view for admin.

Rules:

- read-only
- no admin writes
- no payment/refund/cancel actions
- safe fallback to mock if tables or data are missing

### 13-6 Courier Deliveries Supabase Read Pilot

Read assigned deliveries if table/data exists.

Rules:

- read-only
- fallback to mock if no table/data
- do not update delivery progress
- do not assign/reassign courier

### 13-7 Read Mode Rollback Check

Verify:

- `DATA_SOURCE_MODE=mock` restores all pages
- mock pages still work
- demo actions remain
- no database schema changes are required for rollback

## First Recommended Pilot

The safest first read pilot is:

- `/partner/orders` Supabase read pilot

Reason:

- existing Supabase order record is known
- first real write confirmed the test order path
- `orders.business_id` relation is known
- partner profile relation uses `partner_profiles.business_id`
- order read fields are narrower than full public catalog mapping

## Data Source Strategy

Mode behavior:

- `DATA_SOURCE_MODE=mock` means current mock reads.
- `DATA_SOURCE_MODE=supabase` means controlled Supabase read pilot.
- If Supabase read fails, fallback to mock where possible.
- UI must never show raw database errors.
- UI must never expose SQL details, service role keys or env values.

Mock data must not be removed during pilot stages.

## Required Read Fields for `/partner/orders`

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

Optional later field:

- `ready_for_pickup_at`, only if column exists and is confirmed

## Schema-Specific Note

The schema uses:

- `business_id`, not `partner_id`
- `partner_profiles.business_id`
- `orders.business_id`

Do not introduce `partner_id` assumptions into the read pilot.

## UI Safety

Supabase read pilot must:

- not change visual layout significantly
- clearly label Supabase/test mode if needed
- keep demo buttons available
- not add payment/refund/cancel behavior
- not mutate data while reading
- not change delivery completion flow

## Error Handling

If Supabase read fails:

- show safe message
- fallback to mock data where possible
- do not show raw Supabase error
- do not show SQL details
- do not expose service role key
- do not expose env values

Safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

## RLS/Auth Note

Real auth protection is not active yet.

Rules:

- use Supabase TEST project only
- do not expose private production data
- keep pilot limited to seeded test data
- future implementation must require authenticated partner before production
- ownership checks must use `business_id`
- route protection remains out of scope for this pilot

## Rollback

Rollback must be one clear mode change:

```env
DATA_SOURCE_MODE=mock
```

Then:

1. Restart dev server.
2. Verify mock pages work again.
3. Keep demo actions.
4. Do not remove mock data.
5. Do not change database schema.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Read pilot must not enable alcohol module.
- Read pilot must not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Manual QA Plan

Before Supabase read pilot:

- `DATA_SOURCE_MODE=mock` build passes.
- Supabase order exists.
- Order status is known.
- `payment_status` remains `pending`.
- `ALCOHOL_MODULE_ENABLED=false`.

After pilot:

- `/partner/orders` opens in mock mode.
- `/partner/orders` opens in Supabase mode.
- No real write occurs from read mode.
- Fallback works.
- Demo action path remains available.
- No payment/refund/cancel action is introduced.

## Next Stages

- Stage 13-2 - Partner Orders Supabase Read Pilot Implementation
- Stage 13-3 - Partner Orders Read QA
- Stage 13-4 - Public Catalog Supabase Read Pilot Plan
- Stage 13-5 - Read Mode Rollback Check

## Blockers

No code blocker for planning.

Implementation should not start until the team confirms:

- test project remains non-production
- `DATA_SOURCE_MODE=mock` is restored after write testing
- seed order remains available for read comparison
- no production/private data is used
