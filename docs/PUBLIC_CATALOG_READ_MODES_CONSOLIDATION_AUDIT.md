# Stage 25-1 - Public Catalog Read Modes Consolidation Audit

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Summary

This audit consolidates the current public catalog read-mode pilots for:

- `/food`
- `/tours`
- `/stays`
- `/shop`

Result: the public catalog read-mode rollout is safe to keep in its current mock-default state.

No SQL was applied. No schema files were modified. No writes, cart, checkout, payment, order, booking, availability, stock, audit, or alcohol behavior was added.

## File Existence Audit

Status: passed.

Public read adapter/wrapper files confirmed:

- food: `src/lib/data/public-catalog-supabase.ts`
- food: `src/lib/data/public-catalog-read.ts`
- tours: `src/lib/data/public-tours-supabase.ts`
- tours: `src/lib/data/public-tours-read.ts`
- stays: `src/lib/data/public-stays-supabase.ts`
- stays: `src/lib/data/public-stays-read.ts`
- shop: `src/lib/data/public-shop-supabase.ts`
- shop: `src/lib/data/public-shop-read.ts`

Public catalog docs confirmed:

- `docs/PUBLIC_CATALOG_SUPABASE_READ_UI_PILOT.md`
- `docs/TOURS_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`
- `docs/TOURS_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `docs/TOURS_PUBLIC_SUPABASE_READ_QA.md`
- `docs/TOURS_PUBLIC_SUPABASE_READ_FINAL_AUDIT.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_QA.md`
- `docs/STAYS_PUBLIC_SUPABASE_READ_FINAL_AUDIT.md`
- `docs/SHOP_PUBLIC_SUPABASE_READ_SAFETY_PLAN.md`
- `docs/SHOP_PUBLIC_SUPABASE_READ_ADAPTER_IMPLEMENTATION.md`
- `docs/SHOP_PUBLIC_SUPABASE_READ_UI_WIRING.md`
- `docs/SHOP_PUBLIC_SUPABASE_READ_QA.md`
- `docs/SHOP_PUBLIC_SUPABASE_READ_FINAL_AUDIT.md`

## Page Wiring Audit

Status: passed.

Confirmed controlled wrappers:

- `/food` uses `getPublicFoodReadResult()`
- `/tours` uses `getPublicToursReadResult()`
- `/stays` uses `getPublicStaysReadResult()`
- `/shop` uses `getPublicShopReadResult()`

The pages do not directly rely on mock/static catalog functions as their primary page source. Mock data remains available through controlled wrapper fallback.

## DATA_SOURCE_MODE Behavior Audit

Status: passed.

Current behavior:

- `DATA_SOURCE_MODE=mock` returns mock data.
- missing or unknown mode behaves like mock mode through `isSupabaseMode()`.
- `DATA_SOURCE_MODE=supabase` attempts the controlled Supabase read adapter.
- failed Supabase reads return safe fallback behavior.
- public pages should not crash from missing Supabase env.

## Fallback Mode Audit

Status: passed with one consistency note.

Tours, stays, and shop expose explicit `mode` states:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Shop also exposes:

- `safety_filtered`
- `safety_filtered_empty`

Food uses the older shared result shape with `source` plus safe `code`, not an explicit `mode` field. It still supports the same safe codes:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

Recommended follow-up:

- consider normalizing `/food` to an explicit `mode` field in a later cleanup stage if a fully uniform API is desired.

This is not a blocker because `/food` already supports mock, Supabase, fallback, and safe error behavior.

## Label Audit

Status: passed.

All public catalog pilot pages show non-intrusive labels:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

Shop additionally shows:

- `Safety filtered`, when relevant

## No-Write Audit

Status: passed.

The public catalog read code was checked for write-like operations. No calls were found for:

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

The read adapters use read-only HTTP `GET` requests.

## Schema / No-SQL Audit

Status: passed.

Confirmed:

- Stage 21 SQL draft remains unapplied.
- No Supabase SQL was run in this audit.
- No schema files were changed.
- No DB changes were made.

Stage 21 draft remains:

- `supabase/schema/004_minimal_additive_catalog_fields_DRAFT_NOT_APPLIED.sql`

## Missing Field Safety Audit

Status: passed.

Confirmed:

- missing `image_url` does not break `/tours`, `/stays`, or `/shop`.
- missing `slug` does not break `/shop`.
- missing currency uses `KGS` display fallback in `/shop`.
- missing `is_featured` does not break the public read pilots.
- missing SEO fields do not break the public read pilots.
- Stage 21 migration is not required for the current read pilots.

## Product / Alcohol Safety Audit

Status: passed.

Confirmed:

- `ALCOHOL_MODULE_ENABLED=false`.
- `alcohol_module_settings` is untouched.
- no alcohol queries were added.
- no alcohol sales or delivery path was added.
- `/shop` includes conservative alcohol keyword filtering.
- alcohol-like products/categories/metadata are excluded from the Supabase public shop read pilot.
- no alcohol category tab was added.

The shop safety filter is a temporary public-read guard and not final legal/compliance logic.

## Current Risks

- `/food` uses `source/code` rather than an explicit `mode` field, unlike tours/stays/shop.
- Manual browser verification in `DATA_SOURCE_MODE=supabase` is still useful for live Supabase data.
- Product/alcohol filtering is conservative pilot filtering, not final compliance logic.
- Stage 21 migration remains intentionally unapplied.

## Blockers

No blocking issues found for current mock-default public catalog read mode.

## Final Decision

Public catalog read modes consolidation status: safe.

SQL still unapplied: Yes.

No-write confirmation: Yes.

Alcohol disabled confirmation: Yes.

## Recommended Next Stage

Recommended next stage:

- Stage 25-2 - Public Catalog Read Mode API Consistency Plan

Reason:

- `/food`, `/tours`, `/stays`, and `/shop` all work safely.
- a small API consistency plan can decide whether `/food` should adopt the explicit `mode` result shape before any SQL migration is considered.
