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
