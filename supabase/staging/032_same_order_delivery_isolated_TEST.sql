-- Isolated rollback-only check for verified operator-created pickup + delivered orders.
begin;
do $$
declare
 v_admin uuid:=pg_catalog.gen_random_uuid();
 v_client uuid:=pg_catalog.gen_random_uuid();
 v_owner uuid:=pg_catalog.gen_random_uuid();
 v_shop uuid:=pg_catalog.gen_random_uuid();
 v_product uuid:=pg_catalog.gen_random_uuid();
 v_ticket uuid:=pg_catalog.gen_random_uuid();
 v_pickup_ticket uuid:=pg_catalog.gen_random_uuid();
 v_order uuid;
 v_delivery uuid;
 v_result jsonb;
 v_count int;
 v_stock int;
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at)
 values(v_admin,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-'||v_admin||'@qa.test','',pg_catalog.now()),
 (v_client,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-'||v_client||'@qa.test','',pg_catalog.now()),
 (v_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-'||v_owner||'@qa.test','',pg_catalog.now());
 insert into public.user_roles(user_id,role,scope_id,is_active)
 values(v_admin,'support_admin',null,true),(v_client,'client',null,true);
 insert into public.partners
 (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating)
 values(v_shop,v_owner,'shop','QA operator delivery','qa-op-delivery-'||v_shop,
 'QA isolated store','Чолпон-Ата','QA Pickup','+996700000400','approved','online',5);
 insert into public.shops(business_id,delivery_enabled) values(v_shop,true);
 insert into public.products(id,business_id,title,description,price,stock_qty,status)
 values(v_product,v_shop,'QA Verified Stock','QA only',900,10,'active');
 insert into private.kol_delivery_tariffs
 (business_id,zone_code,fee_som,currency,active,approved_by,approved_at)
 values(v_shop,'cholpon-ata',180,'KGS',true,v_admin,pg_catalog.now());
 insert into public.support_tickets
 (id,created_by,category,priority,status,title,request_payload)
 values
 (v_ticket,v_client,'order_request','medium','open','QA operator delivery',
 pg_catalog.jsonb_build_object('contact',pg_catalog.jsonb_build_object(
   'email','client-'||v_client||'@qa.test'),
   'cart_items',pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_build_object('id',v_product::text,'type','product','quantity',2)),
   'delivery_method','delivery',
   'delivery',pg_catalog.jsonb_build_object('location','Чолпон-Ата','address','QA Client street 4'))),
 (v_pickup_ticket,v_client,'order_request','medium','open','QA operator pickup',
 pg_catalog.jsonb_build_object('contact',pg_catalog.jsonb_build_object(
   'email','client-'||v_client||'@qa.test'),
   'cart_items',pg_catalog.jsonb_build_array(
     pg_catalog.jsonb_build_object('id',v_product::text,'type','product','quantity',1)),
   'delivery_method','pickup'));

 perform pg_catalog.set_config('request.jwt.claim.sub',v_admin::text,true);
 v_result:=public.admin_confirm_intake_order_atomic(
 v_ticket,v_shop,180,'QA Client approved delivery fee and item details','operator-confirm-delivery-0001');
 if v_result->>'ok'<>'true' or v_result->>'idempotent'<>'false' then
   raise exception 'operator_delivery_create_failed %',v_result;end if;
 v_order:=(v_result->>'order_id')::uuid;
 select d.id into v_delivery from public.deliveries d where d.order_id=v_order;
 if v_delivery is null then raise exception 'delivery_row_not_created';end if;
 if (select related_order_id from public.support_tickets where id=v_ticket) is distinct from v_order then
   raise exception 'intake_ticket_not_linked';end if;
 if (select delivery_id from public.order_delivery where order_id=v_order) is distinct from v_delivery then
   raise exception 'order_delivery_not_linked';end if;
 if (select total from public.orders where id=v_order)<>1980 or
    (select delivery_fee from public.orders where id=v_order)<>180 then
   raise exception 'server_delivery_amount_mismatch';end if;
 if (select payment_status from public.orders where id=v_order)<>'pending' then
   raise exception 'payment_falsely_marked_as_paid';end if;
 select stock_qty into v_stock from public.products where id=v_product;
 if v_stock<>8 then raise exception 'stock_not_atomically_decremented: %',v_stock;end if;
 v_result:=public.admin_confirm_intake_order_atomic(
 v_ticket,v_shop,180,'QA Client approved delivery fee and item details','operator-confirm-delivery-0001');
 if v_result->>'idempotent'<>'true' or (v_result->>'order_id')::uuid is distinct from v_order then
   raise exception 'delivery_replay_not_idempotent';end if;
 select count(*) into v_count from public.orders
 where client_id=v_client and metadata->>'idempotency_key'='intake-'||v_ticket::text;
 if v_count<>1 then raise exception 'duplicate_delivery_order';end if;
 begin
  perform public.admin_confirm_intake_order_atomic(
   v_ticket,v_shop,0,'QA Client approved delivery fee and item details',
   'operator-confirm-delivery-0001');
  raise exception 'replayed_request_with_different_fee_accepted';
 exception when unique_violation then null; end;
 raise notice 'KOL_032_SAME_INTAKE_ORDER_DELIVERY_PRICE_STOCK_REPLAY_PASS';

 v_result:=public.admin_confirm_intake_order_atomic(
 v_pickup_ticket,v_shop,0,'QA Client approved item details and pickup','operator-confirm-pickup-0001');
 if v_result->>'ok'<>'true' then raise exception 'operator_pickup_failed %',v_result;end if;
 if (select delivery_fee from public.orders where id=(v_result->>'order_id')::uuid)<>0 then
   raise exception 'pickup_fee_nonzero';end if;
 if exists(select 1 from public.deliveries where order_id=(v_result->>'order_id')::uuid) then
   raise exception 'pickup_invented_courier_delivery';end if;
 raise notice 'KOL_032_SHARED_OPERATOR_PICKUP_CORE_PASS';

 perform pg_catalog.set_config('request.jwt.claim.sub',v_client::text,true);
 begin
   perform public.admin_confirm_intake_order_atomic(
    v_pickup_ticket,v_shop,0,'Unauthorized user cannot confirm order','client-bad-confirm-0001');
   raise exception 'client_operator_creation_not_denied';
 exception when insufficient_privilege then null; end;
 begin
   perform public.create_order_atomic(v_shop,'shop',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('item_id',v_product,'qty',1)),
    'delivery','client-direct-delivery-rejected');
   raise exception 'client_delivery_without_operator_accepted';
 exception when raise_exception then
   if sqlerrm='client_delivery_without_operator_accepted' then raise;end if;
 end;
 raise notice 'KOL_032_ROLE_GATES_AND_CLIENT_DELIVERY_DENIED_PASS';
end;
$$;
rollback;
