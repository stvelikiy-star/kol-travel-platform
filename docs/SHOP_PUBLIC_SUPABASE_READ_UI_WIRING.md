# Stage 24-3 - Shop Public Supabase Read UI Wiring

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Stage 24-3 wired the public `/shop` page to the controlled public shop read result.

The page now reads through:

- `getPublicShopReadResult()` from `src/lib/data/public-shop-read.ts`

The page no longer uses direct `getProducts()` as its primary data source. Mock products still remain available through the wrapper when `DATA_SOURCE_MODE` is missing or set to `mock`.

## Files Changed

- `src/app/shop/page.tsx`
- `docs/SHOP_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `README.md`

## Mock Mode Behavior

When `DATA_SOURCE_MODE=mock` or the mode is missing:

- `/shop` uses existing mock products through the wrapper.
- no Supabase read is required.
- the page shows `Mock data mode`.
- existing catalog layout and product cards are preserved.

## Supabase Mode Behavior

When `DATA_SOURCE_MODE=supabase`:

- `/shop` attempts the controlled Supabase read adapter.
- successful reads show `Supabase read pilot`.
- failed, missing, empty, or unsafe reads fall back to mock products.
- fallback reads show `Fallback to mock data`.

## Safety Filtering Display

If the adapter reports that safety filtering removed any Supabase products, `/shop` shows:

- `Safety filtered`

The page only receives products after adapter safety filtering. Alcohol-related products/categories/items are not intentionally displayed by the pilot read path.

## Labels Added

The page now includes a small non-intrusive internal read-mode panel with:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`
- `Safety filtered`, when relevant

If a safe code is present, the page displays that code without raw Supabase or SQL details.

## No SQL Applied

No SQL was applied.

Stage 21 SQL draft remains unapplied.

## No Schema Changes

No schema files were changed.

No database tables or columns were created, changed, or deleted.

## No Writes

This UI wiring does not:

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
- call payment logic

## Missing Field Safety

The current UI does not require Supabase-only image fields or SEO fields.

The read adapter maps Supabase product rows into the existing `Product` UI shape and does not require:

- `slug`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

Currency falls back to `KGS`.

## Alcohol Compliance

Required state remains:

- `ALCOHOL_MODULE_ENABLED=false`

The `/shop` page does not touch alcohol settings and does not enable alcohol content, sales, or delivery.

## Rollback

Rollback is simple:

- set `DATA_SOURCE_MODE=mock`
- restart the dev server
- `/shop` returns to mock data through the wrapper
- no database or schema rollback is required
