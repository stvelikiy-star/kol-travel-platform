BEGIN;
SET LOCAL lock_timeout='8s';
SET LOCAL statement_timeout='120s';
-- KÖL manual production candidate, reviewed SHA 2b9b402cc800d35fb8a15041f263354d41372527
-- NOT automatic. Cloud Storage object policies are intentionally excluded:
-- storage.objects belongs to supabase_storage_admin, not the postgres migration role.
-- Private catalog-media bucket metadata is provisioned but object uploads remain denied until Storage policy setup.
-- Requires separately confirmed backup, read-only baseline and hosted Auth/JWT E2E after apply.
DO $kol_baseline$
BEGIN
  IF (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') <> 54
    OR (SELECT count(*) FROM pg_policies WHERE schemaname='public') <> 66
    OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public') <> 10
    OR (SELECT count(*) FROM supabase_migrations.schema_migrations) <> 17
    OR (SELECT count(*) FROM auth.users) <> 5
    OR (SELECT count(*) FROM public.bookings) <> 1
    OR (SELECT count(*) FROM public.orders) <> 1
    OR (SELECT count(*) FROM public.deliveries) <> 1
  THEN RAISE EXCEPTION 'KOL_BASELINE_DRIFT: production migration aborted. Refresh verified cloud backup and rehearsal.';
  END IF;
END $kol_baseline$;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('catalog-media','catalog-media',false,8388608,ARRAY['image/jpeg','image/png','image/webp','image/avif']) ON CONFLICT(id) DO NOTHING;
-- BEGIN STAGE 005_security_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- SECURITY HARDENING DRAFT — NOT APPLIED
-- Prepared: 2026-08-20
--
-- IMPORTANT:
-- This file documents a migration candidate derived from read-only inspection of
-- the live Supabase project mphruawzozrpwcjgejhs. It MUST NOT be applied until:
--   1) a logical database backup exists;
--   2) the current live schema has been captured as a tracked baseline;
--   3) role-by-role staging tests are ready;
--   4) rollback has been reviewed.
--
-- Scope of this draft:
--   - break the confirmed user_roles -> is_admin() -> has_role() -> user_roles RLS recursion;
--   - break partner_staff self-recursion by making helper lookup depend on an own-row policy;
--   - fix mutable search_path warnings on the six current public helper/trigger functions;
--   - use init-plan-friendly auth.uid() calls inside the touched functions/policies;
--   - make public catalog Data API SELECT grants explicit for the currently implemented public catalog;
--   - scope public catalog read vs partner mutation policies to the intended API roles.
--
-- Out of scope:
--   - the remaining RLS-enabled tables without policies;
--   - Stage 21 catalog columns;
--   - payment/courier transaction redesign;
--   - indexes/performance migration;
--   - destructive changes.


-- ---------------------------------------------------------------------------
-- 1. Helper function hardening
-- ---------------------------------------------------------------------------

create or replace function public.has_role(required_role text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
      and ur.is_active = true
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
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
set search_path = ''
as $$
  select public.has_role('finance_admin')
    or public.has_role('super_admin');
$$;

create or replace function public.is_partner_for(business uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.partner_staff as ps
    where ps.user_id = (select auth.uid())
      and ps.business_id = business
      and ps.is_active = true
      -- Staff membership alone must not survive application-role revocation.
      and exists (
        select 1 from public.user_roles as ur
        where ur.user_id = ps.user_id
          and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
          and ur.is_active = true
      )
  ) or public.has_role('super_admin');
$$;

create or replace function public.is_assigned_courier(delivery uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.courier_assignments as ca
    where ca.courier_id = (select auth.uid())
      and ca.delivery_id = delivery
      and ca.status in ('assigned', 'accepted', 'active')
  ) or public.has_role('dispatcher')
    or public.has_role('super_admin');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Remove confirmed recursive role policy
-- ---------------------------------------------------------------------------
-- Live recursion before this draft:
-- user_roles SELECT policy -> is_admin() -> has_role() -> user_roles SELECT policy.
--
-- The helper only needs the current authenticated user's own active role rows.
-- Cross-user role administration should use a separately audited server/admin path;
-- it must not reintroduce a recursive policy predicate.

drop policy if exists "admins read roles" on public.user_roles;
drop policy if exists "users read own roles" on public.user_roles;

create policy "users read own roles"
on public.user_roles
for select
to authenticated
using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Break partner_staff self-recursion
-- ---------------------------------------------------------------------------
-- Previous predicate used is_partner_for(business_id); is_partner_for() itself reads
-- partner_staff, causing the policy to re-enter itself. The helper only needs the
-- caller's own active staff row, so the base policy is intentionally own-row + admin.

drop policy if exists "partners read own staff" on public.partner_staff;

create policy "partners read own staff"
on public.partner_staff
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

-- ---------------------------------------------------------------------------
-- 4. Explicit public Data API grants
-- ---------------------------------------------------------------------------
-- Supabase no longer guarantees automatic exposure of new public tables to the
-- Data API. RLS and SQL grants are independent. Only SELECT is granted to anon here.

grant select on table public.partners to anon;
grant select on table public.categories to anon;
grant select on table public.tours to anon;
grant select on table public.stays to anon;
grant select on table public.menu_items to anon;
grant select on table public.products to anon;

-- ---------------------------------------------------------------------------
-- 5. Public catalog policy role scoping
-- ---------------------------------------------------------------------------
-- Separate anon and authenticated read policies so anon never evaluates helper
-- functions that depend on authenticated identity/role tables.

-- partners
drop policy if exists "public reads active partners" on public.partners;
drop policy if exists "authenticated read visible partners" on public.partners;
drop policy if exists "anon read approved partners" on public.partners;

create policy "anon read approved partners"
on public.partners
for select
to anon
using (status = 'approved');

create policy "authenticated read visible partners"
on public.partners
for select
to authenticated
using (
  status = 'approved'
  or public.is_partner_for(id)
  or public.is_admin()
);

-- categories
drop policy if exists "public reads categories" on public.categories;
drop policy if exists "public read categories" on public.categories;

create policy "public read categories"
on public.categories
for select
to anon, authenticated
using (true);

-- tours
drop policy if exists "public reads active tours" on public.tours;
drop policy if exists "partners manage own tours" on public.tours;
drop policy if exists "anon read active tours" on public.tours;
drop policy if exists "authenticated read visible tours" on public.tours;
drop policy if exists "partners insert own tours" on public.tours;
drop policy if exists "partners update own tours" on public.tours;
drop policy if exists "partners delete own tours" on public.tours;

create policy "anon read active tours"
on public.tours
for select
to anon
using (status = 'active');

create policy "authenticated read visible tours"
on public.tours
for select
to authenticated
using (
  status = 'active'
  or public.is_partner_for(business_id)
  or public.is_admin()
);

create policy "partners insert own tours"
on public.tours
for insert
to authenticated
with check (public.is_partner_for(business_id));

create policy "partners update own tours"
on public.tours
for update
to authenticated
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "partners delete own tours"
on public.tours
for delete
to authenticated
using (public.is_partner_for(business_id));

-- stays
drop policy if exists "public reads active stays" on public.stays;
drop policy if exists "partners manage own stays" on public.stays;
drop policy if exists "anon read active stays" on public.stays;
drop policy if exists "authenticated read visible stays" on public.stays;
drop policy if exists "partners insert own stays" on public.stays;
drop policy if exists "partners update own stays" on public.stays;
drop policy if exists "partners delete own stays" on public.stays;

create policy "anon read active stays"
on public.stays
for select
to anon
using (status = 'active');

create policy "authenticated read visible stays"
on public.stays
for select
to authenticated
using (
  status = 'active'
  or public.is_partner_for(business_id)
  or public.is_admin()
);

create policy "partners insert own stays"
on public.stays
for insert
to authenticated
with check (public.is_partner_for(business_id));

create policy "partners update own stays"
on public.stays
for update
to authenticated
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "partners delete own stays"
on public.stays
for delete
to authenticated
using (public.is_partner_for(business_id));

-- menu_items
drop policy if exists "public reads active menu items" on public.menu_items;
drop policy if exists "partners manage own menu items" on public.menu_items;
drop policy if exists "anon read active menu items" on public.menu_items;
drop policy if exists "authenticated read visible menu items" on public.menu_items;
drop policy if exists "partners insert own menu items" on public.menu_items;
drop policy if exists "partners update own menu items" on public.menu_items;
drop policy if exists "partners delete own menu items" on public.menu_items;

create policy "anon read active menu items"
on public.menu_items
for select
to anon
using (status = 'active');

create policy "authenticated read visible menu items"
on public.menu_items
for select
to authenticated
using (
  status = 'active'
  or public.is_partner_for(business_id)
  or public.is_admin()
);

create policy "partners insert own menu items"
on public.menu_items
for insert
to authenticated
with check (public.is_partner_for(business_id));

create policy "partners update own menu items"
on public.menu_items
for update
to authenticated
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "partners delete own menu items"
on public.menu_items
for delete
to authenticated
using (public.is_partner_for(business_id));

-- products
drop policy if exists "public reads active products" on public.products;
drop policy if exists "partners manage own products" on public.products;
drop policy if exists "anon read active products" on public.products;
drop policy if exists "authenticated read visible products" on public.products;
drop policy if exists "partners insert own products" on public.products;
drop policy if exists "partners update own products" on public.products;
drop policy if exists "partners delete own products" on public.products;

create policy "anon read active products"
on public.products
for select
to anon
using (status = 'active');

create policy "authenticated read visible products"
on public.products
for select
to authenticated
using (
  status = 'active'
  or public.is_partner_for(business_id)
  or public.is_admin()
);

create policy "partners insert own products"
on public.products
for insert
to authenticated
with check (public.is_partner_for(business_id));

create policy "partners update own products"
on public.products
for update
to authenticated
using (public.is_partner_for(business_id))
with check (public.is_partner_for(business_id));

create policy "partners delete own products"
on public.products
for delete
to authenticated
using (public.is_partner_for(business_id));


-- POST-APPLY VERIFICATION REQUIRED ON STAGING:
-- 1. Supabase Security Advisor: no function_search_path_mutable for these six functions.
-- 2. authenticated client: can resolve own roles without recursion.
-- 3. partner: is_partner_for() resolves own active staff row without recursion.
-- 4. anon: categories/approved partners/active tours/stays/menu_items/products are readable.
-- 5. anon: cannot read inactive/unapproved catalog rows.
-- 6. partner A cannot read/write partner B private rows.
-- 7. admin role checks still resolve from the admin's own user_roles rows.
-- 8. no payment, booking, delivery or alcohol state is mutated by this patch.
-- END STAGE 005_security_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- FOLLOW-UP TO 005 SECURITY HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20 after independent live/diff re-audit.
--
-- Live policy `partners update own business` currently targets role PUBLIC.
-- Ownership/grants already prevent an anonymous update in practice, but the policy
-- contract should explicitly target authenticated callers and avoid evaluating
-- authenticated ownership helpers for irrelevant roles.


drop policy if exists "partners update own business" on public.partners;

create policy "partners update own business"
on public.partners
for update
to authenticated
using (public.is_partner_for(id))
with check (public.is_partner_for(id));


-- Required staging checks:
-- - authenticated partner can update only its own partner row;
-- - partner A cannot update partner B;
-- - anon cannot update any partner row;
-- - super_admin behavior remains as explicitly granted by is_partner_for().
-- END STAGE 005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006_rls_policy_completion_DRAFT_NOT_APPLIED.sql
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
-- Support: customers see their own tickets and public messages. Only support_admin
-- and super_admin may also see internal notes. Finance/dispatch roles can see only
-- public messages even when public.is_admin() grants access to the parent ticket.
-- Writes remain constrained to the customer-owned ticket/message paths.

drop policy if exists "support admins read all support tickets" on public.support_tickets;
drop policy if exists "users read own support tickets" on public.support_tickets;
drop policy if exists "support ticket owners and admins read tickets" on public.support_tickets;
drop policy if exists "users create own support tickets" on public.support_tickets;

create policy "support ticket owners and admins read tickets"
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

drop policy if exists "support admins read public ticket messages" on public.ticket_messages;
drop policy if exists "ticket messages follow ticket access" on public.ticket_messages;
drop policy if exists "support message visibility follows ticket access" on public.ticket_messages;
drop policy if exists "users create own ticket messages" on public.ticket_messages;

create policy "support message visibility follows ticket access"
on public.ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets as st
    where st.id = ticket_messages.ticket_id
      and (
        st.created_by = (select auth.uid())
        or public.is_admin()
      )
      and (
        ticket_messages.visibility = 'public'
        or (
          ticket_messages.visibility = 'internal'
          and (
            public.has_role('support_admin')
            or public.has_role('super_admin')
          )
        )
      )
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


-- EXPECTED STAGING RESULT AFTER 005 + 006:
-- - every current public table has at least one explicit RLS policy;
-- - normal API writes to finance/AI/compliance/media/history remain closed;
-- - favorites and basic support creation are the only newly opened direct user writes;
-- - restaurant/shop reads are public only when parent partner row is visible;
-- - reviews/promo are not made public based on guessed status semantics.
-- END STAGE 006_rls_policy_completion_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 024_support_policy_consolidation_DRAFT_NOT_APPLIED.sql
-- KÖL support read-policy consolidation
-- DRAFT — apply only through the reviewed staging migration sequence.
-- Replaces overlapping SELECT policies with one policy per support table.
-- Clients see only their own tickets and public replies. Finance/dispatch admins
-- retain public support visibility; support_admin/super_admin may also read internal
-- notes. Writes remain governed by the audited support RPCs and existing grants.


drop policy if exists "support admins read all support tickets" on public.support_tickets;
drop policy if exists "users read own support tickets" on public.support_tickets;
drop policy if exists "support ticket owners and admins read tickets" on public.support_tickets;

create policy "support ticket owners and admins read tickets"
on public.support_tickets
for select
to authenticated
using (
  created_by = (select auth.uid())
  or public.is_admin()
);

drop policy if exists "support admins read public ticket messages" on public.ticket_messages;
drop policy if exists "ticket messages follow ticket access" on public.ticket_messages;
drop policy if exists "support message visibility follows ticket access" on public.ticket_messages;

create policy "support message visibility follows ticket access"
on public.ticket_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_tickets as st
    where st.id = ticket_messages.ticket_id
      and (
        st.created_by = (select auth.uid())
        or public.is_admin()
      )
      and (
        ticket_messages.visibility = 'public'
        or (
          ticket_messages.visibility = 'internal'
          and (
            public.has_role('support_admin')
            or public.has_role('super_admin')
          )
        )
      )
  )
);

-- END STAGE 024_support_policy_consolidation_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql
-- KÖL / security follow-up
-- AUDIT LOG WRITE LOCKDOWN — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Live policy "authenticated users create audit logs draft" only checks that
-- auth.uid() is non-null. That permits an authenticated caller to fabricate actor,
-- action, entity and before/after audit content.
--
-- Current generic source audit helper is still a no-op/TODO, while new transaction
-- RPCs write audit rows inside trusted DB transactions. Therefore direct Data API
-- audit mutation should remain closed.


drop policy if exists "authenticated users create audit logs draft" on public.audit_logs;

revoke insert, update, delete on table public.audit_logs from anon, authenticated;


-- STAGING PROOF:
-- 1. client/partner direct INSERT audit_logs => denied.
-- 2. authenticated users retain only RLS-authorized SELECT, if any.
-- 3. security-definer transactional RPCs can still append their audit row.
-- 4. audit rows cannot be updated/deleted through normal API roles.
-- END STAGE 006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / security follow-up
-- RLS INITPLAN + ROLE SCOPE HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20 from exact live pg_policies definitions.
--
-- Preserves existing access logic while:
-- - replacing direct auth.uid() calls with (select auth.uid()) for init-plan caching;
-- - replacing implicit PUBLIC role scope with explicit authenticated scope where the
--   policy fundamentally depends on authenticated identity.
--
-- Direct order/booking creation and direct audit insertion are intentionally handled
-- by separate fail-closed follow-ups, not recreated here.


-- user_profiles --------------------------------------------------------------
drop policy if exists "clients read own user profile" on public.user_profiles;
create policy "clients read own user profile"
on public.user_profiles for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "users update own user profile" on public.user_profiles;
create policy "users update own user profile"
on public.user_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- client_profiles ------------------------------------------------------------
drop policy if exists "clients read own client profile" on public.client_profiles;
create policy "clients read own client profile"
on public.client_profiles for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "clients update own client profile" on public.client_profiles;
create policy "clients update own client profile"
on public.client_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- courier_profiles -----------------------------------------------------------
drop policy if exists "couriers read own courier profile" on public.courier_profiles;
create policy "couriers read own courier profile"
on public.courier_profiles for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "couriers update own courier status" on public.courier_profiles;
create policy "couriers update own courier status"
on public.courier_profiles for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- courier_assignments --------------------------------------------------------
drop policy if exists "couriers read own assignments" on public.courier_assignments;
create policy "couriers read own assignments"
on public.courier_assignments for select to authenticated
using (courier_id = (select auth.uid()) or public.is_admin());

-- orders ---------------------------------------------------------------------
drop policy if exists "clients read own orders" on public.orders;
create policy "clients read own orders"
on public.orders for select to authenticated
using (
  client_id = (select auth.uid())
  or public.is_partner_for(business_id)
  or public.is_admin()
);

-- order_items ----------------------------------------------------------------
drop policy if exists "order items follow order access" on public.order_items;
create policy "order items follow order access"
on public.order_items for select to authenticated
using (
  exists (
    select 1 from public.orders as o
    where o.id = order_items.order_id
      and (
        o.client_id = (select auth.uid())
        or public.is_partner_for(o.business_id)
        or public.is_admin()
      )
  )
);

-- order_status_history -------------------------------------------------------
drop policy if exists "order status history follows order access" on public.order_status_history;
create policy "order status history follows order access"
on public.order_status_history for select to authenticated
using (
  exists (
    select 1 from public.orders as o
    where o.id = order_status_history.order_id
      and (
        o.client_id = (select auth.uid())
        or public.is_partner_for(o.business_id)
        or public.is_admin()
      )
  )
);

-- bookings -------------------------------------------------------------------
drop policy if exists "clients read own bookings" on public.bookings;
create policy "clients read own bookings"
on public.bookings for select to authenticated
using (
  client_id = (select auth.uid())
  or public.is_partner_for(business_id)
  or public.is_admin()
);

-- deliveries -----------------------------------------------------------------
drop policy if exists "delivery scoped read" on public.deliveries;
create policy "delivery scoped read"
on public.deliveries for select to authenticated
using (
  public.is_assigned_courier(id)
  or exists (
    select 1 from public.orders as o
    where o.id = deliveries.order_id
      and (
        o.client_id = (select auth.uid())
        or public.is_partner_for(o.business_id)
      )
  )
  or public.is_admin()
);

-- payments -------------------------------------------------------------------
drop policy if exists "finance admins read payments" on public.payments;
create policy "finance admins read payments"
on public.payments for select to authenticated
using (
  public.is_finance_admin()
  or user_id = (select auth.uid())
);


-- STAGING PROOF:
-- - role-by-role SELECT/UPDATE behavior remains equivalent to pre-006b behavior;
-- - anon no longer evaluates these identity-dependent policies;
-- - Supabase Performance Advisor auth_rls_initplan warnings disappear for the
--   policies rewritten above;
-- - cross-partner and cross-user reads remain denied.
-- END STAGE 006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql
-- KÖL / security follow-up
-- TRANSACTION ENTRYPOINT LOCKDOWN — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Recovered direct INSERT policies for orders/bookings only bind client_id to auth.uid().
-- They do not make price, total, inventory/capacity or object/business selection
-- server-authoritative. Creation must therefore fail closed until the atomic RPCs
-- (007 Stay/Tour and 008 Food/Shop) are staged and accepted.


drop policy if exists "clients create own bookings" on public.bookings;
drop policy if exists "clients create own orders draft" on public.orders;

revoke insert on table public.bookings from anon, authenticated;
revoke insert on table public.orders from anon, authenticated;


-- This intentionally makes direct client checkout/booking unavailable rather than
-- accepting untrusted monetary/inventory fields. Security-definer atomic RPCs can
-- write as their owner after their own explicit EXECUTE grants are staged.
-- END STAGE 006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006d_api_role_privilege_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- DATA API ROLE PRIVILEGE HARDENING — DRAFT / NOT APPLIED
-- Prepared: 2026-08-21
--
-- Purpose:
--   Make the public Data API table-privilege contract deterministic before the
--   transactional layers are rehearsed. RLS does not protect TRUNCATE, so this
--   layer explicitly removes unsafe table privileges that may be inherited from
--   recovery/local defaults.
--
-- Safety:
--   - no data mutation;
--   - no table/schema deletion;
--   - anon keeps SELECT only on the explicitly public catalog allowlist;
--   - authenticated keeps ordinary SELECT/INSERT/UPDATE/DELETE grants and loses
--     only TRUNCATE/REFERENCES/TRIGGER, which application sessions do not need.
--
-- NOT APPLIED to live Supabase.


-- Anonymous browser sessions have no business reason to mutate public tables or
-- use sequence/DDL-adjacent table privileges. Start from zero table/sequence ACL
-- and grant back only the explicit public read surface.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

grant select on table
  public.partners,
  public.categories,
  public.tours,
  public.stays,
  public.menu_items,
  public.products,
  public.restaurants,
  public.shops
to anon;

-- Authenticated application sessions may need row-level DML according to RLS,
-- but they must never receive privileges that bypass or redefine row security.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- END STAGE 006d_api_role_privilege_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006e_public_booking_inventory_read_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PUBLIC BOOKING INVENTORY READ CONTRACT — DRAFT / NOT APPLIED
-- Prepared: 2026-08-21
-- Depends on: 006d_api_role_privilege_hardening_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
--   Expose the minimum booking-inventory projection needed by public Stay/Tour
--   detail pages without granting anon direct SELECT on rooms,
--   room_availability or tour_schedules.
--
-- Security model:
--   - raw booking inventory tables remain outside the anon table allowlist;
--   - SECURITY DEFINER functions expose only explicit columns;
--   - only active stays/tours and active rooms are eligible;
--   - Stay output includes future-window room availability and authoritative
--     room/override prices but no customer/booking data;
--   - Tour output includes only currently available schedules in the requested
--     date window and no customer/booking data;
--   - date windows are fail-closed when invalid or larger than 366 days;
--   - function search_path is fixed to an empty path and all objects are schema-qualified.
--
-- NOT APPLIED to live Supabase.


create or replace function public.get_public_stay_inventory(
  p_stay_id uuid,
  p_from date,
  p_to date
)
returns table (
  room_id uuid,
  stay_id uuid,
  room_title text,
  room_capacity integer,
  room_price_per_night numeric,
  room_status text,
  availability_date date,
  availability_status text,
  available_count integer,
  price_override numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id as room_id,
    r.stay_id,
    r.title as room_title,
    r.capacity as room_capacity,
    r.price_per_night as room_price_per_night,
    r.status as room_status,
    ra.date as availability_date,
    ra.status as availability_status,
    ra.available_count,
    ra.price_override
  from public.stays as s
  join public.partners as partner
    on partner.id = s.business_id
   and partner.status = 'approved'
   and partner.business_status = 'online'
  join public.rooms as r
    on r.stay_id = s.id
   and r.status = 'active'
  left join public.room_availability as ra
    on ra.room_id = r.id
   and ra.date >= p_from
   and ra.date < p_to
  where p_stay_id is not null
    and p_from is not null
    and p_to is not null
    and p_to > p_from
    and (p_to - p_from) <= 366
    and s.id = p_stay_id
    and s.status = 'active'
  order by r.title, ra.date;
$$;

revoke all on function public.get_public_stay_inventory(uuid,date,date) from public;
grant execute on function public.get_public_stay_inventory(uuid,date,date) to anon, authenticated;

create or replace function public.get_public_tour_schedules(
  p_tour_id uuid,
  p_from date,
  p_to date
)
returns table (
  schedule_id uuid,
  tour_id uuid,
  schedule_date date,
  start_time time,
  capacity integer,
  booked_count integer,
  remaining_count integer,
  schedule_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    ts.id as schedule_id,
    ts.tour_id,
    ts.date as schedule_date,
    ts.time as start_time,
    ts.capacity,
    ts.booked_count,
    greatest(ts.capacity - ts.booked_count, 0) as remaining_count,
    ts.status as schedule_status
  from public.tours as t
  join public.partners as partner
    on partner.id = t.business_id
   and partner.status = 'approved'
   and partner.business_status = 'online'
  join public.tour_schedules as ts
    on ts.tour_id = t.id
  where p_tour_id is not null
    and p_from is not null
    and p_to is not null
    and p_to > p_from
    and (p_to - p_from) <= 366
    and t.id = p_tour_id
    and t.status = 'active'
    and ts.status = 'available'
    and ts.date >= p_from
    and ts.date < p_to
    and ts.capacity > ts.booked_count
  order by ts.date, ts.time, ts.id;
$$;

revoke all on function public.get_public_tour_schedules(uuid,date,date) from public;
grant execute on function public.get_public_tour_schedules(uuid,date,date) to anon, authenticated;

-- END STAGE 006e_public_booking_inventory_read_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 006f_authenticated_read_acl_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- AUTHENTICATED READ ACL — DRAFT / NOT APPLIED
-- Prepared: 2026-08-31
--
-- Purpose:
--   Reconcile PostgreSQL table ACLs with the already-reviewed RLS read contract.
--   The recovered/local baseline can have zero table privileges for the
--   `authenticated` API role even though RLS SELECT policies exist. In that state
--   normal authenticated REST reads fail at table ACL before RLS can evaluate.
--
-- Safety model:
--   - SELECT only; no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grants;
--   - only current public BASE TABLES with RLS enabled are granted;
--   - fail closed before any grant if a current public base table lacks RLS;
--   - RLS remains the row-level authorization boundary for every authenticated read;
--   - no live apply is authorized by this draft.


DO $$
DECLARE
  v_unprotected integer;
  r record;
BEGIN
  select count(*) into v_unprotected
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if v_unprotected <> 0 then
    raise exception '006f refuses authenticated SELECT grant: % public base tables do not have RLS enabled', v_unprotected;
  end if;

  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
    order by c.relname
  loop
    execute format('grant select on table %I.%I to authenticated', r.schema_name, r.table_name);
  end loop;
END
$$;

-- END STAGE 006f_authenticated_read_acl_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 010_fk_index_baseline_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- FOREIGN KEY INDEX BASELINE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20 from live pg_constraint + pg_index inspection.
-- Depends on accepted live-schema baseline. Additive only: no DROP INDEX.
--
-- Purpose:
-- - cover currently unindexed single-column foreign keys;
-- - support RLS parent lookups, status/history reads, joins and FK delete/update checks;
-- - remove a large class of Supabase Performance Advisor warnings before real traffic.
--
-- No live apply before backup + migration baseline + staging advisor rerun.


create index if not exists idx_ai_alerts_event_id on public.ai_alerts(event_id);
create index if not exists idx_ai_decision_logs_approved_by on public.ai_decision_logs(approved_by);
create index if not exists idx_ai_recommendations_event_id on public.ai_recommendations(event_id);
create index if not exists idx_alcohol_module_settings_enabled_by on public.alcohol_module_settings(enabled_by);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);

create index if not exists idx_booking_guests_booking_id on public.booking_guests(booking_id);
create index if not exists idx_booking_status_history_booking_id on public.booking_status_history(booking_id);
create index if not exists idx_booking_status_history_changed_by on public.booking_status_history(changed_by);

create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_commissions_business_id on public.commissions(business_id);
create index if not exists idx_compliance_reviews_reviewed_by on public.compliance_reviews(reviewed_by);

create index if not exists idx_courier_assignments_assigned_by on public.courier_assignments(assigned_by);
create index if not exists idx_courier_assignments_courier_id on public.courier_assignments(courier_id);
create index if not exists idx_courier_assignments_delivery_id on public.courier_assignments(delivery_id);
create index if not exists idx_courier_locations_courier_id on public.courier_locations(courier_id);
create index if not exists idx_courier_shifts_courier_id on public.courier_shifts(courier_id);

create index if not exists idx_delivery_issues_created_by on public.delivery_issues(created_by);
create index if not exists idx_delivery_issues_delivery_id on public.delivery_issues(delivery_id);
create index if not exists idx_delivery_status_history_changed_by on public.delivery_status_history(changed_by);
create index if not exists idx_delivery_status_history_delivery_id on public.delivery_status_history(delivery_id);

create index if not exists idx_loyalty_transactions_account_id on public.loyalty_transactions(account_id);
create index if not exists idx_menu_items_category_id on public.menu_items(category_id);

create index if not exists idx_order_delivery_delivery_id on public.order_delivery(delivery_id);
create index if not exists idx_order_payments_payment_id on public.order_payments(payment_id);
create index if not exists idx_order_status_history_changed_by on public.order_status_history(changed_by);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);

create index if not exists idx_partner_profiles_business_id on public.partner_profiles(business_id);
create index if not exists idx_partners_owner_user_id on public.partners(owner_user_id);

create index if not exists idx_payments_booking_id on public.payments(booking_id);
create index if not exists idx_payments_order_id on public.payments(order_id);

create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_promo_codes_business_id on public.promo_codes(business_id);
create index if not exists idx_promo_usage_booking_id on public.promo_usage(booking_id);
create index if not exists idx_promo_usage_order_id on public.promo_usage(order_id);
create index if not exists idx_promo_usage_promo_code_id on public.promo_usage(promo_code_id);
create index if not exists idx_promo_usage_user_id on public.promo_usage(user_id);

create index if not exists idx_refunds_approved_by on public.refunds(approved_by);
create index if not exists idx_refunds_payment_id on public.refunds(payment_id);

create index if not exists idx_reviews_booking_id on public.reviews(booking_id);
create index if not exists idx_reviews_business_id on public.reviews(business_id);
create index if not exists idx_reviews_client_id on public.reviews(client_id);
create index if not exists idx_reviews_order_id on public.reviews(order_id);

create index if not exists idx_rooms_business_id on public.rooms(business_id);
create index if not exists idx_stays_category_id on public.stays(category_id);

create index if not exists idx_support_tickets_related_booking_id on public.support_tickets(related_booking_id);
create index if not exists idx_support_tickets_related_order_id on public.support_tickets(related_order_id);
create index if not exists idx_ticket_messages_sender_id on public.ticket_messages(sender_id);
create index if not exists idx_ticket_messages_ticket_id on public.ticket_messages(ticket_id);

create index if not exists idx_tours_category_id on public.tours(category_id);


-- NOTE:
-- The 009 media draft adds uploaded_by -> auth.users; its covering index should be
-- added when the final migration sequence is reconciled because 009 is a separate stack.
--
-- REQUIRED POST-APPLY STAGING CHECK:
-- rerun Supabase Performance Advisor and the live FK/index audit query. Expected:
-- no remaining unindexed single-column FKs from the pre-010 baseline.
-- END STAGE 010_fk_index_baseline_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 007_booking_transaction_core_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- ATOMIC BOOKING TRANSACTION CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- This draft is derived from the CURRENT live schema:
--   bookings(client_id,business_id,booking_type,object_id,start_date,end_date,
--            guests_count,total,status,payment_status,metadata)
--   room_availability(room_id,date,status,available_count,price_override)
--     UNIQUE(room_id,date)
--   tour_schedules(tour_id,date,time,capacity,booked_count,status)
--
-- Purpose:
-- - authoritative server-side price calculation;
-- - row locking for concurrency;
-- - no-overbooking / no-oversell within initialized inventory;
-- - caller identity from auth.uid(), never from request input;
-- - idempotent retries;
-- - one transaction for inventory + booking + status history.
--
-- IMPORTANT SAFETY CONDITIONS BEFORE APPLY:
-- 1. authoritative live-schema baseline + logical backup exist;
-- 2. RLS/security baseline is repaired and staging is available;
-- 3. room_availability and tour_schedules inventory is actually initialized;
-- 4. cancellation/refund/release semantics are approved separately;
-- 5. this is tested under real concurrent sessions.
--
-- This draft intentionally does NOT implement cancellation/refund or payment capture.


-- ---------------------------------------------------------------------------
-- 1. Client-scoped idempotency ledger embedded in booking metadata.
-- ---------------------------------------------------------------------------
-- One idempotency key cannot create multiple bookings for the same client.
-- The functions also verify the booking_type when reusing a key.

create unique index if not exists uq_bookings_client_id_idempotency_key
on public.bookings (client_id, ((metadata ->> 'idempotency_key')))
where metadata ? 'idempotency_key';

-- ---------------------------------------------------------------------------
-- 2. Stay booking RPC
-- Date model: [start_date, end_date), i.e. checkout day is NOT consumed.
-- Inventory rows must already exist for every consumed night.
-- ---------------------------------------------------------------------------

