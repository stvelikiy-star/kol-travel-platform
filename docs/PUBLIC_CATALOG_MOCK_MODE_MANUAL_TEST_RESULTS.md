# Stage 26-2 - Public Catalog Mock Mode Manual Test Results

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

Mock mode manual testing was executed for the public catalog pages:

- `/food`
- `/tours`
- `/stays`
- `/shop`

Mode used:

- `DATA_SOURCE_MODE=mock`

Alcohol setting confirmed:

- `ALCOHOL_MODULE_ENABLED=false`

No SQL was applied. No schema files were modified. No database changes were made.

## Environment Checks

Status: passed.

- `.env.local` was set to `DATA_SOURCE_MODE=mock`.
- `.env.local` contains `ALCOHOL_MODULE_ENABLED=false`.
- local dev server was already responding on `http://localhost:3000`.
- `npm run build` passed before page checks.

## Manual Observation Table

| Page | Mode | Rendered yes/no | Label shown | Data source observed | Fallback used yes/no | Error shown yes/no | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/food` | mock | yes | `Mock data mode` | mock wrapper data | no | no | HTTP 200 |
| `/tours` | mock | yes | `Mock data mode` | mock wrapper data | no | no | HTTP 200 |
| `/stays` | mock | yes | `Mock data mode` | mock wrapper data | no | no | HTTP 200 |
| `/shop` | mock | yes | `Mock data mode` | mock wrapper data | no | no | HTTP 200 |

## Build Result

Build command:

```bash
npm run build
```

Result: passed.

Existing non-blocking webpack cache warning may appear after successful build.

## No-Write Audit

Status: passed.

Public catalog read/page code was checked for write-like operations. No calls were found for:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- order creation
- booking creation
- cart creation
- checkout creation
- payment creation
- stock update
- availability update
- `audit_logs` insert

## Schema / No-SQL Audit

Status: passed.

Confirmed:

- no SQL was run.
- Stage 21 SQL draft remains unapplied.
- no schema files were changed.
- no DB changes were made.

## Alcohol Status

Status: passed.

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false`.
- `alcohol_module_settings` was not touched.
- `/shop` did not show an alcohol sales or delivery path in mock mode.
- no cart/checkout/payment/order path was added.
- shop safety filtering remains available in the read wrapper even though mock mode is active.

## Issues / Fixes

No issues found.

No code fixes were required.

## Final Decision

Mock mode manual test: PASS.

Recommended next stage:

- Stage 26-3 - Supabase Mode Manual Test
