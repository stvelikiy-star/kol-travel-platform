-- Tests 029 + 030 on a disposable local database only, transaction rolled back.
begin;
do $$
declare
  v_client uuid := pg_catalog.gen_random_uuid();
  v_operator uuid := pg_catalog.gen_random_uuid();
  v_other uuid := pg_catalog.gen_random_uuid();
  v_business uuid := pg_catalog.gen_random_uuid();
  v_claim uuid := pg_catalog.gen_random_uuid();
  v_delivery uuid := pg_catalog.gen_random_uuid();
  v_quote jsonb;
  v_claim_result jsonb;
  v_count int;
begin
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at)
  values
    (v_client,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kol-claim-'||v_client||'@example.test','',pg_catalog.now()),
    (v_operator,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kol-admin-'||v_operator||'@example.test','',pg_catalog.now()),
    (v_other,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','kol-other-'||v_other||'@example.test','',pg_catalog.now());
  insert into public.user_roles(user_id,role,scope_id,is_active)
    values (v_client,'client',null,true),(v_operator,'support_admin',null,true),
      (v_other,'client',null,true);
  insert into public.partners
  (id,owner_user_id,type,title,slug,description,location,address,phone,status,business_status,rating)
  values(v_business,v_operator,'shop','QA KOL tariff','kol-tariff-'||v_business,
    'QA only','Cholpon-Ata','QA location','+996700000123','approved','online',5);
  insert into public.support_tickets
  (id,created_by,category,priority,status,title,request_payload)
  values
   (v_claim,null,'order_request','medium','open','Anonymous client',
     pg_catalog.jsonb_build_object('contact',pg_catalog.jsonb_build_object(
       'email','kol-claim-'||v_client||'@example.test'))),
   (v_delivery,v_client,'order_request','medium','open','Delivery quote',
     pg_catalog.jsonb_build_object('delivery_method','delivery',
       'delivery',pg_catalog.jsonb_build_object('location','Чолпон-Ата','address','QA Street 11')));

  perform pg_catalog.set_config('request.jwt.claim.sub',v_other::text,true);
  begin
    perform public.claim_anonymous_intake_by_verified_email_atomic(v_claim,'claim-wrong-email-0001');
    raise exception 'claim_wrong_email_not_denied';
  exception when insufficient_privilege then null;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub',v_client::text,true);
  v_claim_result:=public.claim_anonymous_intake_by_verified_email_atomic(v_claim,'claim-verified-0001');
  if v_claim_result->>'ok' <> 'true' or v_claim_result->>'idempotent'<>'false' then
    raise exception 'claim_positive_failed';
  end if;
  if (select created_by from public.support_tickets where id=v_claim) is distinct from v_client then
    raise exception 'claim_not_saved';
  end if;
  v_claim_result:=public.claim_anonymous_intake_by_verified_email_atomic(v_claim,'claim-verified-0001');
  if v_claim_result->>'idempotent'<>'true' then raise exception 'claim_replay_failed'; end if;
  perform pg_catalog.set_config('request.jwt.claim.sub',v_other::text,true);
  begin
    perform public.claim_anonymous_intake_by_verified_email_atomic(v_claim,'claim-other-0001');
    raise exception 'claim_owner_denial_missing';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v_count from public.audit_logs
  where entity_id=v_claim and action='client_anonymous_intake_claimed';
  if v_count<>1 then raise exception 'claim_audit_not_exactly_once'; end if;
  raise notice 'KOL_029_VERIFIED_CLAIM_NEGATIVE_REPLAY_PASS';

  perform pg_catalog.set_config('request.jwt.claim.sub',v_operator::text,true);
  begin
    perform public.quote_intake_delivery_fee_atomic(v_delivery,v_business,'cholpon-ata');
    raise exception 'unconfigured_tariff_should_fail';
  exception when raise_exception then
    if sqlerrm='unconfigured_tariff_should_fail' then raise; end if;
  end;
  insert into private.kol_delivery_tariffs
    (business_id,zone_code,fee_som,currency,active,approved_by,approved_at)
    values(v_business,'cholpon-ata',180.00,'KGS',true,v_operator,pg_catalog.now());
  v_quote:=public.quote_intake_delivery_fee_atomic(v_delivery,v_business,'cholpon-ata');
  if v_quote->>'ok'<>'true' or (v_quote->>'fee_som')::numeric<>180
     or v_quote->>'currency'<>'KGS' or v_quote->>'order_created'<>'false' then
    raise exception 'tariff_quote_incorrect: %',v_quote;
  end if;
  begin
    perform public.quote_intake_delivery_fee_atomic(v_delivery,v_business,'karakol');
    raise exception 'wrong_zone_should_fail';
  exception when insufficient_privilege then
    if sqlerrm='wrong_zone_should_fail' then raise; end if;
  end;
  perform pg_catalog.set_config('request.jwt.claim.sub',v_client::text,true);
  begin
    perform public.quote_intake_delivery_fee_atomic(v_delivery,v_business,'cholpon-ata');
    raise exception 'client_quote_role_should_fail';
  exception when insufficient_privilege then
    if sqlerrm='client_quote_role_should_fail' then raise; end if;
  end;
  raise notice 'KOL_030_APPROVED_KGS_TARIFF_NO_DEFAULT_ROLE_AND_ZONE_PASS';
end;
$$;
rollback;
