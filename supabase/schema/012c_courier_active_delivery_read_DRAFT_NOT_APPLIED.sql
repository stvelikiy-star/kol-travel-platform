-- KÖL / kol-travel-platform
-- COURIER ACTIVE DELIVERY READ — DRAFT NOT APPLIED
-- Prepared: 2026-08-31
--
-- Scope: expose only the minimal active-delivery projection required by the
-- authenticated Courier UI. This intentionally does NOT broaden direct SELECT
-- access to public.orders and does not grant any mutation authority.

begin;

create or replace function public.get_courier_active_deliveries()
returns table (
  delivery_id uuid,
  order_id uuid,
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
  'RLS-safe constrained read projection for the authenticated courier active-delivery UI. Direct order SELECT remains unchanged.';

commit;
