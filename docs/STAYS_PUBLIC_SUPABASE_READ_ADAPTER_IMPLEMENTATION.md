# Stage 23-2 - Stays Public Supabase Read Adapter Implementation

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Stage 23-2 created the read-only public Supabase adapter and read wrapper for `/stays`.

The `/stays` UI is not wired in this stage. `src/app/stays/page.tsx` remains unchanged.

## Files Created

- `src/lib/data/public-stays-supabase.ts`
- `src/lib/data/public-stays-read.ts`
- `docs/STAYS_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`

## Read-Only Guarantee

The adapter performs a read-only HTTP `GET` request against `public.stays`.

It does not:

- create bookings
- update availability
- create cart items
- create checkout sessions
- create payments
- insert `audit_logs`
- update `stays`
- update `partners`
- update `categories`
- touch `alcohol_module_settings`

It does not call:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`

## Selected Fields

The adapter selects these verified `stays` fields:

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

## Joins

The adapter attempts optional read joins:

- `categories(title,slug,scope)`
- `partners(title,slug,type,status,business_status,rating)`

If the read fails because of relationship or table issues, the wrapper falls back to mock data with a safe code/message.

## Mapping

Supabase stay rows are mapped to the existing `Stay` UI shape:

- `business_id` -> `businessId`
- `price_from` -> `minPricePerNight`
- partner `rating` -> `rating`, with a safe fallback
- unknown `type` -> `guest_house`
- `published` status -> `active`
- unknown status -> `under_review`

The adapter does not require:

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

## Fallback Modes

The read wrapper supports:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

`DATA_SOURCE_MODE=mock` or a missing mode returns mock stays immediately.

`DATA_SOURCE_MODE=supabase` attempts the controlled Supabase read and falls back to mock stays on safe failure states.

## Error Safety

The adapter catches read errors and returns safe messages only.

It does not expose:

- raw Supabase errors
- SQL details
- service role key
- auth token
- private env values

## No SQL Applied

No SQL was applied in this stage.

Stage 21 draft SQL remains unapplied.

## No Schema Changes

No schema files were modified.

No database tables or columns were created, changed, or deleted.

## No Booking / Availability / Payment Changes

This stage did not add:

- booking creation
- booking updates
- availability updates
- cart behavior
- checkout behavior
- payment behavior

## Alcohol Compliance

Required state remains:

- `ALCOHOL_MODULE_ENABLED=false`

The stays adapter does not query or update alcohol settings and does not enable alcohol sales or delivery.

## UI Status

UI is not wired yet.

Next stage should wire `/stays` to `getPublicStaysReadResult()` and add the same safe labels used by `/food` and `/tours`:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`
