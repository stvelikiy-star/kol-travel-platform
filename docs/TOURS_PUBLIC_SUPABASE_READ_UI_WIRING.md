# Stage 22-3 - Tours Public Supabase Read UI Wiring

## Page Wired

Updated page:

- `src/app/tours/page.tsx`

The page now calls:

- `getPublicToursReadResult()`

The page no longer uses direct `getTours()` as its primary data source. Mock data remains available through the controlled read wrapper.

## Mock Mode Behavior

When `DATA_SOURCE_MODE=mock` or the env value is missing:

- `/tours` returns existing mock tours through the wrapper
- no Supabase read is required
- the page shows `Mock data mode`
- existing visual layout and tour cards remain in place

## Supabase Mode Behavior

When `DATA_SOURCE_MODE=supabase`:

- `/tours` attempts the controlled Supabase tours read adapter
- successful reads show `Supabase read pilot`
- rows are mapped into the existing `Tour` UI shape
- missing `image_url`, `is_featured` and SEO fields are not required

## Fallback Behavior

If Supabase read fails safely, the wrapper returns mock tours and the page shows:

- `Fallback to mock data`

Safe fallback codes may be shown:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

No raw Supabase, SQL, token or private environment values are shown.

## Labels Added

The page now includes a small internal read-mode label block:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

The block follows the existing `/food` public catalog read pilot pattern and does not redesign the page.

## No SQL Applied

No SQL was applied.

Stage 21 draft remains unapplied:

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

## No Schema Changes

No schema files were changed.

No database changes were made.

## No Writes

Opening `/tours` must not:

- create bookings
- create orders
- create cart items
- create checkout sessions
- create payments
- update `tours`
- update `partners`
- update `categories`
- insert `audit_logs`
- touch `alcohol_module_settings`

## Alcohol

- `ALCOHOL_MODULE_ENABLED=false`
- tours page does not touch alcohol module
- no alcohol content/sales/delivery added
- alcohol settings remain untouched

## Next Stage

Proceed to Stage 22-4 - Tours public Supabase read QA.
