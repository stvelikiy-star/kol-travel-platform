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

begin;

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

commit;

-- STAGING PROOF:
-- - role-by-role SELECT/UPDATE behavior remains equivalent to pre-006b behavior;
-- - anon no longer evaluates these identity-dependent policies;
-- - Supabase Performance Advisor auth_rls_initplan warnings disappear for the
--   policies rewritten above;
-- - cross-partner and cross-user reads remain denied.
