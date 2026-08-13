# Stage 20-1 - Manual Supabase Table Verification Results

## Verification Status

- Verification date/time: manually verified before Stage 20-1
- Supabase project: TEST project
- Verifier: manual Supabase SQL verification
- `DATA_SOURCE_MODE`: keep `mock` as default unless explicitly testing read pilots
- Expected `ALCOHOL_MODULE_ENABLED`: `false`
- Final status: verified for migration planning

No SQL writes, schema changes, migrations, adapter changes, UI wiring, payment/cart/checkout/booking changes or alcohol-module activation were performed during verification.

## Table Existence Matrix

| Table | Exists yes/no | Row count | Has seed data yes/no | Notes |
| --- | --- | ---: | --- | --- |
| `partners` | Yes | 1 | Yes | Business source table exists. |
| `categories` | Yes | 3 | Yes | Existing taxonomy uses `scope`. Do not create duplicate `catalog_categories`. |
| `tours` | Yes | 1 | Yes | Existing public catalog table. |
| `stays` | Yes | 1 | Yes | Existing public catalog table. |
| `restaurants` | Yes | 1 | Yes | Food partner profile table exists. |
| `menu_items` | Yes | 1 | Yes | Current `/food` adapter source. |
| `shops` | Yes | 1 | Yes | Shop partner profile table exists. |
| `products` | Yes | 1 | Yes | Existing shop/product catalog table. |
| `orders` | Yes | Not provided | Yes | Operational table exists; uses `business_id`. |
| `audit_logs` | Yes | Not provided | Not provided | Audit table exists. |
| `alcohol_module_settings` | Yes | Not provided | Yes | `is_enabled=false`. |

## Confirmed Foreign Keys

| Relationship | Confirmed |
| --- | --- |
| `categories.parent_id -> categories.id` | Yes |
| `menu_items.business_id -> partners.id` | Yes |
| `menu_items.category_id -> categories.id` | Yes |
| `orders.business_id -> partners.id` | Yes |
| `products.business_id -> partners.id` | Yes |
| `products.category_id -> categories.id` | Yes |
| `restaurants.business_id -> partners.id` | Yes |
| `shops.business_id -> partners.id` | Yes |
| `stays.business_id -> partners.id` | Yes |
| `stays.category_id -> categories.id` | Yes |
| `tours.business_id -> partners.id` | Yes |
| `tours.category_id -> categories.id` | Yes |

Ownership conclusion:

- Use `business_id = partners.id`.
- Do not introduce `partner_id`.

## Column Verification - categories

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `scope` | text | No | Not provided | Yes | Existing domain-like field. |
| `title` | text | No | Not provided | Yes | Used by joins. |
| `slug` | text | No | Not provided | Yes | Existing slug support. |
| `parent_id` | uuid | Yes | Not provided | Yes | Self-FK confirmed. |
| `sort_order` | integer | No | Not provided | Yes | Existing sort support. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |

Category decision:

- Keep existing `categories`.
- Do not create `catalog_categories`.

## Column Verification - partners

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Business owner/source id. |
| `owner_user_id` | uuid | Yes | Not provided | Yes | Owner relation. |
| `type` | text | No | Not provided | Yes | Partner domain/type. |
| `title` | text | No | Not provided | Yes | Used by joins. |
| `slug` | text | No | Not provided | Yes | Used by joins. |
| `description` | text | Yes | Not provided | Yes | Public copy. |
| `location` | text | Yes | Not provided | Yes | Public location. |
| `address` | text | Yes | Not provided | Yes | Public/address field. |
| `phone` | text | Yes | Not provided | Yes | Must be handled carefully in public reads. |
| `email` | text | Yes | Not provided | Yes | Must be handled carefully in public reads. |
| `status` | text | No | Not provided | Yes | Moderation/active state. |
| `business_status` | text | No | Not provided | Yes | Operational state. |
| `rating` | numeric | No | Not provided | Yes | Public display candidate. |
| `metadata` | jsonb | No | Not provided | Yes | Present. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |

