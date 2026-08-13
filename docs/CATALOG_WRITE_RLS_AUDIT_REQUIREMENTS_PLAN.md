# Stage 28-4 — Catalog Write/RLS/Audit Requirements Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Define safe write architecture, RLS requirements, server action requirements, and audit requirements before implementing any catalog writes.

This stage prevents accidental unsafe writes and remains docs only.

## Write Architecture

Future writes must be:

- server-side only
- authenticated
- role-checked
- ownership-checked
- validated
- audited
- protected from client-side service role exposure

## Entity Write Scopes

`menu_items`:

- partner own business drafts
- admin moderation

`tours`:

- partner own business drafts
- admin moderation

`stays`:

- partner own business drafts
- admin moderation

`products`:

- partner own business drafts
- admin moderation
- strict product/alcohol safety

`categories`:

- admin only

`partners`:

- admin only for moderation/business state
- partner limited profile edits later if needed

## Ownership Resolution

Use:

- current auth user
- `partner_profiles.user_id`
- `partner_profiles.business_id`
- `partners.id`
- `catalog.business_id`

Do not use:

- `partner_id`

## Future Server Actions

Plan action groups:

- `createCatalogDraft`
- `updateCatalogDraft`
- `submitCatalogForReview`
- `approveCatalogItem`
- `rejectCatalogItem`
- `publishCatalogItem`
- `archiveCatalogItem`
- `updateCategory`
- `flagCatalogSafetyIssue`

Do not implement now.

## Validation Requirements

Common:

- title required
- price non-negative
- category valid
- `business_id` ownership
- status transition valid
- metadata safe
- no secret/env values

Product-specific:

- alcohol/prohibited keyword check
- no alcohol if `ALCOHOL_MODULE_ENABLED=false`
- `stock_qty` non-negative

Stay-specific:

- `price_from` non-negative
- capacity positive if present

Tour-specific:

- price non-negative
- duration safe text

Food-specific:

- `preparation_time_minutes` positive if present
- `is_available` later if migration applied

## Status Transitions

Partner:

- `draft -> under_review`
- `rejected -> draft`
- `active/published -> archived` if allowed

Admin:

- `under_review -> approved`
- `approved -> published/active`
- `under_review -> rejected`
- `published/active -> archived`
- `published/active -> under_review` if safety issue

## RLS Requirements

Planning only. No RLS SQL is created in this stage.

Public:

- read only published/active safe records

Partner:

- read own business records
- create drafts for own business
- update own drafts/rejected records
- submit own drafts for review
- cannot approve/publish
- cannot write another business data

Admin:

- read all
- moderate all through server actions
- manage categories

Service role:

- server-only
- no exposure to client

## Audit Requirements

Every future write must insert `audit_logs`:

- `actor_id`
- `actor_role`
- `action`
- `entity_type`
- `entity_id`
- `before`
- `after`
- `reason`
- `request_id`

Actions:

- `create_draft`
- `update_draft`
- `submit_for_review`
- `approve`
- `reject`
- `publish`
- `unpublish`
- `archive`
- `safety_flag`
- `category_update`

## SQL / Migration Dependency

Before implementation, decide if Stage 21 additive fields are needed:

- `image_url`
- `slug`
- `currency`
- `is_available`
- `is_featured`
- `seo_title`
- `seo_description`
- `capacity`
- `amenities`

Do not apply migration in this stage.

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- catalog writes must block alcohol categories/items/products
- no admin moderation path should enable alcohol
- alcohol activation is a separate future legal/super-admin workflow
- audit any blocked alcohol attempt in future

## Testing Requirements

Future write implementation must test:

- partner cannot write another business
- partner cannot publish directly
- admin can approve/reject
- public sees only active/published
- alcohol blocked
- audit inserted
- no payment/order/booking/cart side effects

## No-Write Guarantee

This stage is docs only:

- no code
- no SQL
- no database changes
- no RLS policies
- no server actions

