# Stage 17-1 - Public Catalog Supabase Read Mode Plan

## Goal

Safely prepare public catalog pages for Supabase read mode while keeping the public site stable in mock mode.

This stage does not implement Supabase catalog reads, create schema, change public catalog UI, remove mock data, remove existing catalog pages, add cart writes, add checkout writes, add payment logic, add booking writes or enable the alcohol module.

Goals:

- keep public pages working in `DATA_SOURCE_MODE=mock`
- avoid breaking SEO/public catalog pages
- plan read-only Supabase pilots only where schema/data exists
- keep rollback simple
- avoid public raw technical errors

## Target Pages

Public catalog pages in scope:

- `/tours`
- `/stays`
- `/food`
- `/shop`

Existing route check:

- all four route groups exist in `src/app`

## Current Data Uncertainty

Dedicated Supabase tables may or may not exist for:

- tours
- stays
- restaurants / food catalog
- shop products
- categories
- images
- prices
- availability

Known current Supabase schema includes:

- `orders`
- `partners`
- `audit_logs`

Important schema notes:

- `orders` uses `business_id`, not `partner_id`
- `partners` may be usable for food/shop partner listing
- dedicated catalog tables may not exist yet
- if catalog tables are missing, keep mock fallback and do not force Supabase reads

## First Step Before Implementation

Before implementing any public catalog read adapter:

1. Inspect `src/lib/data/catalog.ts`.
2. Inspect `src/lib/data/partners.ts`.
3. Inspect existing Supabase schema files and TEST project tables.
4. Verify whether catalog tables exist.
5. Verify seed/demo data exists.
6. Verify expected field names and relationships.
7. Do not invent table names without fallback.
8. Do not wire public UI to Supabase if required tables are missing.

## Recommended Read Pilot Order

Recommended Stage 17 sequence:

1. 17-2 Public Catalog Schema/Data Availability Audit
2. 17-3 Public Catalog Read Adapter Plan or Adapter Stub
3. 17-4 Public Catalog UI Wiring for safest page
4. 17-5 Public Catalog Read QA
5. 17-6 Public Catalog Read Final Audit

## Safest First Public Page

The safest first page should be chosen after Stage 17-2 inspection.

Preliminary recommendation:

- choose `/food` if the existing `partners` table can safely represent restaurants and there is enough demo partner data
- choose `/tours` if mock tour shape is simpler and a real `tours` table exists
- choose no UI wiring if required catalog tables are missing

Do not wire public catalog UI until the schema/data audit confirms a safe read source.

## Data Source Strategy

Expected behavior:

- `DATA_SOURCE_MODE=mock`: current mock public catalog data
- `DATA_SOURCE_MODE=supabase`: controlled Supabase read pilot only where schema/data exists
- Supabase read failure or missing table: fallback to mock data
- public UI must not show raw Supabase, SQL or env errors

Mock mode remains the default and safe path.

## Potential Future Data Models

Likely future tables:

- `tours`
- `stays`
- `restaurants`
- `food_items`
- `shops`
- `shop_products`
- `catalog_categories`
- `catalog_images`

Do not create these tables in Stage 17-1.

## UI Safety

Public catalog read mode must:

- keep existing layout
- keep SEO-friendly pages working
- avoid large redesigns
- show optional safe internal mode label only if current project pattern uses labels
- not expose raw technical errors to public users
- fallback to mock if data is missing
- preserve detail routes and not-found behavior

## No-Write Guarantee

Public catalog read mode must not:

- create orders
- create bookings
- update availability
- change prices
- insert `audit_logs`
- change `payment_status`
- create checkout sessions
- touch `alcohol_module_settings`

Adapters must be read-only.

## Safe Errors

Allowed safe codes:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Never expose:

- raw Supabase error
- SQL details
- service role key
- auth token
- private env values

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- Public catalog must not show alcohol category.
- Food/shop must not enable alcohol sales or delivery.
- Client, partner, courier and admin cannot enable alcohol.
- AI cannot enable alcohol.
- Public catalog read mode must not touch `alcohol_module_settings`.

## Rollback

Rollback path:

1. Set `DATA_SOURCE_MODE=mock`.
2. Keep `ALCOHOL_MODULE_ENABLED=false`.
3. Restart dev server.
4. Open `/tours`, `/stays`, `/food`, `/shop`.
5. Confirm public catalogs return to existing mock data.

No schema rollback is required for read-only public catalog failures.

## Manual QA Plan

Mock mode:

- verify `/tours`
- verify `/stays`
- verify `/food`
- verify `/shop`
- verify detail routes where relevant
- verify build

Supabase mode:

- verify selected pilot only if schema/data exists
- verify fallback to mock if table/data is missing
- verify no writes
- verify no raw errors
- verify no alcohol category/sales/delivery appears
- verify build

## Blockers To Resolve In Stage 17-2

Before adapter/UI implementation, confirm:

- whether dedicated catalog tables exist
- whether seed data exists
- whether `partners` can represent restaurants/shops safely
- whether images/prices/categories/availability have source fields
- whether detail pages can resolve slugs from Supabase data

## Final Plan Decision

Proceed to Stage 17-2 with a schema/data availability audit.

Preliminary first pilot:

- `/food` if `partners` can safely represent restaurants and catalog item data is available
- `/tours` if a real `tours` table exists and maps cleanly
- no UI wiring if required tables are missing
