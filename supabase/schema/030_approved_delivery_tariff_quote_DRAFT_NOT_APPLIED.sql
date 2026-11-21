-- KOL 030: server-authoritative delivery tariff QUOTE, staged only.
-- No default price, no customer-supplied fee, no delivery order or payment here.
begin;
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
commit;
