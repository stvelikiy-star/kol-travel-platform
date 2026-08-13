# Stage 22-2 - Tours Public Supabase Read Adapter Implementation

## Problem Found By Stage 22-5 Audit

Stage 22 final audit found that the tours read expansion was not complete:

- tours adapter was missing
- tours read wrapper was missing
- `/tours` page was not wired
- QA doc was missing

This stage creates only the missing data-layer files. The `/tours` page is not wired yet.

## Files Created

- `src/lib/data/public-tours-supabase.ts`
- `src/lib/data/public-tours-read.ts`

## Read-Only Guarantee

The adapter performs only a read-only `GET` request against:

- `public.tours`

It does not:

- insert/update/delete/upsert
- call write RPC
- create bookings
- create cart
- create checkout
- create payment
- insert `audit_logs`
- update `tours`
- update `partners`
- update `categories`
- touch `alcohol_module_settings`

## Selected Fields

The adapter selects verified current fields:

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

Optional joins:

- `categories(title,slug,scope)`
- `partners(title,slug,type,status,business_status,rating)`

If a read fails due join/table/config issues, the wrapper falls back to mock tours.

## Filtering

The adapter requests public-safe statuses:

- `active`
- `published`

If the Supabase result is empty, the wrapper returns mock fallback rather than showing private/inactive data.

## Mapping

Supabase tour rows map to the existing `Tour` UI shape.

Because the Stage 21 SQL draft has not been applied:

- `image_url` is not required
- `is_featured` is not required
- SEO fields are not required
- existing card gradient/default visuals remain safe

## Fallback Modes

The read wrapper exposes safe modes:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Errors never expose raw Supabase, SQL, token or private environment details.

## No SQL Applied

No SQL was applied.

Stage 21 draft remains:

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

No schema changes were made.

## UI Not Wired Yet

`src/app/tours/page.tsx` was intentionally not changed in Stage 22-2.

UI wiring belongs to Stage 22-3.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol queries
- no alcohol settings touched
- no alcohol category/items
- no alcohol sales/delivery

## Next Stage

Proceed to Stage 22-3 - Wire `/tours` page to the public tours read result.
