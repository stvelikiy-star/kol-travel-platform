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