create or replace function public.create_stay_booking_atomic(
  p_room_id uuid,
  p_start_date date,
  p_end_date date,
  p_guests_count integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_business_id uuid;
  v_room_capacity integer;
  v_base_price numeric;
  v_nights integer;
  v_inventory_rows integer;
  v_available_rows integer;
  v_updated_rows integer;
  v_total numeric;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'invalid_stay_dates' using errcode = '22023';
  end if;

  if p_guests_count is null or p_guests_count < 1 then
    raise exception 'invalid_guests_count' using errcode = '22023';
  end if;

  -- Fast retry path before inventory locking.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select r.business_id, r.capacity, r.price_per_night
    into v_business_id, v_room_capacity, v_base_price
  from public.rooms as r
  where r.id = p_room_id
    and r.status = 'active';

  if v_business_id is null then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  if p_guests_count > v_room_capacity then
    raise exception 'room_capacity_exceeded' using errcode = '22023';
  end if;

  v_nights := p_end_date - p_start_date;

  -- Lock the exact date rows in deterministic order. Missing rows fail closed.
  perform 1
  from public.room_availability as ra
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date
  order by ra.date
  for update;

  -- Concurrent retry path after lock wait.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (where ra.status = 'available' and ra.available_count > 0)::integer,
    coalesce(sum(coalesce(ra.price_override, v_base_price)), 0)
    into v_inventory_rows, v_available_rows, v_total
  from public.room_availability as ra
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date;

  if v_inventory_rows <> v_nights then
    raise exception 'stay_inventory_not_initialized' using errcode = 'P0001';
  end if;

  if v_available_rows <> v_nights then
    raise exception 'stay_not_available' using errcode = 'P0001';
  end if;

  if v_total <= 0 then
    raise exception 'invalid_server_price' using errcode = 'P0001';
  end if;

  update public.room_availability as ra
  set available_count = ra.available_count - 1
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date
    and ra.status = 'available'
    and ra.available_count > 0;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> v_nights then
    raise exception 'stay_inventory_changed' using errcode = '40001';
  end if;

  insert into public.bookings (
    client_id,
    business_id,
    booking_type,
    object_id,
    status,
    start_date,
    end_date,
    guests_count,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    v_business_id,
    'stay',
    p_room_id,
    'pending',
    p_start_date,
    p_end_date,
    p_guests_count,
    v_total,
    'pending',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'inventory_model', 'room_availability',
      'end_date_exclusive', true
    )
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_booking_id,
    v_user_id,
    null,
    'pending',
    'atomic_stay_booking_created'
  );

  return v_booking_id;
end;
$$;

-- SECURITY DEFINER in public must never inherit default PUBLIC execute.
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from anon;
grant execute on function public.create_stay_booking_atomic(uuid,date,date,integer,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tour schedule booking RPC
-- bookings.object_id remains the tour_id to preserve the recovered contract.
-- schedule_id is recorded in metadata because the current bookings table has no
-- dedicated schedule FK. A future additive migration may normalize that relation.
-- ---------------------------------------------------------------------------

create or replace function public.create_tour_booking_atomic(
  p_tour_schedule_id uuid,
  p_participants integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_tour_id uuid;
  v_business_id uuid;
  v_date date;
  v_time time;
  v_capacity integer;
  v_booked_count integer;
  v_price numeric;
  v_total numeric;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_participants is null or p_participants < 1 then
    raise exception 'invalid_participants' using errcode = '22023';
  end if;

  -- Fast retry path.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  -- Lock one authoritative capacity row and fetch server-side tour price/business.
  select ts.tour_id, t.business_id, ts.date, ts.time, ts.capacity, ts.booked_count, t.price
    into v_tour_id, v_business_id, v_date, v_time, v_capacity, v_booked_count, v_price
  from public.tour_schedules as ts
  join public.tours as t on t.id = ts.tour_id
  where ts.id = p_tour_schedule_id
    and ts.status = 'available'
    and t.status = 'active'
  for update of ts;

  if v_tour_id is null then
    raise exception 'tour_schedule_not_available' using errcode = 'P0001';
  end if;

  -- Concurrent retry path after lock wait.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  if v_capacity <= 0 or v_booked_count + p_participants > v_capacity then
    raise exception 'tour_capacity_exceeded' using errcode = 'P0001';
  end if;

  if v_price <= 0 then
    raise exception 'invalid_server_price' using errcode = 'P0001';
  end if;

  v_total := v_price * p_participants;

  update public.tour_schedules
  set booked_count = booked_count + p_participants
  where id = p_tour_schedule_id
    and booked_count + p_participants <= capacity;

  if not found then
    raise exception 'tour_capacity_changed' using errcode = '40001';
  end if;

  insert into public.bookings (
    client_id,
    business_id,
    booking_type,
    object_id,
    status,
    start_date,
    end_date,
    guests_count,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    v_business_id,
    'tour',
    v_tour_id,
    'pending',
    v_date,
    null,
    p_participants,
    v_total,
    'pending',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'tour_schedule_id', p_tour_schedule_id,
      'schedule_time', v_time,
      'inventory_model', 'tour_schedules'
    )
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_booking_id,
    v_user_id,
    null,
    'pending',
    'atomic_tour_booking_created'
  );

  return v_booking_id;
end;
$$;

revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from anon;
grant execute on function public.create_tour_booking_atomic(uuid,integer,text) to authenticated;


-- ---------------------------------------------------------------------------
-- REQUIRED CONCURRENCY VERIFICATION BEFORE LIVE APPLY
-- ---------------------------------------------------------------------------
-- Stay:
-- - initialize a 3-night room availability window with available_count=1;
-- - send 10 simultaneous unique idempotency booking attempts;
-- - exactly one must commit, 9 must fail unavailable;
-- - available_count must become 0 on each consumed night, never negative;
-- - retry the winning idempotency key: same booking id, no second decrement.
--
-- Tour:
-- - initialize schedule capacity=5, booked_count=0;
-- - send concurrent requests totaling >5 participants;
-- - committed participant sum must be <=5 and booked_count equal committed sum;
-- - retry a successful idempotency key: same booking id, no second increment.
--
-- Cross-cutting:
-- - client cannot supply another client_id or total (parameters do not expose them);
-- - unauthenticated execute denied;
-- - public/anon EXECUTE denied;
-- - failed booking transaction leaves inventory unchanged;
-- - booking + initial history row commit together.
-- END STAGE 007_booking_transaction_core_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 007a_booking_direct_write_lockdown_DRAFT_NOT_APPLIED.sql
-- KÖL / booking transaction core follow-up
-- DIRECT BOOKING INSERT LOCKDOWN — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- 007 introduces server-authoritative atomic booking RPCs, but the recovered schema
-- still has a direct client INSERT policy that checks only client_id=auth.uid().
-- That direct path would let callers submit booking total/business/object fields
-- without the inventory/price transaction and therefore bypass 007.


drop policy if exists "clients create own bookings" on public.bookings;

-- Creation must go through create_stay_booking_atomic/create_tour_booking_atomic.
-- Existing SELECT and partner/admin UPDATE policies are not changed here.
revoke insert on table public.bookings from anon, authenticated;


-- STAGING PROOF:
-- 1. authenticated direct INSERT into bookings => denied.
-- 2. create_stay_booking_atomic => succeeds for valid initialized inventory.
-- 3. create_tour_booking_atomic => succeeds for valid capacity.
-- 4. client cannot inject total/client_id/business_id through RPC parameters.
-- END STAGE 007a_booking_direct_write_lockdown_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- BOOKING IDEMPOTENCY SERIALIZATION HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 007_booking_transaction_core_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
-- - serialize all retries for one (authenticated user, idempotency key) before inventory locks;
-- - make same-key/different-payload reuse an explicit conflict instead of silently replaying another booking;
-- - preserve the already-reviewed 007 inventory/price transaction bodies behind non-public internal functions.
--
-- No live apply before backup + staging + concurrency tests.


-- Preserve the reviewed 007 implementations once, then put strict wrappers back on
-- the public RPC signatures. The DO block makes source re-application safer in a
-- staging reset without pretending this is an applied migration ledger.
do $$
begin
  if to_regprocedure('public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text)') is null then
    alter function public.create_stay_booking_atomic(uuid,date,date,integer,text)
      rename to create_stay_booking_atomic_unlocked;
  end if;

  if to_regprocedure('public.create_tour_booking_atomic_unlocked(uuid,integer,text)') is null then
    alter function public.create_tour_booking_atomic(uuid,integer,text)
      rename to create_tour_booking_atomic_unlocked;
  end if;
end;
$$;

revoke all on function public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text) from anon;
revoke all on function public.create_stay_booking_atomic_unlocked(uuid,date,date,integer,text) from authenticated;

