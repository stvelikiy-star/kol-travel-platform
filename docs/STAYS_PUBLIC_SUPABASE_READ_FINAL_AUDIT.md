# Stage 23-5 - Stays Public Supabase Read Final Audit

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Stage 23 final audit confirms the public `/stays` Supabase read section is complete.

The `/stays` page now uses the controlled public stays read wrapper. Mock mode remains the safe default, Supabase mode is controlled, fallback to mock is supported, and no SQL, schema, write, booking, availability, cart, checkout, payment, audit insert, or alcohol behavior was added.

## File Audit

Status: passed.

Confirmed files:

- `docs/STAYS_PUBLIC_SUPABASE_READ_ADAPTER_PLAN.md`
- `src/lib/data/public-stays-supabase.ts`
- `src/lib/data/public-stays-read.ts`
- `docs/STAYS_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_QA.md`

## UI Wiring Audit

Status: passed.

`src/app/stays/page.tsx` uses:

- `getPublicStaysReadResult()` from `src/lib/data/public-stays-read.ts`

The page no longer directly relies on `getStays()` as the primary page data source. Mock data is still provided through the wrapper when `DATA_SOURCE_MODE` is missing or set to `mock`.

Visible labels are present:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

## Adapter Safety Audit

Status: passed.

The adapter/read wrapper supports these states:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

The Supabase adapter reads from `public.stays` with safe public catalog fields and optional category/partner joins. It does not expose raw Supabase, SQL, auth, service role, or private env details.

## Schema / No-SQL Audit

Status: passed.

Confirmed:

- Stage 21 SQL draft was not applied.
- No Supabase SQL was run in this stage.
- No schema files were changed.
- No database changes were made.

Stage 21 draft remains a draft-only file:

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

## Read-Only Audit

Status: passed.

The Stage 23 stays read code does not write to:

- `stays`
- `partners`
- `categories`
- `orders`
- `bookings`
- availability
- cart
- checkout
- payments
- `audit_logs`
- `alcohol_module_settings`

No write calls were found for:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`

The adapter uses a read-only HTTP `GET` request.

## Missing Field Safety

Status: passed.

The current `/stays` read pilot does not require Stage 21 migration fields.

Confirmed:

- missing `image_url` does not break the page.
- missing `capacity` does not break the page.
- missing `amenities` does not break the page.
- missing `is_featured` does not break the page.
- missing SEO fields do not break the page.
- migration is not required for the basic `/stays` Supabase read pilot.

## Alcohol Audit

Status: passed.

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false` remains required.
- `alcohol_module_settings` is untouched.
- no alcohol queries were added.
- no alcohol content, sales, or delivery behavior was added.

## Build

Build command:

```bash
npm run build
```

Result: passed.

## Risks

Remaining risks are limited to future manual Supabase verification:

- Supabase test data status values must match the adapter's public-safe filter.
- Manual browser testing in `DATA_SOURCE_MODE=supabase` should confirm live test rows render as expected.
- Stage 21 migration remains intentionally unapplied and is not required for this read pilot.

## Blockers

No blockers found.

## Final Decision

Stage 23 complete: Yes.

SQL still unapplied: Yes.

No-write/no-booking/no-availability confirmation: Yes.

Alcohol disabled confirmation: Yes.

## Recommended Stage 24

Recommended next stage:

- Stage 24 - Shop Public Supabase Read Adapter Without Migration, only with strict product/alcohol filtering.

If product/alcohol filtering cannot be guaranteed first, pause for a shop safety plan before implementation.
