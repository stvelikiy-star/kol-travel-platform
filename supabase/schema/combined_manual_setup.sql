-- Combined manual setup for KOL Supabase TEST project only.
-- Prefer running 001, 002 and 003 separately. If any section fails, stop.

-- SECTION 001 INITIAL SCHEMA
-- Source: supabase/schema/001_initial_schema.sql

-- KOL / Issyk-Kul Travel & Delivery Platform
-- Stage 11C draft schema for Supabase/PostgreSQL.
-- Do not run in production without review, RLS testing and migration planning.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Users and roles -----------------------------------------------------------

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  avatar_url text,
  locale text not null default 'ru',
  preferred_contact text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  scope_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role, scope_id)
);

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  default_address text,
  loyalty_account_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  type text not null,
  title text not null,
  slug text not null unique,
  description text,
  location text,
  address text,
  phone text,
  email text,
  status text not null default 'pending',
  business_status text not null default 'offline',
  rating numeric(3,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.partners is 'Partner businesses. Partners must see only their own business data.';

create table if not exists public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.partners(id) on delete cascade,
  position text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create table if not exists public.courier_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  vehicle_type text,
  vehicle_number text,
  working_zone text,
  availability_status text not null default 'offline',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  admin_level text not null default 'support_admin',
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Marketplace ---------------------------------------------------------------

create table if not exists public.partner_staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'partner_staff',
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  title text not null,
  slug text not null,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, slug)
);

create table if not exists public.tours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  description text,
  location text,
  price numeric(12,2) not null default 0,
  currency text not null default 'KGS',
  duration text,
  status text not null default 'under_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  type text,
  description text,
  location text,
  price_from numeric(12,2) not null default 0,
  currency text not null default 'KGS',
  status text not null default 'under_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays(id) on delete cascade,
  business_id uuid not null references public.partners(id) on delete cascade,
  title text not null,
  capacity integer not null default 1,
  price_per_night numeric(12,2) not null default 0,
  status text not null default 'under_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.partners(id) on delete cascade,
  delivery_enabled boolean not null default true,
  working_hours jsonb not null default '{}'::jsonb,
  min_order_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(12,2) not null default 0,
  preparation_time_minutes integer,
  status text not null default 'under_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.partners(id) on delete cascade,
  delivery_enabled boolean not null default true,
  working_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(12,2) not null default 0,
  stock_qty integer,
  status text not null default 'under_review',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid not null,
  url text not null,
  alt text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Orders --------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid not null references public.partners(id) on delete restrict,
  type text not null,
  status text not null default 'new',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  payment_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_type text not null,
  item_id uuid,
  title_snapshot text not null,
  qty integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid,
  booking_id uuid,
  method text not null default 'manual',
  status text not null default 'pending',
  amount numeric(12,2) not null default 0,
  provider text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, payment_id)
);

-- Bookings ------------------------------------------------------------------

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete restrict,
  business_id uuid not null references public.partners(id) on delete restrict,
  booking_type text not null,
  object_id uuid not null,
  status text not null default 'pending',
  start_date date not null,
  end_date date,
  guests_count integer not null default 1,
  total numeric(12,2) not null default 0,
  payment_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments
  add constraint payments_booking_id_fkey foreign key (booking_id) references public.bookings(id) on delete set null;
alter table public.payments
  add constraint payments_order_id_fkey foreign key (order_id) references public.orders(id) on delete set null;

create table if not exists public.booking_guests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  name text,
  age_group text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.room_availability (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  date date not null,
  status text not null default 'available',
  available_count integer not null default 1,
  price_override numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, date)
);

comment on table public.room_availability is 'Source of truth for room availability. Closed dates block only new bookings.';

