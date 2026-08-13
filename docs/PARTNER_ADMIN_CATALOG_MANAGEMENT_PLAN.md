# Stage 28-1 — Partner/Admin Catalog Management Planning

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Plan safe catalog management before implementing writes.

This plan defines roles, permissions, workflow, statuses, audit needs, RLS needs, and field requirements while protecting the current public catalog read pilot.

No migration should be applied before write and management requirements are clear.

## Existing Catalog Domains

| Public route | Current table/source |
| --- | --- |
| `/food` | `menu_items` |
| `/tours` | `tours` |
| `/stays` | `stays` |
| `/shop` | `products` and `shops` |
| Categories | `categories` |
| Business/partner source | `partners` |

## Role Model

### Partner

Partners should manage only their own business data:

- own `menu_items`
- own `tours`
- own `stays`
- own `products`
- own shop/restaurant operational settings if relevant later

### Admin

Admins should:

- review and moderate catalog content
- approve, reject, publish, and archive
- view all partners
- manage categories
- handle unsafe content
- keep alcohol disabled

### Super Admin

Super admin may be needed later for platform-level settings or legal/compliance flows. Super admin still must not bypass alcohol legal/licensing requirements.

## Ownership Model

Use:

```text
business_id = partners.id
```

Do not introduce:

```text
partner_id
```

Partner access should resolve through:

```text
current user -> partner_profiles.business_id -> partners.id -> catalog.business_id
```

Partners must not manage another business's data.

## Catalog Management Routes To Plan

Partner routes:

- `/partner/catalog`
- `/partner/catalog/food`
- `/partner/catalog/tours`
- `/partner/catalog/stays`
- `/partner/catalog/products`

Admin routes:

- `/admin/catalog`
- `/admin/catalog/review`
- `/admin/catalog/categories`
- `/admin/partners`

No routes are implemented in this stage.

## Status Workflow

Planned statuses:

- `draft`
- `under_review`
- `approved`
- `published` / `active`
- `rejected`
- `archived`

Current seed may use `under_review`. Future work must not break existing status values.

## Write Boundaries

Partner can later:

- create draft
- edit own draft
- submit for review
- archive own item if allowed

Partner cannot:

- publish directly unless approved
- edit another business item
- edit alcohol settings
- create alcohol products/categories
- change payments, orders, or bookings

Admin can later:

- approve/reject
- publish/unpublish
- archive unsafe content
- manage categories
- audit changes

## Audit Requirements

Future writes should create `audit_logs` for:

- create item
- update item
- submit for review
- approve
- reject
- publish
- archive
- safety filter triggered
- admin moderation action

Use existing `audit_logs` structure:

- `actor_id`
- `actor_role`
- `action`
- `entity_type`
- `entity_id`
- `before`
- `after`
- `reason`
- `request_id`

## RLS / Write Policy Requirements

Planning only. No RLS SQL is created in this stage.

Future policies:

- public active-only read
- partner own-business draft/write
- admin full moderation
- service role server-only
- no client-side service role exposure

## Field Requirements

Current likely missing fields for management needs:

`menu_items`:

- `slug`
- `currency`
- `image_url`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`

`products`:

- `slug`
- `currency`
- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

`tours`:

- `image_url`
- `is_featured`
- `seo_title`
- `seo_description`

`stays`:

- `image_url`
- `capacity`
- `amenities`
- `is_featured`
- `seo_title`
- `seo_description`

Decision: do not apply Stage 21 migration yet. Use this planning section to decide whether fields are required before management UI.

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol categories/items
- partner cannot create alcohol products/items/categories
- admin cannot enable alcohol through catalog management
- alcohol activation remains a separate future legal/super-admin workflow
- `/shop` safety filtering remains active

## No-Write Guarantee

This stage is docs only:

- no forms
- no server actions
- no Supabase writes
- no SQL
- no schema/database changes

## Recommended Next Stages

- Stage 28-2 — Partner Catalog Management UX/Route Plan
- Stage 28-3 — Admin Catalog Moderation Workflow Plan
- Stage 28-4 — Catalog Write/RLS/Audit Requirements Plan
- Stage 28-5 — Stage 28 Final Audit

