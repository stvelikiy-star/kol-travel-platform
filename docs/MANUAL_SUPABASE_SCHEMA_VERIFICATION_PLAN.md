# Stage 19-1 - Manual Supabase Schema Verification Plan

## Why This Stage Exists

Stage 18 found that the current schema already includes several catalog tables:

- `tours`
- `stays`
- `restaurants`
- `menu_items`
- `shops`
- `products`
- `categories`

Before creating any migration, the project must manually verify the actual Supabase TEST schema.

This stage exists to:

- avoid duplicate tables
- avoid breaking the working `/food` adapter
- verify actual columns before migration
- protect current read pilots
- confirm RLS and relationship assumptions
- keep `DATA_SOURCE_MODE=mock` as the safe fallback

This document is a plan only. Do not apply SQL changes in this stage.

## Scope

Tables to verify:

- `tours`
- `stays`
- `restaurants`
- `menu_items`
- `shops`
- `products`
- `categories`
- `partners`
- `orders`
- `audit_logs`
- `alcohol_module_settings`

All queries below are read-only inspection queries for the Supabase TEST project.

## Table Existence Queries

Check whether expected tables exist in the `public` schema:

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by table_name;
```

Count expected tables:

```sql
select
  count(*) as existing_expected_tables
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  );
```

## Column Inspection Queries

List columns for all verification tables:

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by table_name, ordinal_position;
```

Focused `menu_items` columns:

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'menu_items'
order by ordinal_position;
```

Focused public catalog columns:

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('tours', 'stays', 'products', 'categories')
order by table_name, ordinal_position;
```

## Constraint Inspection Queries

Inspect primary keys, foreign keys, unique constraints and check constraints:

```sql
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
  and tc.table_schema = ccu.table_schema
where tc.table_schema = 'public'
  and tc.table_name in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name;
```

Inspect check constraint definitions:

```sql
select
  conrelid::regclass::text as table_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where connamespace = 'public'::regnamespace
  and contype = 'c'
  and conrelid::regclass::text in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by table_name, constraint_name;
```

## Index Inspection Queries

Inspect indexes on catalog and operational tables:

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by tablename, indexname;
```

Focus on expected index coverage:

- `slug`
- `business_id`
- `category_id`
- `status`
- `created_at`

Manual review query for likely catalog indexes:

```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('tours', 'stays', 'menu_items', 'products', 'categories')
  and (
    indexdef ilike '%slug%'
    or indexdef ilike '%business_id%'
    or indexdef ilike '%category_id%'
    or indexdef ilike '%status%'
    or indexdef ilike '%created_at%'
  )
order by tablename, indexname;
```

## RLS Inspection Queries

Check whether row level security is enabled:

```sql
select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by tablename;
```

List policies on catalog tables:

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tours',
    'stays',
    'restaurants',
    'menu_items',
    'shops',
    'products',
    'categories',
    'partners',
    'orders',
    'audit_logs',
    'alcohol_module_settings'
  )
order by tablename, policyname;
```

Expected future public behavior:

- public reads only active public catalog items
- partner writes only own `business_id` records later
- admin moderation later
- service role remains server-side only

## Sample Row Queries

Run only in the Supabase TEST project:

```sql
select * from public.menu_items limit 5;
select * from public.tours limit 5;
select * from public.stays limit 5;
select * from public.restaurants limit 5;
select * from public.shops limit 5;
select * from public.products limit 5;
select * from public.categories limit 5;
```

Optional partner relationship checks:

```sql
select
  mi.id,
  mi.business_id,
  p.title as partner_title,
  mi.title,
  mi.status
from public.menu_items mi
left join public.partners p on p.id = mi.business_id
limit 10;
```

```sql
select
  t.id,
  t.business_id,
  p.title as partner_title,
  t.title,
  t.status
from public.tours t
left join public.partners p on p.id = t.business_id
limit 10;
```

## Alcohol Verification

