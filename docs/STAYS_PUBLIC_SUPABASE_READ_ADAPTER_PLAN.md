# Stage 23-1 - Stays Public Supabase Read Adapter Plan, Without Migration

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Purpose

This stage plans the next safe public catalog read pilot: `/stays`.

The goal is to expand public read mode from `/food` and `/tours` to `/stays` without applying any migration. The plan protects the current working project, keeps mock fallback available, and avoids booking, availability, cart, checkout, payment, audit, and alcohol behavior.

No adapter is implemented in this stage. No UI is wired in this stage.

## Current State

Stage 22 is complete:

- `/tours` public Supabase read adapter exists.
- `/tours` page is wired to the controlled read result.
- `/tours` QA and final audit passed.
- Stage 21 SQL draft has not been applied.
- no database schema changes were made.
- `DATA_SOURCE_MODE=mock` remains the safe default.
- `ALCOHOL_MODULE_ENABLED=false`.

Stage 20 confirmed these public catalog tables exist:

- `categories`
- `partners`
- `stays`
- `tours`
- `menu_items`
- `products`
- `restaurants`
- `shops`

## Verified Stays Schema

The current `public.stays` table is expected to provide:

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

Verified relationships:

- `stays.business_id` -> `partners.id`
- `stays.category_id` -> `categories.id`

## Data Source Strategy

The future `/stays` read flow should follow the existing `/food` and `/tours` pattern:

- `DATA_SOURCE_MODE=mock` returns existing mock stays.
- `DATA_SOURCE_MODE=supabase` calls a controlled Supabase read adapter.
- if Supabase is not configured, missing, empty, or fails, fallback to mock.
- the public page must not crash.
- no raw Supabase, SQL, auth, service role, or private env details are shown to users.
- no writes are performed.

Expected mode labels for later UI wiring:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

## Proposed Files For Later Implementation

Do not create these files in Stage 23-1. They are listed for the next stages only:

- `src/lib/data/public-stays-supabase.ts`
- `src/lib/data/public-stays-read.ts`
- possible update to `src/app/stays/page.tsx`

## Proposed Read Query

Use `public.stays` as the base table.

Select safe fields:

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

Optional joins, if the existing REST relationship is available:

- `categories(title, slug, scope)`
- `partners(title, slug, type, status, business_status, rating)`

If joins are risky or fail in the first implementation, the adapter should keep `business_id` and `category_id` only, then document the join limitation.

## Filtering

Only public-safe stays should be shown.

Preferred filter:

- `status` in `active` or `published`, if those values exist in seed data.

If current seed values are uncertain:

- document the observed status values before broadening reads.
- do not show inactive or private records if they are clearly marked.
- keep fallback to mock data available.

## Mapping

Map Supabase stay rows to the current `/stays` UI-compatible shape.

Because some visual and booking-related fields may be missing, the first read pilot should:

- use existing mock/default image fallback.
- not require `image_url`.
- not require `capacity`.
- not require `amenities`.
- not require `is_featured`.
- not require `seo_title`.
- not require `seo_description`.
- not apply migration just for missing visual or SEO fields.

## Error States

The future adapter/read wrapper should support:

- `mock_mode`
- `supabase_success`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`
- `fallback_to_mock`

Errors must be safe and user-facing only. Raw Supabase, SQL, auth, service role, and private env details must not be returned to the UI.

## No-Write Guarantee

The future `/stays` read adapter must not:

- create booking
- update availability
- create cart
- create checkout
- create payment
- insert `audit_logs`
- update `stays`
- update `partners`
- update `categories`

It must not call:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`

## Alcohol Compliance

Required:

- `ALCOHOL_MODULE_ENABLED=false`
- stays read mode must not touch alcohol module behavior.
- no alcohol sales or delivery.
- no alcohol settings changed.
- `alcohol_module_settings` must remain untouched.

## QA Plan For Later Implementation

Later implementation should test:

- `DATA_SOURCE_MODE=mock`
- `DATA_SOURCE_MODE=supabase`
- missing table fallback
- empty result fallback
- `npm run build`
- no writes
- no booking creation
- no availability changes
- no cart/checkout/payment behavior
- no audit log inserts
- `ALCOHOL_MODULE_ENABLED=false`

## Rollback

Rollback should remain simple:

- set `DATA_SOURCE_MODE=mock`
- restart the dev server
- `/stays` returns to existing mock data
- no schema rollback required
- no database reset required

## Recommended Next Stages

- Stage 23-2 - Create stays Supabase read adapter
- Stage 23-3 - Wire `/stays` page to read result
- Stage 23-4 - Stays read QA
- Stage 23-5 - Stage 23 final audit
