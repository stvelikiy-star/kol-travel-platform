-- KÖL / staging
-- Cache auth.uid() once per statement without changing ownership semantics.

begin;

drop policy if exists "clients create own orders draft" on public.orders;
create policy "clients create own orders draft"
  on public.orders
  for insert
  to public
  with check (client_id = (select auth.uid()));

drop policy if exists "clients create own bookings" on public.bookings;
create policy "clients create own bookings"
  on public.bookings
  for insert
  to public
  with check (client_id = (select auth.uid()));

commit;
