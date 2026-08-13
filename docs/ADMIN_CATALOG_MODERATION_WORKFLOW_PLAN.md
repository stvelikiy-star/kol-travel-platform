# Stage 28-3 — Admin Catalog Moderation Workflow Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Define admin moderation before implementing writes.

This plan protects public catalog quality, prevents unsafe products/content, keeps alcohol disabled, and prepares future audit/RLS/write implementation.

No admin UI, routes, forms, actions, writes, SQL, or schema changes are implemented in this stage.

## Admin Route Map

Future routes:

- `/admin/catalog` — overview
- `/admin/catalog/review` — moderation queue
- `/admin/catalog/review/[type]/[id]`
- `/admin/catalog/categories`
- `/admin/catalog/partners`
- `/admin/catalog/safety`
- `/admin/catalog/audit`

## Admin Overview

Should show:

- pending review count
- rejected count
- published count
- archived count
- safety flags
- partner issues
- category gaps
- recent moderation actions

## Moderation Queue

Should show:

- item type
- partner/business
- title
- category
- status
- `submitted_at` if available
- risk flags
- actions:
  - review
  - approve
  - reject
  - request changes
  - archive
  - publish/unpublish

## Review Detail

Should show:

- before/after fields
- partner info
- category
- price
- description
- metadata
- safety flags
- public preview
- audit history
- moderation notes

## Status Workflow

Admin can later:

- approve
- reject with reason
- request changes
- publish
- unpublish
- archive
- flag unsafe
- manage categories

Admin cannot:

- enable alcohol casually
- bypass legal/super-admin alcohol activation
- edit payments/orders/bookings from catalog moderation

## Category Management

Admin can later manage:

- `categories.title`
- `categories.slug`
- `categories.scope`
- `categories.parent_id`
- `categories.sort_order`
- `is_active` if migration is applied later

Needed category scopes:

- food
- tours
- stays
- shop

## Safety Moderation

Plan checks:

- alcohol terms
- prohibited products
- suspicious metadata
- unsafe titles/descriptions
- invalid prices
- duplicate spam
- misleading content
- inactive partner/business

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol products/categories/items
- admin cannot enable alcohol through catalog moderation
- alcohol activation only through future legal/super-admin workflow
- uncertain alcohol-like product should be rejected or held for review

## Audit Events

Future admin actions should write `audit_logs`:

- `approve_item`
- `reject_item`
- `request_changes`
- `publish_item`
- `unpublish_item`
- `archive_item`
- `flag_unsafe`
- `update_category`
- `safety_review`

Use existing `audit_logs` fields:

- `actor_id`
- `actor_role`
- `action`
- `entity_type`
- `entity_id`
- `before`
- `after`
- `reason`
- `request_id`

## RLS / Write Planning

Future requirements:

- admin role can read all catalog
- admin can moderate all catalog through server-side actions
- partner cannot approve/publish
- public sees only active/published safe items
- service role remains server-only

No RLS SQL is created in this stage.

## No-Write Guarantee

This stage is docs only:

- no admin UI implementation
- no actions
- no SQL
- no database changes

