-- KOL 032: verified operator confirmation & atomic creation of a single-partner order.
-- Dependencies 028/029/030/031. DRAFT ONLY; never apply to live without E2E.
begin;
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
commit;
