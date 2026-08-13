# Stage 24-4 - Shop Public Supabase Read QA

Project: KOL / Issyk-Kul Travel & Delivery Platform

## QA Scope

This QA covers the `/shop` public Supabase read pilot after Stage 24-3 UI wiring.

The QA confirms that `/shop` uses the controlled public shop read wrapper, keeps mock mode available, supports Supabase read mode, falls back safely, applies conservative product/alcohol safety filtering, and does not add writes, cart, checkout, payment, order, stock update, audit, schema, or alcohol behavior.

## File Existence Audit

Status: passed.

Files confirmed:

- `src/lib/data/public-shop-supabase.ts`
- `src/lib/data/public-shop-read.ts`
- `docs/SHOP_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`
- `docs/SHOP_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `src/app/shop/page.tsx`

## UI Wiring Audit

Status: passed.

`src/app/shop/page.tsx` now imports and calls:

- `getPublicShopReadResult()` from `src/lib/data/public-shop-read.ts`

The page no longer uses direct `getProducts()` as its primary data source. Mock products are still preserved through the wrapper when `DATA_SOURCE_MODE` is missing or set to `mock`.

Visible labels are present:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`
- `Safety filtered`, when relevant

## Build Result

Build command:

```bash
npm run build
```

Result: passed.

## Mock Mode Result

Expected behavior when `DATA_SOURCE_MODE=mock` or missing:

- `/shop` uses mock products through `getPublicShopReadResult()`.
- no Supabase environment is required.
- the safe label shows `Mock data mode`.
- the page does not crash.

QA result: passed by code inspection and build.

## Supabase Mode Result

Expected behavior when `DATA_SOURCE_MODE=supabase`:

- `/shop` attempts the controlled Supabase read adapter.
- successful reads use source `supabase` and show `Supabase read pilot`.
- safety-filtered reads show `Safety filtered`.
- failed, missing, empty, or all-filtered reads fall back to mock data and show `Fallback to mock data`.
- raw Supabase, SQL, auth, service role, and private env details are not shown.

QA result: ready for manual browser verification against the local Supabase test environment.

## Fallback Behavior

Status: passed.

The wrapper supports these safe modes:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`
- `safety_filtered`
- `safety_filtered_empty`

Fallback uses mock products and safe messages only.

## UI Safety

Status: passed.

The page keeps the existing catalog structure and adds only a small mode label panel. Product cards and catalog sections continue to render from the existing UI shape.

Missing Supabase fields do not block rendering:

- `image_url` is not required.
- `slug` is not required.
- missing currency uses `KGS` as display fallback.
- SEO fields are not required.

No migration is required for the current `/shop` read pilot.

## Product / Alcohol Safety Audit

Status: passed.

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false` remains required.
- `/shop` does not query `alcohol_module_settings`.
- no alcohol settings are touched.
- no alcohol category tab was added.
- no alcohol sales or delivery path was added.
- conservative keyword filtering exists for alcohol-related terms.
- products/categories/metadata that clearly indicate alcohol are excluded before reaching the page.

The safety filter is a temporary pilot guard and not final compliance logic.

## No-Write / No-Cart / No-Checkout / No-Payment / No-Order Audit

Status: passed.

The Stage 24 shop files were checked for write-like operations. No calls were found for:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- cart creation
- checkout creation
- order creation
- payment creation
- stock update
- `audit_logs` insert

The adapter uses a read-only HTTP `GET` request to the Supabase REST endpoint.

## Schema / No-SQL Audit

Status: passed.

- Stage 21 SQL draft remains unapplied.
- No Supabase SQL was run in this stage.
- No schema files were changed.
- No database changes were made.

## Issues / Fixes

One tiny compatibility fix was made during QA:

- `src/lib/data/public-shop-read.ts` now exposes `safety_filtered_empty` for the all-filtered fallback state requested by this QA checklist.

No runtime or build issues were found after the fix.

## Final QA Decision

Stage 24-4 is safe to close.

Recommended next stage:

- Stage 24-5 - Shop Public Supabase Read Final Audit
