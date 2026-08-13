# Stage 17-2 - Public Catalog Schema/Data Availability Audit

## Summary

Audited local public catalog pages, current data layer, mock data, Supabase read adapter assumptions and SQL schema files.

No UI wiring, database schema edits, mock data removals, writes, cart/checkout/booking/payment logic or alcohol module changes were made.

## Inspected Files

Public pages:

- `src/app/tours/page.tsx`
- `src/app/tours/[slug]/page.tsx`
- `src/app/stays/page.tsx`
- `src/app/stays/[slug]/page.tsx`
- `src/app/food/page.tsx`
- `src/app/food/[restaurantSlug]/page.tsx`
- `src/app/shop/page.tsx`
- `src/app/shop/[shopSlug]/page.tsx`

Data layer:

- `src/lib/data/catalog.ts`
- `src/lib/data/partners.ts`
- `src/lib/data/mock-data-source.ts`
- `src/lib/data/supabase-read-adapter.ts`

Mock/static data:

- `src/data/mockTours.ts`
- `src/data/mockStays.ts`
- `src/data/mockFood.ts`
- `src/data/mockProducts.ts`
- `src/data/mockPartners.ts`

Schema/seed:

- `supabase/schema/001_initial_schema.sql`
- `supabase/schema/003_seed_demo_data_draft_FIXED.sql`

## Current Public Data Sources

`/tours`:

- reads through `getTours()` from `src/lib/data/catalog.ts`
- mock fallback comes from `getMockTours()`
- detail page reads by id/slug through `getTourById()`

`/stays`:

- reads through `getStays()` from `src/lib/data/catalog.ts`
- mock fallback comes from `getMockStays()`
- detail page reads by id/slug through `getStayById()`

`/food`:

- reads through `getFood()` from `src/lib/data/catalog.ts`
- mock fallback comes from `getMockFood()`
- partner names/slugs are resolved through `getPartnerById()`
- detail page uses the restaurant/partner slug route

`/shop`:

- reads through `getProducts()` from `src/lib/data/catalog.ts`
- mock fallback comes from `getMockProducts()`
- detail page uses shop slug route

Current `src/lib/data/supabase-read-adapter.ts` has safe placeholder functions for tours, stays, food/menu items and products, but those functions currently return safe empty arrays/nulls until real query refinement.

## Current Data Shapes

Tours:

- id
- businessId
- category
- slug
- title
- description
- location
- price
- currency
- duration
- rating
- image
- status

Stays:

- id
- businessId
- slug
- title
- type
- description
- location
- priceFrom
- currency
- rating
- image
- status

Food:

- id
- businessId
- category
- title
- description
- price
- currency
- status

Products:

- id
- businessId
- category
- title
- description
- price
- currency
- status

Partners:

- id
- ownerUserId
- type
- title
- slug
- description
- location/address/contact/status fields in schema/mock as available

## Available Supabase Tables

Confirmed in `001_initial_schema.sql`:

- `user_profiles`
- `user_roles`
- `client_profiles`
- `partners`
- `partner_profiles`
- `courier_profiles`
- `admin_profiles`
- `partner_staff`
- `categories`
- `tours`
- `stays`
- `rooms`
- `restaurants`
- `menu_items`
- `shops`
- `products`
- `media_files`
- `orders`
- `order_items`
- `order_status_history`
- `payments`
- `order_payments`
- `bookings`
- `booking_guests`
- `booking_status_history`
- `room_availability`
- `tour_schedules`
- `deliveries`
- `order_delivery`
- `delivery_status_history`
- `courier_assignments`
- `courier_shifts`
- `courier_locations`
- `delivery_issues`
- `payouts`
- `commissions`
- `refunds`
- `transactions`
- `support_tickets`
- `ticket_messages`
- `reviews`
- `notifications`
- `audit_logs`
- `promo_codes`
- `promo_usage`
- `loyalty_accounts`
- `loyalty_transactions`
- `favorites`
- `ai_dispatcher_events`
- `ai_recommendations`
- `ai_alerts`
- `ai_decision_logs`
- `alcohol_module_settings`
- `compliance_reviews`

## Seed Data Availability

Confirmed in `003_seed_demo_data_draft_FIXED.sql`:

- demo partner
- categories for tour/food/product scopes
- demo tour
- demo stay
- demo room
- restaurant row
- active demo menu item
- shop row
- active demo product
- demo order/order item
- demo booking
- demo delivery
- AI demo records
- `alcohol_module_settings` with disabled state

## Missing Or Risky Public Catalog Pieces

Not blockers for the first pilot, but still relevant:

- full image/media mapping is not yet wired to public cards
- public detail slug mapping from Supabase needs separate validation
- food page currently expects partner lookup by business id through app data layer
- partner title/slug joins depend on Supabase/PostgREST relationship metadata and RLS
- alcohol category must remain absent/disabled

## Recommended First Pilot

Selected first pilot:

- `/food`

Reason:

- `menu_items` table exists
- `restaurants` table exists
- `partners` table exists and can provide partner title/slug
- seed data includes one active demo menu item
- current `/food` page data shape is simpler than tours/stays because `FoodItem` requires fewer fields
- mock fallback is straightforward

## Blockers

No schema-level blocker for a safe `/food` read adapter.

Blockers before UI wiring:

- adapter must remain read-only
- adapter must handle table missing/read failed/empty safely
- manual Supabase QA must verify `menu_items`, `categories`, `partners` joins
- public UI must fallback to mock if relationships fail

## Safe Fallback Strategy

- `DATA_SOURCE_MODE=mock`: return existing mock catalog data
- `DATA_SOURCE_MODE=supabase`: call selected pilot adapter only
- Supabase failure/table missing/empty: fallback to mock data with safe code/message
- public UI must not show raw SQL/Supabase/env errors

## No-Write Confirmation

Stage 17 remains read-only:

- no orders created
- no bookings created
- no cart writes
- no payments
- no audit inserts
- no alcohol changes

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- public catalog read mode must not show alcohol category
- food/shop must not enable alcohol sales or delivery
- no reads/writes should touch `alcohol_module_settings`

## Next Recommended Stage

Proceed to Stage 17-3 with a `/food` public catalog read adapter using `public.menu_items` plus safe fallback to `getMockFood()`.
