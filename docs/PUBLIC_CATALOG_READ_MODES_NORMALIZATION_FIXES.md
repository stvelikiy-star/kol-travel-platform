# Stage 25-3 - Public Catalog Read Modes Normalization Fixes

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Stage 25-3 applied a tiny normalization fix to align `/food` with the later public catalog read wrappers used by `/tours`, `/stays`, and `/shop`.

No SQL was applied. No schema files were changed. No public page redesign was made. No writes, cart, checkout, payment, order, booking, availability, stock, audit, or alcohol behavior was added.

## Files Changed

- `src/lib/data/public-catalog-read.ts`
- `docs/PUBLIC_CATALOG_READ_MODES_NORMALIZATION_FIXES.md`
- `README.md`

## Difference Fixed

Before this stage:

- `/food` used `source` and safe `code`, but did not expose an explicit `mode` field.
- `/tours`, `/stays`, and `/shop` already exposed explicit read modes.

After this stage:

- `/food` now returns `PublicFoodReadResult`.
- `/food` now exposes `mode`.
- `/food` maps fallback codes into standard mode names.

## Result Modes Normalized

`/food` now supports:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

`/tours`, `/stays`, and `/shop` already supported their expected mode sets.

`/shop` still additionally supports:

- `safety_filtered`
- `safety_filtered_empty`

## Labels Normalized

No page label changes were required.

All public catalog pilot pages already show:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

`/shop` additionally shows:

- `Safety filtered`, when relevant

## Fallback Behavior Normalized

`/food` now matches the same mode pattern as the later wrappers:

- mock mode returns mock data.
- Supabase success returns `supabase_success`.
- failed Supabase reads return mock fallback with a safe fallback mode.
- raw Supabase, SQL, auth, service role, and private env details are not exposed.

## No-Write Confirmation

No write behavior was added.

The changed wrapper does not call:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- create order
- create booking
- create cart
- create checkout
- create payment
- update stock
- update availability
- insert `audit_logs`

## No SQL / Schema Confirmation

Confirmed:

- Stage 21 SQL draft remains unapplied.
- no Supabase SQL was run.
- no schema files were changed.
- no database changes were made.

## Alcohol Confirmation

Required state remains:

- `ALCOHOL_MODULE_ENABLED=false`

No alcohol settings were touched. No alcohol sales or delivery path was added.

## Remaining Differences

Expected difference:

- `/shop` has additional safety modes because product/alcohol safety filtering is required for public shop reads.

No blockers remain for public catalog read-mode normalization.

## Recommended Next Stage

Recommended next stage:

- Stage 25-4 - Public Catalog Read Modes Normalization QA