## Column Verification - menu_items

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `business_id` | uuid | No | Not provided | Yes | FK to `partners.id`. |
| `category_id` | uuid | Yes | Not provided | Yes | FK to `categories.id`. |
| `title` | text | No | Not provided | Yes | Used by `/food`. |
| `description` | text | Yes | Not provided | Yes | Used by `/food`. |
| `price` | numeric | No | Not provided | Yes | Used by `/food`. |
| `preparation_time_minutes` | integer | Yes | Not provided | Yes | Food-specific field. |
| `status` | text | No | Not provided | Yes | `/food` filters `active`. |
| `metadata` | jsonb | No | Not provided | Yes | Present. |
| `created_at` | timestamptz | No | Not provided | Yes | `/food` orders by this. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |
| `slug` | - | - | - | No | Candidate additive field. |
| `currency` | - | - | - | No | Candidate additive field. |
| `image_url` | - | - | - | No | Candidate additive field. |
| `is_available` | - | - | - | No | Candidate additive field. |
| `is_featured` | - | - | - | No | Candidate additive field. |
| `seo_title` | - | - | - | No | Candidate additive field. |
| `seo_description` | - | - | - | No | Candidate additive field. |

## Column Verification - products

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `business_id` | uuid | No | Not provided | Yes | FK to `partners.id`. |
| `category_id` | uuid | Yes | Not provided | Yes | FK to `categories.id`. |
| `title` | text | No | Not provided | Yes | Product title. |
| `description` | text | Yes | Not provided | Yes | Product copy. |
| `price` | numeric | No | Not provided | Yes | Product price. |
| `stock_qty` | integer | Yes | Not provided | Yes | Existing stock field. |
| `status` | text | No | Not provided | Yes | Public filtering candidate. |
| `metadata` | jsonb | No | Not provided | Yes | Present. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |
| `slug` | - | - | - | No | Candidate additive field. |
| `currency` | - | - | - | No | Candidate additive field. |
| `image_url` | - | - | - | No | Candidate additive field. |
| `is_featured` | - | - | - | No | Candidate additive field. |
| `seo_title` | - | - | - | No | Candidate additive field. |
| `seo_description` | - | - | - | No | Candidate additive field. |

## Column Verification - restaurants

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `business_id` | uuid | No | Not provided | Yes | FK to `partners.id`. |
| `delivery_enabled` | boolean | No | Not provided | Yes | Public/ops setting. |
| `working_hours` | jsonb | No | Not provided | Yes | Public/ops setting. |
| `min_order_amount` | numeric | No | Not provided | Yes | Public/ops setting. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |

## Column Verification - shops

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `business_id` | uuid | No | Not provided | Yes | FK to `partners.id`. |
| `delivery_enabled` | boolean | No | Not provided | Yes | Public/ops setting. |
| `working_hours` | jsonb | No | Not provided | Yes | Public/ops setting. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |

## Column Verification - stays

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `business_id` | uuid | No | Not provided | Yes | FK to `partners.id`. |
| `category_id` | uuid | Yes | Not provided | Yes | FK to `categories.id`. |
| `title` | text | No | Not provided | Yes | Public title. |
| `slug` | text | No | Not provided | Yes | Public route candidate. |
| `type` | text | Yes | Not provided | Yes | Accommodation type. |
| `description` | text | Yes | Not provided | Yes | Public copy. |
| `location` | text | Yes | Not provided | Yes | Public location. |
| `price_from` | numeric | No | Not provided | Yes | Public price. |
| `currency` | text | No | Not provided | Yes | Present. |
| `status` | text | No | Not provided | Yes | Public filtering candidate. |
| `metadata` | jsonb | No | Not provided | Yes | Present. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |
| `image_url` | - | - | - | No | Candidate additive field. |
| `capacity` | - | - | - | No | Candidate additive field. |
| `amenities` | - | - | - | No | Candidate additive field. |
| `is_featured` | - | - | - | No | Candidate additive field. |
| `seo_title` | - | - | - | No | Candidate additive field. |
| `seo_description` | - | - | - | No | Candidate additive field. |