revoke all on function public.create_tour_booking_atomic_unlocked(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic_unlocked(uuid,integer,text) from anon;
revoke all on function public.create_tour_booking_atomic_unlocked(uuid,integer,text) from authenticated;

create or replace function public.create_stay_booking_atomic(
  p_room_id uuid,
  p_start_date date,
  p_end_date date,
  p_guests_count integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_existing_object_id uuid;
  v_existing_start_date date;
  v_existing_end_date date;
  v_existing_guests_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  -- Same client + same key always enters one transaction lane, including cross-type
  -- reuse. Hash collisions only over-serialize; they do not weaken correctness.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.object_id, b.start_date, b.end_date, b.guests_count
    into v_existing_id, v_existing_type, v_existing_object_id,
         v_existing_start_date, v_existing_end_date, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay'
       or v_existing_object_id <> p_room_id
       or v_existing_start_date <> p_start_date
       or v_existing_end_date is distinct from p_end_date
       or v_existing_guests_count <> p_guests_count then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_stay_booking_atomic_unlocked(
    p_room_id,
    p_start_date,
    p_end_date,
    p_guests_count,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from anon;
grant execute on function public.create_stay_booking_atomic(uuid,date,date,integer,text) to authenticated;

create or replace function public.create_tour_booking_atomic(
  p_tour_schedule_id uuid,
  p_participants integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_existing_schedule_id text;
  v_existing_guests_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.metadata ->> 'tour_schedule_id', b.guests_count
    into v_existing_id, v_existing_type, v_existing_schedule_id, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour'
       or v_existing_schedule_id is distinct from p_tour_schedule_id::text
       or v_existing_guests_count <> p_participants then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_tour_booking_atomic_unlocked(
    p_tour_schedule_id,
    p_participants,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from anon;
grant execute on function public.create_tour_booking_atomic(uuid,integer,text) to authenticated;


-- REQUIRED STAGING PROOF:
-- 1. 10 simultaneous identical stay calls with one key => one booking id returned/replayed;
--    inventory decremented exactly once.
-- 2. Same stay key with different room/date/guest payload => payload conflict, no inventory change.
-- 3. Same key reused between stay and tour => payload conflict.
-- 4. 10 simultaneous identical tour calls => one booking id; capacity incremented exactly once.
-- 5. Same tour key with different schedule/participants => payload conflict, no capacity change.
-- 6. authenticated cannot EXECUTE *_unlocked functions directly.
-- END STAGE 007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 007c_booking_temporal_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- BOOKING TEMPORAL HARDENING — DRAFT / NOT APPLIED
-- Prepared: 2026-08-21
-- Depends on: 007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
--   Reject creation of NEW Stay/Tour bookings against inventory dates that are
--   already in the past, even when a stale historical inventory row remains
--   marked available. This is enforced inside the trusted PostgreSQL RPC path,
--   not only in the UI.
--
-- Important idempotency rule:
--   An exact replay of an already-created booking is returned before the temporal
--   check. A booking that was valid when created must remain replay-safe after its
--   service date passes.
--
-- NOT APPLIED to live Supabase.


create or replace function public.create_stay_booking_atomic(
  p_room_id uuid,
  p_start_date date,
  p_end_date date,
  p_guests_count integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_existing_object_id uuid;
  v_existing_start_date date;
  v_existing_end_date date;
  v_existing_guests_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.object_id, b.start_date, b.end_date, b.guests_count
    into v_existing_id, v_existing_type, v_existing_object_id,
         v_existing_start_date, v_existing_end_date, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay'
       or v_existing_object_id <> p_room_id
       or v_existing_start_date <> p_start_date
       or v_existing_end_date is distinct from p_end_date
       or v_existing_guests_count <> p_guests_count then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  if p_start_date is null or p_start_date < current_date then
    raise exception 'stay_start_date_in_past' using errcode = '22023';
  end if;

  return public.create_stay_booking_atomic_unlocked(
    p_room_id,
    p_start_date,
    p_end_date,
    p_guests_count,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from public;
revoke all on function public.create_stay_booking_atomic(uuid,date,date,integer,text) from anon;
grant execute on function public.create_stay_booking_atomic(uuid,date,date,integer,text) to authenticated;

create or replace function public.create_tour_booking_atomic(
  p_tour_schedule_id uuid,
  p_participants integer,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_existing_schedule_id text;
  v_existing_guests_count integer;
  v_schedule_date date;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.metadata ->> 'tour_schedule_id', b.guests_count
    into v_existing_id, v_existing_type, v_existing_schedule_id, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour'
       or v_existing_schedule_id is distinct from p_tour_schedule_id::text
       or v_existing_guests_count <> p_participants then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  select ts.date
    into v_schedule_date
  from public.tour_schedules as ts
  where ts.id = p_tour_schedule_id
  for update;

  if v_schedule_date is not null and v_schedule_date < current_date then
    raise exception 'tour_schedule_in_past' using errcode = '22023';
  end if;

  return public.create_tour_booking_atomic_unlocked(
    p_tour_schedule_id,
    p_participants,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from public;
revoke all on function public.create_tour_booking_atomic(uuid,integer,text) from anon;
grant execute on function public.create_tour_booking_atomic(uuid,integer,text) to authenticated;

-- END STAGE 007c_booking_temporal_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 008_order_transaction_core_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- ATOMIC FOOD + SHOP ORDER CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Depends on the recovered schema and the staged security baseline.
-- This file MUST NOT be applied to the live database before backup + staging proof.
--
-- Goals:
-- - caller identity comes from auth.uid();
-- - caller cannot set subtotal/discount/total/payment status;
-- - all items must belong to one approved business;
-- - prices are read and snapshotted inside the DB transaction;
-- - shop stock is row-locked and decremented atomically;
-- - food does not invent ingredient inventory that the schema does not contain;
-- - idempotent retry does not create/decrement twice;
-- - order + items + initial status history + audit commit together;
-- - partner ready-for-pickup transition + history + audit commit together;
-- - direct authenticated order writes are removed from the Data API surface.
--
-- Deliberately excluded:
-- - delivery-fee calculation (no authoritative fee model exists yet);
-- - discounts/promos;
-- - payment capture/refunds;
-- - cancellation/restock;
-- - food ingredient inventory;
-- - courier dispatch.
--
-- Until a server-authoritative delivery price model exists, create_order_atomic
-- accepts pickup only and rejects delivery requests fail-closed.


-- ---------------------------------------------------------------------------
-- 1. Client-scoped idempotency
-- ---------------------------------------------------------------------------

create unique index if not exists uq_orders_client_id_idempotency_key
on public.orders (client_id, ((metadata ->> 'idempotency_key')))
where metadata ? 'idempotency_key';

-- ---------------------------------------------------------------------------
-- 2. Remove direct authenticated order mutation surface
-- ---------------------------------------------------------------------------
-- Existing live policy only checked client_id on INSERT and therefore allowed a
-- caller to submit arbitrary monetary fields. Transactional writes move to RPC.

drop policy if exists "clients create own orders draft" on public.orders;

revoke insert, update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_items from anon, authenticated;
revoke insert, update, delete on table public.order_status_history from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Atomic order creation
-- ---------------------------------------------------------------------------

create or replace function public.create_order_atomic(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_business_id uuid;
  v_existing_type text;
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_min_order numeric := 0;
  v_title text;
  v_price numeric;
  v_stock integer;
  v_partner_address text;
  v_invalid_items integer;
  v_item_count integer;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_delivery_method <> 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null
     or length(pg_catalog.btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array' using errcode = '22023';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'invalid_item_count' using errcode = '22023';
  end if;

  -- Serialize retries with the same client/idempotency pair before inventory locks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select o.id, o.business_id, o.type
    into v_existing_id, v_existing_business_id, v_existing_type
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id <> p_business_id or v_existing_type <> p_order_type then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select count(*)::integer
    into v_invalid_items
  from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
  where x.item_id is null
     or x.qty is null
     or x.qty < 1
     or x.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_order_item' using errcode = '22023';
  end if;

  select p.address
    into v_partner_address
  from public.partners as p
  where p.id = p_business_id
    and p.status = 'approved';

  if not found then
    raise exception 'business_not_available' using errcode = 'P0001';
  end if;

  if p_order_type = 'food' then
    select r.min_order_amount
      into v_min_order
    from public.restaurants as r
    where r.business_id = p_business_id;

    if not found then
      raise exception 'food_business_not_configured' using errcode = 'P0001';
    end if;

    -- Lock every referenced menu row in deterministic UUID order and calculate
    -- the authoritative subtotal. Duplicate item ids are consolidated.
    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active'
      for update;

      if not found then
        raise exception 'menu_item_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;

    if v_subtotal < coalesce(v_min_order, 0) then
      raise exception 'minimum_order_not_met' using errcode = 'P0001';
    end if;
  else
    -- Shop orders require an actual shop contour and tracked stock. NULL stock
    -- is treated as unknown, never as unlimited.
    perform 1
    from public.shops as s
    where s.business_id = p_business_id;

    if not found then
      raise exception 'shop_business_not_configured' using errcode = 'P0001';
    end if;

    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select p.title, p.price, p.stock_qty
        into v_title, v_price, v_stock
      from public.products as p
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
      for update;

      if not found then
        raise exception 'product_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      if v_stock is null then
        raise exception 'product_stock_not_tracked' using errcode = 'P0001';
      end if;

      if v_stock < v_item.qty then
        raise exception 'insufficient_product_stock' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;
  end if;

  if v_subtotal <= 0 then
    raise exception 'invalid_order_subtotal' using errcode = 'P0001';
  end if;

  insert into public.orders (
    client_id,
    business_id,
    type,
    status,
    subtotal,
    delivery_fee,
    discount,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    p_business_id,
    p_order_type,
    'new',
    v_subtotal,
    0,
    0,
    v_subtotal,
    'pending',
    pg_catalog.jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'pricing_authority', 'database',
      'delivery_method', p_delivery_method,
      'delivery_fee_model', 'not_configured_pickup_only'
    )
  )
  returning id into v_order_id;

  -- Insert snapshots from the still-locked catalog rows. Shop stock decrement is
  -- performed in the same transaction immediately before its item snapshot.
  for v_item in
    select x.item_id, sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
    order by x.item_id
  loop
    if p_order_type = 'food' then
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active';

      if not found then
        raise exception 'menu_item_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'menu_item', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    else
      update public.products as p
      set stock_qty = p.stock_qty - v_item.qty
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
        and p.stock_qty is not null
        and p.stock_qty >= v_item.qty
      returning p.title, p.price into v_title, v_price;

      if not found then
        raise exception 'product_stock_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'product', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    end if;
  end loop;

  insert into public.order_delivery (
    order_id,
    delivery_method,
    pickup_address,
    dropoff_address
  ) values (
    v_order_id,
    'pickup',
    v_partner_address,
    null
  );

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_order_id,
    v_user_id,
    null,
    'new',
    'atomic_order_created'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_user_id,
    'client',
    'create_order_atomic',
    'orders',
    v_order_id,
    null,
    pg_catalog.jsonb_build_object(
      'business_id', p_business_id,
      'type', p_order_type,
      'subtotal', v_subtotal,
      'payment_status', 'pending'
    ),
    'Atomic order created from server-authoritative catalog values.',
    'create-order-' || p_idempotency_key
  );

  return v_order_id;
end;
$$;

revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from public;
revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from anon;
grant execute on function public.create_order_atomic(uuid,text,jsonb,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Atomic partner transition: ready_for_pickup
-- ---------------------------------------------------------------------------

create or replace function public.mark_order_ready_for_pickup_atomic(
  p_order_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_status text;
  v_payment_status text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select o.business_id, o.status, o.payment_status
    into v_business_id, v_status, v_payment_status
  from public.orders as o
  where o.id = p_order_id
    and o.type in ('food', 'shop')
    and exists (
      select 1
      from public.partner_staff as ps
      where ps.business_id = o.business_id
        and ps.user_id = v_user_id
        and ps.is_active = true
    )
  for update;

  if not found then
    raise exception 'order_not_available_for_partner' using errcode = '42501';
  end if;

  -- Idempotent retry after a fully committed previous call.
  if v_status = 'ready_for_pickup' then
    return p_order_id;
  end if;

  if v_status not in ('preparing', 'accepted_by_partner') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'ready_for_pickup'
  where id = p_order_id;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_order_id,
    v_user_id,
    v_status,
    'ready_for_pickup',
    'partner_marked_ready_for_pickup_atomic'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_user_id,
    'partner',
    'mark_order_ready_for_pickup',
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'status', 'ready_for_pickup',
      'payment_status', v_payment_status
    ),
    'Partner order status transition committed atomically with history and audit.',
    'mark-ready-' || p_order_id::text
  );

  return p_order_id;
end;
$$;

revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from public;
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from anon;
grant execute on function public.mark_order_ready_for_pickup_atomic(uuid) to authenticated;


-- REQUIRED STAGING TESTS BEFORE LIVE APPLY
--
-- Shop concurrency:
-- - initialize product stock=5;
-- - send concurrent orders whose requested sum >5;
-- - committed item quantity must never exceed 5;
-- - stock_qty must never be negative;
-- - failed transactions must leave orders/items/history/audit unchanged;
-- - retry the winning idempotency key and prove no second decrement.
--
-- Food pricing:
-- - caller supplies only item ids/qty; DB price snapshot drives subtotal/total;
-- - inactive/foreign-business menu items fail;
-- - minimum order amount is enforced;
-- - no ingredient inventory is invented/decremented.
--
-- Security:
-- - caller cannot set client_id, total, payment_status, discount, delivery_fee;
-- - anonymous RPC execute is denied;
-- - authenticated direct INSERT/UPDATE/DELETE on order core tables is denied;
-- - partner A cannot transition partner B order;
-- - ready-for-pickup status/history/audit either all commit or all roll back.
--
-- Delivery requests must fail until an authoritative delivery fee/dispatch model exists.
-- END STAGE 008_order_transaction_core_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 008a_order_idempotency_payload_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- ORDER IDEMPOTENCY PAYLOAD HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Depends on 008_order_transaction_core_DRAFT_NOT_APPLIED.sql.
-- This file MUST NOT be applied to the live database before backup + staging proof.
--
-- Goals:
-- - keep the audited 008 order core intact;
-- - wrap its public entrypoint with stricter replay validation;
-- - serialize the same (client,idempotency_key) before inventory work;
-- - reject reuse of an idempotency key with a different business/type/cart/delivery payload;
-- - normalize duplicate item rows before comparison;
-- - reject an aggregated item quantity above the existing per-item limit;
-- - remove direct authenticated mutation grants from order_delivery.


-- Preserve the 008 implementation as a private internal implementation exactly once.
do $migration$
begin
  if pg_catalog.to_regprocedure('public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text)') is null then
    if pg_catalog.to_regprocedure('public.create_order_atomic(uuid,text,jsonb,text,text)') is null then
      raise exception '008 create_order_atomic is required before 008a' using errcode = '55000';
    end if;

    alter function public.create_order_atomic(uuid,text,jsonb,text,text)
      rename to create_order_atomic_v1_internal;
  end if;
end
$migration$;

revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text) from public;
revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text) from anon;
revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text) from authenticated;

create or replace function public.create_order_atomic(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_business_id uuid;
  v_existing_type text;
  v_existing_delivery_method text;
  v_incoming_cart jsonb;
  v_existing_cart jsonb;
  v_invalid_items integer;
  v_item_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type is null or p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_delivery_method is distinct from 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null
     or length(pg_catalog.btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array' using errcode = '22023';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'invalid_item_count' using errcode = '22023';
  end if;

  select count(*)::integer
    into v_invalid_items
  from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
  where x.item_id is null
     or x.qty is null
     or x.qty < 1
     or x.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_order_item' using errcode = '22023';
  end if;

  -- 008 consolidates duplicate item ids. Enforce the same per-item maximum on
  -- the consolidated cart as well so repeated rows cannot bypass qty <= 99.
  select count(*)::integer
    into v_invalid_items
  from (
    select x.item_id, pg_catalog.sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
  ) as normalized
  where normalized.qty < 1 or normalized.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_normalized_order_item' using errcode = '22023';
  end if;

  -- Serialize all retries before the internal 008 implementation takes any
  -- catalog/inventory row locks. The internal function takes the same xact lock
  -- again for new orders; PostgreSQL releases all transaction-level advisory
  -- locks automatically at transaction end.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select
    o.id,
    o.business_id,
    o.type,
    o.metadata ->> 'delivery_method'
  into
    v_existing_id,
    v_existing_business_id,
    v_existing_type,
    v_existing_delivery_method
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id is distinct from p_business_id
       or v_existing_type is distinct from p_order_type
       or v_existing_delivery_method is distinct from p_delivery_method then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', normalized.item_id::text,
        'qty', normalized.qty
      )
      order by normalized.item_id::text
    )
    into v_incoming_cart
    from (
      select x.item_id, pg_catalog.sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
    ) as normalized;

    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', stored.item_id::text,
        'qty', stored.qty
      )
      order by stored.item_id::text
    )
    into v_existing_cart
    from (
      select oi.item_id, pg_catalog.sum(oi.qty)::integer as qty
      from public.order_items as oi
      where oi.order_id = v_existing_id
      group by oi.item_id
    ) as stored;

    if coalesce(v_existing_cart, '[]'::jsonb) <> coalesce(v_incoming_cart, '[]'::jsonb) then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_order_atomic_v1_internal(
    p_business_id,
    p_order_type,
    p_items,
    p_delivery_method,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from public;
revoke all on function public.create_order_atomic(uuid,text,jsonb,text,text) from anon;
grant execute on function public.create_order_atomic(uuid,text,jsonb,text,text) to authenticated;

-- order_delivery is part of the transactional order aggregate. Normal clients
-- may read through RLS where permitted but must not mutate it directly.
revoke insert, update, delete on table public.order_delivery from anon, authenticated;


-- REQUIRED STAGING TESTS BEFORE LIVE APPLY
-- 1. Same idempotency key + same normalized cart => same order id, no second stock decrement.
-- 2. Same key + reordered items / duplicate rows with same aggregate qty => same order id.
-- 3. Same key + changed qty/item/business/type/delivery => idempotency_key_payload_conflict.
-- 4. Concurrent same-key same-payload requests => one order, one stock decrement.
-- 5. Concurrent same-key different-payload requests => one winner, conflicting retry fails.
-- 6. Aggregated duplicate quantity >99 fails before inventory locks/decrement.
-- 7. authenticated direct INSERT/UPDATE/DELETE on order_delivery is denied.
-- END STAGE 008a_order_idempotency_payload_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 008b_client_transaction_role_scope_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CLIENT TRANSACTION ROLE SCOPE — DRAFT NOT APPLIED
-- Prepared: 2026-08-21
--
-- 007/008 derive client_id from auth.uid(), but their SECURITY DEFINER RPCs are
-- callable by the authenticated database role. This invariant prevents a user
-- whose active application role is not `client` from creating a booking/order,
-- including direct REST/RPC calls that bypass the Next.js server actions.
--
-- Apply only in the reviewed staging package after backup/baseline gates pass.


create or replace function public.enforce_active_client_transaction_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is null then
    raise exception 'client_identity_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = new.client_id
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_role_required' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Trigger-only helper: callers must not invoke it directly.
revoke all on function public.enforce_active_client_transaction_identity() from public;
revoke all on function public.enforce_active_client_transaction_identity() from anon;
revoke all on function public.enforce_active_client_transaction_identity() from authenticated;

drop trigger if exists enforce_active_client_identity_on_bookings on public.bookings;
create trigger enforce_active_client_identity_on_bookings
before insert on public.bookings
for each row
execute function public.enforce_active_client_transaction_identity();

drop trigger if exists enforce_active_client_identity_on_orders on public.orders;
create trigger enforce_active_client_identity_on_orders
before insert on public.orders
for each row
execute function public.enforce_active_client_transaction_identity();


-- STAGING PROOF:
-- 1. client role + atomic booking/order RPC => insert reaches normal business rules.
-- 2. courier/partner/admin authenticated user calling the same RPC => 42501.
-- 3. direct authenticated INSERT remains denied by 007a/008 privileges.
-- 4. trigger helper has no PUBLIC/anon/authenticated EXECUTE grant.
-- END STAGE 008b_client_transaction_role_scope_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 009_catalog_media_storage_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CATALOG MEDIA + SUPABASE STORAGE CORE V2 — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on staged 005 + 006 RLS baseline.
--
-- Live facts re-verified before this restack:
-- - storage.buckets: 0 rows
-- - storage.objects: 0 rows
-- - storage.objects policies: 0
-- - public.media_files: 0 rows
-- - media_files currently has owner_type, owner_id, url, alt, sort_order only
--
-- IMPORTANT STORAGE BOUNDARY:
-- - this migration does NOT INSERT/UPDATE/DELETE storage.buckets;
-- - provision the private catalog-media bucket through Supabase Storage API first;
-- - this migration fails closed unless the exact bucket contract already exists;
-- - object bytes are always created/deleted through Storage API, never SQL.
--
-- Bucket contract:
-- - id/name: catalog-media
-- - private
-- - 8 MiB object limit
-- - JPEG/PNG/WebP/AVIF only; SVG intentionally excluded
--
-- Canonical object path:
--   <business_uuid>/<owner_type>/<owner_uuid>/<random-file>
-- owner_type: menu_item | product | tour | stay
--
-- No live apply before logical backup + accepted migration baseline + staging role tests.


-- ---------------------------------------------------------------------------
-- 1. Fail-fast Storage API provisioning precondition
-- ---------------------------------------------------------------------------

do $bucket_contract$
declare
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_expected text[] := array['image/jpeg','image/png','image/webp','image/avif']::text[];
begin
  select b.public, b.file_size_limit, b.allowed_mime_types
    into v_public, v_limit, v_mimes
  from storage.buckets as b
  where b.id = 'catalog-media'
    and b.name = 'catalog-media';

  if not found then
    raise exception 'catalog_media_bucket_missing_run_storage_api_provisioner'
      using errcode = '55000';
  end if;

  if v_public is distinct from false
     or v_limit is distinct from 8388608
     or v_mimes is null
     or not (v_mimes @> v_expected and v_expected @> v_mimes) then
    raise exception 'catalog_media_bucket_contract_mismatch'
      using errcode = '55000';
  end if;
end
$bucket_contract$;

-- ---------------------------------------------------------------------------
-- 2. media_files becomes Storage-aware
-- ---------------------------------------------------------------------------
-- url is not authoritative for private objects. Signed URLs are generated at read
-- time. Keep url nullable for compatibility/external-media future.

alter table public.media_files
  alter column url drop not null,
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists uploaded_by uuid references auth.users(id) on delete set null;

update public.media_files
set storage_bucket = coalesce(storage_bucket, 'catalog-media')
where storage_path is not null;

create unique index if not exists uq_media_files_storage_object
on public.media_files (storage_bucket, storage_path)
where storage_bucket is not null and storage_path is not null;

create index if not exists idx_media_files_owner
on public.media_files (owner_type, owner_id, sort_order);

-- ---------------------------------------------------------------------------
-- 3. Non-exposed helper schema for Storage/media policy lookups
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to anon, authenticated;

create or replace function private.catalog_media_owner_business(
  p_owner_type text,
  p_owner_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
begin
  case p_owner_type
    when 'menu_item' then
      select m.business_id into v_business_id
      from public.menu_items as m where m.id = p_owner_id;
    when 'product' then
      select p.business_id into v_business_id
      from public.products as p where p.id = p_owner_id;
    when 'tour' then
      select t.business_id into v_business_id
      from public.tours as t where t.id = p_owner_id;
    when 'stay' then
      select s.business_id into v_business_id
      from public.stays as s where s.id = p_owner_id;
    else
      return null;
  end case;

  return v_business_id;
end;
$$;

create or replace function private.catalog_media_owner_is_public(
  p_owner_type text,
  p_owner_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_business_id uuid;
  v_visible boolean := false;
begin
  v_business_id := private.catalog_media_owner_business(p_owner_type, p_owner_id);
  if v_business_id is null then
    return false;
  end if;

  case p_owner_type
    when 'menu_item' then
      select exists(
        select 1 from public.menu_items m
        where m.id = p_owner_id
          and m.business_id = v_business_id
          and m.status = 'active'
      ) into v_visible;
    when 'product' then
      select exists(
        select 1 from public.products p
        where p.id = p_owner_id
          and p.business_id = v_business_id
          and p.status = 'active'
      ) into v_visible;
    when 'tour' then
      select exists(
        select 1 from public.tours t
        where t.id = p_owner_id
          and t.business_id = v_business_id
          and t.status = 'active'
      ) into v_visible;
    when 'stay' then
      select exists(
        select 1 from public.stays s
        where s.id = p_owner_id
          and s.business_id = v_business_id
          and s.status = 'active'
      ) into v_visible;
    else
      return false;
  end case;

  if not v_visible then
    return false;
  end if;

  return exists(
    select 1 from public.partners p
    where p.id = v_business_id and p.status = 'approved'
  );
end;
$$;

create or replace function private.catalog_media_path_matches(
  p_path text,
  p_owner_type text,
  p_owner_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_folders text[];
  v_business_id uuid;
begin
  if p_path is null or p_owner_type is null or p_owner_id is null then
    return false;
  end if;

  v_folders := storage.foldername(p_path);
  if pg_catalog.array_length(v_folders, 1) <> 3 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if v_folders[2] <> p_owner_type or v_folders[3]::uuid <> p_owner_id then
    return false;
  end if;

  v_business_id := private.catalog_media_owner_business(p_owner_type, p_owner_id);
  return v_business_id is not null and v_folders[1]::uuid = v_business_id;
end;
$$;

create or replace function private.catalog_media_partner_can_manage(
  p_path text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_folders text[];
  v_business_id uuid;
  v_owner_id uuid;
  v_owner_type text;
begin
  if v_user_id is null or p_path is null then
    return false;
  end if;

  v_folders := storage.foldername(p_path);
  if pg_catalog.array_length(v_folders, 1) <> 3 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_business_id := v_folders[1]::uuid;
  v_owner_type := v_folders[2];
  v_owner_id := v_folders[3]::uuid;

  if private.catalog_media_owner_business(v_owner_type, v_owner_id) is distinct from v_business_id then
    return false;
  end if;

  return exists(
    select 1 from public.partner_staff ps
    where ps.business_id = v_business_id
      and ps.user_id = v_user_id
      and ps.is_active = true
  ) or exists(
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'super_admin'
      and ur.is_active = true
  );
end;
$$;

-- SECURITY DEFINER helpers are intentionally private-schema functions. Remove
-- default PUBLIC execute and expose only the minimum calls required by policies.
revoke all on function private.catalog_media_owner_business(text,uuid) from public;
revoke all on function private.catalog_media_owner_is_public(text,uuid) from public;
revoke all on function private.catalog_media_path_matches(text,text,uuid) from public;
revoke all on function private.catalog_media_partner_can_manage(text) from public;

grant execute on function private.catalog_media_owner_is_public(text,uuid) to anon, authenticated;
grant execute on function private.catalog_media_path_matches(text,text,uuid) to anon, authenticated;
grant execute on function private.catalog_media_partner_can_manage(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. media_files metadata RLS
-- ---------------------------------------------------------------------------

grant select on table public.media_files to anon;
grant select, insert, update, delete on table public.media_files to authenticated;

drop policy if exists "admins read media metadata" on public.media_files;
drop policy if exists "public reads visible catalog media metadata" on public.media_files;
drop policy if exists "partners read own catalog media metadata" on public.media_files;
drop policy if exists "partners create own catalog media metadata" on public.media_files;
drop policy if exists "partners update own catalog media metadata" on public.media_files;
drop policy if exists "partners delete own catalog media metadata" on public.media_files;

create policy "public reads visible catalog media metadata"
on public.media_files
for select
to anon
using (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_owner_is_public(owner_type, owner_id)
);

create policy "partners read own catalog media metadata"
on public.media_files
for select
to authenticated
using (
  (
    storage_bucket = 'catalog-media'
    and storage_path is not null
    and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
    and private.catalog_media_partner_can_manage(storage_path)
  )
  or (
    storage_bucket = 'catalog-media'
    and storage_path is not null
    and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
    and private.catalog_media_owner_is_public(owner_type, owner_id)
  )
  or public.is_admin()
);

create policy "partners create own catalog media metadata"
on public.media_files
for insert
to authenticated
with check (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and uploaded_by = (select auth.uid())
  and mime_type in ('image/jpeg','image/png','image/webp','image/avif')
  and size_bytes between 1 and 8388608
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_partner_can_manage(storage_path)
);

create policy "partners update own catalog media metadata"
on public.media_files
for update
to authenticated
using (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and private.catalog_media_partner_can_manage(storage_path)
)
with check (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and mime_type in ('image/jpeg','image/png','image/webp','image/avif')
  and size_bytes between 1 and 8388608
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_partner_can_manage(storage_path)
);

create policy "partners delete own catalog media metadata"
on public.media_files
for delete
to authenticated
using (
  storage_bucket = 'catalog-media'
  and storage_path is not null
  and private.catalog_media_path_matches(storage_path, owner_type, owner_id)
  and private.catalog_media_partner_can_manage(storage_path)
);

-- ---------------------------------------------------------------------------

-- STORAGE MANAGED POLICY OPERATIONS EXCLUDED: require supabase_storage_admin owner and Storage API setup

-- END STAGE 009_catalog_media_storage_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 009a_media_uploaded_by_fk_index_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CATALOG MEDIA uploaded_by FK index hardening — DRAFT NOT APPLIED
-- Prepared: 2026-08-21
--
-- Depends on 009_catalog_media_storage_DRAFT_NOT_APPLIED.sql.
-- 009 adds public.media_files.uploaded_by -> auth.users(id) after the earlier
-- 010 FK-index baseline has already run. Keep the complete 005→012b staging
-- sequence at zero missing leading indexes by indexing that later-added FK.
--
-- Source/staging only. Do not apply to live without the accepted backup,
-- baseline and staging gates.


create index if not exists idx_media_files_uploaded_by
on public.media_files (uploaded_by);

-- END STAGE 009a_media_uploaded_by_fk_index_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 011_payment_integrity_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PAYMENT INTEGRITY CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Provider-neutral integrity layer only. This file does NOT choose a payment
-- provider, initiate a real charge, enable refunds, or apply any live change.
--
-- Verified live facts behind this draft:
-- - public.payments currently has 0 rows;
-- - provider/provider_reference exist but are not unique;
-- - authenticated currently has INSERT/UPDATE/DELETE grants on payments;
-- - a finance-admin UPDATE policy can directly mutate payment rows;
-- - there is no provider webhook-event idempotency ledger;
-- - order/booking payment truth is stored on the parent row as payment_status.
--
-- Required before apply:
-- 1. logical backup + accepted migration baseline;
-- 2. PR #13 security baseline staged first;
-- 3. provider adapter with real signature verification;
-- 4. staging replay/idempotency/concurrency tests;
-- 5. owner decision for refunds/cancellations/provider/fees.


-- ---------------------------------------------------------------------------
-- 1. Private provider-event ledger.
-- Raw provider payloads are intentionally NOT stored here. The webhook adapter
-- should retain only a SHA-256 payload hash and sanitized non-sensitive metadata.
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  provider_reference text not null,
  event_type text not null,
  requested_status text not null,
  amount numeric,
  payload_hash text not null,
  processing_status text not null default 'received',
  payment_id uuid references public.payments(id) on delete set null,
  processing_note text,
  metadata jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint payment_provider_events_processing_status_check
    check (processing_status in ('received','applied','ignored','rejected')),
  constraint payment_provider_events_requested_status_check
    check (requested_status in ('paid','failed','cancelled','refunded')),
  constraint payment_provider_events_provider_event_unique
    unique (provider, event_id)
);

revoke all on table private.payment_provider_events from public;
revoke all on table private.payment_provider_events from anon, authenticated;
grant select, insert, update on table private.payment_provider_events to service_role;

create index if not exists idx_payment_provider_events_reference
  on private.payment_provider_events(provider, provider_reference);

create index if not exists idx_payment_provider_events_payment_id
  on private.payment_provider_events(payment_id);

-- One provider-side payment reference must identify at most one internal payment.
create unique index if not exists uq_payments_provider_reference
  on public.payments(provider, provider_reference)
  where provider is not null and provider_reference is not null;

-- ---------------------------------------------------------------------------
-- 2. Close direct payment mutation from browser/session roles.
-- Customers and finance users may still receive scoped SELECT through RLS, but
-- normal authenticated requests cannot create/change/delete financial truth.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.payments from anon, authenticated;
drop policy if exists "finance admins manage payments" on public.payments;

-- ---------------------------------------------------------------------------
-- 3. Create a provider payment attempt from authoritative parent totals.
-- This RPC is service-role only. Amount/user_id are never accepted as input.
-- ---------------------------------------------------------------------------

create or replace function public.create_payment_attempt_atomic(
  p_subject_type text,
  p_subject_id uuid,
  p_provider text,
  p_provider_reference text,
  p_method text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_total numeric;
  v_parent_payment_status text;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_subject_type not in ('order','booking') then
    raise exception 'invalid_payment_subject_type' using errcode = '22023';
  end if;

  if p_subject_id is null then
    raise exception 'payment_subject_required' using errcode = '22023';
  end if;

  if p_provider is null or length(btrim(p_provider)) < 2 or length(p_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if p_provider_reference is null
     or length(btrim(p_provider_reference)) < 4
     or length(p_provider_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if p_method is null or length(btrim(p_method)) < 2 or length(p_method) > 64 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if p_subject_type = 'order' then
    select o.client_id, o.total, o.payment_status
      into v_user_id, v_total, v_parent_payment_status
    from public.orders as o
    where o.id = p_subject_id
    for update;
  else
    select b.client_id, b.total, b.payment_status
      into v_user_id, v_total, v_parent_payment_status
    from public.bookings as b
    where b.id = p_subject_id
    for update;
  end if;

  if v_user_id is null then
    raise exception 'payment_subject_not_found' using errcode = 'P0001';
  end if;

  if v_total is null or v_total <= 0 then
    raise exception 'invalid_authoritative_total' using errcode = 'P0001';
  end if;

  if v_parent_payment_status in ('paid','refunded') then
    raise exception 'payment_subject_already_settled' using errcode = 'P0001';
  end if;

  select p.* into v_existing
  from public.payments as p
  where p.provider = p_provider
    and p.provider_reference = p_provider_reference
  limit 1;

  if v_existing.id is not null then
    if v_existing.user_id is distinct from v_user_id
       or v_existing.amount is distinct from v_total
       or (p_subject_type = 'order' and v_existing.order_id is distinct from p_subject_id)
       or (p_subject_type = 'booking' and v_existing.booking_id is distinct from p_subject_id) then
      raise exception 'provider_reference_conflict' using errcode = '23505';
    end if;

    return v_existing.id;
  end if;

  insert into public.payments (
    user_id,
    order_id,
    booking_id,
    method,
    status,
    amount,
    provider,
    provider_reference,
    metadata
  ) values (
    v_user_id,
    case when p_subject_type = 'order' then p_subject_id else null end,
    case when p_subject_type = 'booking' then p_subject_id else null end,
    btrim(p_method),
    'pending',
    v_total,
    btrim(p_provider),
    btrim(p_provider_reference),
    jsonb_build_object('source','provider_attempt_rpc','subject_type',p_subject_type)
  )
  returning id into v_payment_id;

  if p_subject_type = 'order' then
    insert into public.order_payments(order_id, payment_id)
    values (p_subject_id, v_payment_id)
    on conflict (order_id, payment_id) do nothing;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    null,
    'payment_system',
    'payment_attempt_created',
    'payments',
    v_payment_id,
    null,
    jsonb_build_object(
      'status','pending',
      'amount',v_total,
      'provider',btrim(p_provider),
      'subject_type',p_subject_type,
      'subject_id',p_subject_id
    ),
    'Authoritative provider payment attempt created.',
    'payment-attempt-' || v_payment_id::text
  );

  return v_payment_id;
end;
$$;

revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from public;
revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from anon, authenticated;
grant execute on function public.create_payment_attempt_atomic(text,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Apply an already signature-verified provider event atomically.
-- Signature verification MUST happen before this RPC in a provider-specific
-- server/Edge adapter. This function deliberately does not know provider secrets.
--
-- Refund events are recorded but NOT applied until the owner-approved refund
-- workflow exists. No automatic refund or inventory release happens here.
-- ---------------------------------------------------------------------------

create or replace function public.apply_verified_payment_event_atomic(
  p_provider text,
  p_event_id text,
  p_event_type text,
  p_provider_reference text,
  p_verified_status text,
  p_amount numeric,
  p_payload_hash text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_event_row_id uuid;
  v_existing_event private.payment_provider_events%rowtype;
  v_payment public.payments%rowtype;
  v_before_status text;
  v_parent_status text;
  v_duplicate_settlement boolean := false;
  v_action text;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_provider is null or length(btrim(p_provider)) < 2 or length(p_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if p_event_id is null or length(btrim(p_event_id)) < 3 or length(p_event_id) > 255 then
    raise exception 'invalid_provider_event_id' using errcode = '22023';
  end if;

  if p_provider_reference is null
     or length(btrim(p_provider_reference)) < 4
     or length(p_provider_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if p_verified_status not in ('paid','failed','cancelled','refunded') then
    raise exception 'invalid_verified_payment_status' using errcode = '22023';
  end if;

  if p_payload_hash is null or length(btrim(p_payload_hash)) < 32 or length(p_payload_hash) > 128 then
    raise exception 'invalid_payload_hash' using errcode = '22023';
  end if;

  insert into private.payment_provider_events (
    provider,
    event_id,
    provider_reference,
    event_type,
    requested_status,
    amount,
    payload_hash,
    metadata
  ) values (
    btrim(p_provider),
    btrim(p_event_id),
    btrim(p_provider_reference),
    coalesce(nullif(btrim(p_event_type),''),'unknown'),
    p_verified_status,
    p_amount,
    btrim(p_payload_hash),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, event_id) do nothing
  returning id into v_event_row_id;

  if v_event_row_id is null then
    select e.* into v_existing_event
    from private.payment_provider_events as e
    where e.provider = btrim(p_provider)
      and e.event_id = btrim(p_event_id)
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'applied', v_existing_event.processing_status = 'applied',
      'processing_status', v_existing_event.processing_status,
      'payment_id', v_existing_event.payment_id
    );
  end if;

  select p.* into v_payment
  from public.payments as p
  where p.provider = btrim(p_provider)
    and p.provider_reference = btrim(p_provider_reference)
  for update;

  if v_payment.id is null then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'payment_not_found',
        processed_at = now()
    where id = v_event_row_id;

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'payment_not_found');
  end if;

  update private.payment_provider_events
  set payment_id = v_payment.id
  where id = v_event_row_id;

  if (v_payment.order_id is null and v_payment.booking_id is null)
     or (v_payment.order_id is not null and v_payment.booking_id is not null) then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'invalid_payment_subject_shape',
        processed_at = now()
    where id = v_event_row_id;

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'invalid_payment_subject_shape');
  end if;

  if p_verified_status = 'paid'
     and (p_amount is null or p_amount is distinct from v_payment.amount) then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'provider_amount_mismatch',
        processed_at = now()
    where id = v_event_row_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
    ) values (
      null,
      'payment_system',
      'payment_amount_mismatch',
      'payments',
      v_payment.id,
      jsonb_build_object('expected_amount',v_payment.amount),
      jsonb_build_object('provider_amount',p_amount,'provider',p_provider,'event_id',p_event_id),
      'Verified provider event amount did not match the authoritative payment amount.',
      'payment-event-' || v_event_row_id::text
    );

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'provider_amount_mismatch');
  end if;

  -- Refund truth is intentionally held for a separate approved workflow.
  if p_verified_status = 'refunded' then
    update private.payment_provider_events
    set processing_status = 'ignored',
        processing_note = 'refund_workflow_not_enabled',
        processed_at = now()
    where id = v_event_row_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
    ) values (
      null,
      'payment_system',
      'provider_refund_event_requires_review',
      'payments',
      v_payment.id,
      jsonb_build_object('status',v_payment.status),
      jsonb_build_object('provider_status','refunded','event_id',p_event_id),
      'Provider refund event recorded but automatic refund application is disabled.',
      'payment-event-' || v_event_row_id::text
    );

    return jsonb_build_object(
      'ok', true,
      'applied', false,
      'processing_status', 'ignored',
      'code', 'refund_workflow_not_enabled',
      'payment_id', v_payment.id
    );
  end if;

  v_before_status := v_payment.status;

  if p_verified_status = 'paid' then
    if v_payment.order_id is not null then
      select o.payment_status into v_parent_status
      from public.orders as o
      where o.id = v_payment.order_id
      for update;
    else
      select b.payment_status into v_parent_status
      from public.bookings as b
      where b.id = v_payment.booking_id
      for update;
    end if;

    v_duplicate_settlement := (v_parent_status = 'paid' and v_before_status <> 'paid');

    if v_before_status <> 'paid' then
      update public.payments
      set status = 'paid', updated_at = now()
      where id = v_payment.id;
    end if;

    if v_payment.order_id is not null then
      update public.orders
      set payment_status = 'paid', updated_at = now()
      where id = v_payment.order_id
        and payment_status <> 'paid';
    else
      update public.bookings
      set payment_status = 'paid', updated_at = now()
      where id = v_payment.booking_id
        and payment_status <> 'paid';
    end if;

    v_action := case
      when v_duplicate_settlement then 'duplicate_payment_settlement_detected'
      else 'payment_marked_paid_from_verified_provider_event'
    end;
  elsif p_verified_status in ('failed','cancelled') then
    -- A failed/cancelled attempt does not mark the parent transaction failed;
    -- another payment attempt may still succeed. Never downgrade paid truth.
    if v_before_status = 'pending' then
      update public.payments
      set status = p_verified_status, updated_at = now()
      where id = v_payment.id;
    end if;

    v_action := 'payment_attempt_' || p_verified_status;
  end if;

  update private.payment_provider_events
  set processing_status = 'applied',
      processing_note = case when v_duplicate_settlement then 'duplicate_settlement_requires_review' else null end,
      processed_at = now()
  where id = v_event_row_id;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    null,
    'payment_system',
    v_action,
    'payments',
    v_payment.id,
    jsonb_build_object('status',v_before_status),
    jsonb_build_object(
      'status',case when p_verified_status = 'paid' then 'paid' else case when v_before_status = 'pending' then p_verified_status else v_before_status end end,
      'provider',p_provider,
      'event_id',p_event_id,
      'duplicate_settlement',v_duplicate_settlement
    ),
    'Verified provider payment event applied atomically.',
    'payment-event-' || v_event_row_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'applied', true,
    'payment_id', v_payment.id,
    'duplicate_settlement', v_duplicate_settlement
  );
end;
$$;

revoke all on function public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb) from public;
revoke all on function public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb) from anon, authenticated;
grant execute on function public.apply_verified_payment_event_atomic(text,text,text,text,text,numeric,text,jsonb) to service_role;


-- ---------------------------------------------------------------------------
-- STAGING VERIFICATION REQUIREMENTS
-- ---------------------------------------------------------------------------
-- 1. authenticated/anon cannot INSERT/UPDATE/DELETE public.payments.
-- 2. authenticated/anon cannot EXECUTE either payment RPC.
-- 3. service_role create_payment_attempt derives amount/user_id from order/booking.
-- 4. same (provider,provider_reference) returns same compatible payment id.
-- 5. same (provider,event_id) replay does not apply twice.
-- 6. paid event with wrong amount changes neither payment nor parent status.
-- 7. paid event atomically marks payment + parent payment_status = paid + audit + event ledger.
-- 8. failed/cancelled changes only the attempt; parent remains pending.
-- 9. refund event is recorded/ignored and never auto-refunds.
-- 10. two pending attempts that both settle are both recorded; second settlement is audited as duplicate requiring review.
-- END STAGE 011_payment_integrity_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 011a_payment_event_replay_conflict_guard_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PAYMENT EVENT REPLAY CONFLICT GUARD — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 011_payment_integrity_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
-- A repeated (provider,event_id) is a safe idempotent replay only when the
-- security-relevant event identity is the same. Reusing the same event id with
-- a different payload hash/reference/status/amount/type must fail closed.
--
-- The advisory transaction lock serializes concurrent inserts for the same
-- provider+event id so a conflicting concurrent replay cannot hide behind
-- ON CONFLICT DO NOTHING in the main payment RPC.


create or replace function private.guard_payment_provider_event_replay()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.payment_provider_events%rowtype;
begin
  -- Two-int advisory key avoids exposing event text and is transaction-scoped.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.provider),
    pg_catalog.hashtext(new.event_id)
  );

  select e.* into v_existing
  from private.payment_provider_events as e
  where e.provider = new.provider
    and e.event_id = new.event_id
  limit 1;

  if v_existing.id is null then
    return new;
  end if;

  if v_existing.provider_reference is distinct from new.provider_reference
     or v_existing.event_type is distinct from new.event_type
     or v_existing.requested_status is distinct from new.requested_status
     or v_existing.amount is distinct from new.amount
     or v_existing.payload_hash is distinct from new.payload_hash then
    raise exception 'provider_event_replay_conflict' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_payment_provider_event_replay() from public;
revoke all on function private.guard_payment_provider_event_replay() from anon, authenticated;

drop trigger if exists trg_payment_provider_event_replay_guard
on private.payment_provider_events;

create trigger trg_payment_provider_event_replay_guard
before insert on private.payment_provider_events
for each row
execute function private.guard_payment_provider_event_replay();


-- STAGING VERIFY:
-- 1. first event insert succeeds;
-- 2. exact same provider/event replay is handled idempotently by 011 RPC;
-- 3. same provider/event with a different payload_hash fails with
--    provider_event_replay_conflict;
-- 4. same provider/event with different reference/status/amount/type also fails;
-- 5. two concurrent conflicting inserts serialize and exactly one identity wins.
-- END STAGE 011a_payment_event_replay_conflict_guard_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 011b_payment_projection_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PAYMENT ATTEMPT + ORDER PAYMENT PROJECTION HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on 011_payment_integrity_DRAFT_NOT_APPLIED.sql and 011a replay guard.
--
-- Goals:
-- - serialize concurrent retries of the same provider reference;
-- - reject same provider reference reused with a different method/subject;
-- - move the preserved 011 attempt implementation out of the exposed public schema;
-- - make provider-payment financial identity immutable after creation;
-- - keep public.order_payments amount/status synchronized from public.payments;
-- - block direct browser/session mutation of order_payments;
-- - require one payment subject for provider-backed payment rows;
-- - require SHA-256-shaped provider event hashes.
--
-- This layer remains provider-neutral. It does not initiate a charge/refund and
-- does not choose fees, commissions, currencies, cancellation or refund policy.


-- ---------------------------------------------------------------------------
-- 1. Provider-backed row shape constraints
-- ---------------------------------------------------------------------------

do $constraints$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_provider_pair_check'
  ) then
    alter table public.payments
      add constraint payments_provider_pair_check
      check (
        (provider is null and provider_reference is null)
        or (provider is not null and provider_reference is not null)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_provider_subject_shape_check'
  ) then
    alter table public.payments
      add constraint payments_provider_subject_shape_check
      check (
        provider_reference is null
        or ((order_id is null) <> (booking_id is null))
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_provider_status_check'
  ) then
    alter table public.payments
      add constraint payments_provider_status_check
      check (
        provider_reference is null
        or status in ('pending','paid','failed','cancelled','refunded')
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conrelid = 'private.payment_provider_events'::regclass
      and conname = 'payment_provider_events_payload_hash_sha256_check'
  ) then
    alter table private.payment_provider_events
      add constraint payment_provider_events_payload_hash_sha256_check
      check (payload_hash ~ '^[0-9a-f]{64}$') not valid;
  end if;
end
$constraints$;

alter table public.payments validate constraint payments_provider_pair_check;
alter table public.payments validate constraint payments_provider_subject_shape_check;
alter table public.payments validate constraint payments_provider_status_check;
alter table private.payment_provider_events validate constraint payment_provider_events_payload_hash_sha256_check;

-- ---------------------------------------------------------------------------
-- 2. Preserve audited 011 attempt implementation in the non-exposed private
--    schema and add a serialized service-role public entrypoint.
-- ---------------------------------------------------------------------------

do $move_attempt$
begin
  if pg_catalog.to_regprocedure('private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text)') is null then
    if pg_catalog.to_regprocedure('public.create_payment_attempt_atomic(text,uuid,text,text,text)') is null then
      raise exception '011 create_payment_attempt_atomic is required before 011b' using errcode = '55000';
    end if;

    alter function public.create_payment_attempt_atomic(text,uuid,text,text,text)
      set schema private;
    alter function private.create_payment_attempt_atomic(text,uuid,text,text,text)
      rename to create_payment_attempt_atomic_v1_internal;
  end if;
end
$move_attempt$;

revoke all on function private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text) from public;
revoke all on function private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text) from anon, authenticated;
grant execute on function private.create_payment_attempt_atomic_v1_internal(text,uuid,text,text,text) to service_role;

create or replace function public.create_payment_attempt_atomic(
  p_subject_type text,
  p_subject_id uuid,
  p_provider text,
  p_provider_reference text,
  p_method text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_payment public.payments%rowtype;
  v_provider text := pg_catalog.btrim(p_provider);
  v_reference text := pg_catalog.btrim(p_provider_reference);
  v_method text := pg_catalog.btrim(p_method);
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if v_provider is null or length(v_provider) < 2 or length(v_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if v_reference is null or length(v_reference) < 4 or length(v_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if v_method is null or length(v_method) < 2 or length(v_method) > 64 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_provider || E'\x1f' || v_reference, 0)
  );

  v_payment_id := private.create_payment_attempt_atomic_v1_internal(
    p_subject_type,
    p_subject_id,
    v_provider,
    v_reference,
    v_method
  );

  select p.* into v_payment
  from public.payments as p
  where p.id = v_payment_id;

  if v_payment.id is null then
    raise exception 'payment_attempt_result_missing' using errcode = 'P0001';
  end if;

  if v_payment.provider is distinct from v_provider
     or v_payment.provider_reference is distinct from v_reference
     or v_payment.method is distinct from v_method
     or (p_subject_type = 'order' and (
       v_payment.order_id is distinct from p_subject_id or v_payment.booking_id is not null
     ))
     or (p_subject_type = 'booking' and (
       v_payment.booking_id is distinct from p_subject_id or v_payment.order_id is not null
     )) then
    raise exception 'provider_reference_payload_conflict' using errcode = '23505';
  end if;

  return v_payment_id;
end;
$$;

revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from public;
revoke all on function public.create_payment_attempt_atomic(text,uuid,text,text,text) from anon, authenticated;
grant execute on function public.create_payment_attempt_atomic(text,uuid,text,text,text) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Provider payment identity is immutable after creation.
-- ---------------------------------------------------------------------------

create or replace function private.guard_provider_payment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.provider_reference is not null and (
    new.user_id is distinct from old.user_id
    or new.order_id is distinct from old.order_id
    or new.booking_id is distinct from old.booking_id
    or new.amount is distinct from old.amount
    or new.provider is distinct from old.provider
    or new.provider_reference is distinct from old.provider_reference
    or new.method is distinct from old.method
  ) then
    raise exception 'provider_payment_identity_immutable' using errcode = '23000';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_provider_payment_identity() from public;
revoke all on function private.guard_provider_payment_identity() from anon, authenticated;

drop trigger if exists trg_guard_provider_payment_identity on public.payments;
create trigger trg_guard_provider_payment_identity
before update of user_id, order_id, booking_id, amount, provider, provider_reference, method
on public.payments
for each row
execute function private.guard_provider_payment_identity();

-- ---------------------------------------------------------------------------
-- 4. order_payments is a projection of payment truth, not a second source.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.order_payments from anon, authenticated;

create or replace function private.normalize_order_payment_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_amount numeric;
  v_status text;
begin
  select p.order_id, p.amount, p.status
    into v_order_id, v_amount, v_status
  from public.payments as p
  where p.id = new.payment_id;

  if not found or v_order_id is null or v_order_id is distinct from new.order_id then
    raise exception 'order_payment_projection_subject_mismatch' using errcode = '23503';
  end if;

  new.amount := v_amount;
  new.status := v_status;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function private.normalize_order_payment_projection() from public;
revoke all on function private.normalize_order_payment_projection() from anon, authenticated;

drop trigger if exists trg_normalize_order_payment_projection on public.order_payments;
create trigger trg_normalize_order_payment_projection
before insert or update of order_id, payment_id, amount, status
on public.order_payments
for each row
execute function private.normalize_order_payment_projection();

create or replace function private.sync_order_payment_projection_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.order_id is not null then
    update public.order_payments
    set amount = new.amount,
        status = new.status,
        updated_at = pg_catalog.now()
    where payment_id = new.id
      and order_id = new.order_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_order_payment_projection_after_payment() from public;
revoke all on function private.sync_order_payment_projection_after_payment() from anon, authenticated;

drop trigger if exists trg_sync_order_payment_projection_after_payment on public.payments;
create trigger trg_sync_order_payment_projection_after_payment
after update of amount, status
on public.payments
for each row
execute function private.sync_order_payment_projection_after_payment();

-- Reconcile any staged/recovery rows. Current verified live KÖL has zero rows in
-- both public.payments and public.order_payments.
update public.order_payments as op
set amount = p.amount,
    status = p.status,
    updated_at = pg_catalog.now()
from public.payments as p
where p.id = op.payment_id
  and p.order_id = op.order_id
  and (op.amount is distinct from p.amount or op.status is distinct from p.status);


-- REQUIRED STAGING PROOF
-- 1. Concurrent same provider/reference/payload => same payment id, one row.
-- 2. Same provider/reference with different method/subject => payload conflict.
-- 3. Provider payment user/subject/amount/provider/reference/method cannot be rebound.
-- 4. order_payments snapshots authoritative payment amount/status, never caller/default values.
-- 5. Valid paid/failed/cancelled event keeps order_payments.status synchronized.
-- 6. authenticated/anon cannot INSERT/UPDATE/DELETE payments or order_payments.
-- 7. Provider event payload_hash must be exactly 64 lowercase hex characters.
-- 8. Refund remains fail-closed; no automatic refund or inventory release is introduced.
-- END STAGE 011b_payment_projection_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 011c_payment_service_role_acl_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PAYMENT SERVICE ROLE ACL DEPENDENCY — DRAFT NOT APPLIED
-- Prepared: 2026-08-21
-- Depends on: 011, 011a, 011b
--
-- Purpose:
-- Payment RPCs intentionally remain SECURITY INVOKER and executable only by
-- service_role. They therefore need explicit table privileges for the exact
-- parent/payment/audit operations they perform. This layer is additive: it does
-- not grant browser roles any mutation capability, does not choose a provider,
-- and does not enable refunds.


-- Parent transaction truth read/settlement.
grant select, update on table public.orders to service_role;
grant select, update on table public.bookings to service_role;

-- Provider-backed payment attempt/event truth.
grant select, insert, update on table public.payments to service_role;

-- Order-payment projection is created with INSERT ... ON CONFLICT DO NOTHING.
-- PostgreSQL conflict handling needs SELECT on the projection relation in
-- addition to INSERT. Synchronization after settlement is performed by the
-- trusted SECURITY DEFINER trigger from 011b.
grant select, insert on table public.order_payments to service_role;

-- Trusted payment RPCs append immutable audit evidence. Browser/session roles
-- remain locked down by 006a.
grant insert on table public.audit_logs to service_role;


-- No live SQL is executed by committing this file. It remains DRAFT_NOT_APPLIED.
-- END STAGE 011c_payment_service_role_acl_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- DELIVERY LIFECYCLE CORE — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
--
-- Scope: courier assignment + physical delivery progress only.
-- Delivery pricing/fee calculation and delivery-row creation remain out of scope
-- until an authoritative delivery-fee contract exists.
--
-- Verified live facts:
-- - 1 demo delivery exists, status=courier_assigned;
-- - live delivery workflow already uses detailed status names;
-- - authenticated has broad table grants on delivery operational tables;
-- - current courier UPDATE policy limits rows but not columns, so a courier can
--   potentially change assignment/address/risk metadata through direct PATCH;
-- - courier profile availability uses online/offline/busy semantics.
--
-- Required before apply: backup + accepted baseline + PR #13 staging + role tests.


-- ---------------------------------------------------------------------------
-- 1. Close direct mutation entrypoints. Reads remain RLS-scoped.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on table public.deliveries from anon, authenticated;
revoke insert, update, delete on table public.order_delivery from anon, authenticated;
revoke insert, update, delete on table public.courier_assignments from anon, authenticated;
revoke insert, update, delete on table public.delivery_status_history from anon, authenticated;

drop policy if exists "couriers update assigned delivery physical status" on public.deliveries;

-- At most one active assignment record for a delivery.
create unique index if not exists uq_courier_assignments_active_delivery
on public.courier_assignments(delivery_id)
where status in ('assigned','accepted','in_progress');

-- ---------------------------------------------------------------------------
-- 2. Dispatcher assignment RPC.
-- Reassignment is allowed only before courier acceptance. After acceptance/pickup,
-- the existing high-risk/admin approval workflow remains required and is not
-- implemented by this low-risk RPC.
-- ---------------------------------------------------------------------------

create or replace function public.assign_courier_atomic(
  p_delivery_id uuid,
  p_courier_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries%rowtype;
  v_existing_courier uuid;
  v_courier_status text;
  v_assignment_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.has_role('dispatcher') or public.has_role('super_admin')) then
    raise exception 'dispatcher_role_required' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_courier_id is null then
    raise exception 'delivery_and_courier_required' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select d.* into v_delivery
  from public.deliveries as d
  where d.id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  if v_delivery.status in ('courier_accepted','courier_to_partner','arrived_at_partner','picked_up','courier_to_client','arrived_at_client','delivered','delivery_failed') then
    raise exception 'high_risk_reassignment_required' using errcode = 'P0001';
  end if;

  select cp.availability_status into v_courier_status
  from public.courier_profiles as cp
  where cp.user_id = p_courier_id
  for update;

  if v_courier_status is null then
    raise exception 'courier_profile_not_found' using errcode = 'P0001';
  end if;

  if p_courier_id = v_delivery.assigned_courier_id
     and v_delivery.status = 'courier_assigned' then
    select ca.id into v_assignment_id
    from public.courier_assignments as ca
    where ca.delivery_id = p_delivery_id
      and ca.courier_id = p_courier_id
      and ca.status in ('assigned','accepted','in_progress')
    order by ca.created_at desc
    limit 1;

    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'delivery_id',p_delivery_id,
      'courier_id',p_courier_id,
      'assignment_id',v_assignment_id,
      'status','courier_assigned'
    );
  end if;

  if v_courier_status <> 'online' then
    raise exception 'courier_not_available' using errcode = 'P0001';
  end if;

  v_existing_courier := v_delivery.assigned_courier_id;

  update public.courier_assignments
  set status = 'reassigned', updated_at = now()
  where delivery_id = p_delivery_id
    and status in ('assigned','accepted','in_progress');

  insert into public.courier_assignments (
    delivery_id,
    courier_id,
    status,
    assigned_by
  ) values (
    p_delivery_id,
    p_courier_id,
    'assigned',
    v_actor
  )
  returning id into v_assignment_id;

  update public.deliveries
  set assigned_courier_id = p_courier_id,
      status = 'courier_assigned',
      updated_at = now()
  where id = p_delivery_id;

  update public.courier_profiles
  set availability_status = 'busy', updated_at = now()
  where user_id = p_courier_id;

  if v_existing_courier is not null and v_existing_courier <> p_courier_id then
    update public.courier_profiles cp
    set availability_status = 'online', updated_at = now()
    where cp.user_id = v_existing_courier
      and not exists (
        select 1
        from public.deliveries d2
        where d2.assigned_courier_id = v_existing_courier
          and d2.id <> p_delivery_id
          and d2.status not in ('delivered','delivery_failed')
      );
  end if;

  insert into public.delivery_status_history (
    delivery_id, from_status, to_status, changed_by, reason
  ) values (
    p_delivery_id,
    v_delivery.status,
    'courier_assigned',
    v_actor,
    coalesce(nullif(btrim(p_reason),''),'dispatcher_assignment')
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor,
    'dispatcher',
    'assign_courier',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('assigned_courier_id',v_existing_courier,'status',v_delivery.status),
    jsonb_build_object('assigned_courier_id',p_courier_id,'status','courier_assigned','assignment_id',v_assignment_id),
    coalesce(nullif(btrim(p_reason),''),'Courier assigned by dispatcher.'),
    'delivery-assignment-' || v_assignment_id::text
  );

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'delivery_id',p_delivery_id,
    'courier_id',p_courier_id,
    'assignment_id',v_assignment_id,
    'status','courier_assigned'
  );
