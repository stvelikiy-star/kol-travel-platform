-- DRAFT ONLY - NOT APPLIED.
-- DO NOT RUN IN PRODUCTION.
-- FOR REVIEW ONLY.
-- APPLY ONLY AFTER MANUAL APPROVAL AND BACKUP.
--
-- Minimal additive catalog fields for existing public catalog tables.
-- Protects the current /food adapter that reads public.menu_items.
-- Creates no base tables, enables no application writes, and does not touch
-- alcohol_module_settings. RLS policy work is intentionally separate.

alter table public.menu_items
  add column if not exists slug text,
  add column if not exists currency text default 'KGS',
  add column if not exists image_url text,
  add column if not exists is_available boolean default true,
  add column if not exists is_featured boolean default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.products
  add column if not exists slug text,
  add column if not exists currency text default 'KGS',
  add column if not exists image_url text,
  add column if not exists is_featured boolean default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.tours
  add column if not exists image_url text,
  add column if not exists is_featured boolean default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.stays
  add column if not exists image_url text,
  add column if not exists capacity integer,
  add column if not exists amenities jsonb default '{}'::jsonb,
  add column if not exists is_featured boolean default false,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.categories
  add column if not exists is_active boolean default true;

create index if not exists idx_menu_items_slug on public.menu_items(slug);
create index if not exists idx_menu_items_business_id on public.menu_items(business_id);
create index if not exists idx_menu_items_category_id on public.menu_items(category_id);
create index if not exists idx_menu_items_status on public.menu_items(status);
create index if not exists idx_menu_items_is_available on public.menu_items(is_available);
create index if not exists idx_menu_items_is_featured on public.menu_items(is_featured);

create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_business_id on public.products(business_id);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_status on public.products(status);

create index if not exists idx_tours_slug on public.tours(slug);
create index if not exists idx_tours_status on public.tours(status);
create index if not exists idx_tours_is_featured on public.tours(is_featured);

create index if not exists idx_stays_slug on public.stays(slug);
create index if not exists idx_stays_status on public.stays(status);
create index if not exists idx_stays_is_featured on public.stays(is_featured);

create index if not exists idx_categories_scope on public.categories(scope);
create index if not exists idx_categories_slug on public.categories(slug);
create index if not exists idx_categories_is_active on public.categories(is_active);

comment on table public.menu_items is 'Public food catalog table. Stage 21 draft adds optional public catalog fields while preserving the current /food read adapter.';
comment on table public.products is 'Public shop product table. Stage 21 draft adds optional public catalog fields without enabling cart or checkout behavior.';
comment on table public.tours is 'Public tours table. Stage 21 draft adds optional image, featured and SEO fields.';
comment on table public.stays is 'Public stays table. Stage 21 draft adds optional image, capacity, amenities, featured and SEO fields.';
comment on table public.categories is 'Shared catalog category table. Stage 21 draft optionally adds is_active for public taxonomy visibility.';

comment on column public.menu_items.slug is 'Optional public URL slug for future food detail reads.';
comment on column public.menu_items.currency is 'Display currency for public food price reads. Default KGS.';
comment on column public.menu_items.image_url is 'Optional public food card image URL.';
comment on column public.menu_items.is_available is 'Optional public availability flag for menu items.';
comment on column public.menu_items.is_featured is 'Optional featured flag for public food catalog sections.';
comment on column public.menu_items.seo_title is 'Optional SEO title for future food detail pages.';
comment on column public.menu_items.seo_description is 'Optional SEO description for future food detail pages.';

comment on column public.products.slug is 'Optional public URL slug for future product detail reads.';
comment on column public.products.currency is 'Display currency for public product price reads. Default KGS.';
comment on column public.products.image_url is 'Optional public product card image URL.';
comment on column public.products.is_featured is 'Optional featured flag for public shop sections.';
comment on column public.products.seo_title is 'Optional SEO title for future product detail pages.';
comment on column public.products.seo_description is 'Optional SEO description for future product detail pages.';

comment on column public.tours.image_url is 'Optional public tour card image URL.';
comment on column public.tours.is_featured is 'Optional featured flag for public tour sections.';
comment on column public.tours.seo_title is 'Optional SEO title for future tour detail pages.';
comment on column public.tours.seo_description is 'Optional SEO description for future tour detail pages.';

comment on column public.stays.image_url is 'Optional public stay card image URL.';
comment on column public.stays.capacity is 'Optional public stay guest capacity.';
comment on column public.stays.amenities is 'Optional public stay amenities JSON.';
comment on column public.stays.is_featured is 'Optional featured flag for public stay sections.';
comment on column public.stays.seo_title is 'Optional SEO title for future stay detail pages.';
comment on column public.stays.seo_description is 'Optional SEO description for future stay detail pages.';

comment on column public.categories.is_active is 'Optional active flag for public catalog category visibility.';
