-- KÖL authenticated client stay booking: atomic inventory reservation, idempotency and audit.
-- Applied to the KOL Supabase staging project on 2026-09-28.
-- Production application remains gated by release verification.
begin;
create schema if not exists private;
create index if not exists idx_audit_client_booking_request on public.audit_logs(actor_id,action,request_id) where action='client_booking_created';

create or replace function private.client_stay_booking_create_atomic_internal(
 p_room_id uuid,p_start_date date,p_end_date date,p_guests integer,p_request_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid:=auth.uid(); v_business uuid; v_stay uuid; v_capacity integer; v_price numeric;
 v_days integer; v_total numeric:=0; v_date date; v_avail integer; v_status text; v_override numeric;
 v_booking uuid; v_existing uuid; v_existing_after jsonb; v_req text:=pg_catalog.btrim(coalesce(p_request_id,''));
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 if not exists(select 1 from public.user_roles where user_id=v_actor and role='client' and is_active=true) then raise exception 'client_role_required' using errcode='42501'; end if;
 if p_room_id is null or p_start_date is null or p_end_date is null or p_end_date<=p_start_date then raise exception 'invalid_booking_dates' using errcode='22023'; end if;
 if p_start_date<current_date or p_end_date>current_date+365 then raise exception 'booking_dates_out_of_range' using errcode='22023'; end if;
 if p_guests<1 or p_guests>20 then raise exception 'invalid_guests' using errcode='22023'; end if;
 if length(v_req)<8 or length(v_req)>128 then raise exception 'invalid_request_id' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_room_id::text),pg_catalog.hashtext(p_start_date::text||':'||p_end_date::text));
 select entity_id,after into v_existing,v_existing_after from public.audit_logs where actor_id=v_actor and action='client_booking_created' and request_id=v_req limit 1;
 if v_existing is not null then
  if coalesce(v_existing_after->>'room_id','')<>p_room_id::text or coalesce(v_existing_after->>'start_date','')<>p_start_date::text or coalesce(v_existing_after->>'end_date','')<>p_end_date::text or coalesce(v_existing_after->>'guests','')<>p_guests::text then raise exception 'booking_request_id_payload_conflict' using errcode='23505'; end if;
  return jsonb_build_object('ok',true,'booking_id',v_existing,'idempotent',true,'total',coalesce((v_existing_after->>'total')::numeric,0));
 end if;
 select r.business_id,r.stay_id,r.capacity,r.price_per_night into v_business,v_stay,v_capacity,v_price from public.rooms r join public.stays s on s.id=r.stay_id join public.partners p on p.id=r.business_id where r.id=p_room_id and r.status='active' and s.status in('active','published') and p.status='approved' and p.business_status='online' for update of r;
 if v_business is null then raise exception 'room_not_bookable' using errcode='22023'; end if;
 if p_guests>v_capacity then raise exception 'room_capacity_exceeded' using errcode='22023'; end if;
 v_days:=p_end_date-p_start_date;
 for v_date in select generate_series(p_start_date,p_end_date-1,interval '1 day')::date loop
  select ra.status,ra.available_count,ra.price_override into v_status,v_avail,v_override from public.room_availability ra where ra.room_id=p_room_id and ra.date=v_date for update;
  if found then
   if v_status<>'available' or v_avail<1 then raise exception 'room_unavailable' using errcode='P0001'; end if;
   v_total:=v_total+coalesce(v_override,v_price);
  else v_total:=v_total+v_price; end if;
 end loop;
 insert into public.bookings(client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,metadata)
 values(v_actor,v_business,'stay',p_room_id,'pending',p_start_date,p_end_date,p_guests,v_total,'pending',jsonb_build_object('stay_id',v_stay,'request_id',v_req,'inventory_reserved',true)) returning id into v_booking;
 for v_date in select generate_series(p_start_date,p_end_date-1,interval '1 day')::date loop
  insert into public.room_availability(room_id,date,status,available_count) values(p_room_id,v_date,'booked',0)
  on conflict(room_id,date) do update set available_count=greatest(public.room_availability.available_count-1,0),status=case when public.room_availability.available_count-1<=0 then 'booked' else 'available' end,updated_at=now();
 end loop;
 insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,'client','client_booking_created','bookings',v_booking,null,jsonb_build_object('room_id',p_room_id,'stay_id',v_stay,'start_date',p_start_date,'end_date',p_end_date,'guests',p_guests,'total',v_total,'days',v_days),'Client stay booking created atomically.',v_req);
 return jsonb_build_object('ok',true,'booking_id',v_booking,'idempotent',false,'total',v_total);
end $$;
revoke all on function private.client_stay_booking_create_atomic_internal(uuid,date,date,integer,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_stay_booking_create_atomic_internal(uuid,date,date,integer,text) to authenticated;
create or replace function public.client_stay_booking_create_atomic(p_room_id uuid,p_start_date date,p_end_date date,p_guests integer,p_request_id text)
returns jsonb language sql security invoker set search_path='' as $$ select private.client_stay_booking_create_atomic_internal(p_room_id,p_start_date,p_end_date,p_guests,p_request_id); $$;
revoke all on function public.client_stay_booking_create_atomic(uuid,date,date,integer,text) from public,anon;
grant execute on function public.client_stay_booking_create_atomic(uuid,date,date,integer,text) to authenticated;
commit;