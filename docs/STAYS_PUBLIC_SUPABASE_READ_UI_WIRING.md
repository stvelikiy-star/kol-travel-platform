# Stage 23-3 - Stays Public Supabase Read UI Wiring

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Stage 23-3 wired the public `/stays` page to the controlled public stays read result.

The page now reads through:

- `getPublicStaysReadResult()` from `src/lib/data/public-stays-read.ts`

The page no longer uses direct `getStays()` as its primary data source. Mock data still remains available through the wrapper when `DATA_SOURCE_MODE` is missing or set to `mock`.

## Files Changed

- `src/app/stays/page.tsx`
- `docs/STAYS_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `README.md`

## Mock Mode Behavior

When `DATA_SOURCE_MODE=mock` or the mode is missing:

- `/stays` uses existing mock stays through the wrapper.
- no Supabase read is required.
- the page shows `Mock data mode`.
- existing catalog layout and stay cards are preserved.

## Supabase Mode Behavior

When `DATA_SOURCE_MODE=supabase`:

- `/stays` attempts the controlled Supabase read adapter.
- successful reads show `Supabase read pilot`.
- failed, missing, or empty reads fall back to mock stays.
- fallback reads show `Fallback to mock data`.

## Labels Added

The page now includes a small non-intrusive internal read-mode panel with:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

If a safe code is present, the page displays that code without raw Supabase or SQL details.

## No SQL Applied

No SQL was applied.

Stage 21 SQL draft remains unapplied.

## No Schema Changes

No schema files were changed.

No database tables or columns were created, changed, or deleted.

## No Writes

This UI wiring does not:

- create bookings
- update availability
- create orders
- create cart items
- create checkout
- create payments
- update stays
- update partners
- update categories
- insert `audit_logs`
- call payment logic

## Missing Field Safety

The current UI does not require Supabase-only image fields or SEO fields.

The read adapter maps Supabase stay rows into the existing `Stay` UI shape and does not require:

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

## Alcohol Compliance

Required state remains:

- `ALCOHOL_MODULE_ENABLED=false`

The `/stays` page does not touch alcohol settings and does not enable alcohol content, sales, or delivery.

## Rollback

Rollback is simple:

- set `DATA_SOURCE_MODE=mock`
- restart the dev server
- `/stays` returns to mock data through the wrapper
- no database or schema rollback is required
