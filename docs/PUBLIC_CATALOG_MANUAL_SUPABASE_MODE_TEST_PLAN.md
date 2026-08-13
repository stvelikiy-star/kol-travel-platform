# Stage 26-1 - Public Catalog Manual Supabase Mode Test Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Purpose

This plan defines manual testing for public catalog read modes across:

- `/food`
- `/tours`
- `/stays`
- `/shop`

The goal is to verify:

- mock mode works.
- Supabase mode works or safely falls back.
- no writes happen.
- alcohol remains disabled.
- Stage 21 SQL draft is still unapplied.

No SQL is applied in this stage. No code is changed in this stage.

## Pre-Test Safety Checklist

Before testing, confirm:

- current `DATA_SOURCE_MODE` value is known.
- `ALCOHOL_MODULE_ENABLED=false`.
- `npm run build` passes.
- no SQL migration has been applied.
- no schema files have been changed.
- Supabase credentials exist only in local `.env.local`.
- the Supabase target is a test project, not production.
- `.env.local` is not committed.

## Mock Mode Test

Set in `.env.local`:

```bash
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

Restart the dev server if needed.

Open:

- `/food`
- `/tours`
- `/stays`
- `/shop`

Expected:

- pages render.
- label shows `Mock data mode`.
- no Supabase read is required.
- no page crash.
- no write actions.
- `/shop` alcohol safety remains active.

## Supabase Mode Test

Set in `.env.local`:

```bash
DATA_SOURCE_MODE=supabase
ALCOHOL_MODULE_ENABLED=false
```

Restart the dev server if needed.

Open:

- `/food`
- `/tours`
- `/stays`
- `/shop`

Expected:

- pages attempt Supabase read.
- if data exists, label shows `Supabase read pilot`.
- if read fails or returns empty, label shows `Fallback to mock data`.
- no raw Supabase, SQL, auth, service role, or private env error is shown.
- no page crash.
- no writes.
- no cart/checkout/payment/order/booking/availability updates.
- `/shop` does not show alcohol products/categories/items.

## Manual Observation Table

| Page | Mode | Rendered yes/no | Label shown | Data source observed | Fallback used yes/no | Error shown yes/no | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/food` | mock |  |  |  |  |  |  |
| `/food` | supabase |  |  |  |  |  |  |
| `/tours` | mock |  |  |  |  |  |  |
| `/tours` | supabase |  |  |  |  |  |  |
| `/stays` | mock |  |  |  |  |  |  |
| `/stays` | supabase |  |  |  |  |  |  |
| `/shop` | mock |  |  |  |  |  |  |
| `/shop` | supabase |  |  |  |  |  |  |

## No-Write Verification

This manual test must not trigger:

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

Public catalog read pages should remain read-only in both mock and Supabase modes.

## Alcohol Verification

Confirm:

- `ALCOHOL_MODULE_ENABLED=false`.
- `alcohol_module_settings` is not touched.
- `/shop` does not show alcohol products/categories/items.
- no alcohol sales path appears.
- no alcohol delivery path appears.

## Rollback After Test

After Supabase mode testing, return `.env.local` to:

```bash
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

Restart the dev server if needed.

Run:

```bash
npm run build
```

Expected:

- build passes.
- mock mode is restored.
- no database rollback is required.
- no schema rollback is required.

## Next Stages

- Stage 26-2 - Execute Mock Mode Manual Test
- Stage 26-3 - Execute Supabase Mode Manual Test
- Stage 26-4 - Manual Test Results Documentation
- Stage 26-5 - Stage 26 Final Audit

## Safety Confirmation

This stage is documentation only.

Confirmed required boundaries:

- no SQL applied.
- no schema changes.
- no database changes.
- no writes.
- no cart/checkout/payment/order creation.
- no booking creation.
- no availability updates.
- no stock updates.
- no alcohol module enablement.
