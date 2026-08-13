# Stage 18-3 - Public Catalog Seed Data Plan

## Seed Goal

Plan safe demo seed data for future public catalog Supabase read pilots.

Seed data should:

- provide realistic Issyk-Kul demo content
- support public catalog read pilots for tours, stays, food and shop
- remain safe, non-sensitive and demo-only
- avoid real private data
- avoid production/customer data
- exclude alcohol categories, alcohol products and alcohol delivery

This stage is documentation only. It does not create seed SQL files, apply data, modify schema, implement adapters, wire UI, add writes or enable the alcohol module.

## Seed Domains

Future seed data should cover:

- tours
- stays
- food / `menu_items`
- shop products
- categories
- images

## Partner Linkage

Use existing demo partner/business where available:

- `business_id = 20000000-0000-0000-0000-000000000001`

If more demo partners are required later, propose fixed UUIDs in the future seed SQL plan. Do not create them in this stage.

All business-owned catalog rows should use:

- `business_id = partners.id`

Do not introduce `partner_id` for catalog seed records.

## Demo Categories

Tours:

- Lake tours
- Mountains
- Culture
- Family

Stays:

- Hotels
- Guest houses
- Cottages
- Premium stays

Food:

- Kyrgyz cuisine
- Fast food
- Breakfast
- Drinks non-alcohol only

Shop:

- Beach goods
- Local products
- Souvenirs
- Travel essentials

No alcohol category should be created.

## Food / menu_items Seed

Because `/food` already reads `menu_items`, food seed data should be prepared first.

Plan 8-12 demo menu items:

- Beshbarmak set
- Ashlyan-fu bowl
- Manty with beef
- Lagman
- Oromo plate
- Lake breakfast set
- Samsa
- Fresh berry kompot
- Ayran
- Mountain herb tea

Recommended fields:

- `id uuid`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `price`
- `currency = KGS`
- `image_url`
- `is_available = true`
- `is_featured`
- `status = active`
- `metadata`
- `seo_title` if available
- `seo_description` if available

Rules:

- no alcohol drinks
- only non-alcohol drinks
- no restricted goods
- no real restaurant private data

## Tours Seed

Plan 6-8 demo tours:

- Issyk-Kul lake boat tour
- Jeti-Oguz day trip
- Grigorievka gorge picnic
- Karakol city tour
- Eagle hunting show
- Family picnic tour
- Hot springs route
- Sunrise lakeside photo tour

Recommended seed fields:

- `id`
- `business_id` nullable or linked to tour partner
- `category_id`
- `title`
- `slug`
- `short_description`
- `description`
- `location`
- `duration_label`
- `price_from`
- `currency = KGS`
- `included`
- `excluded`
- `difficulty`
- `season`
- `is_featured`
- `status = active`
- `metadata`
- `seo_title`
- `seo_description`

## Stays Seed

Plan 6-8 demo stays:

- Cholpon-Ata guest house
- Tamchy lakeside cottage
- Bosteri family hotel
- Sary-Oi premium villa
- Karakol mountain eco lodge
- Lakeside yurt camp
- Quiet family apartment
- Weekend cabin near the shore

Recommended seed fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `short_description`
- `description`
- `location`
- `address`
- `capacity`
- `bedrooms`
- `beds`
- `amenities`
- `price_from`
- `currency = KGS`
- `check_in_time`
- `check_out_time`
- `is_featured`
- `status = active`
- `metadata`
- `seo_title`
- `seo_description`

## Shop Products Seed

Plan 8-12 demo products:

- Beach towel
- Sunscreen
- Reusable water bottle
- Local honey
- Felt souvenir
- Travel bag
- Lake map postcard set
- Picnic blanket
- Thermal cup
- Handmade soap
- Kids swim goggles
- Portable phone pouch

Recommended seed fields:

- `id`
- `business_id`
- `category_id`
- `title`
- `slug`
- `description`
- `price`
- `currency = KGS`
- `stock_status`
- `stock_quantity` optional
- `image_url`
- `is_featured`
- `status = active`
- `metadata`
- `seo_title`
- `seo_description`

Rules:

- no alcohol
- no restricted goods
- no medical claims
- no real supplier private data

## Images

Image seed strategy:

- prefer existing project image paths if available
- otherwise use documented placeholder paths
- do not hotlink random external images
- include useful `alt` text
- use cover images consistently
- keep image rows clearly demo-owned

Possible placeholder path style:

- `/images/catalog/demo-food-beshbarmak.jpg`
- `/images/catalog/demo-tour-lake-boat.jpg`
- `/images/catalog/demo-stay-lakeside-cottage.jpg`
- `/images/catalog/demo-shop-beach-towel.jpg`

If actual files do not exist, seed SQL should either use existing assets or safe placeholder URLs already supported by the app.

## Status Rules

Default public demo records:

- `status = active`

Optional later QA records:

- one `draft` item per domain
- one `hidden` item per domain

Those non-active records must never appear publicly. They are useful only for RLS/public filtering QA.

## SEO Seed Fields

Where schema supports SEO fields, seed:

- `seo_title`
- `seo_description`

SEO text should be short, realistic and clearly demo-safe.

## Demo Data Quality Checklist

Seed data must not include:

- real phone numbers
- real personal addresses
- real client private information
- real payment data
- real credentials
- alcohol products
- alcohol categories
- alcohol delivery promises
- restricted goods

Seed data should include:

- stable UUIDs
- stable slugs
- realistic KGS prices
- `status = active`
- clear demo descriptions
- partner/business linkage through `business_id`

## No-Write Guarantee

This stage creates documentation only:

- no seed SQL is created
- no database changes are applied
- no adapters are modified
- no UI is wired
- no orders/bookings/cart/checkout/payment writes are added
- no audit logs are inserted

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- no alcohol category
- no alcohol product/menu item
- no alcohol delivery
- only non-alcohol drinks in food/menu seed
- `alcohol_module_settings` is not touched
- client, partner, courier and admin roles cannot enable alcohol
- AI cannot enable alcohol

Any future alcohol activation requires legal review, licensing, partner verification and `super_admin` approval.

## Rollback

This stage is docs-only:

- no DB rollback needed
- no schema rollback needed
- no seed rollback needed
- mock fallback remains active

Rollback is limited to reverting this document and README status if needed.

## Blockers And Risks

- Existing schema/table names must be confirmed before seed SQL is created.
- `menu_items` shape must be aligned before food seed expands.
- Image paths should be verified before SQL insertion.
- Public filtering must exclude non-active records.
- Alcohol-like product naming must be avoided.

## Recommended Next Stage

Proceed to Stage 18-4 - Food Schema Alignment Audit.
