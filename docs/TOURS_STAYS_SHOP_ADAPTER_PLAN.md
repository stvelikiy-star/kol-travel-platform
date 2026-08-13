# Stage 18-5 - Tours/Stays/Shop Adapter Plan

## Goal

Plan safe future read adapters for:

- `/tours`
- `/stays`
- `/shop`

This stage does not implement adapters, wire UI, create schema, add writes, add booking/cart/checkout/payment logic or enable the alcohol module.

## Current State

- `/food` has a real read-only adapter through `public.menu_items`.
- `/tours`, `/stays` and `/shop` still use existing mock/static data in the public UI.
- Existing schema already includes `tours`, `stays`, `shops` and `products`, but adapter compatibility and seed completeness still need validation.
- Mock fallback must remain for every future public catalog read wrapper.

## Shared Adapter Pattern

Use the same pattern as public food:

- `DATA_SOURCE_MODE=mock`: return current mock/static data
- `DATA_SOURCE_MODE=supabase`: call controlled Supabase adapter if table exists and schema is compatible
- Supabase read failure or missing table: fallback to mock
- return safe labels/messages
- never expose raw Supabase, SQL, auth or env errors
- never write on page load

Shared result shape:

```ts
{
  ok: boolean
  source: "mock" | "supabase" | "fallback"
  items: T[]
  code?: "supabase_not_configured" | "table_missing" | "read_failed" | "empty_result" | "server_error"
  message?: string
}
```

Do not over-engineer until the second or third domain proves duplication.

## Tours Adapter Plan

Future functions:

- `getPublicToursReadResult()`
- `getPublicToursFromSupabase()`

Expected source:

- `public.tours`

Current schema fields available:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `location`
- `price`
- `currency`
- `duration`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Future desired fields:

- `short_description`
- `duration_label`
- `price_from`
- `image_url` or cover image
- category title
- partner title
- `is_featured`
- SEO fields

Initial mapping option:

- map `price` to existing mock `priceFrom` equivalent
- map `duration` to duration label
- use `description` as fallback for short description
- use category/partner joins only after verified

Safe codes:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Read filters:

- `status = active`

No writes:

- no booking creation
- no availability update
- no payment/checkout action

## Stays Adapter Plan

Future functions:

- `getPublicStaysReadResult()`
- `getPublicStaysFromSupabase()`

Expected source:

- `public.stays`

Current schema fields available:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `type`
- `description`
- `location`
- `price_from`
- `currency`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Future desired fields:

- `short_description`
- `address`
- `capacity`
- `amenities`
- `image_url` or cover image
- category title
- partner title
- `is_featured`
- SEO fields

Initial mapping option:

- keep `price_from`
- use `type` as accommodation type
- read room/capacity data later through `rooms` only after separate validation

Read filters:

- `status = active`

No writes:

- no booking creation
- no availability update
- no pricing update
- no payment/checkout action

## Shop Adapter Plan

Future functions:

- `getPublicShopReadResult()`
- `getPublicShopProductsFromSupabase()`

Expected source:

- `public.products` currently exists
- future naming may become `shop_products`, but do not duplicate until migration is planned

Current product fields available:

- `id`
- `business_id`
- `category_id`
- `title`
- `description`
- `price`
- `stock_qty`
- `status`
- timestamps and metadata continue below in the schema file

Future desired fields:

- `slug`
- `currency`
- `stock_status`
- `image_url`
- category title
- partner title
- `is_featured`
- SEO fields

Initial mapping option:

- map `stock_qty` to display stock state
- use `products` as canonical first read source if Stage 19 confirms it
- do not introduce `shop_products` adapter until schema naming is settled

Read filters:

- `status = active`
- exclude alcohol categories/items

No writes:

- no cart creation
- no order creation
- no checkout session
- no stock update
- no payment action

## UI Wiring Later

Wire one page at a time:

1. `/tours` first if `public.tours` seed data and mapping are verified.
2. `/stays` next after stay/room shape is verified.
3. `/shop` last because product stock, cart and payment sensitivity are higher.

Each page should:

- preserve existing layout
- show safe mode/fallback label only if project pattern requires it
- keep SEO content stable
- use mock fallback
- avoid raw technical errors

## No-Write Guarantee

Future adapters must not:

- create bookings
- create carts
- create orders
- create checkout sessions
- update availability
- update stock
- update prices
- insert `audit_logs`
- touch `alcohol_module_settings`

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- shop adapter must exclude alcohol categories/items
- food/shop must not enable alcohol sales or delivery
- client, partner, courier and admin cannot enable alcohol
- AI cannot enable alcohol
- do not touch `alcohol_module_settings`

## Rollback

Rollback for future adapter pilots:

1. Set `DATA_SOURCE_MODE=mock`.
2. Restart dev server.
3. Verify mock public catalogs return.
4. No schema rollback should be required for read-only adapter failures.

## Risks And Blockers

- table naming: current schema uses `products`, while future plan mentions `shop_products`
- tours table has `price`/`duration`, while future public shape may expect `price_from`/`duration_label`
- stays table lacks some public detail fields such as amenities and capacity
- image strategy is not implemented for tours/stays/shop
- seed completeness must be verified before UI wiring
- public active-only reads and RLS must be checked before production

## Recommended Implementation Order

1. Verify actual Supabase TEST data for `tours`, `stays` and `products`.
2. Decide whether to align current tables or introduce new table names later.
3. Implement `/tours` read adapter first.
4. Add `/tours` UI pilot with mock fallback.
5. Repeat for `/stays`.
6. Add `/shop` only after product/stock/no-alcohol filtering is clear.

## Recommended Next Stage

Proceed to Stage 18-6 - Public Catalog Schema Final Audit.
