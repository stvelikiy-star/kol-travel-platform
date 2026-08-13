# Stage 13-5 - Admin Delivery Supabase Read Pilot Plan

## Goal

Plan a safe read-only Supabase pilot for `/admin/delivery`.

The pilot should let admin users see operational order and delivery state from the Supabase TEST database while keeping:

- no admin mutations
- no courier assignment writes
- no payment changes
- no delivery completion writes
- mock fallback
- rollback through `DATA_SOURCE_MODE=mock`

## Current Known Data

The `orders` table exists and has at least one seeded order.

Known `public.orders` fields:

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

Known pilot order:

- order id: `50000000-0000-0000-0000-000000000001`
- business id: `20000000-0000-0000-0000-000000000001`
- payment status: `pending`
- total: `800.00`
- status: current DB status

## First Admin Read Scope

Read only:

- `orders`
- optionally `partners` by `business_id` if admin needs partner names
- optionally `audit_logs` summary in a later read-only stage

No writes.

Do not implement:

- courier assignment
- courier reassignment
- order cancellation
- refund approval
- payment status changes
- force complete
- force close issue
- audit log creation

## Display Fields

For `/admin/delivery`, display enough fields to confirm Supabase read behavior:

- order id
- `business_id`
- type
- status
- `payment_status`
- total
- `updated_at`

Optional later fields:

- partner title from `partners`
- delivery risk from delivery-related tables
- latest audit summary

## Mode Behavior

### `DATA_SOURCE_MODE=mock`

- `/admin/delivery` uses current admin mock data.
- Admin demo actions remain demo-only.
- No Supabase env is required.

### `DATA_SOURCE_MODE=supabase`

- `/admin/delivery` uses admin delivery Supabase read pilot.
- Read pilot should use safe server-side reads only.
- If Supabase read fails, fallback to mock data.
- UI should show a small safe label such as `Supabase read pilot` or `Mock fallback`.

## Safety

Admin read mode must not:

- assign courier
- reassign courier
- cancel order
- refund order
- update payment
- mark delivered
- create audit log
- enable alcohol module
- mutate mock data

Page load must be read-only.

## Error Handling

Show safe messages only.

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

Never show:

- raw Supabase error
- SQL details
- service role key
- auth token
- private env values

## Auth And RLS Note

Production later must protect `/admin/**`.

This pilot is test-only and does not activate auth protection.

Future production admin reads must:

- require authenticated admin or super admin
- respect RLS/admin policies
- avoid exposing private data to non-admin roles
- keep service role key server-only

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Read pilot must not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- Normal roles cannot enable alcohol.
- AI cannot enable alcohol module.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Rollback

Rollback path:

```env
DATA_SOURCE_MODE=mock
```

Then:

1. Restart dev server.
2. Open `/admin/delivery`.
3. Confirm page returns to mock data.
4. Confirm demo admin buttons remain demo-only.
5. Confirm no schema change is required.

## Manual QA Plan For Future Implementation

Before pilot:

- `DATA_SOURCE_MODE=mock` build passes.
- Supabase TEST project has seeded order data.
- `ALCOHOL_MODULE_ENABLED=false`.

After pilot:

- `/admin/delivery` opens in mock mode.
- `/admin/delivery` opens in Supabase mode.
- Supabase order fields render safely.
- Fallback works if read fails.
- No write occurs on page load.
- Audit count does not change on refresh.
- Payment status and total do not change.

## Next Stages

- Stage 13-6 - Admin Delivery Supabase Read Adapter
- Stage 13-7 - Admin Delivery Read UI Pilot
- Stage 13-8 - Read Mode Rollback Check
