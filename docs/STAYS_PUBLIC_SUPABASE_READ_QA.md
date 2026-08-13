# Stage 23-4 - Stays Public Supabase Read QA

Project: KOL / Issyk-Kul Travel & Delivery Platform

## QA Scope

This QA covers the `/stays` public Supabase read pilot after Stage 23-3 UI wiring.

The QA confirms that `/stays` uses the controlled public stays read wrapper, keeps mock mode available, supports Supabase read mode, falls back safely, and does not add writes, bookings, availability updates, cart, checkout, payment, audit, schema, or alcohol behavior.

## File Existence Audit

Status: passed.

Files confirmed:

- `src/lib/data/public-stays-supabase.ts`
- `src/lib/data/public-stays-read.ts`
- `docs/STAYS_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `src/app/stays/page.tsx`

## UI Wiring Audit

Status: passed.

`src/app/stays/page.tsx` now imports and calls:

- `getPublicStaysReadResult()` from `src/lib/data/public-stays-read.ts`

The page no longer uses direct `getStays()` as its primary data source. Mock data is still preserved through the wrapper when `DATA_SOURCE_MODE` is missing or set to `mock`.

Visible labels are present:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

## Build Result

Build command:

```bash
npm run build
```

Result: passed.

## Mock Mode Result

Expected behavior when `DATA_SOURCE_MODE=mock` or missing:

- `/stays` uses mock stays through `getPublicStaysReadResult()`.
- no Supabase environment is required.
- the safe label shows `Mock data mode`.
- the page does not crash.

QA result: passed by code inspection and build.

## Supabase Mode Result

Expected behavior when `DATA_SOURCE_MODE=supabase`:

- `/stays` attempts the controlled Supabase read adapter.
- successful reads use source `supabase` and show `Supabase read pilot`.
- failed, missing, or empty reads fall back to mock data and show `Fallback to mock data`.
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

Fallback uses mock stays and safe messages only.

## UI Safety

Status: passed.

The page keeps the existing catalog structure and adds only a small mode label panel. Stay cards and catalog sections continue to render from the existing UI shape.

Missing Supabase fields do not block rendering:

- `image_url` is not required.
- `capacity` is not required.
- `amenities` is not required.
- `is_featured` is not required.
- SEO fields are not required.

No migration is required for the current `/stays` read pilot.

## No-Write / No-Booking / No-Availability Audit

Status: passed.

The Stage 23 stays files were checked for write-like operations. No calls were found for:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- booking creation
- availability update
- order creation
- cart creation
- checkout creation
- payment creation
- `audit_logs` insert

The adapter uses a read-only HTTP `GET` request to the Supabase REST endpoint.

## Schema / No-SQL Audit

Status: passed.

- Stage 21 SQL draft remains unapplied.
- No Supabase SQL was run in this stage.
- No schema files were changed.
- No database changes were made.

## Alcohol Audit

Status: passed.

- `ALCOHOL_MODULE_ENABLED=false` remains required.
- `/stays` does not query `alcohol_module_settings`.
- no alcohol settings are touched.
- no alcohol content, alcohol sales, or alcohol delivery behavior was added.

## Issues / Fixes

Stage 23-3 wiring was completed before this QA pass because `/stays` was still using direct mock/static data when QA began.

No additional fixes were required during QA.

## Final QA Decision

Stage 23-4 is safe to close.

Recommended next stage:

- Stage 23-5 - Stays Public Supabase Read Final Audit
