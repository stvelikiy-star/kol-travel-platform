-- DRAFT_NOT_APPLIED. Disposable local database ONLY. Never execute on a shared or live database.
-- Atomic check + INSERT: lock keyed IP scope, preserve replay, independent IP and phone windows.
-- Schema prerequisite: public.support_tickets.request_payload jsonb (existing launch-intake migration).
begin;

create or replace function public.kol_public_intake_atomic(
  p_id uuid, p_kind text, p_title text, p_created_by uuid,
  p_payload jsonb, p_fingerprint text, p_phone_hash text, p_ip_hash text
) returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ticket public.support_tickets%rowtype;
  v_recent_ip integer;
  v_recent_phone integer;
begin
  if p_id is null or p_kind not in ('order_request','booking_request','support')
     or length(coalesce(p_title,'')) < 3
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_phone_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid intake request' using errcode='22023';
  end if;

  -- Serialize concurrent requests for one IP and separately by phone.
  -- Ordering by advisory lock key avoids deadlocks when scopes differ.
  perform pg_catalog.pg_advisory_xact_lock(v.lock_key)
  from (select distinct hashtextextended(key, 1407) as lock_key
        from (values ('ip:'||p_ip_hash),('phone:'||p_phone_hash)) as k(key)
        order by lock_key) v;

  select * into v_ticket from public.support_tickets where id=p_id;
  if found then
    if v_ticket.category = p_kind
       and v_ticket.request_payload->>'request_fingerprint' = p_fingerprint then
      return 'replay';
    end if;
    return 'conflict';
  end if;

  select count(*) into v_recent_ip from (
    select 1 from public.support_tickets
      where request_payload->>'contact_ip_hash'=p_ip_hash
      and created_at>=pg_catalog.now()-interval '15 minutes' limit 4
  ) q;
  select count(*) into v_recent_phone from (
    select 1 from public.support_tickets
      where request_payload->>'contact_phone_hash'=p_phone_hash
      and created_at>=pg_catalog.now()-interval '15 minutes' limit 4
  ) q;
  if v_recent_ip>=4 or v_recent_phone>=4 then
    return 'rate_limited';
  end if;

  insert into public.support_tickets (
    id,created_by,related_order_id,related_booking_id,category,priority,status,title,request_payload
  ) values (
    p_id,p_created_by,null,null,p_kind,'medium','open',p_title,
    p_payload || pg_catalog.jsonb_build_object(
      'request_fingerprint',p_fingerprint,'contact_phone_hash',p_phone_hash,
      'contact_ip_hash',p_ip_hash,'intake_version',3
    )
  );
  return 'inserted';
exception
  when unique_violation then
    select * into v_ticket from public.support_tickets where id=p_id;
    if found and v_ticket.category=p_kind
       and v_ticket.request_payload->>'request_fingerprint'=p_fingerprint then
      return 'replay';
    end if;
    return 'conflict';
end
$$;

revoke all on function public.kol_public_intake_atomic(uuid,text,text,uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.kol_public_intake_atomic(uuid,text,text,uuid,jsonb,text,text,text) to service_role;
commit;
