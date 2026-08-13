# Stage 27-2 — Public Catalog Read Pilot Operational Runbook

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

This runbook explains how to operate and test the public catalog read pilot safely.

It covers:

- switching between mock and Supabase modes
- verifying public catalog pages without changing the database
- recovering to safe mock mode
- keeping alcohol disabled
- avoiding accidental writes or SQL execution

## Safe Default

Safe default state:

- `DATA_SOURCE_MODE=mock`
- `ALCOHOL_MODULE_ENABLED=false`
- no writes enabled from public catalog pages
- Supabase mode is manual test mode only

## Routes Covered

- `/food`
- `/tours`
- `/stays`
- `/shop`

## Mock Mode Procedure

Set mock mode:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=mock' | Set-Content .env.local
```

Run:

```powershell
npm run build
npm run dev
```

Expected:

- all public catalog pages render
- label shows `Mock data mode`
- no Supabase connection is required
- no writes occur

## Supabase Mode Test Procedure

Set Supabase mode:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=supabase' | Set-Content .env.local
```

Run:

```powershell
npm run build
npm run dev
```

Open:

- `http://localhost:3000/food`
- `http://localhost:3000/tours`
- `http://localhost:3000/stays`
- `http://localhost:3000/shop`

Expected:

- label shows `Supabase read pilot` or `Fallback to mock data`
- no raw Supabase errors
- no secret/env values shown
- no page crash
- no writes

Use `npm run dev` in the foreground. Avoid silent background dev-server launch for this test because previous Windows shell attempts were unstable.

## Restore Procedure

Always restore mock mode after testing:

```powershell
(Get-Content .env.local | Where-Object { $_ -notmatch '^DATA_SOURCE_MODE' }) + 'DATA_SOURCE_MODE=mock' | Set-Content .env.local
```

Then run:

```powershell
npm run build
```

## Troubleshooting

If Supabase is unreachable:

- pages should fall back to mock
- timeout fallback should prevent hanging
- no raw error should be displayed
- keep `DATA_SOURCE_MODE=mock` after testing

If the dev server is unstable:

- stop it with `Ctrl+C`
- confirm no background server process is needed
- run `npm run dev` manually in the foreground
- retest only after the terminal shows the server is ready

## `/shop` Safety

Confirmed safety rules:

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol items
- no alcohol categories
- no alcohol sales/delivery
- conservative filtering remains active
- uncertain alcohol-like products are excluded
- no cart/checkout/payment/order path is added

## What Not To Do

Do not:

- apply the Stage 21 SQL draft casually
- run SQL from docs without explicit approval
- set `DATA_SOURCE_MODE=supabase` as production default yet
- add cart/checkout/payment/order/booking flows from the public catalog pilot
- enable alcohol module
- touch `alcohol_module_settings`
- create writes from public catalog pages

## Quick Checklist

Before testing:

- `.env.local` exists
- Supabase credentials exist
- `ALCOHOL_MODULE_ENABLED=false`
- build passes
- no SQL applied

After testing:

- `DATA_SOURCE_MODE=mock`
- build passes
- no writes
- no SQL
- no alcohol change