## Column Verification - tours

| column_name | data_type | nullable | default | present yes/no | notes |
| --- | --- | --- | --- | --- | --- |
| `id` | uuid | No | Not provided | Yes | Primary key. |
| `business_id` | uuid | No | Not provided | Yes | FK to `partners.id`. |
| `category_id` | uuid | Yes | Not provided | Yes | FK to `categories.id`. |
| `title` | text | No | Not provided | Yes | Public title. |
| `slug` | text | No | Not provided | Yes | Public route candidate. |
| `description` | text | Yes | Not provided | Yes | Public copy. |
| `location` | text | Yes | Not provided | Yes | Public location. |
| `price` | numeric | No | Not provided | Yes | Public price. |
| `currency` | text | No | Not provided | Yes | Present. |
| `duration` | text | Yes | Not provided | Yes | Duration field. |
| `status` | text | No | Not provided | Yes | Public filtering candidate. |
| `metadata` | jsonb | No | Not provided | Yes | Present. |
| `created_at` | timestamptz | No | Not provided | Yes | Present. |
| `updated_at` | timestamptz | No | Not provided | Yes | Present. |
| `image_url` | - | - | - | No | Candidate additive field. |
| `is_featured` | - | - | - | No | Candidate additive field. |
| `seo_title` | - | - | - | No | Candidate additive field. |
| `seo_description` | - | - | - | No | Candidate additive field. |

## Food Adapter Protection

| Check | Result | Notes |
| --- | --- | --- |
| Current `/food` adapter columns verified | Yes | Uses `id`, `business_id`, `title`, `description`, `price`, `status`. |
| `categories(title)` join verified | Confirmed by schema/FK relationship | Must still be verified in app TEST mode when needed. |
| `partners(title, slug)` join verified | Confirmed by schema/FK relationship | Must still be verified in app TEST mode when needed. |
| `status = active` filter still valid | Yes | Current adapter depends on it. |
| `created_at.desc` ordering still valid | Yes | `created_at` exists. |
| Any column rename/drop risk | No planned rename/drop | Future migration must be additive only. |
| Safe to keep `/food` adapter unchanged | Yes | No base-table migration needed. |
| Mock fallback verified | Existing code path | `getPublicFoodReadResult()` keeps fallback. |

## Alcohol Verification

| Check | Result | Notes |
| --- | --- | --- |
| `alcohol_module_settings` exists | Yes | Confirmed. |
| `is_enabled=false` | Yes | Confirmed. |
| Alcohol categories present | No reported | Must remain absent. |
| Alcohol products/items present | No reported | Must remain absent. |
| Alcohol module activation | No | Module remains disabled. |
| Alcohol settings changed during verification | No | Read-only verification only. |

## Migration Readiness

| Domain | Decision | Blockers | Notes |
| --- | --- | --- | --- |
| Food | Minimal alignment migration needed later | Additive fields missing | Do not create base table. Protect `/food`. |
| Tours | Minimal additive migration likely later | Images/featured/SEO missing | Existing `tours` table is usable as base. |
| Stays | Minimal additive migration likely later | Images/capacity/amenities/featured/SEO missing | Existing `stays` table is usable as base. |
| Shop | Minimal additive migration likely later | Slug/currency/image/featured/SEO missing | Existing `products` table is usable as base. |
| Categories | No base migration needed | May need future `is_active` only if required | Keep existing `categories` with `scope`. |

## Final Decision

- Safe to proceed to migration planning: Yes, for minimal additive migration planning only.
- Safe to keep `/food` adapter unchanged: Yes.
- Safe to expand next public read adapter: Yes, after adapter-specific QA and mock fallback.
- Blockers: no SQL migration should be created until an exact additive field list is reviewed.
- Recommended next stage: minimal additive migration planning, not base table creation.

## No-Write And Compliance Confirmation

- No SQL writes were run.
- No schema was modified.
- No seed data was applied.
- No adapters were implemented.
- No UI was wired.
- No payment, booking, cart or checkout logic was added.
- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol module was not enabled.
