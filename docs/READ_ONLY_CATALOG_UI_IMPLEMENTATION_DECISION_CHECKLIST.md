# Stage 29-4 — Read-Only Catalog UI Implementation Decision Checklist

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Decide whether it is safe to implement partner/admin read-only catalog UI in a later stage.

This checklist keeps implementation low-risk by requiring read-only scope, no writes, no SQL, and no alcohol changes.

## Preconditions

Before implementation, confirm:

- `DATA_SOURCE_MODE=mock` remains the default
- `ALCOHOL_MODULE_ENABLED=false`
- public catalog read pilot remains stable
- Stage 21 migration draft remains unapplied unless separately approved
- no write/RLS/action implementation is bundled into read-only UI

## Required Planning Docs

Confirm these exist:

- `docs/PARTNER_ADMIN_CATALOG_READ_ONLY_UI_PLAN.md`
- `docs/PARTNER_READ_ONLY_CATALOG_DATA_ADAPTER_PLAN.md`
- `docs/ADMIN_READ_ONLY_CATALOG_DATA_ADAPTER_PLAN.md`

## Read-Only Implementation Scope

Allowed future scope:

- read-only partner catalog overview
- read-only partner food/tours/stays/products lists
- read-only admin catalog overview
- read-only admin review queue
- read-only admin food/tours/stays/products/categories/safety views
- safe loading/empty/error states
- safe labels for mock/Supabase/fallback if used

Not allowed in read-only implementation:

- forms
- submit buttons
- mutation buttons
- server actions
- Supabase writes
- SQL migrations
- RLS policy creation
- cart/checkout/payment/order/booking/availability writes
- audit inserts
- alcohol module changes

## Partner Implementation Gate

Partner read-only UI may proceed only if future implementation can guarantee:

- server-side ownership checks
- `catalog.business_id = partner_profiles.business_id`
- no `partner_id` assumption
- partner cannot see another business's records
- service role is not exposed to client
- raw Supabase errors are not shown

## Admin Implementation Gate

Admin read-only UI may proceed only if future implementation can guarantee:

- server-side admin role checks
- no moderation mutation capability
- all catalog records are read-only
- categories are read-only
- safety flags are read-only
- service role is not exposed to client
- raw Supabase errors are not shown

## Adapter Implementation Gate

Future adapters must be read-only:

- `partner-catalog-read`
- `partner-catalog-supabase`
- `admin-catalog-read`
- `admin-catalog-supabase`

Adapters must not call:

- `insert`
- `update`
- `delete`
- `upsert`
- write `rpc`

## Alcohol Safety Gate

Confirm:

- `ALCOHOL_MODULE_ENABLED=false`
- `alcohol_module_settings` untouched
- no alcohol categories/items/products enabled
- no alcohol sales/delivery path
- future product read-only safety flags planned
- alcohol activation remains a separate legal/super-admin workflow

## Build / QA Gate

Future implementation must pass:

- `npm run build`
- mock mode page checks
- safe fallback checks if Supabase mode is used
- no-write search/audit
- no SQL/schema audit

## Decision Options

- `GO`: proceed to read-only UI implementation only
- `GO WITH NOTES`: proceed but document limitations
- `NO-GO`: fix planning/security gaps first

Recommended decision for the next stage:

```text
GO — Stage 30 Partner/Admin Catalog Read-Only UI Implementation
```

Condition:

Stage 30 must remain read-only and must not introduce writes, SQL, forms, mutation buttons, cart/checkout/payment/order/booking flows, or alcohol changes.

