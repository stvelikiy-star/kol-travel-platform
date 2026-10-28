-- KÖL partner inventory publication candidate. NOT APPLIED TO LIVE.
-- Depends on 014 partner availability runtime and transaction hardening 007/008.
-- New capacity must be confirmed by an authorised partner; no automated seeding.
begin;

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
         'time',p_time,'capacity',p_capacity,'price_override',p_price_override,'status','available'),
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
commit;
