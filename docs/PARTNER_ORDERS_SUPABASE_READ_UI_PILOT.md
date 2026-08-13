# Stage 13-3 - Partner Orders Supabase Read UI Pilot

## Scope

This stage wires `/partner/orders` to the partner orders read wrapper.

Changed files:

- `src/app/partner/orders/page.tsx`
- `docs/PARTNER_ORDERS_SUPABASE_READ_UI_PILOT.md`
- `README.md`

The page now uses:

```ts
getPartnerOrdersReadResult()
```

No public pages, client/courier/admin pages, action files, database schema files, payments or notification integrations were changed.

## Mode Behavior

### `DATA_SOURCE_MODE=mock`

- `/partner/orders` shows the existing mock/demo orders.
- Label: `Mock data mode`.
- Demo buttons remain available.
- Real write pilot button remains disabled.
- No Supabase read is required.

### `DATA_SOURCE_MODE=supabase`

- `/partner/orders` calls the Supabase read wrapper.
- Label: `Supabase read pilot`.
- The wrapper reads partner orders by `business_id`.
- Demo buttons remain available.
- The existing controlled real write test button remains narrow and unchanged.

## Fallback Behavior

If the Supabase read fails, the wrapper returns mock fallback data.

The UI shows:

- `Supabase read pilot`
- `Mock fallback`
- the safe code if provided
- a safe message

Allowed safe codes:

- `supabase_not_configured`
- `read_failed`
- `empty_result`
- `server_error`

The UI must never show raw Supabase errors, SQL details, service role key, auth token or private env values.

## Displayed Fields

The order cards show enough fields to confirm Supabase read mapping:

- `id`
- `business_id`
- `type`
- `status`
- `payment_status`
- `total`
- `updated_at`

Note: current `Order` UI shape does not yet include a first-class `updatedAt` property. Until the next mapping refinement, the UI uses `updatedAt` when present and falls back to `createdAt` to keep the page stable.

## Schema-Specific Note

The schema uses:

- `business_id`, not `partner_id`
- `partner_profiles.business_id`
- `orders.business_id`

Do not introduce `partner_id` assumptions.

## No New Writes

This stage does not:

- add update/insert/delete actions
- change `orders`
- insert audit logs
- change `payment_status`
- change totals
- change order items
- assign courier
- mark pickup/delivery states
- cancel/refund orders
- touch `alcohol_module_settings`

## Demo Actions

Existing demo buttons remain available.

This stage does not turn all partner order buttons into real backend writes.

## Rollback

Rollback is:

```env
DATA_SOURCE_MODE=mock
```

Then restart the dev server and verify `/partner/orders`.

No database schema change is required.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Read pilot does not enable alcohol module.
- Read pilot does not touch `alcohol_module_settings`.
- Alcohol sales and delivery remain disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Super admin cannot activate alcohol without legal review, licensing and partner verification.

## Manual Test

Mock mode:

1. Set `DATA_SOURCE_MODE=mock`.
2. Run the app.
3. Open `/partner/orders`.
4. Confirm label says `Mock data mode`.
5. Confirm mock/demo orders and demo buttons are visible.

Supabase mode:

1. Set `DATA_SOURCE_MODE=supabase`.
2. Confirm Supabase TEST env values are local only.
3. Open `/partner/orders`.
4. Confirm label says `Supabase read pilot`.
5. Confirm seeded order fields are visible if read succeeds.
6. Confirm fallback appears safely if read fails.
7. Confirm no write occurs from read mode.