end;
$$;

revoke all on function public.assign_courier_atomic(uuid,uuid,text) from public;
revoke all on function public.assign_courier_atomic(uuid,uuid,text) from anon;
grant execute on function public.assign_courier_atomic(uuid,uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Courier-owned physical progress RPC.
-- Canonical state machine:
-- courier_assigned -> courier_accepted -> courier_to_partner -> arrived_at_partner
-- -> picked_up -> courier_to_client -> arrived_at_client -> delivered
--
-- Courier cannot change assignment, addresses, risk, payment truth, items, price,
-- or force a failure/cancellation through this RPC.
-- ---------------------------------------------------------------------------

create or replace function public.courier_transition_delivery_atomic(
  p_delivery_id uuid,
  p_to_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries%rowtype;
  v_expected_next text;
  v_old_order_status text;
  v_new_order_status text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_delivery_id is null then
    raise exception 'delivery_required' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select d.* into v_delivery
  from public.deliveries as d
  where d.id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  if v_delivery.assigned_courier_id is distinct from v_actor then
    raise exception 'delivery_not_assigned_to_courier' using errcode = '42501';
  end if;

  v_expected_next := case v_delivery.status
    when 'courier_assigned' then 'courier_accepted'
    when 'courier_accepted' then 'courier_to_partner'
    when 'courier_to_partner' then 'arrived_at_partner'
    when 'arrived_at_partner' then 'picked_up'
    when 'picked_up' then 'courier_to_client'
    when 'courier_to_client' then 'arrived_at_client'
    when 'arrived_at_client' then 'delivered'
    else null
  end;

  if p_to_status = v_delivery.status then
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'delivery_id',p_delivery_id,
      'status',v_delivery.status
    );
  end if;

  if v_expected_next is null or p_to_status is distinct from v_expected_next then
    raise exception 'invalid_delivery_status_transition' using errcode = 'P0001';
  end if;

  update public.deliveries
  set status = p_to_status, updated_at = now()
  where id = p_delivery_id;

  update public.courier_assignments
  set status = case
        when p_to_status = 'courier_accepted' then 'accepted'
        when p_to_status = 'delivered' then 'completed'
        else 'in_progress'
      end,
      updated_at = now()
  where delivery_id = p_delivery_id
    and courier_id = v_actor
    and status in ('assigned','accepted','in_progress');

  insert into public.delivery_status_history (
    delivery_id, from_status, to_status, changed_by, reason
  ) values (
    p_delivery_id,
    v_delivery.status,
    p_to_status,
    v_actor,
    coalesce(nullif(btrim(p_reason),''),'courier_physical_progress')
  );

  -- Keep operational order state coherent without touching payment truth.
  if p_to_status in ('picked_up','delivered') then
    select o.status into v_old_order_status
    from public.orders o
    where o.id = v_delivery.order_id
    for update;

    v_new_order_status := case
      when p_to_status = 'picked_up' and v_old_order_status in ('ready','ready_for_pickup') then 'delivering'
      when p_to_status = 'delivered' and v_old_order_status in ('ready','ready_for_pickup','delivering') then 'completed'
      else null
    end;

    if v_new_order_status is not null and v_new_order_status <> v_old_order_status then
      update public.orders
      set status = v_new_order_status, updated_at = now()
      where id = v_delivery.order_id;

      insert into public.order_status_history (
        order_id, from_status, to_status, changed_by, reason
      ) values (
        v_delivery.order_id,
        v_old_order_status,
        v_new_order_status,
        v_actor,
        'delivery_progress_' || p_to_status
      );
    end if;
  end if;

  if p_to_status = 'delivered' then
    update public.courier_profiles cp
    set availability_status = 'online', updated_at = now()
    where cp.user_id = v_actor
      and not exists (
        select 1
        from public.deliveries d2
        where d2.assigned_courier_id = v_actor
          and d2.id <> p_delivery_id
          and d2.status not in ('delivered','delivery_failed')
      );
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor,
    'courier',
    'courier_delivery_transition',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status',v_delivery.status),
    jsonb_build_object('status',p_to_status),
    coalesce(nullif(btrim(p_reason),''),'Courier physical delivery progress.'),
    'delivery-transition-' || p_delivery_id::text || '-' || p_to_status
  );

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'delivery_id',p_delivery_id,
    'status',p_to_status
  );
end;
$$;

revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from public;
revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from anon;
grant execute on function public.courier_transition_delivery_atomic(uuid,text,text) to authenticated;


-- STAGING TESTS REQUIRED:
-- - courier direct PATCH cannot mutate deliveries;
-- - non-dispatcher cannot assign a courier;
-- - dispatcher can assign only an online courier;
-- - reassignment after courier acceptance fails closed;
-- - courier can progress only own delivery and only one canonical step at a time;
-- - courier cannot set delivery_failed/cancelled through the progress RPC;
-- - pickup updates eligible order to delivering; delivered updates eligible order to completed;
-- - payment_status is unchanged by all delivery RPCs;
-- - history/audit/assignment changes roll back together on any failure;
-- - courier returns online only when no other active delivery remains.
-- END STAGE 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- DELIVERY ASSIGNMENT CONSISTENCY — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql
--
-- Recovery issue verified in the current demo DB:
-- - deliveries.assigned_courier_id is populated for an active delivery;
-- - courier_assignments has no matching active row;
-- - the assigned courier profile is still marked online.
--
-- This candidate repairs that derived operational consistency without hardcoded IDs.
-- It fails closed if an existing active assignment contradicts deliveries.


-- Abort instead of guessing when the normalized assignment table disagrees with
-- the delivery row that is currently the recovered operational source.
do $$
begin
  if exists (
    select 1
    from public.deliveries d
    join public.courier_assignments ca
      on ca.delivery_id = d.id
     and ca.status in ('assigned','accepted','in_progress')
    where d.status not in ('delivered','delivery_failed')
      and d.assigned_courier_id is not null
      and ca.courier_id is distinct from d.assigned_courier_id
  ) then
    raise exception 'conflicting_active_delivery_assignment_requires_review';
  end if;
end;
$$;

-- Backfill only missing normalized assignment rows for currently active deliveries.
insert into public.courier_assignments (
  delivery_id,
  courier_id,
  status,
  assigned_by
)
select
  d.id,
  d.assigned_courier_id,
  case
    when d.status = 'courier_assigned' then 'assigned'
    when d.status = 'courier_accepted' then 'accepted'
    else 'in_progress'
  end,
  null
from public.deliveries d
where d.assigned_courier_id is not null
  and d.status in (
    'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
    'picked_up','courier_to_client','arrived_at_client'
  )
  and not exists (
    select 1
    from public.courier_assignments ca
    where ca.delivery_id = d.id
      and ca.status in ('assigned','accepted','in_progress')
  );

-- Any courier who currently owns an active delivery is operationally busy.
update public.courier_profiles cp
set availability_status = 'busy',
    updated_at = now()
where exists (
  select 1
  from public.deliveries d
  where d.assigned_courier_id = cp.user_id
    and d.status in (
      'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
      'picked_up','courier_to_client','arrived_at_client'
    )
)
and cp.availability_status <> 'busy';


-- STAGING VERIFY:
-- 1. every active delivery with assigned_courier_id has exactly one active
--    courier_assignments row for the same courier;
-- 2. all couriers owning active deliveries are busy;
-- 3. no terminal delivery receives a new active assignment;
-- 4. any contradictory pre-existing active assignment aborts the transaction.
-- END STAGE 012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 012b_delivery_role_consistency_hardening_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- DELIVERY ROLE + ASSIGNMENT CONSISTENCY HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql
--             012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
-- - keep the restored 012 transaction core intact;
-- - move the original delivery RPC implementations behind private wrappers;
-- - require active dispatcher/super_admin for assignment and active courier role for progress;
-- - fix is_assigned_courier() to recognize the normalized in_progress assignment state;
-- - enforce deferred consistency between deliveries and courier_assignments;
-- - require active delivery couriers to retain a courier role/profile and busy availability.
--
-- No delivery pricing, failure/reassignment override, payout or payment behavior is added here.
-- MUST NOT be applied to live before backup + accepted baseline + staging role/concurrency proof.


create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Fix courier read helper to match the normalized assignment state machine.
-- ---------------------------------------------------------------------------

create or replace function public.is_assigned_courier(delivery uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (
    public.has_role('courier')
    and exists (
      select 1
      from public.courier_profiles cp
      where cp.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.courier_assignments ca
      where ca.courier_id = (select auth.uid())
        and ca.delivery_id = delivery
        and ca.status in ('assigned','accepted','in_progress')
    )
  )
  or public.has_role('dispatcher')
  or public.has_role('super_admin');
$$;

-- ---------------------------------------------------------------------------
-- 2. Hide the restored RPC implementations behind role-aware public wrappers.
-- ---------------------------------------------------------------------------

alter function public.assign_courier_atomic(uuid,uuid,text)
  rename to assign_courier_atomic_v1;
alter function public.assign_courier_atomic_v1(uuid,uuid,text)
  set schema private;

revoke all on function private.assign_courier_atomic_v1(uuid,uuid,text) from public;
revoke all on function private.assign_courier_atomic_v1(uuid,uuid,text) from anon, authenticated;

create or replace function public.assign_courier_atomic(
  p_delivery_id uuid,
  p_courier_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery_status text;
  v_assigned_courier uuid;
  v_active_assignment_count integer;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.has_role('dispatcher') or public.has_role('super_admin')) then
    raise exception 'dispatcher_role_required' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_courier_id is null then
    raise exception 'delivery_and_courier_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_courier_id
      and ur.role = 'courier'
      and ur.is_active = true
  ) then
    raise exception 'target_user_is_not_active_courier' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = p_courier_id
  ) then
    raise exception 'courier_profile_not_found' using errcode = 'P0001';
  end if;

  select d.status, d.assigned_courier_id
    into v_delivery_status, v_assigned_courier
  from public.deliveries d
  where d.id = p_delivery_id;

  if v_delivery_status is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  -- The restored 012 RPC treats same courier + courier_assigned as idempotent.
  -- Refuse that shortcut if normalized assignment state is missing/corrupt.
  if v_delivery_status = 'courier_assigned'
     and v_assigned_courier is not distinct from p_courier_id then
    select count(*)::integer
      into v_active_assignment_count
    from public.courier_assignments ca
    where ca.delivery_id = p_delivery_id
      and ca.courier_id = p_courier_id
      and ca.status in ('assigned','accepted','in_progress');

    if v_active_assignment_count <> 1 then
      raise exception 'delivery_assignment_inconsistent' using errcode = 'P0001';
    end if;
  end if;

  return private.assign_courier_atomic_v1(
    p_delivery_id,
    p_courier_id,
    p_reason
  );
end;
$$;

revoke all on function public.assign_courier_atomic(uuid,uuid,text) from public;
revoke all on function public.assign_courier_atomic(uuid,uuid,text) from anon;
grant execute on function public.assign_courier_atomic(uuid,uuid,text) to authenticated;

alter function public.courier_transition_delivery_atomic(uuid,text,text)
  rename to courier_transition_delivery_atomic_v1;
alter function public.courier_transition_delivery_atomic_v1(uuid,text,text)
  set schema private;

revoke all on function private.courier_transition_delivery_atomic_v1(uuid,text,text) from public;
revoke all on function private.courier_transition_delivery_atomic_v1(uuid,text,text) from anon, authenticated;

create or replace function public.courier_transition_delivery_atomic(
  p_delivery_id uuid,
  p_to_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_role('courier') then
    raise exception 'courier_role_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = v_actor
  ) then
    raise exception 'courier_profile_not_found' using errcode = '42501';
  end if;

  return private.courier_transition_delivery_atomic_v1(
    p_delivery_id,
    p_to_status,
    p_reason
  );
end;
$$;

revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from public;
revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from anon;
grant execute on function public.courier_transition_delivery_atomic(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Deferred delivery <-> assignment consistency.
-- 012a repairs the recovered demo inconsistency before these triggers are installed.
-- ---------------------------------------------------------------------------

create or replace function private.assert_delivery_assignment_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery_id uuid;
  v_status text;
  v_assigned_courier uuid;
  v_active_count integer;
  v_active_courier uuid;
  v_profile_status text;
begin
  if tg_table_name = 'deliveries' then
    if tg_op = 'DELETE' then
      v_delivery_id := old.id;
    else
      v_delivery_id := new.id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_delivery_id := old.delivery_id;
    else
      v_delivery_id := new.delivery_id;
    end if;
  end if;

  select d.status, d.assigned_courier_id
    into v_status, v_assigned_courier
  from public.deliveries d
  where d.id = v_delivery_id;

  -- Delivery may have been deleted with assignments cascading away.
  if not found then
    return null;
  end if;

  select count(*)::integer,
         max(ca.courier_id::text)::uuid
    into v_active_count, v_active_courier
  from public.courier_assignments ca
  where ca.delivery_id = v_delivery_id
    and ca.status in ('assigned','accepted','in_progress');

  if v_status in (
    'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
    'picked_up','courier_to_client','arrived_at_client'
  ) then
    if v_assigned_courier is null then
      raise exception 'active_delivery_missing_assigned_courier';
    end if;

    if v_active_count <> 1 or v_active_courier is distinct from v_assigned_courier then
      raise exception 'active_delivery_assignment_mismatch';
    end if;

    if not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_assigned_courier
        and ur.role = 'courier'
        and ur.is_active = true
    ) then
      raise exception 'active_delivery_courier_role_missing';
    end if;

    select cp.availability_status
      into v_profile_status
    from public.courier_profiles cp
    where cp.user_id = v_assigned_courier;

    if v_profile_status is null then
      raise exception 'active_delivery_courier_profile_missing';
    end if;

    if v_profile_status <> 'busy' then
      raise exception 'active_delivery_courier_not_busy';
    end if;
  elsif v_status in ('delivery_pending','courier_searching') then
    if v_active_count <> 0 then
      raise exception 'pending_delivery_has_active_assignment';
    end if;
  elsif v_status in ('delivered','delivery_failed') then
    if v_active_count <> 0 then
      raise exception 'terminal_delivery_has_active_assignment';
    end if;
  else
    raise exception 'unknown_delivery_status_consistency_check';
  end if;

  return null;
end;
$$;

revoke all on function private.assert_delivery_assignment_consistency() from public;
revoke all on function private.assert_delivery_assignment_consistency() from anon, authenticated;

drop trigger if exists trg_delivery_assignment_consistency_on_delivery on public.deliveries;
create constraint trigger trg_delivery_assignment_consistency_on_delivery
after insert or update or delete on public.deliveries
deferrable initially deferred
for each row
execute function private.assert_delivery_assignment_consistency();

drop trigger if exists trg_delivery_assignment_consistency_on_assignment on public.courier_assignments;
create constraint trigger trg_delivery_assignment_consistency_on_assignment
after insert or update or delete on public.courier_assignments
deferrable initially deferred
for each row
execute function private.assert_delivery_assignment_consistency();

create or replace function private.assert_courier_profile_delivery_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_status := null;
  else
    v_user_id := new.user_id;
    v_status := new.availability_status;
  end if;

  if exists (
    select 1
    from public.deliveries d
    where d.assigned_courier_id = v_user_id
      and d.status in (
        'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
        'picked_up','courier_to_client','arrived_at_client'
      )
  ) then
    if tg_op = 'DELETE' then
      raise exception 'cannot_delete_courier_profile_with_active_delivery';
    end if;

    if v_status <> 'busy' then
      raise exception 'courier_with_active_delivery_must_be_busy';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.assert_courier_profile_delivery_consistency() from public;
revoke all on function private.assert_courier_profile_delivery_consistency() from anon, authenticated;

drop trigger if exists trg_courier_profile_delivery_consistency on public.courier_profiles;
create constraint trigger trg_courier_profile_delivery_consistency
after insert or update or delete on public.courier_profiles
deferrable initially deferred
for each row
execute function private.assert_courier_profile_delivery_consistency();


-- REQUIRED STAGING PROOF
-- 1. 012a repairs the recovered assigned_courier_id / missing assignment mismatch.
-- 2. Same-courier replay returns idempotently only when exactly one active assignment exists.
-- 3. Target without active courier role/profile cannot be assigned.
-- 4. Courier whose role is inactive cannot progress even an already-assigned delivery.
-- 5. delivery read helper recognizes in_progress and stops recognizing stale "active" state.
-- 6. Active delivery must have exactly one matching active assignment and busy courier profile.
-- 7. Terminal delivery cannot retain an active assignment.
-- 8. Direct browser/session mutations remain revoked by 012.
-- 9. payment_status is untouched by all delivery functions/triggers.
-- END STAGE 012b_delivery_role_consistency_hardening_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 012c_courier_active_delivery_read_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- COURIER ACTIVE DELIVERY READ — DRAFT NOT APPLIED
-- Prepared: 2026-08-31
--
-- Scope: expose only the active-delivery projection required by the
-- authenticated Courier UI. This intentionally does NOT broaden direct SELECT
-- access to public.orders and does not grant any mutation authority.


create or replace function public.get_courier_active_deliveries()
returns table (
  delivery_id uuid,
  order_id uuid,
  client_id uuid,
  business_id uuid,
  type text,
  delivery_status text,
  payment_status text,
  total numeric,
  delivery_fee numeric,
  metadata jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  partner_title text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_role('courier') then
    raise exception 'courier_role_required' using errcode = '42501';
  end if;

  return query
  select
    d.id as delivery_id,
    o.id as order_id,
    o.client_id,
    o.business_id,
    o.type,
    d.status as delivery_status,
    o.payment_status,
    o.total,
    o.delivery_fee,
    o.metadata,
    o.created_at,
    greatest(o.updated_at, d.updated_at) as updated_at,
    p.title as partner_title
  from public.courier_assignments ca
  join public.deliveries d
    on d.id = ca.delivery_id
   and d.assigned_courier_id = v_actor
  join public.orders o
    on o.id = d.order_id
  left join public.partners p
    on p.id = o.business_id
  where ca.courier_id = v_actor
    and ca.status in ('assigned','accepted','in_progress')
    and d.status not in ('delivered','delivery_failed')
  order by d.updated_at desc, d.id;
end;
$$;

revoke all on function public.get_courier_active_deliveries() from public;
revoke all on function public.get_courier_active_deliveries() from anon;
grant execute on function public.get_courier_active_deliveries() to authenticated;

comment on function public.get_courier_active_deliveries() is
  'Constrained active-delivery read projection for the authenticated courier UI. Direct order SELECT remains unchanged.';

-- END STAGE 012c_courier_active_delivery_read_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 013_partner_booking_lifecycle_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PARTNER BOOKING LIFECYCLE — DRAFT / NOT APPLIED
-- Prepared: 2026-08-31
-- Hardened: 2026-09-12
--
-- Scope:
-- - partner may confirm or reject a pending booking;
-- - rejecting an atomically-created pending Stay/Tour booking releases exactly the
--   inventory that booking reserved, in the same transaction as the status change;
-- - Stay may transition confirmed -> checked_in -> completed;
-- - Tour may transition confirmed -> completed and never uses checked_in;
-- - partner may report a booking issue without mutating booking/payment truth;
-- - partner may request cancellation of a confirmed booking without performing cancellation/refund;
-- - every accepted action is ownership-scoped and audited;
-- - direct authenticated booking/history mutation stays closed.
--
-- Explicitly excluded:
-- - cancellation execution;
-- - refund/no-show/payout policy;
-- - payment status mutation;
-- - arbitrary/manual repair of legacy bookings that do not carry the atomic
--   inventory metadata contract;
-- - live/production apply.


create schema if not exists private;

-- The recovered RLS policy is broader than the operational contract because it
-- permits generic row UPDATE. Partner booking mutation is now RPC-only.
drop policy if exists "partners update own bookings" on public.bookings;
revoke update, delete on table public.bookings from anon, authenticated;
revoke insert, update, delete on table public.booking_status_history from anon, authenticated;

create or replace function private.partner_booking_action_atomic_internal(
  p_booking_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_status text;
  v_payment_status text;
  v_booking_type text;
  v_object_id uuid;
  v_start_date date;
  v_end_date date;
  v_guests_count integer;
  v_metadata jsonb;
  v_inventory_model text;
  v_target_status text;
  v_actor_role text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_nights integer;
  v_inventory_rows integer;
  v_released_rows integer;
  v_tour_schedule_id uuid;
  v_tour_booked_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id_required' using errcode = '22023';
  end if;

  if p_action not in ('confirm', 'reject', 'check_in', 'complete', 'report_issue', 'request_cancellation') then
    raise exception 'unsupported_partner_booking_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select
    b.business_id,
    b.status,
    b.payment_status,
    b.booking_type,
    b.object_id,
    b.start_date,
    b.end_date,
    b.guests_count,
    coalesce(b.metadata, '{}'::jsonb)
    into
      v_business_id,
      v_status,
      v_payment_status,
      v_booking_type,
      v_object_id,
      v_start_date,
      v_end_date,
      v_guests_count,
      v_metadata
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'booking_not_available_for_partner' using errcode = '42501';
  end if;

  -- Non-transition actions are persisted only as audit/escalation evidence.
  if p_action in ('report_issue', 'request_cancellation') then
    if p_action = 'request_cancellation' and v_status <> 'confirmed' then
      raise exception 'cancellation_request_requires_confirmed_booking' using errcode = 'P0001';
    end if;

    if p_action = 'report_issue' and v_status in ('completed', 'cancelled', 'rejected', 'no_show') then
      raise exception 'issue_report_not_allowed_for_terminal_booking' using errcode = 'P0001';
    end if;

    v_audit_action := case p_action
      when 'report_issue' then 'partner_booking_issue_reported'
      else 'partner_booking_cancellation_requested'
    end;

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_user_id
      and al.action = v_audit_action
      and al.entity_type = 'bookings'
      and al.entity_id = p_booking_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'booking_id', p_booking_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      before,
      after,
      reason,
      request_id
    ) values (
      v_user_id,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      'bookings',
      p_booking_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'status', v_status,
        'payment_status', v_payment_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'status', v_status,
        'payment_status', v_payment_status,
        'request_only', true
      ),
      coalesce(
        v_reason,
        case p_action
          when 'report_issue' then 'Partner reported a booking issue for admin review.'
          else 'Partner requested cancellation; booking and payment truth were not changed.'
        end
      ),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', false
    );
  end if;

  v_target_status := case p_action
    when 'confirm' then 'confirmed'
    when 'reject' then 'rejected'
    when 'check_in' then 'checked_in'
    when 'complete' then 'completed'
    else null
  end;

  -- A Tour must never use checked_in, even if a legacy/manual row already
  -- carries that status. Status equality alone is not proof that this RPC ran.
  if p_action = 'check_in' and v_booking_type is distinct from 'stay' then
    raise exception 'invalid_partner_booking_check_in_transition' using errcode = 'P0001';
  end if;

  -- Only a previously audited partner transition may be replayed. A legacy or
  -- admin-mutated row with the target status must not masquerade as an accepted
  -- action (or claim that rejection released inventory). The booking row lock
  -- serializes concurrent transitions; the audit is committed in the same txn.
  if v_status = v_target_status then
    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.action = 'partner_booking_' || p_action
      and al.entity_type = 'bookings'
      and al.entity_id = p_booking_id
      and al.after ->> 'status' = v_status
      and al.after ->> 'booking_type' = v_booking_type
      and (
        p_action <> 'reject'
        or al.after ->> 'inventory_released' = 'true'
      )
    limit 1;

    if v_existing_audit_id is null then
      raise exception 'partner_booking_replay_without_audit' using errcode = 'P0001';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', true,
      'inventory_released', p_action = 'reject'
    );
  end if;

  if (p_action in ('confirm', 'reject') and v_status <> 'pending') then
    raise exception 'invalid_partner_booking_status_transition' using errcode = 'P0001';
  end if;

  if p_action = 'check_in' and (v_booking_type <> 'stay' or v_status <> 'confirmed') then
    raise exception 'invalid_partner_booking_check_in_transition' using errcode = 'P0001';
  end if;

  if p_action = 'complete' and not (
    (v_booking_type = 'stay' and v_status = 'checked_in')
    or (v_booking_type = 'tour' and v_status = 'confirmed')
  ) then
    raise exception 'invalid_partner_booking_complete_transition' using errcode = 'P0001';
  end if;

  -- A pending atomic booking has already reserved inventory. Reject must release
  -- that exact reservation in this transaction. Legacy/manual bookings without the
  -- atomic inventory marker fail closed and require an explicit admin repair path.
  if p_action = 'reject' then
    v_inventory_model := v_metadata ->> 'inventory_model';

    if v_booking_type = 'stay' then
      if v_inventory_model is distinct from 'room_availability'
         or v_object_id is null
         or v_start_date is null
         or v_end_date is null
         or v_end_date <= v_start_date then
        raise exception 'stay_rejection_inventory_contract_missing' using errcode = 'P0001';
      end if;

      v_nights := v_end_date - v_start_date;

      perform 1
      from public.room_availability as ra
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date
      order by ra.date
      for update;

      select count(*)::integer
        into v_inventory_rows
      from public.room_availability as ra
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date;

      if v_inventory_rows <> v_nights then
        raise exception 'stay_rejection_inventory_missing' using errcode = 'P0001';
      end if;

      update public.room_availability as ra
      set available_count = ra.available_count + 1
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date;

      get diagnostics v_released_rows = row_count;
      if v_released_rows <> v_nights then
        raise exception 'stay_rejection_inventory_release_changed' using errcode = '40001';
      end if;

    elsif v_booking_type = 'tour' then
      if v_inventory_model is distinct from 'tour_schedules'
         or nullif(v_metadata ->> 'tour_schedule_id', '') is null
         or v_object_id is null
         or v_guests_count is null
         or v_guests_count < 1 then
        raise exception 'tour_rejection_inventory_contract_missing' using errcode = 'P0001';
      end if;

      begin
        v_tour_schedule_id := (v_metadata ->> 'tour_schedule_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'tour_rejection_schedule_id_invalid' using errcode = '22023';
      end;

      select ts.booked_count
        into v_tour_booked_count
      from public.tour_schedules as ts
      where ts.id = v_tour_schedule_id
        and ts.tour_id = v_object_id
      for update;

      if not found then
        raise exception 'tour_rejection_schedule_missing' using errcode = 'P0001';
      end if;

      if v_tour_booked_count < v_guests_count then
        raise exception 'tour_rejection_capacity_inconsistent' using errcode = 'P0001';
      end if;

      update public.tour_schedules as ts
      set booked_count = ts.booked_count - v_guests_count
      where ts.id = v_tour_schedule_id
        and ts.tour_id = v_object_id
        and ts.booked_count >= v_guests_count;

      if not found then
        raise exception 'tour_rejection_capacity_changed' using errcode = '40001';
      end if;

    else
      raise exception 'booking_rejection_type_unsupported' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings as b
  set status = v_target_status
  where b.id = p_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_booking_id,
    v_user_id,
    v_status,
    v_target_status,
    'partner_booking_' || p_action || '_atomic'
  );

  v_audit_action := 'partner_booking_' || p_action;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_user_id,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    'bookings',
    p_booking_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'booking_type', v_booking_type,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'booking_type', v_booking_type,
      'status', v_target_status,
      'payment_status', v_payment_status,
      'inventory_released', p_action = 'reject',
      'inventory_model', case when p_action = 'reject' then v_inventory_model else null end
    ),
    coalesce(v_reason, 'Partner booking lifecycle transition committed atomically.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'booking_type', v_booking_type,
    'action', p_action,
    'status', v_target_status,
    'payment_status', v_payment_status,
    'idempotent', false,
    'inventory_released', p_action = 'reject'
  );
end;
$$;

