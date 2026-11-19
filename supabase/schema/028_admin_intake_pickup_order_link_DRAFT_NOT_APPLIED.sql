-- KOL 028: review-only, STAGING-FIRST. Do NOT deploy on production without signed JWT E2E.
-- Connect an existing client-authorized, DB-priced pickup order to its original intake ticket.
-- This does NOT create orders or enable delivery fees. Anonymous intake cannot be linked
-- without a separately verified customer identity and an independently created order.
begin;
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
commit;
