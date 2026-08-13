# Stage 27-1 — Public Catalog Supabase Read Pilot Finalization

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Milestone Summary

The controlled public catalog Supabase read pilot is finalized for:

- `/food`
- `/tours`
- `/stays`
- `/shop`

Stage 26-5 rerun completed with `PASS` after successful manual browser retest. Public catalog pages work in mock mode and support controlled Supabase read mode with safe fallback behavior.

## Current Safe Default

Confirmed:

- `DATA_SOURCE_MODE=mock` remains the safe default.
- `DATA_SOURCE_MODE=supabase` is controlled test mode only.
- `ALCOHOL_MODULE_ENABLED=false`.

## Public Catalog Status

| Route | Mock mode status | Supabase mode status | Fallback behavior | Labels | No-write status | Missing field fallback |
| --- | --- | --- | --- | --- | --- | --- |
| `/food` | PASS | PASS or safe fallback | Falls back to mock on failed/empty/unreachable Supabase read | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data` | No writes | Current food read shape remains safe |
| `/tours` | PASS | PASS or safe fallback | Falls back to mock on failed/empty/unreachable Supabase read | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data` | No writes | Renders without `image_url`, `is_featured`, or SEO fields |
| `/stays` | PASS | PASS or safe fallback | Falls back to mock on failed/empty/unreachable Supabase read | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data` | No writes | Renders without `image_url`, capacity, amenities, `is_featured`, or SEO fields |
| `/shop` | PASS | PASS or safe fallback | Falls back to mock on failed/empty/unreachable Supabase read; filters unsafe products | `Mock data mode`, `Supabase read pilot`, `Fallback to mock data`, `Safety filtered` | No writes | Renders without `image_url`, slug, currency, `is_featured`, or SEO fields |

## Architecture Summary

Standard public catalog read pattern:

```text
public page -> controlled read wrapper -> mock data or Supabase adapter
```

Rules:

- `DATA_SOURCE_MODE=mock` returns mock data.
- Missing/unknown data source mode behaves safely as mock mode.
- `DATA_SOURCE_MODE=supabase` attempts a controlled Supabase read.
- Failed, empty, missing-table, or unreachable Supabase reads fall back to mock.
- Public pages do not display raw Supabase errors.
- Public pages do not expose secret or private env values.
- Supabase read adapters are read-only and do not perform business mutations.

## Fallback States

Supported public catalog states:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Additional `/shop` states:

- `safety_filtered`
- `safety_filtered_empty`

## No-Write Guarantee

The public catalog read pilot does not:

- create orders
- create bookings
- create cart records
- create checkout records
- create payments
- update stock
- update availability
- insert `audit_logs`
- update catalog tables
- update partners, categories, shops, products, tours, stays, or menu items
- touch `alcohol_module_settings`

No write indicators were found in the audited public catalog read/page files.

## Schema / No-SQL Status

Confirmed:

- Stage 21 SQL draft remains unapplied.
- No SQL was run for this milestone.
- No schema files were changed for this milestone.
- No database changes were made.
- The current public read pilot does not require migration.

## Missing Field Handling

Current safe handling:

- `/tours`, `/stays`, and `/shop` can render without `image_url`.
- `/shop` can render without slug.
- `/shop` uses `KGS` display fallback when currency is missing.
- Missing `is_featured` does not break public pages.
- Missing SEO fields do not break public pages.
- Migration is not required for the current read pilot.

## `/shop` Product / Alcohol Safety

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false`.
- `alcohol_module_settings` untouched.
- no alcohol products, categories, or items displayed by the controlled shop read pilot.
- conservative alcohol keyword filtering is active.
- uncertain alcohol-like products are excluded.
- no alcohol category tabs were added.
- no alcohol sales/delivery path was added.
- no cart, checkout, payment, or order path was added.

## Operational Supabase Mode Test Note

Manual Supabase-mode test procedure:

1. Temporarily set Supabase mode:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=supabase' | Set-Content .env.local
```

2. Run:

```powershell
npm run build
```

3. Start dev server in the foreground:

```powershell
npm run dev
```

4. Test:

- `http://localhost:3000/food`
- `http://localhost:3000/tours`
- `http://localhost:3000/stays`
- `http://localhost:3000/shop`

5. Stop dev server with `Ctrl+C`.

6. Restore mock mode:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=mock' | Set-Content .env.local
```

7. Run:

```powershell
npm run build
```

## Remaining Risks

- Supabase mode is not the production default.
- Public read pilot uses minimal seed data.
- RLS and production policies still need separate review.
- Stage 21 additive migration remains a draft only.
- Real catalog management UI is not built yet.
- Bookings, cart, checkout, and payments are not enabled by this public catalog read pilot.
- Public catalog reads are safe read pilots, not full production catalog operations.

## Recommended Roadmap Options

Possible Stage 28 directions:

- Stage 28 — Partner/Admin Catalog Management Planning
- Stage 28 — Minimal Additive Migration Apply Review
- Stage 28 — Production Deployment Readiness Checklist

Final recommendation:

```text
Stage 28 — Partner/Admin Catalog Management Planning
```

Reason:

- public read is now stable
- next value is controlled management of catalog data
- DB migration should not be applied yet unless catalog management requires missing fields

