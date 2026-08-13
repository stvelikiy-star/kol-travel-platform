-- KOL / Issyk-Kul Travel & Delivery Platform
-- Stage 11C demo seed draft.
-- Demo only. Do not apply to production without replacing auth user IDs and reviewing RLS.

-- Demo UUIDs are fixed for review readability.
-- In a real Supabase project, auth.users rows are created by Supabase Auth, not by this seed.
-- This fixed test seed adds FK-only auth.users rows so public profile/order demo rows can be inserted.

-- FIXED VERSION NOTES:
-- This test seed creates FK parent rows in auth.users before inserting public profiles.
-- These auth.users rows are for FK/demo seed integrity only and are not intended as real login credentials.
-- For real login testing, create Supabase Auth users manually and map profiles after reviewing the schema.

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@kol.demo', null, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Demo Admin","demo":true}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'client@kol.demo', null, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Demo Client","demo":true}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'partner@kol.demo', null, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Demo Partner","demo":true}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'courier@kol.demo', null, now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Demo Courier","demo":true}'::jsonb, now(), now())
on conflict (id) do nothing;
insert into public.user_profiles (id, user_id, full_name, phone, email, locale, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Demo Admin', '+996700000001', 'admin@kol.demo', 'ru', 'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Demo Client', '+996700000002', 'client@kol.demo', 'ru', 'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Demo Partner', '+996700000003', 'partner@kol.demo', 'ru', 'active'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Demo Courier', '+996700000004', 'courier@kol.demo', 'ru', 'active')
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role, scope_id, is_active)
select user_id, role, scope_id, is_active
from (values
  ('00000000-0000-0000-0000-000000000001'::uuid, 'super_admin'::text, null::uuid, true),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'client'::text, null::uuid, true),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'partner_owner'::text, '20000000-0000-0000-0000-000000000001'::uuid, true),
  ('00000000-0000-0000-0000-000000000004'::uuid, 'courier'::text, null::uuid, true)
) as seed_roles(user_id, role, scope_id, is_active)
where not exists (
  select 1 from public.user_roles existing
  where existing.user_id = seed_roles.user_id
    and existing.role = seed_roles.role
    and existing.scope_id is not distinct from seed_roles.scope_id
);

insert into public.client_profiles (user_id, default_address)
values ('00000000-0000-0000-0000-000000000002', 'Cholpon-Ata demo address')
on conflict (user_id) do nothing;

insert into public.partners (id, owner_user_id, type, title, slug, description, location, address, phone, status, business_status, rating)
values (
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000003',
  'restaurant',
  'Demo Lake Partner',
  'demo-lake-partner',
  'Demo partner for tours, food and shop examples.',
  'Cholpon-Ata',
  'Cholpon-Ata, Issyk-Kul',
  '+996700000003',
  'approved',
  'online',
  4.80
)
on conflict (slug) do nothing;

insert into public.partner_staff (business_id, user_id, role, is_active)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'partner_owner', true)
on conflict (business_id, user_id) do nothing;

insert into public.courier_profiles (user_id, vehicle_type, vehicle_number, working_zone, availability_status)
values ('00000000-0000-0000-0000-000000000004', 'car', 'DEMO-01', 'Cholpon-Ata', 'online')
on conflict (user_id) do nothing;

insert into public.admin_profiles (user_id, admin_level, department)
values ('00000000-0000-0000-0000-000000000001', 'super_admin', 'operations')
on conflict (user_id) do nothing;

insert into public.categories (id, scope, title, slug)
values
  ('30000000-0000-0000-0000-000000000001', 'tour', 'Boat tours', 'boat-tours'),
  ('30000000-0000-0000-0000-000000000002', 'food', 'National food', 'national-food'),
  ('30000000-0000-0000-0000-000000000003', 'shop', 'Vacation goods', 'vacation-goods')
on conflict (scope, slug) do nothing;

