# Stage 29-1 — Partner/Admin Catalog Management Read-Only UI Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Plan safe read-only partner/admin catalog management screens before implementing any writes.

Goals:

- introduce read-only management visibility before writes
- validate catalog data ownership and statuses
- prepare partner/admin UX safely
- protect the public read pilot
- avoid premature writes, RLS changes, or migration apply

## Read-Only Scope

Partner/admin screens may later display:

- catalog records
- statuses
- categories
- business ownership
- moderation state
- safety flags
- public visibility hints

Screens must not:

- create records
- edit records
- delete records
- publish records
- approve/reject records
- update categories
- update stock
- update availability
- create `audit_logs`

## Partner Read-Only Route Plan

| Route | Source table | Visible fields | Filters | Empty state | Status display | Ownership rule | No-write rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/partner/catalog` | all catalog domains | counts, statuses, recent items | current partner business only | no catalog items yet | status summary badges | `catalog.business_id = partner_profiles.business_id` | no create/edit/submit buttons |
| `/partner/catalog/food` | `menu_items` | id, title, category, price, status, timestamps | current partner business only | no food items yet | draft/review/active/rejected/archived | `business_id` ownership | read-only table/cards |
| `/partner/catalog/tours` | `tours` | id, title, location, price, currency, duration, status, timestamps | current partner business only | no tours yet | draft/review/active/rejected/archived | `business_id` ownership | read-only table/cards |
| `/partner/catalog/stays` | `stays` | id, title, location, type, price_from, currency, status, timestamps | current partner business only | no stays yet | draft/review/active/rejected/archived | `business_id` ownership | read-only table/cards |
| `/partner/catalog/products` | `products` | id, title, category, price, stock_qty, status, safety hint, timestamps | current partner business only | no products yet | draft/review/active/rejected/archived | `business_id` ownership | read-only table/cards |

## Admin Read-Only Route Plan

| Route | Source table | Visible fields | Moderation signals | Partner/business display | Status display | Safety flags | No-write rule |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/admin/catalog` | all catalog domains | counts, statuses, recent items | pending/rejected/archived counts | all partners | status summary badges | safety summary | no moderation buttons yet |
| `/admin/catalog/review` | all catalog domains | item type, title, category, status, timestamps | review queue signals | business title/id | queue badges | unsafe/prohibited hints | read-only queue |
| `/admin/catalog/food` | `menu_items` | id, title, price, category, status, timestamps | under_review/rejected | business title/id | status badges | content safety hints | no approve/reject |
| `/admin/catalog/tours` | `tours` | id, title, location, price, currency, duration, status | under_review/rejected | business title/id | status badges | content safety hints | no approve/reject |
| `/admin/catalog/stays` | `stays` | id, title, location, type, price_from, currency, status | under_review/rejected | business title/id | status badges | content safety hints | no approve/reject |
| `/admin/catalog/products` | `products` | id, title, price, stock_qty, category, status | under_review/rejected | business title/id | status badges | alcohol/prohibited hints | no approve/reject |
| `/admin/catalog/categories` | `categories` | id, title, slug, scope, parent, sort, status if available | category gaps | global | active/inactive if available | unsafe category names | no category edits |
| `/admin/catalog/safety` | products/catalog safety views | item, domain, reason, status | safety queue | business title/id | risk badges | alcohol/prohibited/uncertain | no safety writes |

## Data Sources

Use existing tables:

- `menu_items`
- `tours`
- `stays`
- `products`
- `shops`
- `categories`
- `partners`
- `partner_profiles` if needed for ownership

Canonical ownership:

```text
business_id = partners.id
```

Do not introduce:

```text
partner_id
```

## Partner Visibility Rules

Partner should only see records where:

```text
catalog.business_id = partner_profiles.business_id
```

Partner should not see:

- other partner catalog items
- global moderation queue
- private admin notes
- service role details
- alcohol settings

## Admin Visibility Rules

Admin may see:

- all catalog records
- all partners/businesses
- categories
- statuses
- safety flags
- moderation queue

Admin read-only UI must not mutate anything in this stage.

## Fields To Display

Common:

- id
- title
- `business_id`
- partner/business title
- category
- status
- `created_at`
- `updated_at`

Food:

- price
- `preparation_time_minutes`
- description

Tours:

- location
- price
- currency
- duration
- description

Stays:

- location
- `price_from`
- currency
- type
- description

Products:

- price
- `stock_qty`
- description
- category
- safety/alcohol flag if relevant

## Status Badges

Plan badges for:

- `draft`
- `under_review`
- `approved`
- `published`
- `active`
- `rejected`
- `archived`
- `unknown`

Do not change database statuses in this stage.

## Safety Display

For `/shop` and product views:

- show safety indicator if product may be filtered
- show alcohol safety blocked status if relevant
- do not expose alcohol sales/delivery
- keep `ALCOHOL_MODULE_ENABLED=false`

## UI States

Plan:

- loading
- empty
- read success
- fallback to mock if needed
- access denied
- missing partner profile
- missing business
- read error safe state

## Adapter / Read Strategy

This stage only plans future read-only management adapters. Do not implement adapters yet.

Future adapter names may be:

- `src/lib/data/partner-catalog-read.ts`
- `src/lib/data/admin-catalog-read.ts`
- `src/lib/data/partner-catalog-supabase.ts`
- `src/lib/data/admin-catalog-supabase.ts`

## Security Guardrails

Future implementation must:

- use server-side ownership checks
- avoid client-side service role exposure
- keep service role server-only
- avoid raw Supabase errors in UI
- avoid secret/env display
- keep public read pilot unaffected

## No-Write Guarantee

This stage is docs only:

- no UI
- no routes
- no forms
- no actions
- no SQL
- no database changes

## Recommended Next Stages

- Stage 29-2 — Partner Read-Only Catalog Data Adapter Plan
- Stage 29-3 — Admin Read-Only Catalog Data Adapter Plan
- Stage 29-4 — Read-Only UI Implementation Decision Checklist
- Stage 29-5 — Stage 29 Final Audit

