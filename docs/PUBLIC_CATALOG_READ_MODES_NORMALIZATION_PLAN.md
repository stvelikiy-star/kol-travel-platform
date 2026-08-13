# Stage 25-2 - Public Catalog Read Modes Normalization Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform

## Purpose

This plan defines how to normalize public read-mode behavior across:

- `/food`
- `/tours`
- `/stays`
- `/shop`

The goal is to reduce future QA risk, prepare for manual `DATA_SOURCE_MODE=supabase` testing, avoid unnecessary database migration, and keep mock fallback as the safe default.

No implementation is performed in this stage.

## Current Public Read Pages

| Page | Adapter file | Read wrapper file | Page wired | Labels present | Fallback modes supported | No-write status | SQL/schema status | Safety notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/food` | `src/lib/data/public-catalog-supabase.ts` | `src/lib/data/public-catalog-read.ts` | Yes | Yes | Uses `source` plus safe `code`; no explicit `mode` field | No writes found | No SQL/schema changes | Food read is safe; API shape is older than later wrappers |
| `/tours` | `src/lib/data/public-tours-supabase.ts` | `src/lib/data/public-tours-read.ts` | Yes | Yes | Explicit `mode` states | No writes found | No SQL/schema changes | Missing image/SEO fields do not block read |
| `/stays` | `src/lib/data/public-stays-supabase.ts` | `src/lib/data/public-stays-read.ts` | Yes | Yes | Explicit `mode` states | No writes found | No SQL/schema changes | Missing image/capacity/amenities/SEO fields do not block read |
| `/shop` | `src/lib/data/public-shop-supabase.ts` | `src/lib/data/public-shop-read.ts` | Yes | Yes | Explicit `mode` states plus safety states | No writes found | No SQL/schema changes | Conservative product/alcohol filtering exists |

## Standard Read Wrapper Contract

All public catalog read wrappers should eventually expose a consistent result shape:

- `ok`
- `source`
- `mode`
- `items`
- `code` when a safe fallback/error reason exists
- `message`
- optional `fallbackReason`
- optional internal debug reason that never exposes secrets
- optional safety flags, such as `safetyFiltered` for `/shop`

Public UI must never display:

- raw Supabase errors
- SQL details
- service role key
- auth token
- private env values

## Standard Modes

All public catalog read wrappers should support:

- `mock_mode`
- `supabase_success`
- `fallback_to_mock`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

`/shop` additionally supports:

- `safety_filtered`
- `safety_filtered_empty`

## Standard UI Labels

All pages should use small non-intrusive labels:

- `Mock data mode`
- `Supabase read pilot`
- `Fallback to mock data`

`/shop` additionally:

- `Safety filtered`, when relevant

## Standard DATA_SOURCE_MODE Behavior

Expected behavior for every public catalog read:

- `DATA_SOURCE_MODE=mock` returns mock data.
- missing `DATA_SOURCE_MODE` behaves like mock.
- unknown mode behaves like mock unless explicitly supported later.
- `DATA_SOURCE_MODE=supabase` attempts a controlled Supabase read.
- failed, missing, empty, or unsafe Supabase reads fall back to mock.
- no public catalog page crashes from missing Supabase env.

## Standard No-Write Guarantee

All public catalog read code must not call:

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

Read adapters should remain read-only and must not mutate Supabase or mock data.

## Standard Missing Field Fallback

For the current schema:

- missing `image_url` must not break `/tours`, `/stays`, or `/shop`.
- missing `slug` must not break `/shop`.
- missing currency in `/shop` should use `KGS` display fallback.
- missing `is_featured` must not break UI.
- missing SEO fields must not break UI.

No migration should be applied only to satisfy the current read pilots.

## Shop Safety Standard

Required:

- `ALCOHOL_MODULE_ENABLED=false`
- no `alcohol_module_settings` writes
- no alcohol products/categories/items displayed
- conservative alcohol keyword filtering remains
- uncertain alcohol-like products excluded
- no alcohol category tabs
- no cart/checkout/payment/order path added

The current `/shop` safety filter is a pilot guard, not final legal/compliance logic.

## Normalization Checklist

| Area | Current difference | Affected page | Risk | Recommended fix | Code change needed | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Result mode shape | `/food` uses `source` and `code` but no explicit `mode` field | `/food` | Low; behavior is safe but QA consistency is weaker | Add `PublicFoodReadMode` and return explicit `mode` | Yes | Medium |
| Fallback reason naming | `/food` does not expose `fallback_to_mock` mode name | `/food` | Low | Map safe codes to standard modes like tours/stays/shop | Yes | Medium |
| Wrapper result type names | Tours/stays/shop have domain-specific read result types; food uses generic `PublicCatalogReadResult` | `/food` | Low | Add `PublicFoodReadResult` type alias extending the generic shape | Yes | Low |
| Documentation consistency | Food docs are older than tours/stays/shop docs | `/food` docs | Low | Add or update food normalization note after code cleanup | Docs only | Low |
| Shop safety states | `/shop` has extra `safety_filtered` and `safety_filtered_empty` states | `/shop` | Expected difference | Keep as shop-only extension | No | None |

## Recommended Tiny Fix Stage

Because differences were found, recommended next stage:

- Stage 25-3 - Public Catalog Read Modes Normalization Fixes

Fixes should be limited to:

- labels
- result mode naming
- docs consistency
- wrapper result shape
- fallback reason handling

Do not include:

- DB changes
- schema changes
- payment changes
- write actions
- cart changes
- booking changes
- availability changes
- alcohol module changes

## If No Differences Remain Later

After Stage 25-3, if wrappers are consistent and build passes, proceed to:

- Stage 26 - Public Catalog Manual Supabase Mode Test

## Alcohol Confirmation

Current required state:

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol settings changed
- no alcohol sales or delivery enabled
- no alcohol product/category enablement added

## Final Decision

Normalization plan created: Yes.

Inconsistencies found: Yes, limited to `/food` read wrapper API shape.

Recommended next stage:

- Stage 25-3 - Public Catalog Read Modes Normalization Fixes