revoke all on function private.partner_booking_action_atomic_internal(uuid,text,text,text) from public;
revoke all on function private.partner_booking_action_atomic_internal(uuid,text,text,text) from anon;
revoke all on function private.partner_booking_action_atomic_internal(uuid,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_booking_action_atomic_internal(uuid,text,text,text) to authenticated;

-- Data API entrypoint is invoker-rights only. The privileged implementation stays
-- outside the exposed public schema and performs its own caller/ownership checks.
create or replace function public.partner_booking_action_atomic(
  p_booking_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_booking_action_atomic_internal(
    p_booking_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.partner_booking_action_atomic(uuid,text,text,text) from public;
revoke all on function public.partner_booking_action_atomic(uuid,text,text,text) from anon;
grant execute on function public.partner_booking_action_atomic(uuid,text,text,text) to authenticated;

comment on function public.partner_booking_action_atomic(uuid,text,text,text) is
  'Partner-scoped booking lifecycle entrypoint. Stay supports confirmed->checked_in->completed; Tour supports confirmed->completed. Reject releases trusted reserved inventory. Payment/refund truth is unchanged.';

-- END STAGE 013_partner_booking_lifecycle_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 014_partner_availability_runtime_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PARTNER AVAILABILITY RUNTIME — DRAFT / NOT APPLIED
-- Prepared: 2026-09-01
--
-- Scope:
-- - partner may close/open an owned room availability date;
-- - partner may close/open an owned tour schedule;
-- - partner may report an availability conflict as audit evidence;
-- - status changes affect only future/new booking attempts;
-- - existing booking/payment truth and inventory counters are never rewritten;
-- - direct authenticated availability DML is closed.
--
-- Explicitly excluded:
-- - price_override mutation;
-- - room available_count mutation;
-- - tour capacity/booked_count mutation;
-- - cancellation/refund/no-show/payout policy;
-- - live/production apply.


create schema if not exists private;

-- Replace the recovered broad FOR ALL policies with read-only ownership policies.
-- Operational mutations become RPC-only.
drop policy if exists "partners manage room availability" on public.room_availability;
drop policy if exists "partners manage tour schedules" on public.tour_schedules;

create policy "partners read own room availability"
on public.room_availability for select
to authenticated
using (
  exists (
    select 1
    from public.rooms as r
    where r.id = room_availability.room_id
      and (public.is_partner_for(r.business_id) or public.is_admin())
  )
);

create policy "partners read own tour schedules"
on public.tour_schedules for select
to authenticated
using (
  exists (
    select 1
    from public.tours as t
    where t.id = tour_schedules.tour_id
      and (public.is_partner_for(t.business_id) or public.is_admin())
  )
);

revoke insert, update, delete on table public.room_availability from anon, authenticated;
revoke insert, update, delete on table public.tour_schedules from anon, authenticated;

create or replace function private.partner_availability_action_atomic_internal(
  p_scope_type text,
  p_scope_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_entity_type text;
  v_status text;
  v_target_status text;
  v_date date;
  v_parent_id uuid;
  v_available_count integer;
  v_price_override numeric;
  v_capacity integer;
  v_booked_count integer;
  v_time time;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_scope_id is null then
    raise exception 'availability_scope_id_required' using errcode = '22023';
  end if;

  if p_scope_type not in ('room_date', 'tour_schedule') then
    raise exception 'unsupported_availability_scope_type' using errcode = '22023';
  end if;

  if p_action not in ('close', 'open', 'report_conflict') then
    raise exception 'unsupported_partner_availability_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  if p_scope_type = 'room_date' then
    select r.business_id, ra.room_id, ra.date, ra.status, ra.available_count, ra.price_override
      into v_business_id, v_parent_id, v_date, v_status, v_available_count, v_price_override
    from public.room_availability as ra
    join public.rooms as r on r.id = ra.room_id
    where ra.id = p_scope_id
    for update of ra;

    if not found then
      raise exception 'room_availability_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'room_availability';
  else
    select t.business_id, ts.tour_id, ts.date, ts.time, ts.status, ts.capacity, ts.booked_count
      into v_business_id, v_parent_id, v_date, v_time, v_status, v_capacity, v_booked_count
    from public.tour_schedules as ts
    join public.tours as t on t.id = ts.tour_id
    where ts.id = p_scope_id
    for update of ts;

    if not found then
      raise exception 'tour_schedule_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'tour_schedules';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'availability_not_available_for_partner' using errcode = '42501';
  end if;

  if p_action = 'report_conflict' then
    v_audit_action := 'partner_availability_conflict_reported';

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_user_id
      and al.action = v_audit_action
      and al.entity_type = v_entity_type
      and al.entity_id = p_scope_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'scope_type', p_scope_type,
        'scope_id', p_scope_id,
        'action', p_action,
        'status', v_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_user_id,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      v_entity_type,
      p_scope_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'parent_id', v_parent_id,
        'date', v_date,
        'status', v_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'parent_id', v_parent_id,
        'date', v_date,
        'status', v_status,
        'report_only', true
      ),
      coalesce(v_reason, 'Partner reported an availability conflict for operational review.'),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'action', p_action,
      'status', v_status,
      'idempotent', false
    );
  end if;

  if v_date < current_date then
    raise exception 'availability_date_in_past' using errcode = '22023';
  end if;

  v_target_status := case p_action
    when 'close' then 'closed'
    when 'open' then 'available'
    else null
  end;

  if v_status = v_target_status then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'action', p_action,
      'status', v_status,
      'idempotent', true
    );
  end if;

  -- Opening never creates capacity. Existing authoritative counters must still
  -- show at least one unit/seat available for a new booking attempt.
  if p_action = 'open' and p_scope_type = 'room_date' and v_available_count <= 0 then
    raise exception 'room_availability_capacity_exhausted' using errcode = 'P0001';
  end if;

  if p_action = 'open' and p_scope_type = 'tour_schedule' and v_booked_count >= v_capacity then
    raise exception 'tour_schedule_capacity_exhausted' using errcode = 'P0001';
  end if;

  if p_scope_type = 'room_date' then
    update public.room_availability as ra
    set status = v_target_status
    where ra.id = p_scope_id;
  else
    update public.tour_schedules as ts
    set status = v_target_status
    where ts.id = p_scope_id;
  end if;

  v_audit_action := 'partner_availability_' || p_scope_type || '_' || p_action;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_user_id,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    v_entity_type,
    p_scope_id,
    case
      when p_scope_type = 'room_date' then pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'room_id', v_parent_id,
        'date', v_date,
        'status', v_status,
        'available_count', v_available_count,
        'price_override', v_price_override
      )
      else pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'tour_id', v_parent_id,
        'date', v_date,
        'time', v_time,
        'status', v_status,
        'capacity', v_capacity,
        'booked_count', v_booked_count
      )
    end,
    case
      when p_scope_type = 'room_date' then pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'room_id', v_parent_id,
        'date', v_date,
        'status', v_target_status,
        'available_count', v_available_count,
        'price_override', v_price_override
      )
      else pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'tour_id', v_parent_id,
        'date', v_date,
        'time', v_time,
        'status', v_target_status,
        'capacity', v_capacity,
        'booked_count', v_booked_count
      )
    end,
    coalesce(v_reason, 'Partner availability status changed atomically; inventory counters and accepted bookings remain unchanged.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'scope_type', p_scope_type,
    'scope_id', p_scope_id,
    'action', p_action,
    'status', v_target_status,
    'idempotent', false
  );
end;
$$;

revoke all on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) from public;
revoke all on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) from anon;
revoke all on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_availability_action_atomic_internal(text,uuid,text,text,text) to authenticated;

create or replace function public.partner_availability_action_atomic(
  p_scope_type text,
  p_scope_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_availability_action_atomic_internal(
    p_scope_type,
    p_scope_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.partner_availability_action_atomic(text,uuid,text,text,text) from public;
revoke all on function public.partner_availability_action_atomic(text,uuid,text,text,text) from anon;
grant execute on function public.partner_availability_action_atomic(text,uuid,text,text,text) to authenticated;

comment on function public.partner_availability_action_atomic(text,uuid,text,text,text) is
  'Partner-scoped room/tour availability status entrypoint. Never changes capacity, price, booking status or payment truth.';

-- END STAGE 014_partner_availability_runtime_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 015_partner_order_lifecycle_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PARTNER FOOD + SHOP ORDER LIFECYCLE — DRAFT / NOT APPLIED
-- Prepared: 2026-09-01
--
-- Scope:
-- - partner may accept a new food/shop order;
-- - partner may move accepted orders into preparation;
-- - partner may mark prepared orders ready_for_pickup;
-- - partner may reject a NEW FOOD order only while payment is pending;
-- - partner may report an issue or request cancellation as audit-only evidence;
-- - payment, order items, prices and delivery truth are never mutated by partner actions;
-- - direct authenticated order/history mutation stays closed;
-- - the legacy public SECURITY DEFINER ready_for_pickup entrypoint is disabled.
--
-- Explicitly excluded:
-- - delivery row creation / delivery-fee calculation;
-- - paid-order rejection/refund;
-- - shop rejection/restock contract;
-- - cancellation execution;
-- - payment provider activation;
-- - live/production apply.


create schema if not exists private;

-- Partner order mutation is RPC-only. The earlier broad policy must not remain an
-- alternate update path even though table grants were already tightened by 008.
drop policy if exists "partners update own order preparation" on public.orders;
revoke update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_status_history from anon, authenticated;

-- Disable the older exposed SECURITY DEFINER pilot entrypoint. The new public
-- entrypoint below is SECURITY INVOKER and delegates to a private implementation.
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from public;
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from anon;
revoke all on function public.mark_order_ready_for_pickup_atomic(uuid) from authenticated;

create or replace function private.partner_order_action_atomic_internal(
  p_order_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_business_id uuid;
  v_order_type text;
  v_status text;
  v_payment_status text;
  v_target_status text;
  v_actor_role text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_order_id is null then
    raise exception 'order_id_required' using errcode = '22023';
  end if;

  if p_action not in (
    'accept',
    'reject',
    'start_preparing',
    'mark_ready',
    'report_issue',
    'request_cancellation'
  ) then
    raise exception 'unsupported_partner_order_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select o.business_id, o.type, o.status, o.payment_status
    into v_business_id, v_order_type, v_status, v_payment_status
  from public.orders as o
  where o.id = p_order_id
    and o.type in ('food', 'shop')
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_actor
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_actor
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'order_not_available_for_partner' using errcode = '42501';
  end if;

  -- These actions intentionally persist evidence only. They never alter order,
  -- payment, stock, delivery or item truth.
  if p_action in ('report_issue', 'request_cancellation') then
    if v_status in ('completed', 'rejected', 'cancelled') then
      raise exception 'partner_order_action_not_allowed_for_terminal_order' using errcode = 'P0001';
    end if;

    if p_action = 'request_cancellation'
       and v_status not in ('accepted_by_partner', 'preparing', 'ready_for_pickup') then
      raise exception 'cancellation_request_requires_accepted_order' using errcode = 'P0001';
    end if;

    v_audit_action := case p_action
      when 'report_issue' then 'partner_order_issue_reported'
      else 'partner_order_cancellation_requested'
    end;

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_actor
      and al.action = v_audit_action
      and al.entity_type = 'orders'
      and al.entity_id = p_order_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      before,
      after,
      reason,
      request_id
    ) values (
      v_actor,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      'orders',
      p_order_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'order_type', v_order_type,
        'status', v_status,
        'payment_status', v_payment_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'order_type', v_order_type,
        'status', v_status,
        'payment_status', v_payment_status,
        'request_only', true
      ),
      coalesce(
        v_reason,
        case p_action
          when 'report_issue' then 'Partner reported an order issue for admin review.'
          else 'Partner requested cancellation; order, stock and payment truth were not changed.'
        end
      ),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'order_id', p_order_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', false
    );
  end if;

  if p_action = 'reject' then
    if v_status = 'rejected' then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    if v_status <> 'new' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;

    -- Shop stock is decremented atomically at order creation. Until an explicit
    -- reject/restock contract exists, shop rejection must fail closed.
    if v_order_type = 'shop' then
      raise exception 'shop_reject_restock_contract_required' using errcode = 'P0001';
    end if;

    -- A paid food order would require refund/cancellation policy. Do not invent it.
    if v_payment_status <> 'pending' then
      raise exception 'paid_order_rejection_requires_admin_policy' using errcode = 'P0001';
    end if;

    v_target_status := 'rejected';
  elsif p_action = 'accept' then
    v_target_status := 'accepted_by_partner';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'new' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  elsif p_action = 'start_preparing' then
    v_target_status := 'preparing';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'accepted_by_partner' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  elsif p_action = 'mark_ready' then
    v_target_status := 'ready_for_pickup';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'preparing' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  end if;

  if v_payment_status not in ('pending', 'paid') then
    raise exception 'order_payment_state_not_operational' using errcode = 'P0001';
  end if;

  update public.orders as o
  set status = v_target_status,
      updated_at = now()
  where o.id = p_order_id;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_order_id,
    v_actor,
    v_status,
    v_target_status,
    'partner_order_' || p_action || '_atomic'
  );

  v_audit_action := 'partner_order_' || p_action;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'order_type', v_order_type,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'order_type', v_order_type,
      'status', v_target_status,
      'payment_status', v_payment_status
    ),
    coalesce(v_reason, 'Partner order lifecycle transition committed atomically.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'action', p_action,
    'status', v_target_status,
    'payment_status', v_payment_status,
    'idempotent', false
  );
end;
$$;

revoke all on function private.partner_order_action_atomic_internal(uuid,text,text,text) from public;
revoke all on function private.partner_order_action_atomic_internal(uuid,text,text,text) from anon;
revoke all on function private.partner_order_action_atomic_internal(uuid,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_order_action_atomic_internal(uuid,text,text,text) to authenticated;

create or replace function public.partner_order_action_atomic(
  p_order_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_order_action_atomic_internal(
    p_order_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.partner_order_action_atomic(uuid,text,text,text) from public;
revoke all on function public.partner_order_action_atomic(uuid,text,text,text) from anon;
grant execute on function public.partner_order_action_atomic(uuid,text,text,text) to authenticated;

comment on function public.partner_order_action_atomic(uuid,text,text,text) is
  'Partner-scoped food/shop lifecycle entrypoint. Never changes payment, delivery, item or price truth; cancellation is request-only.';

-- END STAGE 015_partner_order_lifecycle_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 016_partner_stop_runtime_DRAFT_NOT_APPLIED.sql
-- KÖL / PARTNER STOP RUNTIME — DRAFT / NOT APPLIED
-- Stops future demand only. Existing orders, bookings, payments and inventory remain unchanged.


create schema if not exists private;

create table if not exists public.partner_stop_statuses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  scope_type text not null check (scope_type in ('new_orders', 'new_bookings')),
  is_paused boolean not null default true,
  reason text,
  paused_by uuid references auth.users(id) on delete set null,
  paused_at timestamptz,
  resume_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (business_id, scope_type),
  check (reason is null or length(reason) <= 500)
);

create index if not exists idx_partner_stop_statuses_business_paused
  on public.partner_stop_statuses (business_id, is_paused, scope_type);

create index if not exists idx_partner_stop_statuses_paused_by
  on public.partner_stop_statuses (paused_by)
  where paused_by is not null;

alter table public.partner_stop_statuses enable row level security;

drop policy if exists "partners read own stop statuses" on public.partner_stop_statuses;
create policy "partners read own stop statuses"
on public.partner_stop_statuses for select
to authenticated
using (public.is_partner_for(business_id) or public.is_admin());

revoke all on table public.partner_stop_statuses from anon, authenticated;
grant select on table public.partner_stop_statuses to authenticated;

create or replace function private.partner_stop_action_atomic_internal(
  p_scope_type text,
  p_action text,
  p_request_id text,
  p_reason text default null,
  p_resume_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_scope text;
  v_scopes text[];
  v_existing_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_audit_action text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_scope_type not in ('new_orders', 'new_bookings', 'business') then
    raise exception 'unsupported_stop_scope' using errcode = '22023';
  end if;
  if p_action not in ('pause', 'resume') then
    raise exception 'unsupported_stop_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  if p_action = 'pause' and v_reason is null then
    raise exception 'pause_reason_required' using errcode = '22023';
  end if;
  if p_resume_at is not null and p_resume_at <= now() then
    raise exception 'resume_at_must_be_future' using errcode = '22023';
  end if;

  select ps.business_id, ps.role
    into v_business_id, v_actor_role
  from public.partner_staff ps
  join public.partner_profiles pp
    on pp.business_id = ps.business_id and pp.user_id = ps.user_id
  where ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'partner_stop_not_authorized' using errcode = '42501';
  end if;

  v_scopes := case when p_scope_type = 'business'
    then array['new_orders', 'new_bookings']::text[]
    else array[p_scope_type]::text[] end;

  foreach v_scope in array v_scopes loop
    -- Serialize identical business/scope mutations even before the first status row exists.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_business_id::text || ':' || v_scope, 0)
    );

    select id, pg_catalog.jsonb_build_object(
      'is_paused', is_paused, 'reason', reason, 'resume_at', resume_at
    ) into v_existing_id, v_before
    from public.partner_stop_statuses
    where business_id = v_business_id and scope_type = v_scope
    for update;

    if p_action = 'pause' then
      insert into public.partner_stop_statuses (
        business_id, scope_type, is_paused, reason, paused_by, paused_at, resume_at, updated_at
      ) values (
        v_business_id, v_scope, true, v_reason, v_user_id, now(), p_resume_at, now()
      )
      on conflict (business_id, scope_type) do update set
        is_paused = true,
        reason = excluded.reason,
        paused_by = excluded.paused_by,
        paused_at = excluded.paused_at,
        resume_at = excluded.resume_at,
        updated_at = now();
    else
      insert into public.partner_stop_statuses (
        business_id, scope_type, is_paused, reason, paused_by, paused_at, resume_at, updated_at
      ) values (
        v_business_id, v_scope, false, v_reason, v_user_id, null, null, now()
      )
      on conflict (business_id, scope_type) do update set
        is_paused = false,
        reason = excluded.reason,
        paused_by = excluded.paused_by,
        paused_at = null,
        resume_at = null,
        updated_at = now();
    end if;

    select pg_catalog.jsonb_build_object(
      'is_paused', is_paused, 'reason', reason, 'resume_at', resume_at
    ) into v_after
    from public.partner_stop_statuses
    where business_id = v_business_id and scope_type = v_scope;

    v_audit_action := 'partner_stop_' || v_scope || '_' || p_action;
    if not exists (
      select 1 from public.audit_logs al
      where al.actor_id = v_user_id and al.action = v_audit_action
        and al.entity_type = 'partner_stop_status' and al.entity_id = v_business_id
        and al.request_id = p_request_id
    ) then
      insert into public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        before, after, reason, request_id
      ) values (
        v_user_id, coalesce(v_actor_role, 'partner_manager'), v_audit_action,
        'partner_stop_status', v_business_id, coalesce(v_before, '{}'::jsonb), v_after,
        coalesce(v_reason, 'Partner resumed future demand.'), p_request_id
      );
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'business_id', v_business_id, 'scope_type', p_scope_type,
    'action', p_action, 'affected_scopes', v_scopes
  );
end;
$$;

revoke all on function private.partner_stop_action_atomic_internal(text,text,text,text,timestamptz) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_stop_action_atomic_internal(text,text,text,text,timestamptz) to authenticated;

create or replace function public.partner_stop_action_atomic(
  p_scope_type text,
  p_action text,
  p_request_id text,
  p_reason text default null,
  p_resume_at timestamptz default null
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.partner_stop_action_atomic_internal(p_scope_type, p_action, p_request_id, p_reason, p_resume_at);
$$;

revoke all on function public.partner_stop_action_atomic(text,text,text,text,timestamptz) from public, anon;
grant execute on function public.partner_stop_action_atomic(text,text,text,text,timestamptz) to authenticated;

create or replace function private.reject_paused_partner_demand()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_scope text;
begin
  v_scope := case tg_table_name when 'orders' then 'new_orders' when 'bookings' then 'new_bookings' else null end;
  if v_scope is null then raise exception 'unsupported_stop_guard_target'; end if;
  if exists (
    select 1 from public.partner_stop_statuses s
    where s.business_id = new.business_id and s.scope_type = v_scope and s.is_paused = true
      and (s.resume_at is null or s.resume_at > now())
  ) then
    raise exception 'partner_%_paused', v_scope using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_paused_partner_demand() from public, anon, authenticated;

drop trigger if exists reject_paused_partner_orders on public.orders;
create trigger reject_paused_partner_orders before insert on public.orders
for each row execute function private.reject_paused_partner_demand();

drop trigger if exists reject_paused_partner_bookings on public.bookings;
create trigger reject_paused_partner_bookings before insert on public.bookings
for each row execute function private.reject_paused_partner_demand();

comment on table public.partner_stop_statuses is
  'Partner-owned stop state for future demand only. Existing orders, bookings, payments and inventory are immutable to stop/resume.';

-- END STAGE 016_partner_stop_runtime_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 017_partner_catalog_availability_DRAFT_NOT_APPLIED.sql
-- KÖL / PARTNER CATALOG AVAILABILITY — DRAFT / NOT APPLIED
-- Operational availability for food and shop items. Moderation status, price,
-- stock and already accepted orders remain unchanged.


create schema if not exists private;

create table if not exists public.partner_catalog_item_availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  item_type text not null check (item_type in ('menu_item', 'product')),
  item_id uuid not null,
  availability_state text not null default 'available'
    check (availability_state in ('available', 'paused', 'out_of_stock')),
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, item_id),
  check (reason is null or length(reason) <= 500),
  check (availability_state = 'available' or reason is not null)
);

create index if not exists idx_partner_catalog_availability_business_state
  on public.partner_catalog_item_availability (business_id, availability_state, item_type);
create index if not exists idx_partner_catalog_availability_changed_by
  on public.partner_catalog_item_availability (changed_by)
  where changed_by is not null;

alter table public.partner_catalog_item_availability enable row level security;

drop policy if exists "partners read own catalog availability" on public.partner_catalog_item_availability;
create policy "partners read own catalog availability"
on public.partner_catalog_item_availability for select
to authenticated
using (public.is_partner_for(business_id) or public.is_admin());

revoke all on table public.partner_catalog_item_availability from anon, authenticated;
grant select on table public.partner_catalog_item_availability to authenticated;

create or replace function private.partner_catalog_availability_action_internal(
  p_item_type text,
  p_item_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_item_business_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_target_state text;
  v_before jsonb;
  v_after jsonb;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_item_type not in ('menu_item', 'product') then
    raise exception 'unsupported_catalog_item_type' using errcode = '22023';
  end if;
  if p_item_id is null then
    raise exception 'catalog_item_id_required' using errcode = '22023';
  end if;
  if p_action not in ('pause', 'resume', 'out_of_stock') then
    raise exception 'unsupported_catalog_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  if p_action <> 'resume' and v_reason is null then
    raise exception 'catalog_reason_required' using errcode = '22023';
  end if;

  select ps.business_id, ps.role
    into v_business_id, v_actor_role
  from public.partner_staff ps
  join public.partner_profiles pp
    on pp.business_id = ps.business_id and pp.user_id = ps.user_id
  where ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'partner_catalog_not_authorized' using errcode = '42501';
  end if;

  if p_item_type = 'menu_item' then
    select business_id into v_item_business_id
    from public.menu_items where id = p_item_id;
  else
    select business_id into v_item_business_id
    from public.products where id = p_item_id;
  end if;

  if v_item_business_id is null then
    raise exception 'catalog_item_not_found' using errcode = 'P0001';
  end if;
  if v_item_business_id <> v_business_id then
    raise exception 'catalog_item_ownership_mismatch' using errcode = '42501';
  end if;

  -- Serialize request-id evaluation so concurrent replays cannot diverge.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id, 0)
  );

  select al.action, al.entity_type, al.entity_id
    into v_existing_action, v_existing_entity_type, v_existing_entity_id
  from public.audit_logs al
  where al.actor_id = v_user_id and al.request_id = p_request_id
  order by al.created_at asc
  limit 1;

  if found then
    if v_existing_action <> 'partner_catalog_' || p_action
       or v_existing_entity_type <> p_item_type
       or v_existing_entity_id <> p_item_id then
      raise exception 'catalog_request_id_conflict' using errcode = '23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'idempotent_replay', true, 'business_id', v_business_id,
      'item_type', p_item_type, 'item_id', p_item_id,
      'availability_state', case p_action when 'pause' then 'paused' when 'out_of_stock' then 'out_of_stock' else 'available' end
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_item_type || ':' || p_item_id::text, 0)
  );

  select pg_catalog.jsonb_build_object(
    'availability_state', availability_state, 'reason', reason
  ) into v_before
  from public.partner_catalog_item_availability
  where item_type = p_item_type and item_id = p_item_id
  for update;

  v_target_state := case p_action
    when 'pause' then 'paused'
    when 'out_of_stock' then 'out_of_stock'
    else 'available'
  end;

  insert into public.partner_catalog_item_availability (
    business_id, item_type, item_id, availability_state, reason,
    changed_by, changed_at, updated_at
  ) values (
    v_business_id, p_item_type, p_item_id, v_target_state,
    case when p_action = 'resume' then null else v_reason end,
    v_user_id, now(), now()
  )
  on conflict (item_type, item_id) do update set
    business_id = excluded.business_id,
    availability_state = excluded.availability_state,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    changed_at = excluded.changed_at,
    updated_at = now();

  select pg_catalog.jsonb_build_object(
    'availability_state', availability_state, 'reason', reason
  ) into v_after
  from public.partner_catalog_item_availability
  where item_type = p_item_type and item_id = p_item_id;

  if not exists (
    select 1 from public.audit_logs al
    where al.actor_id = v_user_id
      and al.action = 'partner_catalog_' || p_action
      and al.entity_type = p_item_type
      and al.entity_id = p_item_id
      and al.request_id = p_request_id
  ) then
    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_user_id, coalesce(v_actor_role, 'partner_manager'),
      'partner_catalog_' || p_action, p_item_type, p_item_id,
      coalesce(v_before, '{}'::jsonb), v_after,
      coalesce(v_reason, 'Partner resumed catalog item.'), p_request_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'business_id', v_business_id,
    'item_type', p_item_type,
    'item_id', p_item_id,
    'availability_state', v_target_state
  );
end;
$$;

revoke all on function private.partner_catalog_availability_action_internal(text,uuid,text,text,text)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_catalog_availability_action_internal(text,uuid,text,text,text)
  to authenticated;

create or replace function public.partner_catalog_availability_action(
  p_item_type text,
  p_item_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_catalog_availability_action_internal(
    p_item_type, p_item_id, p_action, p_request_id, p_reason
  );
$$;

revoke all on function public.partner_catalog_availability_action(text,uuid,text,text,text)
  from public, anon;
grant execute on function public.partner_catalog_availability_action(text,uuid,text,text,text)
  to authenticated;

create or replace function private.reject_unavailable_catalog_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.item_type in ('menu_item', 'product') and new.item_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.item_type || ':' || new.item_id::text, 0)
    );
  end if;
  if new.item_type in ('menu_item', 'product') and exists (
    select 1
    from public.partner_catalog_item_availability a
    join public.orders o on o.id = new.order_id
    where a.business_id = o.business_id
      and a.item_type = new.item_type
      and a.item_id = new.item_id
      and a.availability_state <> 'available'
  ) then
    raise exception 'catalog_item_not_operationally_available' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_unavailable_catalog_order_item()
  from public, anon, authenticated;

drop trigger if exists reject_unavailable_catalog_order_items on public.order_items;
create trigger reject_unavailable_catalog_order_items
before insert on public.order_items
for each row execute function private.reject_unavailable_catalog_order_item();

comment on table public.partner_catalog_item_availability is
  'Operational availability for future food/shop demand; moderation status, price, stock and existing orders are unchanged.';

-- END STAGE 017_partner_catalog_availability_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 018_admin_catalog_moderation_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- ADMIN CATALOG MODERATION — DRAFT / NOT APPLIED
-- Prepared: 2026-09-01
--
-- Scope:
-- - fail-closed first moderation slice: approve/reject under_review catalog items;
-- - write authority is intentionally restricted to super_admin until a broader
--   admin-subrole moderation permission contract is explicitly approved;
-- - direct authenticated catalog INSERT/UPDATE/DELETE is revoked; moderation is RPC-only;
-- - every committed decision writes immutable audit evidence with actor/reason/request_id;
-- - idempotent replay is serialized per actor/request_id and must match the original payload;
-- - catalog approval fails closed on alcohol keywords across all supported domains while the alcohol module is OFF;
-- - no order, booking, payment, availability, delivery, category or partner state is mutated.
--
-- Explicitly excluded:
-- - partner catalog create/edit/submit RPCs (direct DML stays closed until that authority exists);
-- - publish/unpublish/archive/category management;
-- - partner verification or user blocking;
-- - role changes;
-- - finance/payment/refund/payout actions;
-- - live/production apply;
-- - alcohol enablement.


create schema if not exists private;

-- Catalog moderation must not have an alternate authenticated DML path.
-- Earlier partner INSERT policies only checked business ownership and did not
-- constrain status, so retaining INSERT would allow a direct active-row bypass.
revoke insert, update, delete on table public.menu_items from anon, authenticated;
revoke insert, update, delete on table public.tours from anon, authenticated;
revoke insert, update, delete on table public.stays from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;

create or replace function private.admin_catalog_moderation_atomic_internal(
  p_item_id uuid,
  p_domain text,
  p_action text,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_target_status text;
  v_business_id uuid;
  v_category_id uuid;
  v_category_title text;
  v_title text;
  v_description text;
  v_metadata jsonb;
  v_price numeric(12,2);
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_entity_type text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_existing_audit_action text;
  v_existing_audit_entity_type text;
  v_existing_audit_entity_id uuid;
  v_existing_audit_reason text;
  v_existing_audit_domain text;
  v_existing_audit_status text;
  v_searchable text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_item_id is null then
    raise exception 'item_id_required' using errcode = '22023';
  end if;

  if p_domain not in ('food', 'tours', 'stays', 'products') then
    raise exception 'unsupported_catalog_domain' using errcode = '22023';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'unsupported_catalog_moderation_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'moderation_reason_required' using errcode = '22023';
  end if;

  -- The generic app requireAdmin() is broader than catalog write authority.
  -- Until a subrole permission matrix is explicitly approved, only super_admin
  -- may commit moderation decisions.
  if not exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = v_actor
      and ur.role = 'super_admin'
      and ur.is_active = true
  ) then
    raise exception 'catalog_moderation_not_authorized' using errcode = '42501';
  end if;

  -- A moderation request id is actor-scoped authority, not merely a UI token.
  -- Serialize it before catalog row work so concurrent reuse on another entity
  -- cannot commit two distinct decisions under the same request id.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(p_request_id)
  );

  if p_domain = 'food' then
    v_entity_type := 'menu_items';
    select m.business_id, m.category_id, m.title, m.description, m.metadata, m.price, m.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.menu_items as m
    where m.id = p_item_id
    for update;
  elsif p_domain = 'tours' then
    v_entity_type := 'tours';
    select t.business_id, t.category_id, t.title, t.description, t.metadata, t.price, t.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.tours as t
    where t.id = p_item_id
    for update;
  elsif p_domain = 'stays' then
    v_entity_type := 'stays';
    select s.business_id, s.category_id, s.title, s.description, s.metadata, s.price_from, s.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.stays as s
    where s.id = p_item_id
    for update;
  else
    v_entity_type := 'products';
    select p.business_id, p.category_id, p.title, p.description, p.metadata, p.price, p.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.products as p
    where p.id = p_item_id
    for update;
  end if;

  if not found then
    raise exception 'catalog_item_not_found' using errcode = 'P0002';
  end if;

  if v_category_id is not null then
    select c.title
      into v_category_title
    from public.categories as c
    where c.id = v_category_id;
  end if;

  v_target_status := case p_action
    when 'approve' then 'approved'
    else 'rejected'
  end;
  v_audit_action := 'admin_catalog_' || p_action;

  select
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.reason,
    al.before ->> 'domain',
    al.after ->> 'status'
  into
    v_existing_audit_id,
    v_existing_audit_action,
    v_existing_audit_entity_type,
    v_existing_audit_entity_id,
    v_existing_audit_reason,
    v_existing_audit_domain,
    v_existing_audit_status
  from public.audit_logs as al
  where al.actor_id = v_actor
    and al.request_id = p_request_id
  order by al.created_at asc, al.id asc
  limit 1;

  if v_existing_audit_id is not null then
    if v_existing_audit_action is distinct from v_audit_action
       or v_existing_audit_entity_type is distinct from v_entity_type
       or v_existing_audit_entity_id is distinct from p_item_id
       or v_existing_audit_reason is distinct from v_reason
       or v_existing_audit_domain is distinct from p_domain then
      raise exception 'catalog_moderation_idempotency_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'domain', p_domain,
      'action', p_action,
      'status', coalesce(v_existing_audit_status, v_target_status),
      'idempotent', true
    );
  end if;

  -- A successful replay must always be backed by the matching immutable audit.
  -- Existing target status without that request evidence is not idempotency.
  if v_status <> 'under_review' then
    raise exception 'invalid_catalog_moderation_status_transition' using errcode = 'P0001';
  end if;

  if p_action = 'approve' then
    if v_category_id is null then
      raise exception 'catalog_category_required_for_approval' using errcode = 'P0001';
    end if;

    if v_price is null or v_price < 0 then
      raise exception 'catalog_price_invalid_for_approval' using errcode = 'P0001';
    end if;

    -- Alcohol is disabled for the whole KÖL catalog, not only Shop products.
    -- Keep this guard at DB authority so a crafted RPC call cannot bypass the UI.
    v_searchable := pg_catalog.lower(
      coalesce(v_title, '') || ' ' ||
      coalesce(v_description, '') || ' ' ||
      coalesce(v_category_title, '') || ' ' ||
      coalesce(v_metadata::text, '')
    );

    if exists (
      select 1
      from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) as blocked(keyword)
      where pg_catalog.strpos(v_searchable, blocked.keyword) > 0
    ) then
      raise exception 'alcohol_catalog_approval_blocked' using errcode = 'P0001';
    end if;
  end if;

  if p_domain = 'food' then
    update public.menu_items set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  elsif p_domain = 'tours' then
    update public.tours set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  elsif p_domain = 'stays' then
    update public.stays set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  else
    update public.products set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    'super_admin',
    v_audit_action,
    v_entity_type,
    p_item_id,
    pg_catalog.jsonb_build_object(
      'domain', p_domain,
      'business_id', v_business_id,
      'status', v_status
    ),
    pg_catalog.jsonb_build_object(
      'domain', p_domain,
      'business_id', v_business_id,
      'status', v_target_status
    ),
    v_reason,
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'domain', p_domain,
    'action', p_action,
    'status', v_target_status,
    'idempotent', false
  );
end;
$$;

revoke all on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) from public;
revoke all on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) from anon;
revoke all on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_catalog_moderation_atomic(
  p_item_id uuid,
  p_domain text,
  p_action text,
  p_request_id text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_catalog_moderation_atomic_internal(
    p_item_id,
    p_domain,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) from public;
revoke all on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) from anon;
grant execute on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) to authenticated;

comment on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) is
  'Fail-closed first Admin catalog moderation slice. Super-admin only; approve/reject under_review items with payload-bound idempotency and audit evidence. Alcohol approval is blocked across all supported catalog domains; money/order/booking/delivery truth is untouched.';

-- END STAGE 018_admin_catalog_moderation_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 019_partner_catalog_write_runtime_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- PARTNER CATALOG CREATE / EDIT / SUBMIT — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Scope:
-- - partner_owner / partner_manager only;
-- - create own-business catalog draft;
-- - edit own draft or rejected item (rejected returns to draft);
-- - submit own draft to under_review;
-- - direct authenticated catalog DML remains revoked; writes are RPC-only;
-- - every committed mutation writes immutable audit evidence;
-- - request ids are actor-scoped, payload-bound and concurrency-serialized;
-- - alcohol-like catalog content is blocked at DB authority across all domains;
-- - no publish/approve/archive, payment, order, booking, delivery or availability truth is mutated.
--
-- Explicitly excluded:
-- - Admin publish/unpublish/archive/category management;
-- - Partner direct active/published/approved status changes;
-- - Stage 21 optional catalog fields;
-- - live/production apply;
-- - alcohol enablement.


