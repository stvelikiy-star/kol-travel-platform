# Stage 26-4 — Public Catalog Manual Test Results and Retest Checklist

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Stage 26 Status Summary

| Stage | Status | Notes |
| --- | --- | --- |
| 26-1 Public Catalog Manual Supabase Mode Test Plan | Completed | Test plan document exists. |
| 26-2 Execute Public Catalog Mock Mode Manual Test | Completed / PASS | `/food`, `/tours`, `/stays`, and `/shop` passed in `DATA_SOURCE_MODE=mock`. |
| 26-3 Execute Public Catalog Supabase Mode Manual Test | Build/config completed | Supabase-mode build passed, config was checked, and mock mode was restored. |
| 26-3 browser HTTP checks | Not fully completed | Local persistent HTTP checks were blocked by Windows dev-server background launch instability. |

## Confirmed PASS Items

- `DATA_SOURCE_MODE` was restored to `mock`.
- `ALCOHOL_MODULE_ENABLED=false` was confirmed.
- Supabase-mode build passed.
- Final build after restoring mock mode passed.
- No SQL was applied.
- No schema files were changed.
- No database changes were made.
- No writes were added.
- No cart, checkout, payment, order, booking, availability, stock, or audit insert logic was added.
- A tiny safe timeout fallback fix was added to public Supabase read adapters so unreachable Supabase reads fall back promptly instead of hanging.
- Mock mode pages previously passed:
  - `/food`
  - `/tours`
  - `/stays`
  - `/shop`

## Unverified Items

Supabase-mode browser HTTP checks still need a manual rerun for:

- `/food`
- `/tours`
- `/stays`
- `/shop`

For each page, verify:

- HTTP 200
- page renders
- label shows `Supabase read pilot` or `Fallback to mock data`
- no raw Supabase error is shown
- no secret or env value is shown
- no page crash
- no writes are triggered
- `/shop` product/alcohol safety remains active

## Stable Dev-Server Retest Procedure

Run these steps in a normal foreground PowerShell session. Do not launch the dev server as a silent background process for this retest.

### Step A — Set Supabase Mode

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=supabase' | Set-Content .env.local
```

### Step B — Confirm Alcohol Remains Disabled

Confirm `.env.local` contains:

```text
ALCOHOL_MODULE_ENABLED=false
```

Do not change alcohol settings.

### Step C — Build

```powershell
npm run build
```

### Step D — Start Dev Server Manually

```powershell
npm run dev
```

Keep this process in the foreground.

### Step E — Open Pages Manually

Open these URLs in the browser:

- `http://localhost:3000/food`
- `http://localhost:3000/tours`
- `http://localhost:3000/stays`
- `http://localhost:3000/shop`

### Step F — Record Results

Use the manual observation table below.

### Step G — Stop Dev Server

Press `Ctrl+C` in the terminal running `npm run dev`.

### Step H — Restore Mock Mode

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=mock' | Set-Content .env.local
```

### Step I — Final Build

```powershell
npm run build
```

## Manual Observation Table

| Page | Mode | HTTP 200 yes/no | Rendered yes/no | Label shown | Data source observed | Fallback used yes/no | Error shown yes/no | Write triggered yes/no | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/food` | supabase |  |  |  |  |  |  |  |  |
| `/tours` | supabase |  |  |  |  |  |  |  |  |
| `/stays` | supabase |  |  |  |  |  |  |  |  |
| `/shop` | supabase |  |  |  |  |  |  |  |  |

## `/shop` Specific Retest

Verify:

- no alcohol products, categories, or items are displayed
- no alcohol sales/delivery path exists
- no cart, checkout, payment, or order path is added
- conservative product/alcohol safety filtering remains active
- if a product is filtered out, the fallback or empty state remains safe

## No-Write Retest

Confirm no user action during the test triggers:

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

## Schema / SQL Retest

Confirm:

- no SQL is run
- Stage 21 SQL draft remains unapplied
- no schema files are changed
- no database changes are made

## Alcohol Retest

Confirm:

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` is not touched
- public catalog pages do not enable alcohol sales or delivery
- `/shop` does not show alcohol products, categories, or items

## Final Stage 26 Decision Rules

Stage 26 can only be marked `PASS` after:

- mock mode `PASS` remains confirmed
- Supabase-mode browser checks are complete for all four pages
- `DATA_SOURCE_MODE` is restored to `mock`
- final build passes
- no writes are confirmed
- no SQL/schema/database changes are confirmed
- no alcohol changes are confirmed

Until the Supabase browser retest is completed, the Stage 26 decision is:

```text
PASS WITH RETEST REQUIRED
```

## Recommended Next Stage

Recommended next stage:

```text
Stage 26-5 — Final Audit After Manual Supabase Browser Retest
```

Start Stage 26-5 only after stable foreground dev-server browser checks are completed.

