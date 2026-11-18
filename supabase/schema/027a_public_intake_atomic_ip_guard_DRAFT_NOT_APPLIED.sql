-- DRAFT_NOT_APPLIED. Intended solely for disposable/local Supabase after 027.
-- No production deployment, migration, or shared database change.
-- Advisory transaction locks serialize submissions across workers/instances.
begin;

create or replace function public.public_intake_create_atomic(
  p_request_id uuid,
  p_category text,
  p_title text,
  p_request_payload jsonb,
  p_request_fingerprint text,
  p_phone_hash text,
  p_ip_hash text,
  p_created_by uuid default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_existing record;
  v_ip_count integer;
  v_phone_count integer;
begin
  if p_request_id is null
     or substring(p_request_id::text,15,1) <> '4'
     or p_category not in ('booking_request','order_request','support')
     or length(p_title) not between 3 and 160
     or jsonb_typeof(p_request_payload) is distinct from 'object'
     or p_request_fingerprint !~ '^[a-f0-9]{64}$'
     or p_phone_hash !~ '^[a-f0-9]{64}$'
     or p_ip_hash !~ '^[a-f0-9]{64}$'
     or p_request_payload ->> 'request_fingerprint' is distinct from p_request_fingerprint
     or p_request_payload ->> 'contact_phone_hash' is distinct from p_phone_hash
     or p_request_payload ->> 'contact_ip_hash' is distinct from p_ip_hash then
    return jsonb_build_object('ok',false,'code','validation_error');
  end if;

  -- Same request ID must always resolve before new rate consumption.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kol-intake-request:' || p_request_id::text,0));
  select t.category,t.request_payload into v_existing
    from public.support_tickets t where t.id = p_request_id;
  if found then
    if v_existing.category = p_category
       and v_existing.request_payload ->> 'request_fingerprint' = p_request_fingerprint then
      return jsonb_build_object('ok',true,'replay',true,'request_id',p_request_id);
    end if;
    return jsonb_build_object('ok',false,'code','request_id_conflict');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kol-intake-ip:' || p_ip_hash,0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('kol-intake-phone:' || p_phone_hash,0));
  select count(*) into v_ip_count from public.support_tickets t
    where t.created_at >= pg_catalog.now() - interval '15 minutes'
      and t.request_payload ->> 'contact_ip_hash' = p_ip_hash;
  select count(*) into v_phone_count from public.support_tickets t
    where t.created_at >= pg_catalog.now() - interval '15 minutes'
      and t.request_payload ->> 'contact_phone_hash' = p_phone_hash;
  if v_ip_count >= 4 or v_phone_count >= 4 then
    return jsonb_build_object('ok',false,'code','rate_limited');
  end if;

  insert into public.support_tickets(
    id, created_by, related_order_id, related_booking_id, category,
    priority, status, title, request_payload
  ) values (
    p_request_id,p_created_by,null,null,p_category,
    'medium','open',p_title,p_request_payload
  );
  return jsonb_build_object('ok',true,'replay',false,'request_id',p_request_id);
end;
$function$;

revoke all on function public.public_intake_create_atomic(uuid,text,text,jsonb,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.public_intake_create_atomic(uuid,text,text,jsonb,text,text,text,uuid) to service_role;
commit;