create schema if not exists private;

-- Keep the authority surface single-path. Migration 018 already revoked these;
-- repeat the revoke here so 019 is fail-closed even when reviewed independently.
revoke insert, update, delete on table public.menu_items from anon, authenticated;
revoke insert, update, delete on table public.tours from anon, authenticated;
revoke insert, update, delete on table public.stays from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;

create or replace function private.partner_catalog_write_atomic_internal(
  p_domain text,
  p_action text,
  p_item_id uuid,
  p_request_id text,
  p_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_business_id uuid;
  v_business_status text;
  v_partner_status text;
  v_entity_type text;
  v_audit_action text;
  v_status text;
  v_target_status text;
  v_new_id uuid;
  v_row_business_id uuid;

  v_title text;
  v_description text;
  v_category_id uuid;
  v_category_scope text;
  v_category_title text;
  v_price numeric(12,2);
  v_slug text;
  v_location text;
  v_duration text;
  v_stay_type text;
  v_prep integer;
  v_stock integer;
  v_searchable text;
  v_expected_scope text;

  v_existing_audit_id uuid;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_domain text;
  v_existing_input jsonb;
  v_existing_status text;
  v_input jsonb := coalesce(p_fields, '{}'::jsonb);
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_domain not in ('food', 'tours', 'stays', 'products') then
    raise exception 'unsupported_catalog_domain' using errcode = '22023';
  end if;

  if p_action not in ('create', 'update', 'submit') then
    raise exception 'unsupported_partner_catalog_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  select pp.business_id, ur.role
    into v_business_id, v_actor_role
  from public.partner_profiles as pp
  join public.user_roles as ur
    on ur.user_id = pp.user_id
   and ur.is_active = true
   and ur.role in ('partner_owner', 'partner_manager')
   and (ur.scope_id is null or ur.scope_id = pp.business_id)
  where pp.user_id = v_actor
  order by case ur.role when 'partner_owner' then 0 else 1 end
  limit 1;

  if v_business_id is null then
    raise exception 'partner_catalog_write_not_authorized' using errcode = '42501';
  end if;

  select p.status, p.business_status
    into v_partner_status, v_business_status
  from public.partners as p
  where p.id = v_business_id;

  if not found
     or coalesce(v_partner_status, '') in ('inactive','suspended','blocked','disabled')
     or coalesce(v_business_status, '') in ('inactive','suspended','blocked','disabled') then
    raise exception 'partner_business_not_writable' using errcode = '42501';
  end if;

  v_entity_type := case p_domain
    when 'food' then 'menu_items'
    when 'tours' then 'tours'
    when 'stays' then 'stays'
    else 'products'
  end;
  v_audit_action := 'partner_catalog_' || case p_action
    when 'create' then 'create_draft'
    when 'update' then 'update_draft'
    else 'submit_for_review'
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(p_request_id)
  );

  select
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.after ->> 'domain',
    al.after -> 'input',
    al.after ->> 'status'
  into
    v_existing_audit_id,
    v_existing_action,
    v_existing_entity_type,
    v_existing_entity_id,
    v_existing_domain,
    v_existing_input,
    v_existing_status
  from public.audit_logs as al
  where al.actor_id = v_actor
    and al.request_id = p_request_id
  order by al.created_at asc, al.id asc
  limit 1;

  if v_existing_audit_id is not null then
    if v_existing_action is distinct from v_audit_action
       or v_existing_entity_type is distinct from v_entity_type
       or v_existing_domain is distinct from p_domain
       or (p_action <> 'create' and v_existing_entity_id is distinct from p_item_id)
       or coalesce(v_existing_input, '{}'::jsonb) is distinct from v_input then
      raise exception 'partner_catalog_idempotency_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'item_id', v_existing_entity_id,
      'domain', p_domain,
      'action', p_action,
      'status', v_existing_status,
      'idempotent', true
    );
  end if;

  if p_action in ('create', 'update') then
    v_title := pg_catalog.btrim(coalesce(v_input ->> 'title', ''));
    v_description := nullif(pg_catalog.btrim(coalesce(v_input ->> 'description', '')), '');

    if length(v_title) < 2 or length(v_title) > 160 then
      raise exception 'catalog_title_invalid' using errcode = '22023';
    end if;
    if v_description is not null and length(v_description) > 2000 then
      raise exception 'catalog_description_too_long' using errcode = '22023';
    end if;

    if coalesce(v_input ->> 'category_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'catalog_category_required' using errcode = '22023';
    end if;
    v_category_id := (v_input ->> 'category_id')::uuid;

    v_expected_scope := case p_domain
      when 'food' then 'food'
      when 'tours' then 'tour'
      when 'stays' then 'stay'
      else 'shop'
    end;

    select c.scope, c.title
      into v_category_scope, v_category_title
    from public.categories as c
    where c.id = v_category_id;

    if not found or v_category_scope is distinct from v_expected_scope then
      raise exception 'catalog_category_scope_mismatch' using errcode = '22023';
    end if;

    if coalesce(v_input ->> 'price', '') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'catalog_price_invalid' using errcode = '22023';
    end if;
    v_price := (v_input ->> 'price')::numeric(12,2);
    if v_price < 0 or v_price > 100000000 then
      raise exception 'catalog_price_out_of_range' using errcode = '22023';
    end if;

    if p_domain in ('tours', 'stays') then
      v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(v_input ->> 'slug', '')));
      v_location := pg_catalog.btrim(coalesce(v_input ->> 'location', ''));
      if length(v_slug) < 3 or length(v_slug) > 120 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
        raise exception 'catalog_slug_invalid' using errcode = '22023';
      end if;
      if length(v_location) < 2 or length(v_location) > 200 then
        raise exception 'catalog_location_invalid' using errcode = '22023';
      end if;
    end if;

    if p_domain = 'tours' then
      v_duration := nullif(pg_catalog.btrim(coalesce(v_input ->> 'duration', '')), '');
      if v_duration is not null and length(v_duration) > 100 then
        raise exception 'tour_duration_invalid' using errcode = '22023';
      end if;
    elsif p_domain = 'stays' then
      v_stay_type := nullif(pg_catalog.btrim(coalesce(v_input ->> 'type', '')), '');
      if v_stay_type is not null and length(v_stay_type) > 100 then
        raise exception 'stay_type_invalid' using errcode = '22023';
      end if;
    elsif p_domain = 'food' then
      if nullif(pg_catalog.btrim(coalesce(v_input ->> 'preparation_time_minutes', '')), '') is not null then
        if (v_input ->> 'preparation_time_minutes') !~ '^[0-9]+$' then
          raise exception 'food_preparation_time_invalid' using errcode = '22023';
        end if;
        v_prep := (v_input ->> 'preparation_time_minutes')::integer;
        if v_prep < 1 or v_prep > 1440 then
          raise exception 'food_preparation_time_out_of_range' using errcode = '22023';
        end if;
      end if;
    else
      if coalesce(v_input ->> 'stock_qty', '') !~ '^[0-9]+$' then
        raise exception 'product_stock_invalid' using errcode = '22023';
      end if;
      v_stock := (v_input ->> 'stock_qty')::integer;
      if v_stock < 0 or v_stock > 1000000 then
        raise exception 'product_stock_out_of_range' using errcode = '22023';
      end if;
    end if;

    v_searchable := pg_catalog.lower(
      coalesce(v_title, '') || ' ' ||
      coalesce(v_description, '') || ' ' ||
      coalesce(v_category_title, '')
    );
    if exists (
      select 1
      from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) as blocked(keyword)
      where pg_catalog.strpos(v_searchable, blocked.keyword) > 0
    ) then
      raise exception 'alcohol_catalog_write_blocked' using errcode = 'P0001';
    end if;
  end if;

  if p_action = 'create' then
    if p_item_id is not null then
      raise exception 'create_item_id_must_be_null' using errcode = '22023';
    end if;

    v_new_id := gen_random_uuid();
    v_target_status := 'draft';

    if p_domain = 'food' then
      insert into public.menu_items (
        id,business_id,category_id,title,description,price,preparation_time_minutes,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_description,v_price,v_prep,'draft','{}'::jsonb
      );
    elsif p_domain = 'tours' then
      insert into public.tours (
        id,business_id,category_id,title,slug,description,location,price,currency,duration,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_slug,v_description,v_location,v_price,'KGS',v_duration,'draft','{}'::jsonb
      );
    elsif p_domain = 'stays' then
      insert into public.stays (
        id,business_id,category_id,title,slug,type,description,location,price_from,currency,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_slug,v_stay_type,v_description,v_location,v_price,'KGS','draft','{}'::jsonb
      );
    else
      insert into public.products (
        id,business_id,category_id,title,description,price,stock_qty,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_description,v_price,v_stock,'draft','{}'::jsonb
      );
    end if;

    insert into public.audit_logs (
      actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
    ) values (
      v_actor,v_actor_role,v_audit_action,v_entity_type,v_new_id,
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',null,'input',v_input),
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','draft','input',v_input),
      'Partner catalog draft created',p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok',true,'item_id',v_new_id,'domain',p_domain,'action',p_action,'status','draft','idempotent',false
    );
  end if;

  if p_item_id is null then
    raise exception 'item_id_required' using errcode = '22023';
  end if;

  if p_domain = 'food' then
    select m.business_id,m.status into v_row_business_id,v_status
    from public.menu_items as m where m.id=p_item_id for update;
  elsif p_domain = 'tours' then
    select t.business_id,t.status into v_row_business_id,v_status
    from public.tours as t where t.id=p_item_id for update;
  elsif p_domain = 'stays' then
    select s.business_id,s.status into v_row_business_id,v_status
    from public.stays as s where s.id=p_item_id for update;
  else
    select p.business_id,p.status into v_row_business_id,v_status
    from public.products as p where p.id=p_item_id for update;
  end if;

  if not found then
    raise exception 'catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_row_business_id is distinct from v_business_id then
    raise exception 'catalog_item_not_owned_by_partner' using errcode = '42501';
  end if;

  if p_action = 'update' then
    if v_status not in ('draft','rejected') then
      raise exception 'catalog_item_not_editable' using errcode = 'P0001';
    end if;
    v_target_status := 'draft';

    if p_domain = 'food' then
      update public.menu_items set
        category_id=v_category_id,title=v_title,description=v_description,price=v_price,
        preparation_time_minutes=v_prep,status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    elsif p_domain = 'tours' then
      update public.tours set
        category_id=v_category_id,title=v_title,slug=v_slug,description=v_description,location=v_location,
        price=v_price,currency='KGS',duration=v_duration,status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    elsif p_domain = 'stays' then
      update public.stays set
        category_id=v_category_id,title=v_title,slug=v_slug,type=v_stay_type,description=v_description,
        location=v_location,price_from=v_price,currency='KGS',status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    else
      update public.products set
        category_id=v_category_id,title=v_title,description=v_description,price=v_price,
        stock_qty=v_stock,status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    end if;

    insert into public.audit_logs (
      actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
    ) values (
      v_actor,v_actor_role,v_audit_action,v_entity_type,p_item_id,
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',v_status),
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','draft','input',v_input),
      'Partner catalog draft updated',p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,'status','draft','idempotent',false
    );
  end if;

  if v_status <> 'draft' then
    raise exception 'catalog_item_not_submittable' using errcode = 'P0001';
  end if;

  -- Re-read authoritative row values before review submission. This prevents a
  -- crafted empty submit request from bypassing required fields or alcohol guards.
  if p_domain = 'food' then
    select m.category_id,m.title,m.description,m.price,m.preparation_time_minutes
      into v_category_id,v_title,v_description,v_price,v_prep
    from public.menu_items as m where m.id=p_item_id;
  elsif p_domain = 'tours' then
    select t.category_id,t.title,t.slug,t.description,t.location,t.price,t.duration
      into v_category_id,v_title,v_slug,v_description,v_location,v_price,v_duration
    from public.tours as t where t.id=p_item_id;
  elsif p_domain = 'stays' then
    select s.category_id,s.title,s.slug,s.type,s.description,s.location,s.price_from
      into v_category_id,v_title,v_slug,v_stay_type,v_description,v_location,v_price
    from public.stays as s where s.id=p_item_id;
  else
    select p.category_id,p.title,p.description,p.price,p.stock_qty
      into v_category_id,v_title,v_description,v_price,v_stock
    from public.products as p where p.id=p_item_id;
  end if;

  if v_category_id is null then
    raise exception 'catalog_category_required_for_review' using errcode = 'P0001';
  end if;
  select c.scope,c.title into v_category_scope,v_category_title
  from public.categories as c where c.id=v_category_id;
  v_expected_scope := case p_domain when 'food' then 'food' when 'tours' then 'tour' when 'stays' then 'stay' else 'shop' end;
  if not found or v_category_scope is distinct from v_expected_scope then
    raise exception 'catalog_category_scope_mismatch' using errcode = 'P0001';
  end if;
  if length(pg_catalog.btrim(coalesce(v_title,''))) < 2 or v_price is null or v_price < 0 then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;
  if p_domain in ('tours','stays') and (
    length(coalesce(v_slug,'')) < 3 or length(pg_catalog.btrim(coalesce(v_location,''))) < 2
  ) then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;
  if p_domain='food' and v_prep is not null and (v_prep < 1 or v_prep > 1440) then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;
  if p_domain='products' and (v_stock is null or v_stock < 0) then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;

  v_searchable := pg_catalog.lower(
    coalesce(v_title,'') || ' ' || coalesce(v_description,'') || ' ' || coalesce(v_category_title,'')
  );
  if exists (
    select 1
    from pg_catalog.unnest(array[
      'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
      'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
    ]::text[]) as blocked(keyword)
    where pg_catalog.strpos(v_searchable, blocked.keyword) > 0
  ) then
    raise exception 'alcohol_catalog_write_blocked' using errcode = 'P0001';
  end if;

  if p_domain='food' then
    update public.menu_items set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='tours' then
    update public.tours set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='stays' then
    update public.stays set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  else
    update public.products set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  end if;

  insert into public.audit_logs (
    actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
  ) values (
    v_actor,v_actor_role,v_audit_action,v_entity_type,p_item_id,
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','draft'),
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','under_review','input',v_input),
    'Partner catalog submitted for review',p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,'status','under_review','idempotent',false
  );
end;
$$;

revoke all on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) from public;
revoke all on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) from anon;
revoke all on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) to authenticated;

create or replace function public.partner_catalog_write_atomic(
  p_domain text,
  p_action text,
  p_item_id uuid,
  p_request_id text,
  p_fields jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_catalog_write_atomic_internal(
    p_domain,p_action,p_item_id,p_request_id,p_fields
  );
$$;

revoke all on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) from public;
revoke all on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) from anon;
grant execute on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) to authenticated;

comment on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) is
  'Partner owner/manager RPC for own-business catalog create draft, edit draft/rejected, and draft -> under_review submission. Payload-bound idempotency, audit evidence, ownership, category scope and alcohol safety are enforced. No publish/approve/payment/order/booking/delivery authority.';

-- END STAGE 019_partner_catalog_write_runtime_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 020_admin_catalog_governance_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- ADMIN CATALOG GOVERNANCE — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Scope:
-- - super_admin-only catalog publish / unpublish / archive authority;
-- - super_admin-only category create / update / archive authority;
-- - public catalog visibility remains status='active'; publish maps approved -> active;
-- - category archive is fail-closed while referenced by any non-archived catalog record;
-- - direct authenticated catalog/category DML remains revoked; writes are RPC-only;
-- - every committed mutation writes immutable audit evidence;
-- - actor/request idempotency is concurrency-serialized and payload-bound;
-- - alcohol-like content/categories remain blocked while the alcohol module is OFF;
-- - no payment, order, booking, delivery, availability, partner or role truth is mutated.
--
-- Explicitly excluded:
-- - partner verification/user blocking/role changes;
-- - cancellation/refund/payout/settlement;
-- - live/production apply;
-- - alcohol enablement.


create schema if not exists private;

-- Minimal category lifecycle state required for reversible public taxonomy control.
alter table public.categories
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'categories_status_valid'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_status_valid check (status in ('active','archived'));
  end if;
end
$$;

create index if not exists idx_categories_status_scope_sort
  on public.categories (status, scope, sort_order, title);

-- Categories are public taxonomy only while active. Admins retain visibility for governance.
drop policy if exists "public reads categories" on public.categories;
drop policy if exists "public read categories" on public.categories;
drop policy if exists "anon read active categories" on public.categories;
drop policy if exists "authenticated read visible categories" on public.categories;

create policy "anon read active categories"
on public.categories for select
to anon
using (status = 'active');

create policy "authenticated read visible categories"
on public.categories for select
to authenticated
using (status = 'active' or public.is_admin());

-- Keep all governance writes behind audited RPC authority.
revoke insert, update, delete on table public.categories from anon, authenticated;
revoke insert, update, delete on table public.menu_items from anon, authenticated;
revoke insert, update, delete on table public.tours from anon, authenticated;
revoke insert, update, delete on table public.stays from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;
grant select on table public.categories to anon, authenticated;

create or replace function private.admin_catalog_governance_atomic_internal(
  p_item_id uuid,
  p_domain text,
  p_action text,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_target_status text;
  v_business_id uuid;
  v_partner_status text;
  v_business_status text;
  v_category_id uuid;
  v_category_title text;
  v_title text;
  v_description text;
  v_metadata jsonb;
  v_price numeric(12,2);
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_entity_type text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_reason text;
  v_existing_domain text;
  v_existing_status text;
  v_searchable text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_item_id is null then
    raise exception 'item_id_required' using errcode = '22023';
  end if;
  if p_domain not in ('food','tours','stays','products') then
    raise exception 'unsupported_catalog_domain' using errcode = '22023';
  end if;
  if p_action not in ('publish','unpublish','archive') then
    raise exception 'unsupported_catalog_governance_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'governance_reason_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'super_admin'
      and ur.is_active = true
  ) then
    raise exception 'catalog_governance_not_authorized' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(p_request_id)
  );

  if p_domain = 'food' then
    v_entity_type := 'menu_items';
    select m.business_id,m.category_id,m.title,m.description,m.metadata,m.price,m.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.menu_items m where m.id=p_item_id for update;
  elsif p_domain = 'tours' then
    v_entity_type := 'tours';
    select t.business_id,t.category_id,t.title,t.description,t.metadata,t.price,t.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.tours t where t.id=p_item_id for update;
  elsif p_domain = 'stays' then
    v_entity_type := 'stays';
    select s.business_id,s.category_id,s.title,s.description,s.metadata,s.price_from,s.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.stays s where s.id=p_item_id for update;
  else
    v_entity_type := 'products';
    select p.business_id,p.category_id,p.title,p.description,p.metadata,p.price,p.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.products p where p.id=p_item_id for update;
  end if;

  if not found then
    raise exception 'catalog_item_not_found' using errcode = 'P0002';
  end if;

  if v_category_id is not null then
    select c.title into v_category_title
    from public.categories c
    where c.id=v_category_id and c.status='active';
  end if;

  v_target_status := case p_action
    when 'publish' then 'active'
    when 'unpublish' then 'approved'
    else 'archived'
  end;
  v_audit_action := 'admin_catalog_' || p_action;

  select al.id,al.action,al.entity_type,al.entity_id,al.reason,
         al.before->>'domain',al.after->>'status'
    into v_existing_audit_id,v_existing_action,v_existing_entity_type,
         v_existing_entity_id,v_existing_reason,v_existing_domain,v_existing_status
  from public.audit_logs al
  where al.actor_id=v_actor and al.request_id=p_request_id
  order by al.created_at asc, al.id asc
  limit 1;

  if v_existing_audit_id is not null then
    if v_existing_action is distinct from v_audit_action
       or v_existing_entity_type is distinct from v_entity_type
       or v_existing_entity_id is distinct from p_item_id
       or v_existing_reason is distinct from v_reason
       or v_existing_domain is distinct from p_domain then
      raise exception 'catalog_governance_idempotency_payload_conflict' using errcode = '23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,
      'status',coalesce(v_existing_status,v_target_status),'idempotent',true
    );
  end if;

  if p_action='publish' and v_status <> 'approved' then
    raise exception 'catalog_publish_requires_approved' using errcode = 'P0001';
  elsif p_action='unpublish' and v_status <> 'active' then
    raise exception 'catalog_unpublish_requires_active' using errcode = 'P0001';
  elsif p_action='archive' and v_status not in ('under_review','approved','rejected','active') then
    raise exception 'catalog_archive_invalid_status' using errcode = 'P0001';
  end if;

  if p_action='publish' then
    if v_category_id is null or v_category_title is null then
      raise exception 'active_category_required_for_publish' using errcode = 'P0001';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'catalog_price_invalid_for_publish' using errcode = 'P0001';
    end if;

    select p.status,p.business_status into v_partner_status,v_business_status
    from public.partners p where p.id=v_business_id;
    if not found
       or v_partner_status <> 'approved'
       or coalesce(v_business_status,'') in ('inactive','suspended','blocked','disabled') then
      raise exception 'partner_business_not_publishable' using errcode = 'P0001';
    end if;

    v_searchable := pg_catalog.lower(
      coalesce(v_title,'') || ' ' || coalesce(v_description,'') || ' ' ||
      coalesce(v_category_title,'') || ' ' || coalesce(v_metadata::text,'')
    );
    if exists (
      select 1 from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) blocked(keyword)
      where pg_catalog.strpos(v_searchable,blocked.keyword)>0
    ) then
      raise exception 'alcohol_catalog_publish_blocked' using errcode = 'P0001';
    end if;
  end if;

  if p_domain='food' then
    update public.menu_items set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='tours' then
    update public.tours set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='stays' then
    update public.stays set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  else
    update public.products set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  end if;

  insert into public.audit_logs(
    actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
  ) values (
    v_actor,'super_admin',v_audit_action,v_entity_type,p_item_id,
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',v_status),
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',v_target_status),
    v_reason,p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,
    'status',v_target_status,'idempotent',false
  );
end;
$$;

revoke all on function private.admin_catalog_governance_atomic_internal(uuid,text,text,text,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_catalog_governance_atomic_internal(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_catalog_governance_atomic(
  p_item_id uuid,p_domain text,p_action text,p_request_id text,p_reason text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.admin_catalog_governance_atomic_internal(p_item_id,p_domain,p_action,p_request_id,p_reason);
$$;
revoke all on function public.admin_catalog_governance_atomic(uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_catalog_governance_atomic(uuid,text,text,text,text) to authenticated;

create or replace function private.admin_catalog_category_atomic_internal(
  p_category_id uuid,
  p_action text,
  p_request_id text,
  p_fields jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason,'')),'');
  v_input jsonb := coalesce(p_fields,'{}'::jsonb);
  v_id uuid;
  v_title text;
  v_slug text;
  v_scope text;
  v_parent_id uuid;
  v_sort integer;
  v_status text;
  v_before jsonb;
  v_after jsonb;
  v_audit_action text;
  v_existing_id uuid;
  v_existing_action text;
  v_existing_entity_id uuid;
  v_existing_reason text;
  v_existing_input jsonb;
  v_existing_status text;
  v_parent_scope text;
  v_parent_status text;
  v_searchable text;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if p_action not in ('create','update','archive') then
    raise exception 'unsupported_category_governance_action' using errcode='22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id))<8 or length(p_request_id)>128 then
    raise exception 'invalid_request_id' using errcode='22023';
  end if;
  if v_reason is null or length(v_reason)<3 or length(v_reason)>500 then
    raise exception 'category_governance_reason_required' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id=v_actor and ur.role='super_admin' and ur.is_active=true
  ) then
    raise exception 'category_governance_not_authorized' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),pg_catalog.hashtext(p_request_id)
  );
  v_audit_action := 'admin_category_' || p_action;

  select al.id,al.action,al.entity_id,al.reason,al.after->'input',al.after->>'status'
    into v_existing_id,v_existing_action,v_existing_entity_id,v_existing_reason,v_existing_input,v_existing_status
  from public.audit_logs al
  where al.actor_id=v_actor and al.request_id=p_request_id
  order by al.created_at asc,al.id asc limit 1;

  if v_existing_id is not null then
    if v_existing_action is distinct from v_audit_action
       or v_existing_reason is distinct from v_reason
       or coalesce(v_existing_input,'{}'::jsonb) is distinct from v_input
       or (p_action<>'create' and v_existing_entity_id is distinct from p_category_id) then
      raise exception 'category_governance_idempotency_payload_conflict' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok',true,'category_id',v_existing_entity_id,'action',p_action,
      'status',coalesce(v_existing_status,'active'),'idempotent',true
    );
  end if;

  if p_action in ('create','update') then
    v_title := pg_catalog.btrim(coalesce(v_input->>'title',''));
    v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(v_input->>'slug','')));
    v_scope := pg_catalog.lower(pg_catalog.btrim(coalesce(v_input->>'scope','')));
    if length(v_title)<2 or length(v_title)>120 then raise exception 'category_title_invalid' using errcode='22023'; end if;
    if length(v_slug)<2 or length(v_slug)>120 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'category_slug_invalid' using errcode='22023';
    end if;
    if v_scope not in ('food','tour','stay','shop') then raise exception 'category_scope_invalid' using errcode='22023'; end if;

    if nullif(pg_catalog.btrim(coalesce(v_input->>'sort_order','')),'') is null then
      v_sort := 0;
    elsif (v_input->>'sort_order') !~ '^-?[0-9]+$' then
      raise exception 'category_sort_invalid' using errcode='22023';
    else
      v_sort := (v_input->>'sort_order')::integer;
      if v_sort < -100000 or v_sort > 100000 then raise exception 'category_sort_out_of_range' using errcode='22023'; end if;
    end if;

    if nullif(pg_catalog.btrim(coalesce(v_input->>'parent_id','')),'') is not null then
      if (v_input->>'parent_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'category_parent_invalid' using errcode='22023';
      end if;
      v_parent_id := (v_input->>'parent_id')::uuid;
      select c.scope,c.status into v_parent_scope,v_parent_status from public.categories c where c.id=v_parent_id;
      if not found or v_parent_scope is distinct from v_scope or v_parent_status <> 'active' then
        raise exception 'category_parent_not_available' using errcode='P0001';
      end if;
    end if;

    v_searchable := pg_catalog.lower(v_title || ' ' || v_slug);
    if exists (
      select 1 from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) blocked(keyword)
      where pg_catalog.strpos(v_searchable,blocked.keyword)>0
    ) then
      raise exception 'alcohol_category_write_blocked' using errcode='P0001';
    end if;
  end if;

  if p_action='create' then
    if p_category_id is not null then raise exception 'create_category_id_must_be_null' using errcode='22023'; end if;
    v_id := gen_random_uuid();
    insert into public.categories(id,scope,title,slug,parent_id,sort_order,status,created_at,updated_at)
    values(v_id,v_scope,v_title,v_slug,v_parent_id,v_sort,'active',pg_catalog.now(),pg_catalog.now());
    v_before := pg_catalog.jsonb_build_object('status',null,'input',v_input);
    v_after := pg_catalog.jsonb_build_object('status','active','input',v_input);
  else
    if p_category_id is null then raise exception 'category_id_required' using errcode='22023'; end if;
    select c.status,
           pg_catalog.jsonb_build_object('scope',c.scope,'title',c.title,'slug',c.slug,'parent_id',c.parent_id,'sort_order',c.sort_order,'status',c.status)
      into v_status,v_before
    from public.categories c where c.id=p_category_id for update;
    if not found then raise exception 'category_not_found' using errcode='P0002'; end if;

    if p_action='update' then
      if v_status <> 'active' then raise exception 'category_update_requires_active' using errcode='P0001'; end if;
      if v_parent_id = p_category_id then raise exception 'category_parent_cycle' using errcode='P0001'; end if;
      if v_parent_id is not null and exists (
        with recursive descendants as (
          select c.id from public.categories c where c.parent_id=p_category_id
          union all
          select c.id from public.categories c join descendants d on c.parent_id=d.id
        ) select 1 from descendants where id=v_parent_id
      ) then
        raise exception 'category_parent_cycle' using errcode='P0001';
      end if;
      update public.categories set scope=v_scope,title=v_title,slug=v_slug,parent_id=v_parent_id,
        sort_order=v_sort,updated_at=pg_catalog.now() where id=p_category_id;
      v_id := p_category_id;
      v_after := pg_catalog.jsonb_build_object('scope',v_scope,'title',v_title,'slug',v_slug,'parent_id',v_parent_id,'sort_order',v_sort,'status','active','input',v_input);
    else
      if v_status <> 'active' then raise exception 'category_archive_requires_active' using errcode='P0001'; end if;
      if exists(select 1 from public.menu_items m where m.category_id=p_category_id and m.status<>'archived')
         or exists(select 1 from public.tours t where t.category_id=p_category_id and t.status<>'archived')
         or exists(select 1 from public.stays s where s.category_id=p_category_id and s.status<>'archived')
         or exists(select 1 from public.products p where p.category_id=p_category_id and p.status<>'archived') then
        raise exception 'category_archive_blocked_by_catalog_references' using errcode='P0001';
      end if;
      if exists(select 1 from public.categories c where c.parent_id=p_category_id and c.status='active') then
        raise exception 'category_archive_blocked_by_active_children' using errcode='P0001';
      end if;
      update public.categories set status='archived',updated_at=pg_catalog.now() where id=p_category_id;
      v_id := p_category_id;
      v_after := pg_catalog.jsonb_build_object('status','archived','input',v_input);
    end if;
  end if;

  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
  values(v_actor,'super_admin',v_audit_action,'categories',v_id,v_before,v_after,v_reason,p_request_id);

  return pg_catalog.jsonb_build_object(
    'ok',true,'category_id',v_id,'action',p_action,
    'status',case when p_action='archive' then 'archived' else 'active' end,'idempotent',false
  );
end;
$$;

