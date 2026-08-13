# Stage 15-1 - Courier Deliveries Supabase Read Mode Plan

## Goal

Plan safe read-only Supabase data for courier delivery pages while keeping courier mode mock by default.

This stage does not implement courier Supabase reads, add courier writes, assign courier, mark picked up, mark delivered, change payments, cancel or refund orders, protect routes, create login UI, remove mock data, remove demo actions or enable the alcohol module.

## Target Pages

Future courier read-mode pages:

- `/courier/deliveries`
- `/courier/active`
- `/courier/history`
- `/courier/dispatcher` if relevant later

## First Recommended Pilot

Recommended first pilot:

- `/courier/deliveries`

Why:

- operationally important
- can read current order/delivery-like data
- does not require writes
- simple fallback to mock courier delivery data
- good first step before active delivery or history views

## Data Source Strategy

Expected mode behavior:

- `DATA_SOURCE_MODE=mock`: use current mock courier delivery data
- `DATA_SOURCE_MODE=supabase`: use a controlled Supabase read pilot
- Supabase read failure: fallback to mock data
- UI shows safe mode label
- UI never shows raw Supabase, SQL or env errors

`DATA_SOURCE_MODE=mock` remains the safe default.

## Data Availability

If there is no dedicated `deliveries` table ready for this pilot, use `public.orders` as the first read source for a courier operational list.

The first adapter can show delivery-relevant order fields from `orders`. A future dedicated `deliveries` table may still be needed for assigned courier, physical route state, issue workflow and courier history.

Known schema note:

- `orders` uses `business_id`, not `partner_id`.
- `audit_logs` uses `action`, `entity_type`, `entity_id`.

## Required Read Fields

Read from `public.orders`:

- `id`
- `client_id`
- `business_id`
- `type`
- `status`
- `payment_status`
- `total`
- `metadata`
- `created_at`
- `updated_at`

Known test data:

- test order id: `50000000-0000-0000-0000-000000000001`
- test business id: `20000000-0000-0000-0000-000000000001`

## Optional Partner Info

If safe later:

- join `partners` by `orders.business_id = partners.id`
- display partner title when available

If the join is unstable or RLS blocks it, keep only `business_id` and document the limitation.

## UI Safety

Courier read mode must:

- keep existing courier layout
- show a safe mode label
- not add new real buttons
- keep demo buttons demo-only
- not mutate data on page load
- not imply real delivery progress was changed

Recommended labels:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

## No-Write Guarantee

Courier read mode must not:

- update `orders`
- insert `audit_logs`
- assign courier
- mark `picked_up`
- mark delivering
- mark delivered
- report issue as real write
- change `payment_status`
- change `total`
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

- require authenticated courier
- show only assigned deliveries or allowed available deliveries
- verify courier assignment rules
- use RLS
- keep server-side checks for future mutations

For now this is a test-only read pilot. It does not activate route protection or login UI.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Alcohol sales and delivery remain disabled.
- Courier, admin and partner cannot enable alcohol.
- AI cannot enable alcohol.
- Courier read mode must not touch `alcohol_module_settings`.

## Rollback

Rollback path:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Hard refresh with `Ctrl+F5`.
5. Open courier pages.
6. Confirm mock courier data returns.

No schema rollback is required for read-only failures.

## Next Stages

- 15-2 Courier Deliveries Supabase Read Adapter
- 15-3 Courier Deliveries Supabase Read UI Wiring
- 15-4 Courier Deliveries Supabase Read QA
- 15-5 Courier Deliveries Read Rollback Check
- 15-6 Courier Deliveries Read Final Audit

## Final Plan Decision

Proceed with `/courier/deliveries` as the first courier read pilot.

Use `public.orders` as the first read source if no dedicated delivery table is ready, keep fallback to mock, and keep all courier progress actions demo-only until a separate write stage.
