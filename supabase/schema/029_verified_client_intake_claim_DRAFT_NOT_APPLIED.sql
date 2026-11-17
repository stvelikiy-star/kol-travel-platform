-- KOL 029. DRAFT; isolated Auth/JWT tests required before deployment.
-- Allows a verified-email customer to claim only an anonymous intake containing
-- precisely that email. Phone-only and unverified email claims fail closed.
begin;
create or replace function public.claim_anonymous_intake_by_verified_email_atomic(
  p_ticket_id uuid,
  p_request_id text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 v_actor uuid := auth.uid();
 v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
 v_email text;
 v_verified timestamptz;
 v_ticket record;
 v_existing record;
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 if p_ticket_id is null or length(v_request)<8 or length(v_request)>128 then
  raise exception 'invalid_claim_input' using errcode='22023'; end if;
 if not exists (select 1 from public.user_roles r
                where r.user_id=v_actor and r.role='client' and r.is_active) then
  raise exception 'active_client_required' using errcode='42501'; end if;
 select pg_catalog.lower(pg_catalog.btrim(u.email)),u.email_confirmed_at
   into v_email,v_verified
   from auth.users u where u.id=v_actor;
 if v_email is null or v_email='' or v_verified is null then
  raise exception 'verified_email_required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_actor::text),
                                           pg_catalog.hashtext(v_request));
 select al.entity_id, al.after into v_existing
 from public.audit_logs al
 where al.actor_id=v_actor and al.action='client_anonymous_intake_claimed'
   and al.entity_type='support_tickets' and al.request_id=v_request limit 1;
 if found then
  if v_existing.entity_id is distinct from p_ticket_id then
    raise exception 'intake_claim_request_conflict' using errcode='23505'; end if;
  return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
    'idempotent',true);
 end if;
 select st.id,st.created_by,st.category,st.status,st.request_payload
 into v_ticket
 from public.support_tickets st where st.id=p_ticket_id for update;
 if not found or v_ticket.category is distinct from 'order_request' then
  raise exception 'intake_order_ticket_not_found' using errcode='P0002'; end if;
 if v_ticket.created_by is not null and v_ticket.created_by is distinct from v_actor then
  raise exception 'intake_owned_by_other_client' using errcode='42501'; end if;
 if v_ticket.status not in ('open','in_progress') then
  raise exception 'intake_ticket_not_claimable' using errcode='P0001'; end if;
 if pg_catalog.lower(pg_catalog.btrim(coalesce(v_ticket.request_payload->'contact'->>'email','')))
    is distinct from v_email then
  raise exception 'intake_email_verification_mismatch' using errcode='42501'; end if;
 if v_ticket.created_by is null then
  update public.support_tickets set created_by=v_actor,updated_at=pg_catalog.now()
    where id=p_ticket_id;
 end if;
 insert into public.audit_logs
 (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,'client','client_anonymous_intake_claimed','support_tickets',
  p_ticket_id,pg_catalog.jsonb_build_object('created_by',null),
  pg_catalog.jsonb_build_object('created_by',v_actor),
  'Customer proved the intake email via confirmed Supabase Auth.',v_request);
 return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
   'idempotent',false);
end;
$$;
revoke all on function public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)
 from public,anon,authenticated;
grant execute on function public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)
 to authenticated;
comment on function public.claim_anonymous_intake_by_verified_email_atomic(uuid,text)
 is 'Verified email + exact ticket identifier; phone-only and wrong-client claims denied.';
commit;
