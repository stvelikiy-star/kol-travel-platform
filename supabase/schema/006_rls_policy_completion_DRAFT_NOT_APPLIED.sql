-- KÖL / kol-travel-platform
-- RLS POLICY COMPLETION DRAFT — NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 005_security_hardening_DRAFT_NOT_APPLIED.sql
--
-- Goal:
-- Give every currently policy-less public table an explicit, conservative access
-- contract without inventing unfinished business workflows.
--
-- Safety model:
-- - obvious ownership reads are enabled;
-- - obvious personal low-risk writes are enabled only for favorites/support messages;
-- - operational/financial/AI/compliance/media writes remain denied to normal API roles;
-- - public restaurant/shop reads are limited to businesses visible through partners RLS;
-- - reviews are NOT public until a verified moderation status contract exists;
-- - promo validation/redemption remains closed until transactional rules exist;
-- - no service-role behavior is reduced by RLS (service_role bypasses RLS).
--
-- DO NOT APPLY to the live project until backup + staging + role tests + rollback review.

begin;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

drop policy if exists "admins read admin profiles" on public.admin_profiles;
create policy "admins read admin profiles"
on public.admin_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

-- Partner profile is the user's profile record, not the staff membership authority.
drop policy if exists "partners read own partner profile" on public.partner_profiles;
create policy "partners read own partner profile"
on public.partner_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Booking child/read-history tables
-- Access follows the parent booking, whose RLS already scopes client/partner/admin.
-- No direct writes are opened here; booking transactions must own history writes.
-- ---------------------------------------------------------------------------

drop policy if exists "booking guests follow booking access" on public.booking_guests;
create policy "booking guests follow booking access"
on public.booking_guests
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings as b
    where b.id = booking_guests.booking_id
  )
);

drop policy if exists "booking history follows booking access" on public.booking_status_history;
create policy "booking history follows booking access"
on public.booking_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings as b
    where b.id = booking_status_history.booking_id
  )
);

-- ---------------------------------------------------------------------------
-- Order/payment/delivery child tables
-- ---------------------------------------------------------------------------

drop policy if exists "order delivery follows order access" on public.order_delivery;
create policy "order delivery follows order access"
on public.order_delivery
for select
to authenticated
using (
  exists (
    select 1
    from public.orders as o
    where o.id = order_delivery.order_id
  )
);

drop policy if exists "order payments follow order access" on public.order_payments;
create policy "order payments follow order access"
on public.order_payments
for select
to authenticated
using (
  public.is_finance_admin()
  or exists (
    select 1
    from public.orders as o
    where o.id = order_payments.order_id
  )
);

drop policy if exists "delivery history follows delivery access" on public.delivery_status_history;
create policy "delivery history follows delivery access"
on public.delivery_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.deliveries as d
    where d.id = delivery_status_history.delivery_id
  )
);

-- ---------------------------------------------------------------------------
-- Courier self-read tables
-- Direct operational writes remain closed until courier lifecycle/RPC is complete.
-- ---------------------------------------------------------------------------

drop policy if exists "couriers read own shifts" on public.courier_shifts;
create policy "couriers read own shifts"
on public.courier_shifts
for select
to authenticated
using (
  courier_id = (select auth.uid())
  or public.is_admin()
);

drop policy if exists "couriers read own locations" on public.courier_locations;
create policy "couriers read own locations"
on public.courier_locations
for select
to authenticated
using (
  courier_id = (select auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Favorites: clear low-risk user-owned CRUD
-- ---------------------------------------------------------------------------

drop policy if exists "users read own favorites" on public.favorites;
drop policy if exists "users create own favorites" on public.favorites;
drop policy if exists "users update own favorites" on public.favorites;
drop policy if exists "users delete own favorites" on public.favorites;

create policy "users read own favorites"
on public.favorites
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "users create own favorites"
on public.favorites
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy "users update own favorites"
on public.favorites
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "users delete own favorites"
on public.favorites
for delete
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Loyalty: read-only to customer. Balance/ledger writes stay server-controlled.
-- ---------------------------------------------------------------------------

drop policy if exists "users read own loyalty account" on public.loyalty_accounts;
create policy "users read own loyalty account"
on public.loyalty_accounts
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

drop policy if exists "users read own loyalty transactions" on public.loyalty_transactions;
create policy "users read own loyalty transactions"
on public.loyalty_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.loyalty_accounts as la
    where la.id = loyalty_transactions.account_id
  )
);

