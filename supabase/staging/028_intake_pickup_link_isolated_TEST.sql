-- ISOLATED STAGING TEST ONLY: run after 028, all test fixtures are rolled back.
-- Never execute against production; this creates disposable auth users and orders.
begin;
do $$
declare
 v_operator uuid := pg_catalog.gen_random_uuid();
 v_client uuid := pg_catalog.gen_random_uuid();
 v_partner_owner uuid := pg_catalog.gen_random_uuid();
 v_business uuid := pg_catalog.gen_random_uuid();
 v_item uuid := pg_catalog.gen_random_uuid();
 v_ticket uuid := pg_catalog.gen_random_uuid();
 v_order uuid := pg_catalog.gen_random_uuid();
 v_other_order uuid := pg_catalog.gen_random_uuid();
 v_out jsonb;
 v_audit_count int;
begin
 insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at)
 values
 (v_operator,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','link-operator-'||v_operator||'@example.test','',pg_catalog.now()),
 (v_client,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','link-client-'||v_client||'@example.test','',pg_catalog.now()),
 (v_partner_owner,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','link-partner-'||v_partner_owner||'@example.test','',pg_catalog.now());

 insert into public.user_roles(user_id,role,scope_id,is_active)
 values(v_operator,'support_admin',null,true),(v_client,'client',null,true);
 insert into public.partners
 (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating)
 values(v_business,v_partner_owner,'shop','QA Intake Link','qa-intake-link-'||v_business,
   'Disposable isolated test business','Cholpon-Ata','QA only','+996700000000','approved','online',5);
 insert into public.products (id,business_id,title,description,price,stock_qty,status)
 values(v_item,v_business,'QA Intake Link Item','Temporary product',900,10,'active');
 insert into public.support_tickets
 (id,created_by,category,status,priority,title,request_payload)
 values(v_ticket,v_client,'order_request','open','medium','QA Link',
  pg_catalog.jsonb_build_object('cart_items',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',v_item,'type','product','quantity',2))));
 insert into public.orders
 (id,client_id,business_id,type,status,subtotal,delivery_fee,discount,total,payment_status,metadata)
 values(v_order,v_client,v_business,'shop','new',1800,0,0,1800,'pending',
  pg_catalog.jsonb_build_object('idempotency_key','intake-'||v_ticket,'delivery_method','pickup')),
 (v_other_order,v_client,v_business,'shop','new',1800,0,0,1800,'pending',
  pg_catalog.jsonb_build_object('idempotency_key','unrelated-order-id','delivery_method','pickup'));
 insert into public.order_items
 (order_id,item_type,item_id,title_snapshot,qty,unit_price,total)
 values(v_order,'product',v_item,'QA Intake Link Item',2,900,1800),
 (v_other_order,'product',v_item,'QA Intake Link Item',2,900,1800);

 perform pg_catalog.set_config('request.jwt.claim.sub',v_operator::text,true);
 v_out := public.admin_link_intake_pickup_order_atomic(v_ticket,v_order,'link-intake-test-request-01');
 if v_out->>'ok' <> 'true' or v_out->>'idempotent' <> 'false' then
  raise exception 'first link must succeed exactly once: %',v_out;
 end if;
 if (select related_order_id from public.support_tickets where id=v_ticket) is distinct from v_order then
  raise exception 'intake link was not saved';
 end if;
 v_out := public.admin_link_intake_pickup_order_atomic(v_ticket,v_order,'link-intake-test-request-01');
 if v_out->>'idempotent' <> 'true' then
  raise exception 'same request replay was not idempotent';
 end if;
 select count(*) into v_audit_count from public.audit_logs
 where entity_id=v_ticket and action='admin_intake_pickup_order_linked';
 if v_audit_count <> 1 then
  raise exception 'expected one operator audit log, got %',v_audit_count;
 end if;
 raise notice 'KOL_INTAKE_LINK_POSITIVE_AND_REPLAY_PASS';

 begin
  perform public.admin_link_intake_pickup_order_atomic(v_ticket,v_other_order,'link-intake-test-request-01');
  raise exception 'expected_request_conflict_not_raised';
 exception
  when unique_violation then null;
 end;
 raise notice 'KOL_INTAKE_LINK_CONFLICT_REJECTED_PASS';

 perform pg_catalog.set_config('request.jwt.claim.sub',v_client::text,true);
 begin
  perform public.admin_link_intake_pickup_order_atomic(v_ticket,v_order,'link-intake-test-request-02');
  raise exception 'expected_role_denial_not_raised';
 exception
  when insufficient_privilege then null;
 end;
 raise notice 'KOL_INTAKE_LINK_CLIENT_ROLE_DENIED_PASS';
end;
$$;
rollback;
