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

begin;

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

commit;

-- POST-APPLY VERIFICATION REQUIRED ON STAGING:
-- 1. Supabase Security Advisor: no function_search_path_mutable for these six functions.
-- 2. authenticated client: can resolve own roles without recursion.
-- 3. partner: is_partner_for() resolves own active staff row without recursion.
-- 4. anon: categories/approved partners/active tours/stays/menu_items/products are readable.
-- 5. anon: cannot read inactive/unapproved catalog rows.
-- 6. partner A cannot read/write partner B private rows.
-- 7. admin role checks still resolve from the admin's own user_roles rows.
-- 8. no payment, booking, delivery or alcohol state is mutated by this patch.