revoke all on function private.admin_catalog_category_atomic_internal(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.admin_catalog_category_atomic_internal(uuid,text,text,jsonb,text) to authenticated;

create or replace function public.admin_catalog_category_atomic(
  p_category_id uuid,p_action text,p_request_id text,p_fields jsonb,p_reason text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.admin_catalog_category_atomic_internal(p_category_id,p_action,p_request_id,p_fields,p_reason);
$$;
revoke all on function public.admin_catalog_category_atomic(uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.admin_catalog_category_atomic(uuid,text,text,jsonb,text) to authenticated;

comment on function public.admin_catalog_governance_atomic(uuid,text,text,text,text) is
  'Super-admin catalog lifecycle authority: approved->active publish, active->approved unpublish, controlled archive. Audited, idempotent, alcohol fail-closed.';
comment on function public.admin_catalog_category_atomic(uuid,text,text,jsonb,text) is
  'Super-admin category create/update/archive authority. Active taxonomy only, referenced-category archive protection, audited and alcohol fail-closed.';

-- END STAGE 020_admin_catalog_governance_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 020a_catalog_category_active_guard_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CATALOG ACTIVE CATEGORY GUARD — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Hardens migration 020: once category lifecycle exists, no new or changed
-- catalog row may attach an archived category through a crafted RPC or future writer.
-- This is staging-only and does not mutate existing catalog rows.


create schema if not exists private;

create or replace function private.enforce_active_catalog_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope text;
  v_status text;
  v_expected_scope text;
begin
  if new.category_id is null then
    return new;
  end if;

  v_expected_scope := case tg_table_name
    when 'menu_items' then 'food'
    when 'tours' then 'tour'
    when 'stays' then 'stay'
    when 'products' then 'shop'
    else null
  end;

  if v_expected_scope is null then
    raise exception 'unsupported_catalog_category_guard_table' using errcode = '22023';
  end if;

  select c.scope, c.status
    into v_scope, v_status
  from public.categories c
  where c.id = new.category_id;

  if not found then
    raise exception 'catalog_category_not_found' using errcode = '23503';
  end if;
  if v_status <> 'active' then
    raise exception 'catalog_category_not_active' using errcode = 'P0001';
  end if;
  if v_scope is distinct from v_expected_scope then
    raise exception 'catalog_category_scope_mismatch' using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_active_catalog_category() from public, anon, authenticated;

drop trigger if exists trg_menu_items_active_category on public.menu_items;
create trigger trg_menu_items_active_category
before insert or update of category_id on public.menu_items
for each row execute function private.enforce_active_catalog_category();

drop trigger if exists trg_tours_active_category on public.tours;
create trigger trg_tours_active_category
before insert or update of category_id on public.tours
for each row execute function private.enforce_active_catalog_category();

drop trigger if exists trg_stays_active_category on public.stays;
create trigger trg_stays_active_category
before insert or update of category_id on public.stays
for each row execute function private.enforce_active_catalog_category();

drop trigger if exists trg_products_active_category on public.products;
create trigger trg_products_active_category
before insert or update of category_id on public.products
for each row execute function private.enforce_active_catalog_category();

comment on function private.enforce_active_catalog_category() is
  'Fail-closed catalog taxonomy guard. New/changed category references must point to an active category with the canonical domain scope.';

-- END STAGE 020a_catalog_category_active_guard_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 020b_category_scope_reference_guard_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CATEGORY SCOPE REFERENCE GUARD — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Prevents a taxonomy scope change from silently invalidating existing catalog
-- references or active child-category relationships. Staging-only hardening.


create schema if not exists private;

create or replace function private.guard_category_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scope is not distinct from old.scope then
    return new;
  end if;

  if exists (
       select 1 from public.menu_items m
       where m.category_id = old.id and m.status <> 'archived'
     )
     or exists (
       select 1 from public.tours t
       where t.category_id = old.id and t.status <> 'archived'
     )
     or exists (
       select 1 from public.stays s
       where s.category_id = old.id and s.status <> 'archived'
     )
     or exists (
       select 1 from public.products p
       where p.category_id = old.id and p.status <> 'archived'
     ) then
    raise exception 'category_scope_change_blocked_by_catalog_references' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.categories c
    where c.parent_id = old.id
      and c.status = 'active'
  ) then
    raise exception 'category_scope_change_blocked_by_active_children' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_category_scope_change() from public, anon, authenticated;

drop trigger if exists trg_categories_scope_reference_guard on public.categories;
create trigger trg_categories_scope_reference_guard
before update of scope on public.categories
for each row execute function private.guard_category_scope_change();

comment on function private.guard_category_scope_change() is
  'Fail-closed taxonomy invariant: domain scope cannot change while non-archived catalog records or active children depend on the category.';

-- END STAGE 020b_category_scope_reference_guard_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 021_client_support_runtime_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CLIENT SUPPORT RUNTIME — DRAFT / NOT APPLIED
-- Prepared: 2026-09-07
--
-- Scope:
-- - authenticated active Client creates a support ticket + first public message atomically;
-- - optional related order/booking must belong to the caller and cannot both be set;
-- - priority is server-owned and starts as `medium`;
-- - status is server-owned and starts as `open`;
-- - request id is payload-bound and idempotent;
-- - accepted creation writes immutable audit evidence;
-- - direct authenticated support INSERT/UPDATE/DELETE is closed; writes are RPC-only;
-- - Admin continues to read the queue through existing RLS.
--
-- Explicitly excluded:
-- - Admin status/reply workflow;
-- - external CRM/messenger delivery;
-- - payment/refund/cancellation mutation;
-- - live/production apply.


create schema if not exists private;

-- Move support mutation authority behind one audited transactional RPC.
drop policy if exists "users create own support tickets" on public.support_tickets;
drop policy if exists "users create own ticket messages" on public.ticket_messages;
-- Legacy direct intake policies exist in the hosted baseline; remove them
-- before enforcing RPC-only support writes.
drop policy if exists "anon create intake requests" on public.support_tickets;
drop policy if exists "authenticated create intake requests" on public.support_tickets;

revoke insert, update, delete on table public.support_tickets from anon, authenticated;
revoke insert, update, delete on table public.ticket_messages from anon, authenticated;

create index if not exists idx_audit_client_support_request
  on public.audit_logs (actor_id, action, request_id)
  where action = 'client_support_ticket_created';

create or replace function private.client_support_ticket_create_atomic_internal(
  p_category text,
  p_title text,
  p_message text,
  p_request_id text,
  p_related_order_id uuid default null,
  p_related_booking_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_category text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_category, '')));
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_ticket_id uuid;
  v_existing_after jsonb;
  v_message_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_message, '')));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_support_not_authorized' using errcode = '42501';
  end if;

  if v_category !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'invalid_support_category' using errcode = '22023';
  end if;
  if length(v_title) < 3 or length(v_title) > 160 then
    raise exception 'invalid_support_title' using errcode = '22023';
  end if;
  if length(v_message) < 3 or length(v_message) > 4000 then
    raise exception 'invalid_support_message' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if p_related_order_id is not null and p_related_booking_id is not null then
    raise exception 'support_reference_ambiguous' using errcode = '22023';
  end if;

  if p_related_order_id is not null and not exists (
    select 1 from public.orders o
    where o.id = p_related_order_id and o.client_id = v_actor
  ) then
    raise exception 'support_order_not_available' using errcode = '42501';
  end if;

  if p_related_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_related_booking_id and b.client_id = v_actor
  ) then
    raise exception 'support_booking_not_available' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.entity_id, al.after
    into v_ticket_id, v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_support_ticket_created'
    and al.entity_type = 'support_tickets'
    and al.request_id = v_request_id
  limit 1;

  if v_ticket_id is not null then
    if coalesce(v_existing_after ->> 'category', '') <> v_category
       or coalesce(v_existing_after ->> 'title', '') <> v_title
       or coalesce(v_existing_after ->> 'message_md5', '') <> v_message_md5
       or coalesce(v_existing_after ->> 'message_length', '') <> length(v_message)::text
       or coalesce(v_existing_after ->> 'related_order_id', '') <> coalesce(p_related_order_id::text, '')
       or coalesce(v_existing_after ->> 'related_booking_id', '') <> coalesce(p_related_booking_id::text, '') then
      raise exception 'support_request_id_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', v_ticket_id,
      'status', coalesce(v_existing_after ->> 'status', 'open'),
      'idempotent', true
    );
  end if;

  insert into public.support_tickets (
    created_by,
    related_order_id,
    related_booking_id,
    category,
    priority,
    status,
    title
  ) values (
    v_actor,
    p_related_order_id,
    p_related_booking_id,
    v_category,
    'medium',
    'open',
    v_title
  ) returning id into v_ticket_id;

  insert into public.ticket_messages (
    ticket_id,
    sender_id,
    message,
    visibility
  ) values (
    v_ticket_id,
    v_actor,
    v_message,
    'public'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    'client',
    'client_support_ticket_created',
    'support_tickets',
    v_ticket_id,
    null,
    pg_catalog.jsonb_build_object(
      'category', v_category,
      'title', v_title,
      'message_md5', v_message_md5,
      'message_length', length(v_message),
      'related_order_id', p_related_order_id,
      'related_booking_id', p_related_booking_id,
      'priority', 'medium',
      'status', 'open'
    ),
    'Client support ticket and initial message created atomically.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ticket_id', v_ticket_id,
    'status', 'open',
    'idempotent', false
  );
end;
$$;

revoke all on function private.client_support_ticket_create_atomic_internal(text,text,text,text,uuid,uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_support_ticket_create_atomic_internal(text,text,text,text,uuid,uuid) to authenticated;

create or replace function public.client_support_ticket_create_atomic(
  p_category text,
  p_title text,
  p_message text,
  p_request_id text,
  p_related_order_id uuid default null,
  p_related_booking_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.client_support_ticket_create_atomic_internal(
    p_category,
    p_title,
    p_message,
    p_request_id,
    p_related_order_id,
    p_related_booking_id
  );
$$;

revoke all on function public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid) from public, anon;
grant execute on function public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid) to authenticated;

comment on function public.client_support_ticket_create_atomic(text,text,text,text,uuid,uuid) is
  'Authenticated Client support entrypoint. Identity, ownership, priority/status, idempotency and audit are DB-authoritative.';

-- END STAGE 021_client_support_runtime_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 022_admin_support_lifecycle_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- ADMIN SUPPORT LIFECYCLE — DRAFT / NOT APPLIED
-- Prepared: 2026-09-07
--
-- Scope:
-- - active support_admin or super_admin may reply to an existing support ticket;
-- - active support_admin or super_admin may move ticket status through the verified
--   linear lifecycle open -> in_progress -> resolved -> closed;
-- - replies are public ticket_messages and remain visible to the ticket owner through RLS;
-- - closed tickets reject further replies and status mutation;
-- - request id is payload-bound and idempotent per actor;
-- - every accepted mutation writes immutable audit evidence;
-- - direct table mutation remains closed; writes are RPC-only.
--
-- Explicitly excluded:
-- - reopen/escalated/rejected flows;
-- - assignment/SLA automation;
-- - external CRM/messenger delivery;
-- - payment/refund/cancellation mutation;
-- - live/production apply.


create schema if not exists private;

create index if not exists idx_audit_admin_support_request
  on public.audit_logs (actor_id, action, request_id)
  where action in ('admin_support_reply','admin_support_status_changed');

create or replace function private.admin_support_lifecycle_atomic_internal(
  p_ticket_id uuid,
  p_action text,
  p_request_id text,
  p_message text default null,
  p_status text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, '')));
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_current_status text;
  v_audit_action text;
  v_existing_after jsonb;
  v_existing_entity uuid;
  v_message_id uuid;
  v_message_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_message, '')));
  v_reason_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_reason, '')));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select ur.role
    into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor
    and ur.is_active = true
    and ur.role in ('support_admin','super_admin')
  order by case ur.role when 'super_admin' then 1 else 2 end
  limit 1;

  if v_actor_role is null then
    raise exception 'admin_support_not_authorized' using errcode = '42501';
  end if;

  if p_ticket_id is null then
    raise exception 'invalid_support_ticket_id' using errcode = '22023';
  end if;
  if v_action not in ('reply','status') then
    raise exception 'invalid_support_admin_action' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_action = 'reply' then
    if length(v_message) < 3 or length(v_message) > 4000 then
      raise exception 'invalid_support_reply' using errcode = '22023';
    end if;
    if v_status <> '' or v_reason <> '' then
      raise exception 'support_reply_payload_ambiguous' using errcode = '22023';
    end if;
    v_audit_action := 'admin_support_reply';
  else
    if v_status not in ('in_progress','resolved','closed') then
      raise exception 'invalid_support_status' using errcode = '22023';
    end if;
    if length(v_reason) < 3 or length(v_reason) > 500 then
      raise exception 'support_status_reason_required' using errcode = '22023';
    end if;
    if v_message <> '' then
      raise exception 'support_status_payload_ambiguous' using errcode = '22023';
    end if;
    v_audit_action := 'admin_support_status_changed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.entity_id, al.after
    into v_existing_entity, v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = v_audit_action
    and al.entity_type = 'support_tickets'
    and al.request_id = v_request_id
  limit 1;

  if v_existing_entity is not null then
    if v_existing_entity <> p_ticket_id
       or coalesce(v_existing_after ->> 'action', '') <> v_action then
      raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
    end if;

    if v_action = 'reply' then
      if coalesce(v_existing_after ->> 'message_md5', '') <> v_message_md5
         or coalesce(v_existing_after ->> 'message_length', '') <> length(v_message)::text then
        raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
      end if;
    else
      if coalesce(v_existing_after ->> 'status', '') <> v_status
         or coalesce(v_existing_after ->> 'reason_md5', '') <> v_reason_md5
         or coalesce(v_existing_after ->> 'reason_length', '') <> length(v_reason)::text then
        raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
      end if;
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', v_existing_entity,
      'status', coalesce(v_existing_after ->> 'status', ''),
      'message_id', nullif(v_existing_after ->> 'message_id', '')::uuid,
      'idempotent', true
    );
  end if;

  select st.status
    into v_current_status
  from public.support_tickets st
  where st.id = p_ticket_id
  for update;

  if v_current_status is null then
    raise exception 'support_ticket_not_found' using errcode = 'P0002';
  end if;

  if v_action = 'reply' then
    if v_current_status = 'closed' then
      raise exception 'closed_support_ticket_is_immutable' using errcode = '22023';
    end if;

    insert into public.ticket_messages (
      ticket_id,
      sender_id,
      message,
      visibility
    ) values (
      p_ticket_id,
      v_actor,
      v_message,
      'public'
    ) returning id into v_message_id;

    update public.support_tickets
    set updated_at = pg_catalog.now()
    where id = p_ticket_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_actor,
      v_actor_role,
      v_audit_action,
      'support_tickets',
      p_ticket_id,
      pg_catalog.jsonb_build_object('status', v_current_status),
      pg_catalog.jsonb_build_object(
        'action', 'reply',
        'status', v_current_status,
        'message_id', v_message_id,
        'message_md5', v_message_md5,
        'message_length', length(v_message)
      ),
      'Support administrator public reply created atomically.',
      v_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', p_ticket_id,
      'status', v_current_status,
      'message_id', v_message_id,
      'idempotent', false
    );
  end if;

  if v_current_status = 'closed' then
    raise exception 'closed_support_ticket_is_immutable' using errcode = '22023';
  end if;

  if not (
    (v_current_status = 'open' and v_status = 'in_progress')
    or (v_current_status = 'in_progress' and v_status = 'resolved')
    or (v_current_status = 'resolved' and v_status = 'closed')
  ) then
    raise exception 'invalid_support_status_transition' using errcode = '22023';
  end if;

  update public.support_tickets
  set status = v_status,
      updated_at = pg_catalog.now()
  where id = p_ticket_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_actor,
    v_actor_role,
    v_audit_action,
    'support_tickets',
    p_ticket_id,
    pg_catalog.jsonb_build_object('status', v_current_status),
    pg_catalog.jsonb_build_object(
      'action', 'status',
      'status', v_status,
      'previous_status', v_current_status,
      'reason_md5', v_reason_md5,
      'reason_length', length(v_reason)
    ),
    v_reason,
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'status', v_status,
    'message_id', null,
    'idempotent', false
  );
end;
$$;

revoke all on function private.admin_support_lifecycle_atomic_internal(uuid,text,text,text,text,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_support_lifecycle_atomic_internal(uuid,text,text,text,text,text) to authenticated;

create or replace function public.admin_support_lifecycle_atomic(
  p_ticket_id uuid,
  p_action text,
  p_request_id text,
  p_message text default null,
  p_status text default null,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_support_lifecycle_atomic_internal(
    p_ticket_id,
    p_action,
    p_request_id,
    p_message,
    p_status,
    p_reason
  );
$$;

revoke all on function public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text) from public, anon;
grant execute on function public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text) to authenticated;

comment on function public.admin_support_lifecycle_atomic(uuid,text,text,text,text,text) is
  'Support Admin/Super Admin audited reply/status entrypoint. Role, lifecycle, idempotency and audit are DB-authoritative.';

-- END STAGE 022_admin_support_lifecycle_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 023_client_profile_runtime_DRAFT_NOT_APPLIED.sql
-- KÖL / kol-travel-platform
-- CLIENT PROFILE RUNTIME — DRAFT / NOT APPLIED
-- Prepared: 2026-09-07
--
-- Scope:
-- - authenticated active Client reads only own profile through existing RLS;
-- - Client may update only full_name, locale and default_address;
-- - email, phone, avatar, preferred_contact, status, metadata and roles are immutable here;
-- - writes are RPC-only, payload-bound idempotent and audited;
-- - audit evidence stores hashes/lengths for PII, not raw name/address values.
--
-- Explicitly excluded:
-- - email/phone/password verification or mutation;
-- - notification/contact preferences;
-- - role/status/admin user management;
-- - live/production apply.


create schema if not exists private;

-- Move profile mutation authority behind one audited RPC.
drop policy if exists "users update own user profile" on public.user_profiles;
drop policy if exists "clients update own client profile" on public.client_profiles;
revoke update on table public.user_profiles from anon, authenticated;
revoke update on table public.client_profiles from anon, authenticated;

create index if not exists idx_audit_client_profile_request
  on public.audit_logs (actor_id, action, request_id)
  where action = 'client_profile_updated';

create or replace function private.client_profile_update_atomic_internal(
  p_full_name text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  v_locale text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_locale, '')));
  v_default_address text := nullif(pg_catalog.btrim(coalesce(p_default_address, '')), '');
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_profile_id uuid;
  v_old_full_name text;
  v_old_locale text;
  v_old_address text;
  v_existing_after jsonb;
  v_name_md5 text := pg_catalog.md5(coalesce(nullif(pg_catalog.btrim(coalesce(p_full_name, '')), ''), ''));
  v_address_md5 text := pg_catalog.md5(coalesce(nullif(pg_catalog.btrim(coalesce(p_default_address, '')), ''), ''));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_profile_not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_profiles up
    where up.user_id = v_actor and up.status = 'active'
  ) then
    raise exception 'client_profile_inactive' using errcode = '42501';
  end if;

  if v_full_name is not null and (length(v_full_name) < 2 or length(v_full_name) > 120) then
    raise exception 'invalid_client_full_name' using errcode = '22023';
  end if;
  if v_locale not in ('ru','kg','en') then
    raise exception 'invalid_client_locale' using errcode = '22023';
  end if;
  if v_default_address is not null and length(v_default_address) > 500 then
    raise exception 'invalid_client_default_address' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.after
    into v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_profile_updated'
    and al.entity_type = 'user_profiles'
    and al.request_id = v_request_id
  limit 1;

  if v_existing_after is not null then
    if coalesce(v_existing_after ->> 'full_name_md5', '') <> v_name_md5
       or coalesce(v_existing_after ->> 'full_name_length', '') <> coalesce(length(v_full_name)::text, '0')
       or coalesce(v_existing_after ->> 'locale', '') <> v_locale
       or coalesce(v_existing_after ->> 'default_address_md5', '') <> v_address_md5
       or coalesce(v_existing_after ->> 'default_address_length', '') <> coalesce(length(v_default_address)::text, '0') then
      raise exception 'client_profile_request_id_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'user_id', v_actor,
      'locale', v_locale,
      'idempotent', true
    );
  end if;

  select up.id, up.full_name, up.locale
    into v_profile_id, v_old_full_name, v_old_locale
  from public.user_profiles up
  where up.user_id = v_actor
  for update;

  if v_profile_id is null then
    raise exception 'client_profile_not_found' using errcode = 'P0002';
  end if;

  select cp.default_address
    into v_old_address
  from public.client_profiles cp
  where cp.user_id = v_actor
  for update;

  if not found then
    raise exception 'client_profile_not_found' using errcode = 'P0002';
  end if;

  update public.user_profiles
  set full_name = v_full_name,
      locale = v_locale,
      updated_at = pg_catalog.now()
  where user_id = v_actor;

  update public.client_profiles
  set default_address = v_default_address,
      updated_at = pg_catalog.now()
  where user_id = v_actor;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_actor,
    'client',
    'client_profile_updated',
    'user_profiles',
    v_profile_id,
    pg_catalog.jsonb_build_object(
      'full_name_md5', pg_catalog.md5(coalesce(v_old_full_name, '')),
      'full_name_length', coalesce(length(v_old_full_name), 0),
      'locale', coalesce(v_old_locale, ''),
      'default_address_md5', pg_catalog.md5(coalesce(v_old_address, '')),
      'default_address_length', coalesce(length(v_old_address), 0)
    ),
    pg_catalog.jsonb_build_object(
      'full_name_md5', v_name_md5,
      'full_name_length', coalesce(length(v_full_name), 0),
      'locale', v_locale,
      'default_address_md5', v_address_md5,
      'default_address_length', coalesce(length(v_default_address), 0)
    ),
    'Client updated allowlisted own profile fields atomically.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'user_id', v_actor,
    'locale', v_locale,
    'idempotent', false
  );
end;
$$;

revoke all on function private.client_profile_update_atomic_internal(text,text,text,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_profile_update_atomic_internal(text,text,text,text) to authenticated;

create or replace function public.client_profile_update_atomic(
  p_full_name text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.client_profile_update_atomic_internal(
    p_full_name,
    p_locale,
    p_default_address,
    p_request_id
  );
$$;

revoke all on function public.client_profile_update_atomic(text,text,text,text) from public, anon;
grant execute on function public.client_profile_update_atomic(text,text,text,text) to authenticated;

comment on function public.client_profile_update_atomic(text,text,text,text) is
  'Authenticated active Client profile update entrypoint. Only full_name, locale and default_address may change; identity, role, idempotency and audit are DB-authoritative.';

-- END STAGE 023_client_profile_runtime_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 025_client_onboarding_atomic_DRAFT_NOT_APPLIED.sql
-- KÖL CLIENT ONBOARDING — DRAFT / NOT APPLIED
-- Creates one client profile after a verified passwordless Auth session.
-- Run only in the Supabase TEST project after review and RLS verification.


create schema if not exists private;

create or replace function private.client_onboarding_complete_atomic_internal(
  p_full_name text,
  p_phone text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(pg_catalog.btrim(coalesce(p_phone, '')), '');
  v_locale text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_locale, 'ru')));
  v_default_address text := nullif(pg_catalog.btrim(coalesce(p_default_address, '')), '');
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_email text;
  v_profile_id uuid;
  v_user_profile_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_full_name is null or length(v_full_name) < 2 or length(v_full_name) > 120 then
    raise exception 'invalid_client_full_name' using errcode = '22023';
  end if;
  if v_phone is null or length(v_phone) < 5 or length(v_phone) > 40 then
    raise exception 'invalid_client_phone' using errcode = '22023';
  end if;
  if v_locale not in ('ru', 'kg', 'en') then
    raise exception 'invalid_client_locale' using errcode = '22023';
  end if;
  if length(v_default_address) > 500 then
    raise exception 'invalid_client_default_address' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  -- Serialize profile creation and role checks for the authenticated identity.
  -- Self-service onboarding must never reactivate a disabled account or role.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('client_onboarding'), pg_catalog.hashtext(v_actor::text));
  if not exists (select 1 from auth.users where id = v_actor and email_confirmed_at is not null) then
    raise exception 'verified_email_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_profiles where user_id = v_actor and status <> 'active')
    or exists (select 1 from public.user_roles where user_id = v_actor and role = 'client' and is_active = false) then
    raise exception 'client_account_disabled' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_actor and is_active = true and role <> 'client'
  ) then
    raise exception 'client_role_scope_conflict' using errcode = '42501';
  end if;

  select au.email into v_email from auth.users au where au.id = v_actor;

  select al.entity_id into v_profile_id
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_onboarding_completed'
    and al.request_id = v_request_id
  limit 1;

  if v_profile_id is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'user_id', v_actor, 'idempotent', true);
  end if;

  insert into public.user_profiles (user_id, full_name, phone, email, locale, preferred_contact, status)
  values (v_actor, v_full_name, v_phone, v_email, v_locale, 'phone', 'active')
  on conflict (user_id) do update
    set full_name = coalesce(nullif(public.user_profiles.full_name, ''), excluded.full_name),
        phone = coalesce(nullif(public.user_profiles.phone, ''), excluded.phone),
        email = coalesce(nullif(public.user_profiles.email, ''), excluded.email),
        locale = coalesce(public.user_profiles.locale, excluded.locale),
        updated_at = pg_catalog.now();

  select up.id into v_user_profile_id from public.user_profiles up where up.user_id = v_actor;

  if not exists (select 1 from public.user_roles where user_id = v_actor and role = 'client') then
    insert into public.user_roles (user_id, role, is_active) values (v_actor, 'client', true);
  else
    update public.user_roles set is_active = true, updated_at = pg_catalog.now()
    where user_id = v_actor and role = 'client';
  end if;

  insert into public.client_profiles (user_id, default_address)
  values (v_actor, v_default_address)
  on conflict (user_id) do update
    set default_address = coalesce(public.client_profiles.default_address, excluded.default_address),
        updated_at = pg_catalog.now();

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor, 'client', 'client_onboarding_completed', 'user_profiles', v_user_profile_id,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object('full_name_length', length(v_full_name), 'phone_length', length(v_phone), 'locale', v_locale),
    'Client profile created after verified passwordless Auth session.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object('ok', true, 'user_id', v_actor, 'idempotent', false);
end;
$$;

revoke all on function private.client_onboarding_complete_atomic_internal(text, text, text, text, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_onboarding_complete_atomic_internal(text, text, text, text, text) to authenticated;

create or replace function public.client_onboarding_complete_atomic(
  p_full_name text,
  p_phone text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language sql
security invoker
set search_path = public, pg_catalog
as $$
  select private.client_onboarding_complete_atomic_internal(
    p_full_name, p_phone, p_locale, p_default_address, p_request_id
  );
$$;

revoke all on function public.client_onboarding_complete_atomic(text, text, text, text, text) from public, anon;
grant execute on function public.client_onboarding_complete_atomic(text, text, text, text, text) to authenticated;

comment on function public.client_onboarding_complete_atomic(text, text, text, text, text)
is 'Creates or completes the authenticated KOL client profile after passwordless onboarding; idempotent and audited.';

-- END STAGE 025_client_onboarding_atomic_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 026_partner_inventory_publish_DRAFT_NOT_APPLIED.sql
-- KÖL partner inventory publication candidate. NOT APPLIED TO LIVE.
-- Depends on 014 partner availability runtime and transaction hardening 007/008.
-- New capacity must be confirmed by an authorised partner; no automated seeding.

-- There can only be one scheduling slot per tour and start time.
-- NULL time means an untimed full-day tour; keep it distinct from midnight.
create unique index if not exists uq_kol_tour_schedule_exact_slot
  on public.tour_schedules (tour_id, date, time) nulls not distinct;

create or replace function private.partner_inventory_publish_atomic_internal(
 p_scope_type text, p_parent_id uuid, p_date date, p_time time,
 p_capacity integer, p_price_override numeric, p_request_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := auth.uid();
 v_business uuid;
 v_role text;
 v_id uuid;
 v_existing record;
 v_action text;
 v_request_audit record;
begin
 if v_actor is null then
   raise exception 'not_authenticated' using errcode='28000';
 end if;
 if p_scope_type not in ('room_date','tour_schedule') or p_parent_id is null then
   raise exception 'invalid_inventory_scope' using errcode='22023';
 end if;
 if p_date is null or p_date < current_date or p_date > current_date + 365 then
   raise exception 'invalid_inventory_date' using errcode='22023';
 end if;
 if p_capacity is null or p_capacity < 1 or p_capacity > 1000 then
   raise exception 'invalid_inventory_capacity' using errcode='22023';
 end if;
 if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
   raise exception 'invalid_request_id' using errcode='22023';
 end if;
 if p_scope_type='room_date' then
   if p_time is not null or (p_price_override is not null and (p_price_override <= 0 or p_price_override > 10000000)) then
     raise exception 'invalid_room_inventory_price_or_time' using errcode='22023';
   end if;
   select r.business_id into v_business from public.rooms r
    join public.stays s on s.id=r.stay_id and s.business_id=r.business_id
    where r.id=p_parent_id and r.status='active' and s.status='active' and r.price_per_night>0;
 else
   if p_price_override is not null then
     raise exception 'tour_price_override_not_supported' using errcode='22023';
   end if;
   select t.business_id into v_business from public.tours t
    where t.id=p_parent_id and t.status='active' and t.price>0;
 end if;
 if v_business is null then
   raise exception 'inventory_parent_not_active' using errcode='42501';
 end if;
 select ps.role into v_role from public.partner_staff ps
   where ps.user_id=v_actor and ps.business_id=v_business and ps.is_active
   and exists(select 1 from public.user_roles ur where ur.user_id=v_actor
     and ur.role in ('partner_owner','partner_manager','partner_staff') and ur.is_active)
   limit 1;
 if v_role is null then
   raise exception 'inventory_not_owned' using errcode='42501';
 end if;

 -- Serialise by actor/request_id first: a retried request may not be reused
 -- for a different parent, date or capacity, even in another transaction.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('kol_inventory_request:' || v_actor::text),
   pg_catalog.hashtext(p_request_id)
 );
 v_action := 'partner_inventory_' || p_scope_type || '_published';
 select al.entity_id,al.after into v_request_audit
 from public.audit_logs al where al.actor_id=v_actor
   and al.action in ('partner_inventory_room_date_published','partner_inventory_tour_schedule_published')
   and al.request_id=p_request_id
 order by al.created_at desc limit 1;
 if found then
   if v_request_audit.after->>'business_id' <> v_business::text
     or v_request_audit.after->>'parent_id' <> p_parent_id::text
     or v_request_audit.after->>'date' <> p_date::text
     or (v_request_audit.after->>'time') is distinct from p_time::text
     or (v_request_audit.after->>'capacity')::integer <> p_capacity
     or (v_request_audit.after->>'price_override')::numeric is distinct from p_price_override
     or (v_request_audit.after->>'status') <> 'available'
     or v_request_audit.after->>'scope_type' is distinct from p_scope_type
   then raise exception 'inventory_idempotency_key_reused_with_different_payload' using errcode='23505'; end if;
   return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_request_audit.entity_id,'idempotent',true,'status','available');
 end if;

 -- A single parent serialises concurrent publishes. Do not silently change
 -- previously published capacity or override prices.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kol_inventory_publish'),pg_catalog.hashtext(p_parent_id::text));

 if p_scope_type='room_date' then
   select ra.id,ra.available_count,ra.price_override,ra.status into v_existing
     from public.room_availability ra where ra.room_id=p_parent_id and ra.date=p_date for update;
   if found then
     if v_existing.available_count<>p_capacity or v_existing.price_override is distinct from p_price_override then
       raise exception 'existing_room_inventory_requires_review' using errcode='23505';
     end if;
     return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_existing.id,'idempotent',true,'status',v_existing.status);
   end if;
   insert into public.room_availability(room_id,date,status,available_count,price_override)
    values(p_parent_id,p_date,'available',p_capacity,p_price_override) returning id into v_id;
 else
   select ts.id,ts.capacity,ts.booked_count,ts.status into v_existing
     from public.tour_schedules ts
     where ts.tour_id=p_parent_id and ts.date=p_date and ts.time is not distinct from p_time for update;
   if found then
     if v_existing.capacity<>p_capacity then
       raise exception 'existing_tour_capacity_requires_review' using errcode='23505';
     end if;
     return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_existing.id,'idempotent',true,'status',v_existing.status);
   end if;
   insert into public.tour_schedules(tour_id,date,time,capacity,booked_count,status)
    values(p_parent_id,p_date,p_time,p_capacity,0,'available') returning id into v_id;
 end if;
 v_action := 'partner_inventory_' || p_scope_type || '_published';
 insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,v_role,v_action,
        case when p_scope_type='room_date' then 'room_availability' else 'tour_schedules' end,
        v_id,'{}'::jsonb,
        pg_catalog.jsonb_build_object('business_id',v_business,'parent_id',p_parent_id,'date',p_date,
         'time',p_time,'capacity',p_capacity,'price_override',p_price_override,'status','available','scope_type',p_scope_type),
        'Authorized partner published confirmed dated inventory.',p_request_id);
 return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_id,'idempotent',false,'status','available');
end;
$$;