create table if not exists public.tour_schedules (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  date date not null,
  time time,
  capacity integer not null default 0,
  booked_count integer not null default 0,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tour_schedules is 'Source of truth for tour dates and seats. Closed dates block only new bookings.';

-- Delivery ------------------------------------------------------------------

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  assigned_courier_id uuid references auth.users(id) on delete set null,
  status text not null default 'delivery_pending',
  pickup_address text,
  dropoff_address text,
  risk_level text not null default 'low',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.deliveries is 'Courier controls physical delivery only. Courier must not change payment status or order contents.';

create table if not exists public.order_delivery (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  delivery_method text not null default 'delivery',
  pickup_address text,
  dropoff_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_status_history (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courier_assignments (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  courier_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'assigned',
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courier_shifts (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'planned',
  zone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courier_locations (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references auth.users(id) on delete cascade,
  lat numeric(10,7) not null,
  lng numeric(10,7) not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_issues (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  category text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Finance -------------------------------------------------------------------

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  recipient_type text not null,
  recipient_id uuid not null,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  period_start date,
  period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.partners(id) on delete cascade,
  scope text not null default 'default',
  rate numeric(6,4) not null default 0,
  fixed_amount numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  reason text,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid,
  amount numeric(12,2) not null default 0,
  direction text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- CRM and support -----------------------------------------------------------

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  related_order_id uuid references public.orders(id) on delete set null,
  related_booking_id uuid references public.bookings(id) on delete set null,
  category text not null,
  priority text not null default 'medium',
  status text not null default 'open',
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  message text not null,
  visibility text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.partners(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  text text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  request_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Promos and loyalty --------------------------------------------------------

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  business_id uuid references public.partners(id) on delete cascade,
  scope text not null default 'global',
  discount_type text not null,
  discount_value numeric(12,2) not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.promo_usage (
  id uuid primary key default gen_random_uuid(),
  promo_code_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  points_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.loyalty_accounts(id) on delete cascade,
  type text not null,
  points integer not null,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

-- AI dispatcher -------------------------------------------------------------

create table if not exists public.ai_dispatcher_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id uuid not null,
  event_type text not null,
  risk_level text not null default 'low',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.ai_dispatcher_events(id) on delete cascade,
  recommended_action text not null,
  human_approval_required boolean not null default true,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_recommendations is 'AI can recommend actions only. AI cannot cancel orders, change payment status, or enable alcohol delivery.';

create table if not exists public.ai_alerts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.ai_dispatcher_events(id) on delete cascade,
  recipient_role text not null,
  message text not null,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_decision_logs (
  id uuid primary key default gen_random_uuid(),
  situation_summary text not null,
  risk_level text not null,
  who_to_notify text[],
  messages jsonb not null default '{}'::jsonb,
  human_approval_required boolean not null default true,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compliance ----------------------------------------------------------------

create table if not exists public.alcohol_module_settings (
  id uuid primary key default gen_random_uuid(),
  is_enabled boolean not null default false,
  enabled_by uuid references auth.users(id) on delete set null,
  enabled_at timestamptz,
  legal_review_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.alcohol_module_settings is 'Alcohol module must remain disabled unless legal compliance is approved.';

create table if not exists public.compliance_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  review_type text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes -------------------------------------------------------------------

create index if not exists idx_user_roles_user_id on public.user_roles(user_id);
create index if not exists idx_user_roles_role on public.user_roles(role);
create index if not exists idx_partner_staff_business_id on public.partner_staff(business_id);
create index if not exists idx_partner_staff_user_id on public.partner_staff(user_id);
create index if not exists idx_partners_status on public.partners(status);
create index if not exists idx_tours_business_id on public.tours(business_id);
create index if not exists idx_stays_business_id on public.stays(business_id);
create index if not exists idx_rooms_stay_id on public.rooms(stay_id);
create index if not exists idx_menu_items_business_id on public.menu_items(business_id);
create index if not exists idx_products_business_id on public.products(business_id);
create index if not exists idx_orders_client_id on public.orders(client_id);
create index if not exists idx_orders_business_id on public.orders(business_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_bookings_client_id on public.bookings(client_id);
create index if not exists idx_bookings_business_id on public.bookings(business_id);
create index if not exists idx_bookings_status on public.bookings(status);
create index if not exists idx_room_availability_room_date on public.room_availability(room_id, date);
create index if not exists idx_tour_schedules_tour_date on public.tour_schedules(tour_id, date);
create index if not exists idx_deliveries_order_id on public.deliveries(order_id);
create index if not exists idx_deliveries_courier_id on public.deliveries(assigned_courier_id);
create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_support_tickets_created_by on public.support_tickets(created_by);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_audit_logs_entity on public.audit_logs(entity_type, entity_id);

-- updated_at triggers -------------------------------------------------------

create trigger set_updated_at_user_profiles before update on public.user_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_user_roles before update on public.user_roles for each row execute function public.set_updated_at();
create trigger set_updated_at_client_profiles before update on public.client_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_partners before update on public.partners for each row execute function public.set_updated_at();
create trigger set_updated_at_partner_profiles before update on public.partner_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_courier_profiles before update on public.courier_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_admin_profiles before update on public.admin_profiles for each row execute function public.set_updated_at();
create trigger set_updated_at_partner_staff before update on public.partner_staff for each row execute function public.set_updated_at();
create trigger set_updated_at_categories before update on public.categories for each row execute function public.set_updated_at();
create trigger set_updated_at_tours before update on public.tours for each row execute function public.set_updated_at();
create trigger set_updated_at_stays before update on public.stays for each row execute function public.set_updated_at();
create trigger set_updated_at_rooms before update on public.rooms for each row execute function public.set_updated_at();
create trigger set_updated_at_restaurants before update on public.restaurants for each row execute function public.set_updated_at();
create trigger set_updated_at_menu_items before update on public.menu_items for each row execute function public.set_updated_at();
create trigger set_updated_at_shops before update on public.shops for each row execute function public.set_updated_at();
create trigger set_updated_at_products before update on public.products for each row execute function public.set_updated_at();
create trigger set_updated_at_orders before update on public.orders for each row execute function public.set_updated_at();
create trigger set_updated_at_bookings before update on public.bookings for each row execute function public.set_updated_at();
create trigger set_updated_at_deliveries before update on public.deliveries for each row execute function public.set_updated_at();


-- SECTION 002 RLS POLICIES
-- Source: supabase/schema/002_rls_policies_draft.sql

-- KOL / Issyk-Kul Travel & Delivery Platform
-- Stage 11C draft RLS policies.
-- Draft only: review and test before applying to a real Supabase project.

-- Helper functions are intentionally simple drafts. They depend on auth.uid().
-- Real implementation should harden role checks, admin scopes and service-role usage.

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = required_role
      and is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.has_role('super_admin')
    or public.has_role('support_admin')
    or public.has_role('finance_admin')
    or public.has_role('dispatcher');
$$;

create or replace function public.is_finance_admin()
returns boolean
language sql
stable
as $$
  select public.has_role('finance_admin') or public.has_role('super_admin');
$$;

create or replace function public.is_partner_for(business uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.partner_staff
    where user_id = auth.uid()
      and business_id = business
      and is_active = true
  ) or public.has_role('super_admin');
$$;

create or replace function public.is_assigned_courier(delivery uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.courier_assignments
    where courier_id = auth.uid()
      and delivery_id = delivery
      and status in ('assigned', 'accepted', 'active')
  ) or public.has_role('dispatcher') or public.has_role('super_admin');
$$;

-- Enable RLS ----------------------------------------------------------------

alter table public.user_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.client_profiles enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.courier_profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.partners enable row level security;
alter table public.partner_staff enable row level security;
alter table public.categories enable row level security;
alter table public.tours enable row level security;
alter table public.stays enable row level security;
alter table public.rooms enable row level security;
alter table public.restaurants enable row level security;
alter table public.menu_items enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.media_files enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_payments enable row level security;
alter table public.order_delivery enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_guests enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.room_availability enable row level security;
alter table public.tour_schedules enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_status_history enable row level security;
alter table public.courier_assignments enable row level security;
alter table public.courier_shifts enable row level security;
alter table public.courier_locations enable row level security;
alter table public.delivery_issues enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.commissions enable row level security;
alter table public.refunds enable row level security;
alter table public.transactions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_usage enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.favorites enable row level security;
alter table public.ai_dispatcher_events enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.ai_alerts enable row level security;
alter table public.ai_decision_logs enable row level security;
alter table public.alcohol_module_settings enable row level security;
alter table public.compliance_reviews enable row level security;

-- Profiles ------------------------------------------------------------------

create policy "clients read own user profile"
on public.user_profiles for select
using (user_id = auth.uid() or public.is_admin());

create policy "users update own user profile"
on public.user_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "clients read own client profile"
on public.client_profiles for select
using (user_id = auth.uid() or public.is_admin());

create policy "clients update own client profile"
on public.client_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "couriers read own courier profile"
on public.courier_profiles for select
using (user_id = auth.uid() or public.is_admin());

create policy "couriers update own courier status"
on public.courier_profiles for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "admins read roles"
on public.user_roles for select
using (public.is_admin());

-- Marketplace ---------------------------------------------------------------

create policy "public reads active partners"
on public.partners for select
using (status = 'approved' or public.is_partner_for(id) or public.is_admin());

create policy "partners update own business"
on public.partners for update
using (public.is_partner_for(id))
with check (public.is_partner_for(id));

create policy "partners read own staff"
on public.partner_staff for select
using (public.is_partner_for(business_id) or public.is_admin());

create policy "public reads categories"
on public.categories for select
using (true);

create policy "public reads active tours"
on public.tours for select
using (status = 'active' or public.is_partner_for(business_id) or public.is_admin());

create policy "partners manage own tours"
on public.tours for all
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "public reads active stays"
on public.stays for select
using (status = 'active' or public.is_partner_for(business_id) or public.is_admin());

create policy "partners manage own stays"
on public.stays for all
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "partners manage own rooms"
on public.rooms for all
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "public reads active menu items"
on public.menu_items for select
using (status = 'active' or public.is_partner_for(business_id) or public.is_admin());

create policy "partners manage own menu items"
on public.menu_items for all
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "public reads active products"
on public.products for select
using (status = 'active' or public.is_partner_for(business_id) or public.is_admin());

create policy "partners manage own products"
on public.products for all
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

-- Orders --------------------------------------------------------------------

create policy "clients read own orders"
on public.orders for select
using (client_id = auth.uid() or public.is_partner_for(business_id) or public.is_admin());

create policy "clients create own orders draft"
on public.orders for insert
with check (client_id = auth.uid());

create policy "partners update own order preparation"
on public.orders for update
using (public.is_partner_for(business_id) or public.is_admin())
with check (public.is_partner_for(business_id) or public.is_admin());

create policy "order items follow order access"
on public.order_items for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.client_id = auth.uid() or public.is_partner_for(orders.business_id) or public.is_admin())
  )
);

create policy "order status history follows order access"
on public.order_status_history for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_status_history.order_id
      and (orders.client_id = auth.uid() or public.is_partner_for(orders.business_id) or public.is_admin())
  )
);

-- Bookings ------------------------------------------------------------------

create policy "clients read own bookings"
on public.bookings for select
using (client_id = auth.uid() or public.is_partner_for(business_id) or public.is_admin());

create policy "clients create own bookings"
on public.bookings for insert
with check (client_id = auth.uid());

create policy "partners update own bookings"
on public.bookings for update
using (public.is_partner_for(business_id) or public.is_admin())
with check (public.is_partner_for(business_id) or public.is_admin());

create policy "partners manage room availability"
on public.room_availability for all
using (
  exists (
    select 1
    from public.rooms
    where rooms.id = room_availability.room_id
      and public.is_partner_for(rooms.business_id)
  ) or public.is_admin()
)
with check (
  exists (
    select 1
    from public.rooms
    where rooms.id = room_availability.room_id
      and public.is_partner_for(rooms.business_id)
  ) or public.is_admin()
);

create policy "partners manage tour schedules"
on public.tour_schedules for all
using (
  exists (
    select 1
    from public.tours
    where tours.id = tour_schedules.tour_id
      and public.is_partner_for(tours.business_id)
  ) or public.is_admin()
)
with check (
  exists (
    select 1
    from public.tours
    where tours.id = tour_schedules.tour_id
      and public.is_partner_for(tours.business_id)
  ) or public.is_admin()
);

-- Delivery ------------------------------------------------------------------

create policy "delivery scoped read"
on public.deliveries for select
using (
  public.is_assigned_courier(id)
  or exists (
    select 1
    from public.orders
    where orders.id = deliveries.order_id
      and (orders.client_id = auth.uid() or public.is_partner_for(orders.business_id))
  )
  or public.is_admin()
);

create policy "couriers update assigned delivery physical status"
on public.deliveries for update
using (public.is_assigned_courier(id) or public.is_admin())
with check (public.is_assigned_courier(id) or public.is_admin());

create policy "couriers read own assignments"
on public.courier_assignments for select
using (courier_id = auth.uid() or public.is_admin());

create policy "couriers create delivery issues"
on public.delivery_issues for insert
with check (
  public.is_admin()
  or exists (
    select 1
    from public.deliveries
    where deliveries.id = delivery_issues.delivery_id
      and public.is_assigned_courier(deliveries.id)
  )
);

-- Finance -------------------------------------------------------------------

create policy "finance admins read payments"
on public.payments for select
using (
  public.is_finance_admin()
  or user_id = auth.uid()
);

create policy "finance admins manage payments"
on public.payments for update
using (public.is_finance_admin())
with check (public.is_finance_admin());

create policy "finance admins read payouts"
on public.payouts for select
using (public.is_finance_admin());

create policy "finance admins manage refunds"
on public.refunds for all
using (public.is_finance_admin())
with check (public.is_finance_admin());

-- AI dispatcher -------------------------------------------------------------

create policy "admins read ai events"
on public.ai_dispatcher_events for select
using (public.is_admin());

create policy "dispatcher creates ai events draft"
on public.ai_dispatcher_events for insert
with check (public.has_role('dispatcher') or public.has_role('super_admin'));

create policy "dispatcher creates recommendations only"
on public.ai_recommendations for insert
with check (public.has_role('dispatcher') or public.has_role('super_admin'));

create policy "admins read ai recommendations"
on public.ai_recommendations for select
using (public.is_admin());

-- AI restrictions:
-- AI cannot cancel orders.
-- AI cannot change payment status.
-- AI cannot enable alcohol module.
-- High-risk recommendations require human approval before operational changes.

-- Alcohol compliance --------------------------------------------------------

create policy "super admins read alcohol settings"
on public.alcohol_module_settings for select
using (public.has_role('super_admin'));

create policy "no ai alcohol enablement"
on public.alcohol_module_settings for update
using (public.has_role('super_admin'))
with check (public.has_role('super_admin') and is_enabled = false);

-- Draft note: this policy intentionally keeps is_enabled=false.
-- Real activation requires legal review, licensing, partner verification,
-- explicit migration/policy update and audited human admin approval.

-- Audit logs ----------------------------------------------------------------

create policy "admins read audit logs"
on public.audit_logs for select
using (public.is_admin());

create policy "authenticated users create audit logs draft"
on public.audit_logs for insert
with check (auth.uid() is not null);


-- SECTION 003 SEED DEMO DATA
-- Source: supabase/schema/003_seed_demo_data_draft.sql

-- KOL / Issyk-Kul Travel & Delivery Platform
-- Stage 11C demo seed draft.
-- Demo only. Do not apply to production without replacing auth user IDs and reviewing RLS.

-- Demo UUIDs are fixed for review readability.
-- In a real Supabase project, auth.users rows are created by Supabase Auth, not by this seed.

insert into public.user_profiles (id, user_id, full_name, phone, email, locale, status)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Demo Admin', '+996700000001', 'admin@kol.demo', 'ru', 'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Demo Client', '+996700000002', 'client@kol.demo', 'ru', 'active'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Demo Partner', '+996700000003', 'partner@kol.demo', 'ru', 'active'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'Demo Courier', '+996700000004', 'courier@kol.demo', 'ru', 'active')
on conflict (user_id) do nothing;

insert into public.user_roles (user_id, role, scope_id, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'super_admin', null, true),
  ('00000000-0000-0000-0000-000000000002', 'client', null, true),
  ('00000000-0000-0000-0000-000000000003', 'partner_owner', '20000000-0000-0000-0000-000000000001', true),
  ('00000000-0000-0000-0000-000000000004', 'courier', null, true)
on conflict (user_id, role, scope_id) do nothing;

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
values ('50000000-0000-0000-0000-000000000001', 'menu_item', '43000000-0000-0000-0000-000000000001', 'Demo beshbarmak', 1, 650, 650);

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
values (
  '53000000-0000-0000-0000-000000000001',
  'Monitor delivery status. No high-risk action required.',
  false,
  'new'
);

insert into public.alcohol_module_settings (id, is_enabled, notes)
values (
  '54000000-0000-0000-0000-000000000001',
  false,
  'Alcohol module disabled by default. Legal compliance approval required before activation.'
)
on conflict do nothing;