Read-only verification:

```sql
select *
from public.alcohol_module_settings;
```

Expected:

- `is_enabled = false`
- no alcohol module activation
- no public catalog alcohol sales/delivery

If the table is missing, document it as schema uncertainty. Do not create it in this stage.

## Verification Checklist

Use this table while manually verifying the Supabase TEST project.

| Table | Exists / Missing | Current fields | Missing fields | Relationships | Safe for read adapter | Migration needed | Seed data exists | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `partners` | Unknown | Unknown | Unknown | Owns catalog via `business_id` | Unknown | Unknown | Unknown | Verify `id`, `type`, `title`, `slug`. |
| `categories` | Unknown | Unknown | Unknown | Used by catalog category joins | Unknown | Unknown | Unknown | Verify `scope` or future domain strategy. |
| `menu_items` | Unknown | Unknown | `slug`, `currency`, `image_url`, `is_available`, `is_featured`, SEO likely missing | `business_id -> partners.id`, `category_id -> categories.id` | Unknown | Likely alignment needed | Unknown | Protect `/food` adapter. |
| `tours` | Unknown | Unknown | Public UI fields may differ | `business_id -> partners.id` | Unknown | Unknown | Unknown | Verify price/duration shape. |
| `stays` | Unknown | Unknown | Capacity/amenities/image/SEO may differ | `business_id -> partners.id` | Unknown | Unknown | Unknown | Verify room relationship later. |
| `restaurants` | Unknown | Unknown | Profile fields may differ | `business_id -> partners.id` | Unknown | Unknown | Unknown | Verify food partner profile shape. |
| `shops` | Unknown | Unknown | Profile fields may differ | `business_id -> partners.id` | Unknown | Unknown | Unknown | Verify shop partner profile shape. |
| `products` | Unknown | Unknown | `slug`, `currency`, `stock_status`, image, SEO likely missing | `business_id -> partners.id`, `category_id -> categories.id` | Unknown | Unknown | Unknown | Verify no alcohol products. |
| `orders` | Unknown | Unknown | N/A | `business_id` operational relation | N/A | N/A | Unknown | Read-only reference only. |
| `audit_logs` | Unknown | Unknown | N/A | Audit evidence | N/A | N/A | Unknown | Must not be inserted by read pages. |
| `alcohol_module_settings` | Unknown | Unknown | N/A | Compliance setting | N/A | N/A | Unknown | Must remain disabled. |

## Special /food Protection

Before changing `menu_items`, confirm the current `/food` adapter dependencies:

- table: `public.menu_items`
- selected columns:
  - `id`
  - `business_id`
  - `title`
  - `description`
  - `price`
  - `status`
- joins:
  - `categories(title)`
  - `partners(title,slug)`
- filter:
  - `status = active`
- ordering:
  - `created_at.desc`

Do not rename, drop or change these columns/relationships without a migration plan and adapter update.

Keep:

- `getPublicFoodReadResult()`
- mock fallback
- safe error codes
- `DATA_SOURCE_MODE=mock` rollback

## No-Write Guarantee

This stage is docs only:

- no SQL is applied
- no database changes are made
- no schema files are modified
- no adapters are implemented
- no UI is wired
- no writes are added
- no payments/bookings/carts/checkout changes are added

All SQL in this document is read-only inspection SQL.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`
- do not enable alcohol
- do not create alcohol categories/items
- do not touch alcohol settings except read-only verification
- partner, courier, admin and client roles cannot enable alcohol
- AI cannot enable alcohol
- future activation requires legal review, licensing, partner verification and `super_admin` approval

## Next Stages

Recommended Stage 19 sequence:

1. 19-2 Manual Supabase Table Verification Results Template
2. 19-3 Catalog Migration Decision Matrix
3. 19-4 Minimal Safe Migration Plan
4. 19-5 Stage 19 Final Audit

Do not create migrations until manual verification results are captured.