-- ---------------------------------------------------------------------------
-- Notifications: read-only until a constrained mark-read RPC/column grant exists.
-- ---------------------------------------------------------------------------

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Support: customer owns ticket; admin can see all. Messages follow ticket access.
-- Client may create an own ticket/message. Status mutations remain server/admin flow.
-- ---------------------------------------------------------------------------

drop policy if exists "users read own support tickets" on public.support_tickets;
drop policy if exists "users create own support tickets" on public.support_tickets;

create policy "users read own support tickets"
on public.support_tickets
for select
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_admin()
);

create policy "users create own support tickets"
on public.support_tickets
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists "ticket messages follow ticket access" on public.ticket_messages;
drop policy if exists "users create own ticket messages" on public.ticket_messages;

create policy "ticket messages follow ticket access"
on public.ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets as st
    where st.id = ticket_messages.ticket_id
  )
);

create policy "users create own ticket messages"
on public.ticket_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.support_tickets as st
    where st.id = ticket_messages.ticket_id
  )
);

-- ---------------------------------------------------------------------------
-- Restaurant / Shop public read facades
-- The parent partners RLS from 005 determines whether the business is public/visible.
-- No restaurant/shop writes are opened by this patch.
-- ---------------------------------------------------------------------------

grant select on table public.restaurants to anon;
grant select on table public.shops to anon;

drop policy if exists "public read visible restaurants" on public.restaurants;
create policy "public read visible restaurants"
on public.restaurants
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.partners as p
    where p.id = restaurants.business_id
  )
);

drop policy if exists "public read visible shops" on public.shops;
create policy "public read visible shops"
on public.shops
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.partners as p
    where p.id = shops.business_id
  )
);

-- ---------------------------------------------------------------------------
-- Reviews
-- No public policy yet: live table is empty and moderation lifecycle/status values
-- are not constrained in the schema. Customer/partner/admin can inspect relevant
-- rows, but review creation/publication remains closed until verified rules exist.
-- ---------------------------------------------------------------------------

drop policy if exists "review participants read relevant reviews" on public.reviews;
create policy "review participants read relevant reviews"
on public.reviews
for select
to authenticated
using (
  client_id = (select auth.uid())
  or public.is_partner_for(business_id)
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Promo: read relevant definitions/own usage only. Redemption stays transactional.
-- ---------------------------------------------------------------------------

drop policy if exists "partners admins read promo codes" on public.promo_codes;
create policy "partners admins read promo codes"
on public.promo_codes
for select
to authenticated
using (
  public.is_admin()
  or (business_id is not null and public.is_partner_for(business_id))
);

drop policy if exists "users read own promo usage" on public.promo_usage;
create policy "users read own promo usage"
on public.promo_usage
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- Finance: read-only through authorized roles/ownership. No financial writes.
-- ---------------------------------------------------------------------------

drop policy if exists "finance and partner read commissions" on public.commissions;
create policy "finance and partner read commissions"
on public.commissions
for select
to authenticated
using (
  public.is_finance_admin()
  or (business_id is not null and public.is_partner_for(business_id))
);

drop policy if exists "finance admins read transactions" on public.transactions;
create policy "finance admins read transactions"
on public.transactions
for select
to authenticated
using (public.is_finance_admin());

-- ---------------------------------------------------------------------------
-- AI / compliance / media: admin read only for now.
-- Normal API writes remain fail-closed; these must later move behind explicit
-- server actions/RPC with audit and, for media, Storage policy design.
-- ---------------------------------------------------------------------------

drop policy if exists "admins read ai alerts" on public.ai_alerts;
create policy "admins read ai alerts"
on public.ai_alerts
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins read ai decision logs" on public.ai_decision_logs;
create policy "admins read ai decision logs"
on public.ai_decision_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins read compliance reviews" on public.compliance_reviews;
create policy "admins read compliance reviews"
on public.compliance_reviews
for select
to authenticated
using (public.is_admin());

drop policy if exists "admins read media metadata" on public.media_files;
create policy "admins read media metadata"
on public.media_files
for select
to authenticated
using (public.is_admin());

commit;

-- EXPECTED STAGING RESULT AFTER 005 + 006:
-- - every current public table has at least one explicit RLS policy;
-- - normal API writes to finance/AI/compliance/media/history remain closed;
-- - favorites and basic support creation are the only newly opened direct user writes;
-- - restaurant/shop reads are public only when parent partner row is visible;
-- - reviews/promo are not made public based on guessed status semantics.
