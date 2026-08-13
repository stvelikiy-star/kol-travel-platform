# Stage 17-6 - Public Catalog Read Final Audit

## Summary

The Public Catalog Supabase Read section is complete at code and documentation level for one selected pilot page.

Selected pilot page:

- `/food`

Implemented:

- public catalog read-mode plan
- schema/data availability audit
- read-only `/food` public catalog adapter
- mock/fallback wrapper
- `/food` UI pilot
- QA document
- final audit document

No public catalog writes, database tables, booking/cart/checkout/payment logic or alcohol module activation were added.

## Adapter Decision

Decision:

- real read-only adapter, not table-missing stub

Source table:

- `public.menu_items`

Optional joins:

- `categories(title)`
- `partners(title,slug)`

Reason:

- `menu_items`, `categories`, `partners` and `restaurants` exist in local SQL schema
- fixed seed file includes one active demo menu item
- mock fallback remains available

## Files Reviewed

- `docs/PUBLIC_CATALOG_SUPABASE_READ_MODE_PLAN.md` - exists
- `docs/PUBLIC_CATALOG_SCHEMA_DATA_AUDIT.md` - exists
- `docs/PUBLIC_CATALOG_READ_ADAPTER.md` - exists
- `docs/PUBLIC_CATALOG_SUPABASE_READ_UI_PILOT.md` - exists
- `docs/PUBLIC_CATALOG_SUPABASE_READ_QA.md` - exists
- `src/lib/data/public-catalog-read.ts` - exists
- `src/lib/data/public-catalog-supabase.ts` - exists
- `src/app/food/page.tsx` - wired to `getPublicFoodReadResult()`

## Available Tables

Relevant available tables confirmed in local SQL:

- `partners`
- `categories`
- `tours`
- `stays`
- `rooms`
- `restaurants`
- `menu_items`
- `shops`
- `products`
- `media_files`
- `room_availability`
- `tour_schedules`
- `orders`
- `bookings`
- `audit_logs`
- `alcohol_module_settings`

## Missing Or Deferred Tables

No blocker for `/food` pilot.

Deferred/risky pieces:

- complete public image/media mapping
- public detail route Supabase slug validation
- broader `/tours`, `/stays`, `/shop` UI wiring
- relationship behavior in actual TEST project RLS/PostgREST

## Selected Page Audit

`/food`:

- reads through `getPublicFoodReadResult()`
- opens in mock mode
- opens in Supabase mode or safe fallback mode
- shows safe mode/fallback label
- keeps existing catalog layout and CTA behavior
- does not expose raw errors in the planned UI surface

## Data Audit

Confirmed:

- adapter queries only `menu_items`
- table-missing path returns safe `table_missing`
- read failures return safe codes
- wrapper falls back to mock food data
- no production/private data exposure is added

## No-Write Audit

Public catalog read mode does not:

- create orders
- create bookings
- create cart
- create checkout
- update availability
- update prices
- insert audit logs
- update payment status
- touch `alcohol_module_settings`

The Supabase adapter uses `method: "GET"`.

## Env Audit

- `DATA_SOURCE_MODE=mock` remains safe default.
- `DATA_SOURCE_MODE=supabase` activates only the controlled `/food` read pilot.
- `ALCOHOL_MODULE_ENABLED=false` remains required.

## Error Audit

Safe codes only:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

No raw:

- Supabase errors
- SQL details
- service role key
- auth token
- private env values

## Public UX Audit

Confirmed at code level:

- selected catalog page remains usable
- SEO-visible heading/content is not removed
- CTA buttons remain safe
- no real booking/payment/order creation added

Manual viewport QA is still recommended for mobile layout after Supabase TEST verification.

## Alcohol Audit

- `ALCOHOL_MODULE_ENABLED=false`
- alcohol category/items are not intentionally returned
- public catalog does not enable alcohol sales/delivery
- client/partner/courier/admin cannot enable alcohol
- AI cannot enable alcohol
- adapter does not touch `alcohol_module_settings`

## Rollback Audit

Rollback:

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. Open `/food`.
4. Mock public food catalog data returns.
5. No schema rollback required.

## Risks

Remaining manual risks:

- actual TEST project relationship joins may differ from local SQL assumptions
- seed data may be absent if fixed seed was not applied
- `partners(title,slug)` relation may need query refinement
- full public detail route wiring is not included

## Blockers

No code-level blockers found for the selected `/food` pilot.

Manual Supabase QA is still required before expanding to `/tours`, `/stays` or `/shop`.

## Final Decision

Safe at code/build/documentation level for the selected `/food` public catalog read pilot.

Recommended next section:

- manually verify `/food` in TEST Supabase mode
- then plan the next public catalog pilot, likely `/tours` or `/shop`, only after confirming table fields and seed data
