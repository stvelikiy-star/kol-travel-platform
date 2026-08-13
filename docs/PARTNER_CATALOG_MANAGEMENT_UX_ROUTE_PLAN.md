# Stage 28-2 — Partner Catalog Management UX/Route Plan

Project: KOL / Issyk-Kul Travel & Delivery Platform.

## Purpose

Plan Partner catalog management UX before implementation.

This defines route structure, list/detail/create/edit flows, safe draft/review workflow, validation expectations, and ownership rules while protecting the current public read pilot.

No UI, routes, forms, actions, writes, SQL, or schema changes are implemented in this stage.

## Partner Route Map

Future routes:

- `/partner/catalog` — overview
- `/partner/catalog/food` — `menu_items`
- `/partner/catalog/food/new`
- `/partner/catalog/food/[id]/edit`
- `/partner/catalog/tours` — `tours`
- `/partner/catalog/tours/new`
- `/partner/catalog/tours/[id]/edit`
- `/partner/catalog/stays` — `stays`
- `/partner/catalog/stays/new`
- `/partner/catalog/stays/[id]/edit`
- `/partner/catalog/products` — `products`
- `/partner/catalog/products/new`
- `/partner/catalog/products/[id]/edit`

## Partner Overview Page

Should show:

- business identity
- catalog domains
- item counts by status
- drafts
- under review
- published/active
- rejected
- archived
- warnings/safety issues
- CTA to create draft

## List Page UX

For each domain, show:

- table/cards list
- title
- category
- price
- status
- last updated
- public visibility
- moderation status
- actions:
  - view
  - edit draft
  - duplicate to draft
  - submit for review
  - archive

## Create/Edit Form Planning

Common fields:

- title
- description
- `category_id`
- price / `price_from`
- currency
- `image_url` or image upload later
- status
- metadata
- SEO fields later if migration is applied

Food / `menu_items`:

- `preparation_time_minutes`
- `is_available` later
- spicy/diet tags later in metadata

Tours:

- location
- duration
- price
- `category_id`

Stays:

- location
- type
- `price_from`
- capacity later
- amenities later

Products:

- `stock_qty`
- price
- `category_id`
- currency later
- `image_url` later

## Status Flow

Partner can:

- save draft
- edit own draft
- submit for review
- archive own draft/active item if allowed

Partner cannot:

- publish directly
- approve own content
- edit another business item
- create alcohol items
- change alcohol settings
- create cart/order/payment/booking from catalog management

## Validation Plan

Plan validations:

- required title
- positive price
- valid category
- safe status transition
- `business_id` ownership
- alcohol/product safety check for products
- no secret/env exposure

## Ownership Rules

All future partner catalog actions must verify:

- authenticated user
- partner profile exists
- `business_id` belongs to partner
- `item.business_id` matches partner `business_id`

## Empty/Error States

Plan:

- no catalog items yet
- no permission
- business profile missing
- Supabase read error
- validation error
- moderation rejected

## Audit Events

Future partner actions should audit:

- `create_draft`
- `update_draft`
- `submit_for_review`
- `archive_item`
- `duplicate_item`
- `safety_rejected`

## Alcohol Safety

- `ALCOHOL_MODULE_ENABLED=false`
- partner cannot create alcohol items/products/categories
- product title/description/category metadata must be checked
- uncertain alcohol-like products should be blocked or routed to admin review
- no alcohol sales/delivery path

## No-Write Guarantee

This stage is docs only:

- no UI
- no routes
- no forms
- no actions
- no SQL
- no database changes

