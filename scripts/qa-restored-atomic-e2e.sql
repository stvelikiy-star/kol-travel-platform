-- KÖL: only a disposable restored PostgreSQL copy, never run against the live source.
-- All fixture writes occur inside BEGIN/ROLLBACK; use psql -X -v ON_ERROR_STOP=1.
begin;

create temporary table kol_qa_context as
select
  ur.user_id as client_id,
  r.id as room_id,
  t.id as tour_id,
  mi.id as menu_id,
  mi.business_id as food_business_id,
  gen_random_uuid() as schedule_id,
  current_date + 7 as stay_start,
  current_date + 8 as stay_end,
  'kol-isolated-stay-' || gen_random_uuid()::text as stay_key,
  'kol-isolated-tour-' || gen_random_uuid()::text as tour_key,
  'kol-isolated-food-' || gen_random_uuid()::text as order_key
from public.user_roles ur
cross join lateral (select id from public.rooms where status='active' limit 1) r
cross join lateral (select id from public.tours where status='active' limit 1) t
cross join lateral (select id, business_id from public.menu_items where status='active' limit 1) mi
where ur.role='client' and ur.is_active
limit 1;

do $$ begin
  if (select count(*) from kol_qa_context) <> 1 then
    raise exception 'missing_client_or_active_test_inventory';
  end if;
end $$;

insert into public.room_availability(room_id,date,status,available_count,price_override)
select room_id, stay_start, 'available', 2, 5700 from kol_qa_context;

insert into public.tour_schedules(id,tour_id,date,time,capacity,booked_count,status)
select schedule_id,tour_id,stay_end,'11:00'::time,12,0,'available' from kol_qa_context;

create temporary table kol_qa_results(operation text, id uuid);
grant select on kol_qa_context to authenticated;
grant select,insert on kol_qa_results to authenticated;
select set_config('request.jwt.claim.sub',(select client_id::text from kol_qa_context),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',(select jsonb_build_object('sub',client_id,'role','authenticated')::text from kol_qa_context),true);

set local role authenticated;

insert into kol_qa_results
select 'stay_first', public.create_stay_booking_atomic(room_id,stay_start,stay_end,1,stay_key) from kol_qa_context;
insert into kol_qa_results
select 'stay_retry', public.create_stay_booking_atomic(room_id,stay_start,stay_end,1,stay_key) from kol_qa_context;
insert into kol_qa_results
select 'tour_first', public.create_tour_booking_atomic(schedule_id,2,tour_key) from kol_qa_context;
insert into kol_qa_results
select 'tour_retry', public.create_tour_booking_atomic(schedule_id,2,tour_key) from kol_qa_context;
insert into kol_qa_results
select 'food_first', public.create_order_atomic(food_business_id,'food',jsonb_build_array(jsonb_build_object('item_id',menu_id,'qty',1)),'pickup',order_key) from kol_qa_context;
insert into kol_qa_results
select 'food_retry', public.create_order_atomic(food_business_id,'food',jsonb_build_array(jsonb_build_object('item_id',menu_id,'qty',1)),'pickup',order_key) from kol_qa_context;

reset role;

do $$
declare ctx record;
begin
 select * into ctx from kol_qa_context;
 if (select id from kol_qa_results where operation='stay_first') is distinct from
    (select id from kol_qa_results where operation='stay_retry') then
    raise exception 'stay_idempotency_failed';
 end if;
 if (select id from kol_qa_results where operation='tour_first') is distinct from
    (select id from kol_qa_results where operation='tour_retry') then
    raise exception 'tour_idempotency_failed';
 end if;
 if (select id from kol_qa_results where operation='food_first') is distinct from
    (select id from kol_qa_results where operation='food_retry') then
    raise exception 'food_idempotency_failed';
 end if;
 if (select available_count from public.room_availability where room_id=ctx.room_id and date=ctx.stay_start) <> 1 then
    raise exception 'stay_inventory_incorrect';
 end if;
 if (select booked_count from public.tour_schedules where id=ctx.schedule_id) <> 2 then
    raise exception 'tour_capacity_incorrect';
 end if;
 if (select count(*) from public.bookings where client_id=ctx.client_id and metadata->>'idempotency_key' in (ctx.stay_key,ctx.tour_key)) <> 2 then
    raise exception 'booking_rows_incorrect';
 end if;
 if (select count(*) from public.orders where client_id=ctx.client_id and metadata->>'idempotency_key'=ctx.order_key) <> 1 then
    raise exception 'order_rows_incorrect';
 end if;
 if (select count(*) from public.order_items where order_id=(select id from kol_qa_results where operation='food_first')) <> 1 then
    raise exception 'order_items_incorrect';
 end if;
 if (select count(*) from public.booking_status_history where booking_id in (select id from kol_qa_results where operation in ('stay_first','tour_first'))) < 2 then
    raise exception 'booking_history_missing';
 end if;
end $$;
rollback;
select 'KOL_DISPOSABLE_ATOMIC_E2E_PASS' as result;