revoke all on function private.partner_inventory_publish_atomic_internal(text,uuid,date,time,integer,numeric,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_inventory_publish_atomic_internal(text,uuid,date,time,integer,numeric,text) to authenticated;
create or replace function public.partner_inventory_publish_atomic(
 p_scope_type text, p_parent_id uuid, p_date date, p_time time,
 p_capacity integer, p_price_override numeric, p_request_id text
) returns jsonb language sql security invoker set search_path='' as $$
 select private.partner_inventory_publish_atomic_internal(p_scope_type,p_parent_id,p_date,p_time,p_capacity,p_price_override,p_request_id);
$$;
revoke all on function public.partner_inventory_publish_atomic(text,uuid,date,time,integer,numeric,text) from public,anon;
grant execute on function public.partner_inventory_publish_atomic(text,uuid,date,time,integer,numeric,text) to authenticated;
-- END STAGE 026_partner_inventory_publish_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 027_public_intake_payload_DRAFT_NOT_APPLIED.sql
-- KÖL: additive public-intake support ticket payload, staging review only.
-- Reconciles the clean migration package with the restored PostgreSQL schema.
-- Anonymous/authenticated callers retain NO direct support_tickets INSERT.
-- Apply only through the reviewed staging sequence and backup/rollback gate.

alter table public.support_tickets
  add column if not exists request_payload jsonb not null default '{}'::jsonb;

create index if not exists idx_support_tickets_intake_phone_recent
  on public.support_tickets ((request_payload ->> 'contact_phone_hash'), created_at desc);

-- RLS bypass does not imply SQL object privileges on a clean Supabase stack.
-- Only the server-side intake adapter may look up retries and create tickets.
grant usage on schema public to service_role;
grant select, insert on table public.support_tickets to service_role;

-- END STAGE 027_public_intake_payload_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 028_admin_intake_pickup_order_link_DRAFT_NOT_APPLIED.sql
-- KOL 028: review-only, STAGING-FIRST. Do NOT deploy on production without signed JWT E2E.
-- Connect an existing client-authorized, DB-priced pickup order to its original intake ticket.
-- This does NOT create orders or enable delivery fees. Anonymous intake cannot be linked
-- without a separately verified customer identity and an independently created order.
create unique index if not exists uq_kol_intake_order_link
  on public.support_tickets (related_order_id)
  where category = 'order_request' and related_order_id is not null;

create or replace function public.admin_link_intake_pickup_order_atomic(
  p_ticket_id uuid,
  p_order_id uuid,
  p_request_id text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
  v_ticket record;
  v_order record;
  v_existing record;
  v_expected jsonb;
  v_actual jsonb;
  v_item_count integer;
  v_bad_count integer;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode='28000';
  end if;
  select ur.role into v_role
    from public.user_roles ur
    where ur.user_id = v_actor and ur.is_active
      and ur.role in ('support_admin','super_admin')
    order by case when ur.role='super_admin' then 0 else 1 end
    limit 1;
  if v_role is null then
    raise exception 'intake_link_operator_required' using errcode='42501';
  end if;
  if p_ticket_id is null or p_order_id is null
     or length(v_request) < 8 or length(v_request) > 128 then
    raise exception 'invalid_intake_link_input' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text), pg_catalog.hashtext(v_request)
  );
  select al.entity_id, al.after into v_existing
    from public.audit_logs al
    where al.actor_id=v_actor and al.action='admin_intake_pickup_order_linked'
      and al.entity_type='support_tickets' and al.request_id=v_request
    limit 1;
  if found then
    if v_existing.entity_id is distinct from p_ticket_id
       or v_existing.after->>'order_id' is distinct from p_order_id::text then
      raise exception 'intake_link_request_payload_conflict' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
      'order_id',p_order_id,'idempotent',true);
  end if;

  select st.id,st.created_by,st.category,st.status,st.related_order_id,
         st.request_payload
    into v_ticket from public.support_tickets st
    where st.id=p_ticket_id for update;
  if not found or v_ticket.category is distinct from 'order_request' then
    raise exception 'intake_order_ticket_not_found' using errcode='P0002';
  end if;
  if v_ticket.created_by is null then
    raise exception 'anonymous_intake_requires_verified_client' using errcode='42501';
  end if;
  if v_ticket.status not in ('open','in_progress') then
    raise exception 'intake_ticket_not_operational' using errcode='P0001';
  end if;
  if v_ticket.related_order_id is not null then
    if v_ticket.related_order_id is distinct from p_order_id then
      raise exception 'intake_ticket_already_linked' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
      'order_id',p_order_id,'idempotent',true);
  end if;

  select o.id,o.client_id,o.type,o.metadata
    into v_order from public.orders o where o.id=p_order_id for update;
  if not found then
    raise exception 'intake_order_not_found' using errcode='P0002';
  end if;
  if v_order.client_id is distinct from v_ticket.created_by then
    raise exception 'intake_client_order_owner_mismatch' using errcode='42501';
  end if;
  if v_order.type not in ('food','shop')
     or v_order.metadata->>'delivery_method' is distinct from 'pickup' then
    raise exception 'intake_delivery_not_configured' using errcode='P0001';
  end if;
  if v_order.metadata->>'idempotency_key' is distinct from
       ('intake-' || p_ticket_id::text) then
    raise exception 'intake_order_key_mismatch' using errcode='23505';
  end if;

  if pg_catalog.jsonb_typeof(v_ticket.request_payload->'cart_items') is distinct from 'array' then
    raise exception 'intake_cart_not_verifiable' using errcode='22023';
  end if;
  select count(*),count(*) filter (where
      id is null or id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or quantity is null or quantity < 1 or quantity > 99
      or type is distinct from case when v_order.type='food' then 'food' else 'product' end)
    into v_item_count,v_bad_count
    from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
      as cart(id text,type text,quantity integer);
  if v_item_count < 1 or v_item_count > 50 or v_bad_count > 0 then
    raise exception 'intake_cart_invalid' using errcode='22023';
  end if;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'qty',x.qty)
    order by x.id) into v_expected
    from (select id, pg_catalog.sum(quantity)::integer qty
      from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
        as cart(id text,type text,quantity integer)
      group by id) x;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'qty',x.qty)
    order by x.id) into v_actual
    from (select oi.item_id::text id,pg_catalog.sum(oi.qty)::integer qty
      from public.order_items oi where oi.order_id=p_order_id
      group by oi.item_id) x;
  if v_expected is distinct from v_actual then
    raise exception 'intake_cart_order_items_mismatch' using errcode='23505';
  end if;

  update public.support_tickets
    set related_order_id=p_order_id,updated_at=pg_catalog.now()
    where id=p_ticket_id;
  insert into public.audit_logs
    (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
    values (v_actor,v_role,'admin_intake_pickup_order_linked','support_tickets',
      p_ticket_id,pg_catalog.jsonb_build_object('related_order_id',null),
      pg_catalog.jsonb_build_object('order_id',p_order_id,'type',v_order.type),
      'Verified existing client-authorized pickup order bound to intake.',v_request);

  return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
    'order_id',p_order_id,'idempotent',false);
end;
$$;

revoke all on function public.admin_link_intake_pickup_order_atomic(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.admin_link_intake_pickup_order_atomic(uuid,uuid,text)
  to authenticated;
comment on function public.admin_link_intake_pickup_order_atomic(uuid,uuid,text) is
  'P0 verified link only. Cannot create or deliver an order; requires already authenticated ticket owner, exact item/quantity and pickup-only DB-authoritative order.';
-- END STAGE 028_admin_intake_pickup_order_link_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 029_verified_client_intake_claim_DRAFT_NOT_APPLIED.sql
-- KOL 029. DRAFT; isolated Auth/JWT tests required before deployment.
-- Allows a verified-email customer to claim only an anonymous intake containing
-- precisely that email. Phone-only and unverified email claims fail closed.
create or replace function public.claim_anonymous_intake_by_verified_email_atomic(
  p_ticket_id uuid,
  p_request_id text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
 v_email text;
 v_verified timestamptz;
 v_ticket record;
 v_existing record;
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 if p_ticket_id is null or length(v_request)<8 or length(v_request)>128 then
  raise exception 'invalid_claim_input' using errcode='22023'; end if;
 if not exists (select 1 from public.user_roles r
                where r.user_id=v_actor and r.role='client' and r.is_active) then
  raise exception 'active_client_required' using errcode='42501'; end if;
 select pg_catalog.lower(pg_catalog.btrim(u.email)),u.email_confirmed_at
   into v_email,v_verified
   from auth.users u where u.id=v_actor;
 if v_email is null or v_email='' or v_verified is null then
  raise exception 'verified_email_required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_actor::text),
                                           pg_catalog.hashtext(v_request));
 select al.entity_id, al.after into v_existing
 from public.audit_logs al
 where al.actor_id=v_actor and al.action='client_anonymous_intake_claimed'
   and al.entity_type='support_tickets' and al.request_id=v_request limit 1;
 if found then
  if v_existing.entity_id is distinct from p_ticket_id then
    raise exception 'intake_claim_request_conflict' using errcode='23505'; end if;
  return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
    'idempotent',true);
 end if;
 select st.id,st.created_by,st.category,st.status,st.request_payload
 into v_ticket
 from public.support_tickets st where st.id=p_ticket_id for update;
 if not found or v_ticket.category is distinct from 'order_request' then
  raise exception 'intake_order_ticket_not_found' using errcode='P0002'; end if;
 if v_ticket.created_by is not null and v_ticket.created_by is distinct from v_actor then
  raise exception 'intake_owned_by_other_client' using errcode='42501'; end if;
 if v_ticket.status not in ('open','in_progress') then
  raise exception 'intake_ticket_not_claimable' using errcode='P0001'; end if;
 if pg_catalog.lower(pg_catalog.btrim(coalesce(v_ticket.request_payload->'contact'->>'email','')))
    is distinct from v_email then
  raise exception 'intake_email_verification_mismatch' using errcode='42501'; end if;
 if v_ticket.created_by is null then
  update public.support_tickets set created_by=v_actor,updated_at=pg_catalog.now()
    where id=p_ticket_id;
 end if;
 insert into public.audit_logs
 (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,'client','client_anonymous_intake_claimed','support_tickets',
  p_ticket_id,pg_catalog.jsonb_build_object('created_by',null),
  pg_catalog.jsonb_build_object('created_by',v_actor),
  'Customer proved the intake email via confirmed Supabase Auth.',v_request);
 return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
   'idempotent',false);
end;
$$;
revoke all on function public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)
 from public,anon,authenticated;
grant execute on function public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)
 to authenticated;
comment on function public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)
 is 'Verified email + exact ticket identifier; phone-only and wrong-client claims denied.';
-- END STAGE 029_verified_client_intake_claim_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 030_approved_delivery_tariff_quote_DRAFT_NOT_APPLIED.sql
-- KOL 030: server-authoritative delivery tariff QUOTE, staged only.
-- No default price, no customer-supplied fee, no delivery order or payment here.
create table if not exists private.kol_delivery_tariffs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete restrict,
  zone_code text not null check (zone_code ~ '^[a-z][a-z0-9-]{2,63}$'),
  fee_som numeric(12,2) not null check (fee_som >= 0 and fee_som <= 100000),
  currency text not null default 'KGS' check (currency = 'KGS'),
  active boolean not null default false,
  valid_from timestamptz not null default pg_catalog.now(),
  valid_until timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check (valid_until is null or valid_until > valid_from),
  check (not active or (approved_by is not null and approved_at is not null)),
  unique (business_id, zone_code)
);
alter table private.kol_delivery_tariffs enable row level security;
revoke all on table private.kol_delivery_tariffs from public, anon, authenticated;
grant select, insert, update on table private.kol_delivery_tariffs to service_role;
create index if not exists idx_kol_delivery_tariffs_active_business
 on private.kol_delivery_tariffs(business_id, zone_code) where active;

create or replace function public.quote_intake_delivery_fee_atomic(
  p_ticket_id uuid,
  p_business_id uuid,
  p_zone_code text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_ticket record;
  v_rate record;
  v_zone text;
  v_location text;
  v_address text;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  select ur.role into v_role from public.user_roles ur
    where ur.user_id=v_actor and ur.is_active
      and ur.role in ('support_admin','super_admin')
    order by case when ur.role='super_admin' then 0 else 1 end limit 1;
  if v_role is null then
    raise exception 'delivery_quote_operator_required' using errcode='42501'; end if;
  if p_ticket_id is null or p_business_id is null
     or p_zone_code is null or p_zone_code !~ '^[a-z][a-z0-9-]{2,63}$' then
    raise exception 'invalid_delivery_quote_input' using errcode='22023'; end if;
  select st.category,st.status,st.request_payload into v_ticket
  from public.support_tickets st where st.id=p_ticket_id;
  if not found or v_ticket.category is distinct from 'order_request'
     or v_ticket.status not in ('open','in_progress') then
    raise exception 'intake_not_quotable' using errcode='P0002'; end if;
  if v_ticket.request_payload->>'delivery_method' is distinct from 'delivery' then
    raise exception 'intake_does_not_request_delivery' using errcode='P0001'; end if;
  v_location := pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'location',''));
  v_address := pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'address',''));
  if length(v_address)<8 or length(v_address)>500 then
    raise exception 'delivery_address_requires_operator_confirmation' using errcode='P0001'; end if;
  v_zone := case v_location
    when 'Чолпон-Ата' then 'cholpon-ata'
    when 'Бостери' then 'bosteri'
    when 'Каракол' then 'karakol'
    when 'Тамчы' then 'tamchy'
    when 'Бактуу-Долоноту' then 'baktuu-dolonotu'
    when 'Сары-Ой' then 'sary-oy'
    else null
  end;
  if v_zone is null or v_zone is distinct from p_zone_code then
    raise exception 'delivery_zone_not_confirmed' using errcode='42501'; end if;
  if not exists(select 1 from public.partners p
    where p.id=p_business_id and p.status='approved') then
    raise exception 'delivery_business_not_approved' using errcode='42501'; end if;
  select t.id,t.fee_som,t.currency,t.valid_from,t.valid_until into v_rate
    from private.kol_delivery_tariffs t
    where t.business_id=p_business_id and t.zone_code=v_zone
      and t.active and t.approved_by is not null and t.approved_at is not null
      and t.valid_from<=pg_catalog.now()
      and (t.valid_until is null or t.valid_until>pg_catalog.now())
      and exists(select 1 from public.user_roles ar where ar.user_id=t.approved_by
         and ar.is_active and ar.role in ('support_admin','super_admin'));
  if not found then
    raise exception 'delivery_tariff_not_configured' using errcode='P0001'; end if;
  return pg_catalog.jsonb_build_object(
    'ok',true,'ticket_id',p_ticket_id,'business_id',p_business_id,
    'tariff_id',v_rate.id,'currency',v_rate.currency,
    'fee_som',v_rate.fee_som,'zone_code',v_zone,
    'quote_at',pg_catalog.now(),'expires_at',v_rate.valid_until,
    'price_source','approved_database_tariff',
    'operator_address_review_required',true,
    'order_created',false);
end;
$$;
revoke all on function public.quote_intake_delivery_fee_atomic(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.quote_intake_delivery_fee_atomic(uuid,uuid,text)
  to authenticated;
comment on function public.quote_intake_delivery_fee_atomic(uuid,uuid,text) is
  'Operator-only authoritative KGS zone tariff quote; no delivery order created; address must be confirmed.';
-- END STAGE 030_approved_delivery_tariff_quote_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 031_shared_atomic_order_core_DRAFT_NOT_APPLIED.sql
-- KOL 031 — shared atomic client/verified operator core; DRAFT NOT APPLIED.
-- Depends on 008, 008a, 012 and 028, 029, 030. Isolated staging only.
-- The existing public create_order_atomic wrapper retains client pickup-only policy.
-- No payment capture, zero default delivery tariff or JWT impersonation.
create or replace function private.create_order_for_client_atomic_core(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text,
  p_client_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_delivery_tariff_id uuid default null,
  p_delivery_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_client_id;
  v_delivery_fee numeric(12,2) := 0;
  v_tariff record;
  v_tariff_zone text := null;
  v_delivery_id uuid;
  v_existing_id uuid;
  v_existing_business_id uuid;
  v_existing_type text;
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_min_order numeric := 0;
  v_title text;
  v_price numeric;
  v_stock integer;
  v_partner_address text;
  v_invalid_items integer;
  v_item_count integer;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_actor_id is null or p_actor_role not in ('client','support_admin','super_admin') then
    raise exception 'invalid_order_actor' using errcode = '42501';
  end if;
  if p_delivery_method not in ('pickup','delivery') then
    raise exception 'unsupported_delivery_method' using errcode = '22023';
  end if;
  if p_delivery_method='pickup' and
     (p_delivery_tariff_id is not null or p_delivery_address is not null) then
    raise exception 'pickup_payload_has_delivery_fields' using errcode = '22023';
  end if;
  if p_delivery_method='delivery' then
    if p_delivery_tariff_id is null or p_delivery_address is null or
       length(pg_catalog.btrim(p_delivery_address)) < 8 or
       length(pg_catalog.btrim(p_delivery_address)) > 500 then
      raise exception 'delivery_price_or_address_missing' using errcode = 'P0001';
    end if;
    select t.id,t.fee_som,t.currency,t.zone_code into v_tariff
      from private.kol_delivery_tariffs t
      where t.id=p_delivery_tariff_id and t.business_id=p_business_id
        and t.active and t.currency='KGS'
        and t.valid_from<=pg_catalog.now()
        and (t.valid_until is null or t.valid_until>pg_catalog.now())
        and exists(select 1 from public.user_roles ar where
          ar.user_id=t.approved_by and ar.is_active
          and ar.role in ('support_admin','super_admin'))
      for share of t;
    if not found then
      raise exception 'approved_delivery_tariff_missing' using errcode = 'P0001';
    end if;
    v_delivery_fee:=v_tariff.fee_som;
    v_tariff_zone:=v_tariff.zone_code;
  end if;

  if p_idempotency_key is null
     or length(pg_catalog.btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array' using errcode = '22023';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'invalid_item_count' using errcode = '22023';
  end if;

  -- Serialize retries with the same client/idempotency pair before inventory locks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select o.id, o.business_id, o.type
    into v_existing_id, v_existing_business_id, v_existing_type
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id <> p_business_id or v_existing_type <> p_order_type then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select count(*)::integer
    into v_invalid_items
  from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
  where x.item_id is null
     or x.qty is null
     or x.qty < 1
     or x.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_order_item' using errcode = '22023';
  end if;

  select p.address
    into v_partner_address
  from public.partners as p
  where p.id = p_business_id
    and p.status = 'approved';

  if not found then
    raise exception 'business_not_available' using errcode = 'P0001';
  end if;

  if p_order_type = 'food' then
    select r.min_order_amount
      into v_min_order
    from public.restaurants as r
    where r.business_id = p_business_id;

    if not found then
      raise exception 'food_business_not_configured' using errcode = 'P0001';
    end if;

    -- Lock every referenced menu row in deterministic UUID order and calculate
    -- the authoritative subtotal. Duplicate item ids are consolidated.
    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active'
      for update;

      if not found then
        raise exception 'menu_item_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;

    if v_subtotal < coalesce(v_min_order, 0) then
      raise exception 'minimum_order_not_met' using errcode = 'P0001';
    end if;
  else
    -- Shop orders require an actual shop contour and tracked stock. NULL stock
    -- is treated as unknown, never as unlimited.
    perform 1
    from public.shops as s
    where s.business_id = p_business_id;

    if not found then
      raise exception 'shop_business_not_configured' using errcode = 'P0001';
    end if;

    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select p.title, p.price, p.stock_qty
        into v_title, v_price, v_stock
      from public.products as p
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
      for update;

      if not found then
        raise exception 'product_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      if v_stock is null then
        raise exception 'product_stock_not_tracked' using errcode = 'P0001';
      end if;

      if v_stock < v_item.qty then
        raise exception 'insufficient_product_stock' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;
  end if;

  if v_subtotal <= 0 then
    raise exception 'invalid_order_subtotal' using errcode = 'P0001';
  end if;

  insert into public.orders (
    client_id,
    business_id,
    type,
    status,
    subtotal,
    delivery_fee,
    discount,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    p_business_id,
    p_order_type,
    'new',
    v_subtotal,
    v_delivery_fee,
    0,
    v_subtotal+v_delivery_fee,
    'pending',
    pg_catalog.jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'pricing_authority', 'database',
      'delivery_method', p_delivery_method,
      'delivery_fee_model',case when p_delivery_method='pickup' then 'pickup_zero' else 'approved_zone_tariff' end,
      'delivery_tariff_id',p_delivery_tariff_id,
      'delivery_zone',v_tariff_zone,
      'currency','KGS'
    )
  )
  returning id into v_order_id;

  -- Insert snapshots from the still-locked catalog rows. Shop stock decrement is
  -- performed in the same transaction immediately before its item snapshot.
  for v_item in
    select x.item_id, sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
    order by x.item_id
  loop
    if p_order_type = 'food' then
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active';

      if not found then
        raise exception 'menu_item_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'menu_item', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    else
      update public.products as p
      set stock_qty = p.stock_qty - v_item.qty
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
        and p.stock_qty is not null
        and p.stock_qty >= v_item.qty
      returning p.title, p.price into v_title, v_price;

      if not found then
        raise exception 'product_stock_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'product', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    end if;
  end loop;

  insert into public.order_delivery (
    order_id,
    delivery_method,
    pickup_address,
    dropoff_address
  ) values (
    v_order_id,
    p_delivery_method,
    v_partner_address,
    case when p_delivery_method='delivery' then pg_catalog.btrim(p_delivery_address) else null end
  );

  if p_delivery_method='delivery' then
    insert into public.deliveries
      (order_id,status,pickup_address,dropoff_address,metadata)
    values (v_order_id,'delivery_pending',v_partner_address,
      pg_catalog.btrim(p_delivery_address),
      pg_catalog.jsonb_build_object('tariff_id',v_tariff.id,
        'zone_code',v_tariff.zone_code,'fee_som',v_delivery_fee,'currency','KGS'))
    returning id into v_delivery_id;
    update public.order_delivery set delivery_id=v_delivery_id
      where order_id=v_order_id;
    insert into public.delivery_status_history
      (delivery_id,from_status,to_status,changed_by,reason)
    values (v_delivery_id,null,'delivery_pending',p_actor_id,
      'approved_delivery_order_created');
  end if;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_order_id,
    p_actor_id,
    null,
    'new',
    'atomic_order_created'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    p_actor_id,
    p_actor_role,
    'create_order_atomic',
    'orders',
    v_order_id,
    null,
    pg_catalog.jsonb_build_object(
      'business_id', p_business_id,
      'type', p_order_type,
      'subtotal', v_subtotal,
      'delivery_fee', v_delivery_fee,
      'delivery_id',v_delivery_id,
      'client_id',v_user_id,
      'payment_status', 'pending'
    ),
    'Atomic order created from server-authoritative catalog values.',
    'create-order-' || p_idempotency_key
  );

  return v_order_id;
end;
$$;
revoke all on function private.create_order_for_client_atomic_core(
  uuid,text,jsonb,text,text,uuid,uuid,text,uuid,text)
  from public,anon,authenticated;
-- This internal function is only callable from SECURITY DEFINER wrappers
-- owned by the migration administrator; direct Data API execution denied.
create or replace function public.create_order_atomic_v1_internal(
  p_business_id uuid,
  p_order_type text,
  p_items jsonb,
  p_delivery_method text,
  p_idempotency_key text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  -- Preserve client route as pickup-only until a separate accepted UX/fee flow.
  if p_delivery_method is distinct from 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode='P0001';
  end if;
  return private.create_order_for_client_atomic_core(
    p_business_id,p_order_type,p_items,p_delivery_method,p_idempotency_key,
    v_actor,v_actor,'client',null,null);
end;
$$;
revoke all on function public.create_order_atomic_v1_internal(uuid,text,jsonb,text,text)
  from public,anon,authenticated;

-- END STAGE 031_shared_atomic_order_core_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 032_admin_confirm_intake_order_DRAFT_NOT_APPLIED.sql
-- KOL 032: verified operator confirmation & atomic creation of a single-partner order.
-- Dependencies 028/029/030/031. DRAFT ONLY; never apply to live without E2E.
create or replace function public.admin_confirm_intake_order_atomic(
  p_ticket_id uuid,
  p_business_id uuid,
  p_confirmed_delivery_fee_som numeric,
  p_confirmation_note text,
  p_request_id text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_role text;
 v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
 v_note text := pg_catalog.btrim(coalesce(p_confirmation_note,''));
 v_ticket record;
 v_client record;
 v_method text;
 v_order_type text;
 v_item_type text;
 v_types integer;
 v_items jsonb;
 v_invalid int;
 v_normalized_invalid int;
 v_cart_count int;
 v_key text;
 v_old uuid;
 v_order uuid;
 v_tariff record;
 v_zone text;
 v_location text;
 v_address text;
 v_existing record;
 v_actual_fee numeric(12,2) := 0;
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 select r.role into v_role from public.user_roles r
  where r.user_id=v_actor and r.is_active and r.role in ('support_admin','super_admin')
  order by case when r.role='super_admin' then 0 else 1 end limit 1;
 if v_role is null then raise exception 'operator_order_role_required' using errcode='42501'; end if;
 if p_ticket_id is null or p_business_id is null
    or length(v_request)<8 or length(v_request)>128
    or length(v_note)<8 or length(v_note)>500 or
    p_confirmed_delivery_fee_som is null or
    p_confirmed_delivery_fee_som<0 then
   raise exception 'operator_order_confirmation_required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext(v_actor::text),pg_catalog.hashtext(v_request));
 select al.entity_id,al.after into v_existing from public.audit_logs al
   where al.actor_id=v_actor and al.action='admin_confirm_intake_order_atomic'
     and al.entity_type='support_tickets' and al.request_id=v_request limit 1;
 if found then
   if v_existing.entity_id is distinct from p_ticket_id
      or v_existing.after->>'business_id' is distinct from p_business_id::text
      or (v_existing.after->>'delivery_fee_som')::numeric is distinct from p_confirmed_delivery_fee_som
      or v_existing.after->>'confirmation_note_hash' is distinct from pg_catalog.md5(v_note) then
     raise exception 'operator_confirmation_request_conflict' using errcode='23505'; end if;
   return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
     'order_id',v_existing.after->>'order_id','idempotent',true);
 end if;

 select st.id,st.created_by,st.category,st.status,st.related_order_id,
        st.request_payload into v_ticket
 from public.support_tickets st where st.id=p_ticket_id for update;
 if not found or v_ticket.category is distinct from 'order_request' then
   raise exception 'intake_not_found' using errcode='P0002'; end if;
 if v_ticket.status not in ('open','in_progress') then
   raise exception 'intake_not_active' using errcode='P0001'; end if;
 if v_ticket.related_order_id is not null then
   raise exception 'intake_already_has_order' using errcode='23505'; end if;
 if v_ticket.created_by is null then
   raise exception 'intake_client_verification_required' using errcode='42501'; end if;
 select pg_catalog.lower(pg_catalog.btrim(u.email)) as email,
        u.email_confirmed_at as verified_at
   into v_client from auth.users u where u.id=v_ticket.created_by;
 if not found or v_client.verified_at is null or v_client.email is null or
    v_client.email is distinct from
      pg_catalog.lower(pg_catalog.btrim(coalesce(v_ticket.request_payload->'contact'->>'email','')))
    or not exists(select 1 from public.user_roles ur where
         ur.user_id=v_ticket.created_by and ur.role='client' and ur.is_active) then
   raise exception 'verified_ticket_client_required' using errcode='42501'; end if;

 v_method:=v_ticket.request_payload->>'delivery_method';
 if v_method not in ('pickup','delivery') then
   raise exception 'unsupported_intake_delivery_method' using errcode='P0001'; end if;
 if pg_catalog.jsonb_typeof(v_ticket.request_payload->'cart_items') is distinct from 'array' then
   raise exception 'unverifiable_intake_cart' using errcode='22023'; end if;
 select count(*),count(distinct x.type),
  count(*) filter(where x.id is null or
      x.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or x.type not in ('food','product') or x.type is null
      or x.quantity is null or x.quantity<1 or x.quantity>99)
 into v_cart_count,v_types,v_invalid
 from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
  as x(id text,type text,quantity integer);
 if v_cart_count<1 or v_cart_count>50 or v_types<>1 or v_invalid<>0 then
   raise exception 'invalid_single_business_intake_cart' using errcode='22023'; end if;
 select x.type into v_item_type
 from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
 as x(id text,type text,quantity integer) limit 1;
 v_order_type:=case when v_item_type='food' then 'food' else 'shop' end;
 select count(*) into v_normalized_invalid
 from (select x.id,pg_catalog.sum(x.quantity)::integer qty
    from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
      as x(id text,type text,quantity integer) group by x.id) m
 where m.qty<1 or m.qty>99;
 if v_normalized_invalid<>0 then
   raise exception 'intake_normalized_quantity_invalid' using errcode='22023'; end if;
 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'item_id',x.id::uuid,'qty',x.qty) order by x.id)
 into v_items from (
   select y.id,pg_catalog.sum(y.quantity)::integer qty
   from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
     as y(id text,type text,quantity integer)
   group by y.id) x;
 if v_items is null then raise exception 'intake_empty_cart' using errcode='22023'; end if;

 if v_method='pickup' then
   if p_confirmed_delivery_fee_som<>0 then
     raise exception 'pickup_has_no_delivery_fee' using errcode='22023'; end if;
   v_address:=null;
 else
   v_location:=pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'location',''));
   v_address:=pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'address',''));
   v_zone:=case v_location
     when 'Чолпон-Ата' then 'cholpon-ata'
     when 'Бостери' then 'bosteri'
     when 'Каракол' then 'karakol'
     when 'Тамчы' then 'tamchy'
     when 'Бактуу-Долоноту' then 'baktuu-dolonotu'
     when 'Сары-Ой' then 'sary-oy'
     else null end;
   if v_zone is null or length(v_address)<8 or length(v_address)>500 then
     raise exception 'delivery_address_or_zone_unconfirmed' using errcode='P0001'; end if;
   select t.id,t.fee_som into v_tariff from private.kol_delivery_tariffs t
   where t.business_id=p_business_id and t.zone_code=v_zone
     and t.active and t.currency='KGS'
     and t.valid_from<=pg_catalog.now()
     and (t.valid_until is null or t.valid_until>pg_catalog.now())
     and exists(select 1 from public.user_roles r where r.user_id=t.approved_by
       and r.is_active and r.role in ('support_admin','super_admin'))
   for share of t;
   if not found then raise exception 'delivery_tariff_not_configured' using errcode='P0001'; end if;
   v_actual_fee:=v_tariff.fee_som;
   if v_actual_fee is distinct from p_confirmed_delivery_fee_som then
     raise exception 'delivery_quote_changed_require_reconfirmation' using errcode='P0001'; end if;
 end if;

 v_key:='intake-'||p_ticket_id::text;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext(v_ticket.created_by::text),pg_catalog.hashtext(v_key));
 select o.id into v_old from public.orders o
 where o.client_id=v_ticket.created_by and o.metadata->>'idempotency_key'=v_key
 limit 1;
 if v_old is not null then
   raise exception 'intake_order_exists_use_verified_link' using errcode='23505'; end if;

 -- Shared atomic core: identical pricing, inventory decrement, payment pending,
 -- items/history/audit; delivery aggregate is committed in this same transaction.
 v_order:=private.create_order_for_client_atomic_core(
   p_business_id,v_order_type,v_items,v_method,v_key,
   v_ticket.created_by,v_actor,v_role,
   case when v_method='delivery' then v_tariff.id else null end,
   v_address);
 update public.support_tickets set related_order_id=v_order,
   updated_at=pg_catalog.now() where id=p_ticket_id;
 insert into public.audit_logs
 (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,v_role,'admin_confirm_intake_order_atomic','support_tickets',
  p_ticket_id,pg_catalog.jsonb_build_object('related_order_id',null),
  pg_catalog.jsonb_build_object('order_id',v_order,
    'business_id',p_business_id,'delivery_fee_som',v_actual_fee,
    'delivery_method',v_method,'confirmation_note_hash',pg_catalog.md5(v_note)),
  v_note,v_request);
 return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
   'order_id',v_order,'idempotent',false,'delivery_fee_som',v_actual_fee,
   'delivery_method',v_method);
end;
$$;
revoke all on function public.admin_confirm_intake_order_atomic(uuid,uuid,numeric,text,text)
 from public,anon,authenticated;
grant execute on function public.admin_confirm_intake_order_atomic(uuid,uuid,numeric,text,text)
 to authenticated;
comment on function public.admin_confirm_intake_order_atomic(uuid,uuid,numeric,text,text) is
 'Verified-client operator confirmation. Shared DB price/stock core; exact configured KGS fee; atomic linked order/delivery and audit.';
-- END STAGE 032_admin_confirm_intake_order_DRAFT_NOT_APPLIED.sql
-- BEGIN STAGE 033_public_intake_atomic_rate_limit_DRAFT_NOT_APPLIED.sql
-- DRAFT_NOT_APPLIED. Disposable local database ONLY. Never execute on a shared or live database.
-- Atomic check + INSERT: lock keyed IP scope, preserve replay, independent IP and phone windows.
-- Schema prerequisite: public.support_tickets.request_payload jsonb (existing launch-intake migration).

create or replace function public.kol_public_intake_atomic(
  p_id uuid, p_kind text, p_title text, p_created_by uuid,
  p_payload jsonb, p_fingerprint text, p_phone_hash text, p_ip_hash text
) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_recent_ip integer;
  v_recent_phone integer;
begin
  if p_id is null or p_kind not in ('order_request','booking_request','support')
     or length(coalesce(p_title,'')) < 3
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_phone_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid intake request' using errcode='22023';
  end if;

  -- Serialize concurrent requests for one IP and separately by phone.
  -- Ordering by advisory lock key avoids deadlocks when scopes differ.
  perform pg_catalog.pg_advisory_xact_lock(v.lock_key)
  from (select distinct hashtextextended(key, 1407) as lock_key
        from (values ('ip:'||p_ip_hash),('phone:'||p_phone_hash)) as k(key)
        order by lock_key) v;

  select * into v_ticket from public.support_tickets where id=p_id;
  if found then
    if v_ticket.category = p_kind
       and v_ticket.request_payload->>'request_fingerprint' = p_fingerprint then
      return 'replay';
    end if;
    return 'conflict';
  end if;

  select count(*) into v_recent_ip from (
    select 1 from public.support_tickets
      where request_payload->>'contact_ip_hash'=p_ip_hash
      and created_at>=pg_catalog.now()-interval '15 minutes' limit 4
  ) q;
  select count(*) into v_recent_phone from (
    select 1 from public.support_tickets
      where request_payload->>'contact_phone_hash'=p_phone_hash
      and created_at>=pg_catalog.now()-interval '15 minutes' limit 4
  ) q;
  if v_recent_ip>=4 or v_recent_phone>=4 then
    return 'rate_limited';
  end if;

  insert into public.support_tickets (
    id,created_by,related_order_id,related_booking_id,category,priority,status,title,request_payload
  ) values (
    p_id,p_created_by,null,null,p_kind,'medium','open',p_title,
    p_payload || pg_catalog.jsonb_build_object(
      'request_fingerprint',p_fingerprint,'contact_phone_hash',p_phone_hash,
      'contact_ip_hash',p_ip_hash,'intake_version',3
    )
  );
  return 'inserted';
exception
  when unique_violation then
    select * into v_ticket from public.support_tickets where id=p_id;
    if found and v_ticket.category=p_kind
       and v_ticket.request_payload->>'request_fingerprint'=p_fingerprint then
      return 'replay';
    end if;
    return 'conflict';
end
$$;

revoke all on function public.kol_public_intake_atomic(uuid,text,text,uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.kol_public_intake_atomic(uuid,text,text,uuid,jsonb,text,text,text) to service_role;
-- END STAGE 033_public_intake_atomic_rate_limit_DRAFT_NOT_APPLIED.sql
SELECT 'KOL_PRISTINE_SQL_ALL_50_STAGES_PASS';
COMMIT;