insert into public.tours (id, business_id, category_id, title, slug, description, location, price, duration, status)
values (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Demo boat trip',
  'demo-boat-trip',
  'Demo boat trip on Issyk-Kul.',
  'Cholpon-Ata',
  2500,
  '2 hours',
  'active'
)
on conflict (slug) do nothing;

insert into public.stays (id, business_id, title, slug, type, description, location, price_from, status)
values (
  '41000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Demo guest house',
  'demo-guest-house',
  'guest_house',
  'Demo stay near the lake.',
  'Bosteri',
  4500,
  'active'
)
on conflict (slug) do nothing;

insert into public.rooms (id, stay_id, business_id, title, capacity, price_per_night, status)
values (
  '42000000-0000-0000-0000-000000000001',
  '41000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Demo family room',
  4,
  5500,
  'active'
)
on conflict do nothing;

insert into public.restaurants (business_id, delivery_enabled, min_order_amount)
values ('20000000-0000-0000-0000-000000000001', true, 500)
on conflict (business_id) do nothing;

insert into public.menu_items (id, business_id, category_id, title, description, price, preparation_time_minutes, status)
values (
  '43000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  'Demo beshbarmak',
  'Demo national dish.',
  650,
  25,
  'active'
)
on conflict do nothing;

insert into public.shops (business_id, delivery_enabled)
values ('20000000-0000-0000-0000-000000000001', true)
on conflict (business_id) do nothing;

insert into public.products (id, business_id, category_id, title, description, price, stock_qty, status)
values (
  '44000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000003',
  'Demo charcoal',
  'Demo vacation product.',
  350,
  20,
  'active'
)
on conflict do nothing;

insert into public.orders (id, client_id, business_id, type, status, subtotal, delivery_fee, discount, total, payment_status)
values (
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'food',
  'new',
  650,
  150,
  0,
  800,
  'pending'
)
on conflict do nothing;

insert into public.order_items (order_id, item_type, item_id, title_snapshot, qty, unit_price, total)
select '50000000-0000-0000-0000-000000000001', 'menu_item', '43000000-0000-0000-0000-000000000001', 'Demo beshbarmak', 1, 650, 650
where not exists (
  select 1 from public.order_items
  where order_id = '50000000-0000-0000-0000-000000000001'
    and item_type = 'menu_item'
    and item_id = '43000000-0000-0000-0000-000000000001'
);

insert into public.bookings (id, client_id, business_id, booking_type, object_id, status, start_date, end_date, guests_count, total, payment_status)
values (
  '51000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'tour',
  '40000000-0000-0000-0000-000000000001',
  'pending',
  '2026-07-10',
  null,
  2,
  5000,
  'pending'
)
on conflict do nothing;

insert into public.deliveries (id, order_id, assigned_courier_id, status, pickup_address, dropoff_address, risk_level)
values (
  '52000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004',
  'courier_assigned',
  'Demo Lake Partner, Cholpon-Ata',
  'Cholpon-Ata demo client address',
  'low'
)
on conflict (order_id) do nothing;

insert into public.ai_dispatcher_events (id, source_type, source_id, event_type, risk_level, payload)
values (
  '53000000-0000-0000-0000-000000000001',
  'delivery',
  '52000000-0000-0000-0000-000000000001',
  'courier_assigned_demo',
  'low',
  '{"demo": true}'::jsonb
)
on conflict do nothing;

insert into public.ai_recommendations (event_id, recommended_action, human_approval_required, status)
select
  '53000000-0000-0000-0000-000000000001',
  'Monitor delivery status. No high-risk action required.',
  false,
  'new'
where not exists (
  select 1 from public.ai_recommendations
  where event_id = '53000000-0000-0000-0000-000000000001'
    and recommended_action = 'Monitor delivery status. No high-risk action required.'
);

insert into public.alcohol_module_settings (id, is_enabled, notes)
values (
  '54000000-0000-0000-0000-000000000001',
  false,
  'Alcohol module disabled by default. Legal compliance approval required before activation.'
)
on conflict do nothing;


