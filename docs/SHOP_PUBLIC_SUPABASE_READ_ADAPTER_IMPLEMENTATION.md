# Stage 24-2 - Shop Public Supabase Read Adapter Implementation

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Stage 24-2 created the read-only public Supabase adapter and read wrapper for `/shop`.

The `/shop` UI is not wired in this stage. `src/app/shop/page.tsx` remains unchanged until Stage 24-3.

## Files Created

- `src/lib/data/public-shop-supabase.ts`
- `src/lib/data/public-shop-read.ts`
- `docs/SHOP_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`

## Read-Only Guarantee

The adapter performs a read-only HTTP `GET` request against `public.products`.

It does not:

- create cart
- create checkout
- create order
- create payment
- update stock
- update products
- update shops
- update partners
- update categories
- insert `audit_logs`
- touch `alcohol_module_settings`

It does not call:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`

## Selected Fields

The adapter selects these verified `products` fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `description`
- `price`
- `stock_qty`
- `status`
- `metadata`
- `created_at`
- `updated_at`

## Joins

The adapter attempts optional read joins:

- `categories(title,slug,scope)`
- `partners(title,slug,type,status,business_status,rating)`

The `shops` join is not used in this first adapter to avoid relationship-risk during the public read pilot.

## Safety Filtering

The adapter includes conservative pilot safety filtering.

It excludes products when product/category/metadata text clearly indicates alcohol. Keywords include English alcohol terms and common Russian terms encoded safely in code.

This is not final compliance logic. It is a temporary public-read guard while `ALCOHOL_MODULE_ENABLED=false`.

## Fallback Modes

The read wrapper supports:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`
- `safety_filtered`

`DATA_SOURCE_MODE=mock` or a missing mode returns mock products immediately.

`DATA_SOURCE_MODE=supabase` attempts the controlled Supabase read and falls back to mock products on safe failure states.

## Missing Fields Fallback

The adapter does not require:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

It maps products into the existing `Product` UI shape and uses `KGS` as the display currency fallback.

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

## No Cart / Checkout / Payment / Order Changes

This stage did not add:

- cart behavior
- checkout behavior
- payment behavior
- order creation
- stock updates

## Alcohol Compliance

Required state remains:

- `ALCOHOL_MODULE_ENABLED=false`

The shop adapter does not query or update alcohol settings and does not enable alcohol sales or delivery.

## UI Status

UI is not wired yet.

Next stage should wire `/shop` to `getPublicShopReadResult()` and add:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`
- `Safety filtered` when relevant
