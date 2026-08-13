# Stage 26-3 — Public Catalog Supabase Mode Manual Test Results

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Test Summary

This stage executed the public catalog Supabase-mode test path without applying SQL, modifying schema files, or changing the database.

`DATA_SOURCE_MODE` was set to `supabase` for the test and restored to `mock` afterward. `ALCOHOL_MODULE_ENABLED=false` remained unchanged.

During Supabase-mode testing, local background dev-server launch was blocked by the Windows shell environment: `Start-Process` failed with a duplicate `Path`/`PATH` environment key issue, and background `cmd`/Node launch attempts did not bind a reachable local port. The direct foreground Next dev command reached `Ready`, and both Supabase-mode and restored mock-mode production builds passed.

Because HTTP page-open checks could not be completed through a persistent local server process, this result records build-time Supabase-mode validation, wrapper/page label verification, no-write audit, and the safe runtime fallback fix added during this stage.

## Environment Checks

| Item | Result | Notes |
| --- | --- | --- |
| DATA_SOURCE_MODE set to supabase for test | Yes | `.env.local` was switched to `DATA_SOURCE_MODE=supabase` before the Supabase-mode build. |
| Supabase env keys present | Yes | Presence was checked without printing secret values. |
| ALCOHOL_MODULE_ENABLED=false | Yes | Alcohol setting remained disabled. |
| DATA_SOURCE_MODE restored to mock | Yes | `.env.local` was restored to `DATA_SOURCE_MODE=mock` after the test. |

## Build Results

| Build | Result | Notes |
| --- | --- | --- |
| Supabase-mode build | Pass | `npm run build` passed after adding bounded public Supabase read timeouts. |
| Final mock-mode build | Pass | `npm run build` passed after restoring `DATA_SOURCE_MODE=mock`. |

The known non-blocking webpack cache warning may appear after a successful build:

```text
Caching failed for pack: Error: Unable to snapshot resolve dependencies
```

## Manual Page Observation Table

| Page | Mode | Rendered yes/no | HTTP status | Label shown | Data source observed | Fallback used yes/no | Error shown yes/no | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/food` | supabase | Not completed via HTTP | Not completed | Verified in page code | Supabase read attempted by wrapper in Supabase mode | Safe fallback supported | No raw error path found | Local persistent server launch was blocked; Supabase-mode build passed. |
| `/tours` | supabase | Not completed via HTTP | Not completed | Verified in page code | Supabase read attempted by wrapper in Supabase mode | Safe fallback supported | No raw error path found | Local persistent server launch was blocked; Supabase-mode build passed. |
| `/stays` | supabase | Not completed via HTTP | Not completed | Verified in page code | Supabase read attempted by wrapper in Supabase mode | Safe fallback supported | No raw error path found | Local persistent server launch was blocked; Supabase-mode build passed. |
| `/shop` | supabase | Not completed via HTTP | Not completed | Verified in page code | Supabase read attempted by wrapper in Supabase mode | Safe fallback supported | No raw error path found | Conservative product/alcohol safety filtering remains present. |

## Supabase Mode Observations

Supabase mode is controlled by the public catalog read wrappers:

- `/food`: `getPublicFoodReadResult()`
- `/tours`: `getPublicToursReadResult()`
- `/stays`: `getPublicStaysReadResult()`
- `/shop`: `getPublicShopReadResult()`

The pages include non-intrusive labels for:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

The shop page also includes the safety filter label path:

- `Safety filtered`

## Runtime Fallback Fix Applied

Supabase-mode page requests initially waited too long when the local environment could not reach Supabase. A tiny safe fix was applied to public Supabase read adapters by adding a bounded read timeout before returning the existing safe fallback path.

Files adjusted:

- `src/lib/data/public-catalog-supabase.ts`
- `src/lib/data/public-tours-supabase.ts`
- `src/lib/data/public-stays-supabase.ts`
- `src/lib/data/public-shop-supabase.ts`

This does not add writes and does not change schema, payments, booking, cart, checkout, orders, availability, audit logging, or alcohol behavior.

## Fallback Behavior

The public catalog wrappers support safe fallback states:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

The shop wrapper also supports:

- `safety_filtered`
- `safety_filtered_empty`

## Shop Safety Result

Shop product/alcohol safety remains active:

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol module settings touched
- no alcohol category tab added
- no alcohol sales/delivery path added
- no cart, checkout, payment, or order path added
- conservative alcohol keyword filtering remains in the Supabase shop adapter

## No-Write Audit

Public catalog read/page files were searched for write indicators:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`
- `audit_logs`
- create order/booking/cart/checkout/payment
- update stock/availability
- `alcohol_module_settings`

Result: no matches in the audited public catalog read/page files.

## Schema / SQL Audit

- No SQL was run.
- Stage 21 SQL draft remains unapplied.
- No schema files were changed.
- No database changes were made.

## Alcohol Status

- `ALCOHOL_MODULE_ENABLED=false`
- alcohol settings untouched
- no alcohol sales/delivery path added
- public catalog reads do not enable alcohol

## Issues / Fixes

Issue found:

- Local background server launch was blocked by the Windows shell environment, preventing persistent HTTP manual page checks.
- Supabase-mode reads needed a bounded timeout so unreachable Supabase reads fall back promptly.

Fix applied:

- Added a 1.5 second bounded fetch timeout to the four public Supabase read adapters.

## Final Result

Stage 26-3 is partially executed:

- Supabase-mode build passed.
- Mock mode was restored.
- Final mock-mode build passed.
- No writes were added.
- No SQL/schema/database changes were made.
- Alcohol remains disabled.
- HTTP page-open checks should be rerun manually in a stable dev-server session during Stage 26-4.

