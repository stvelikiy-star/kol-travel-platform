-- KOL: separate room-only lifecycle; TEST/STAGING ONLY, NOT APPLIED.
-- Does not change bookings, availability, prices, payments or other modules.
begin;
create schema if not exists private;

-- All room status mutations pass through authenticated, audited RPC.
revoke insert, update, delete on table public.rooms from anon, authenticated;

-- Admin review queue requires SELECT, but it never permits direct DML.
-- public.has_role checks the authenticated actor's own RLS-scoped user_roles.
drop policy if exists "super_admin reviews room lifecycle" on public.rooms;
create policy "super_admin reviews room lifecycle" on public.rooms
for select to authenticated using (public.has_role('super_admin'));

create or replace function private.admin_room_lifecycle_atomic_internal(
    p_room_id uuid, p_action text, p_request_id text, p_reason text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
    v_actor uuid := auth.uid();
    v_room record;
    v_partner record;
    v_stay record;
    v_to text;
    v_prev record;
    v_expected_audit text := 'admin_room_' || p_action;
    v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason,'')),'');
begin
    if v_actor is null then
        raise exception 'not_authenticated' using errcode='28000';
    end if;
    if p_room_id is null or p_action not in ('approve','reject','publish','unpublish') then
        raise exception 'room_action_invalid' using errcode='22023';
    end if;
    if p_request_id is null or pg_catalog.length(pg_catalog.btrim(p_request_id)) < 8
       or pg_catalog.length(p_request_id)>128 or v_reason is null
       or pg_catalog.length(v_reason)<3 or pg_catalog.length(v_reason)>500 then
        raise exception 'room_request_invalid' using errcode='22023';
    end if;
    if not exists (select 1 from public.user_roles ur
                   where ur.user_id=v_actor and ur.role='super_admin' and ur.is_active=true) then
        raise exception 'room_governance_not_authorized' using errcode='42501';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext(v_actor::text),
        pg_catalog.hashtext(p_request_id)
    );

    select r.id,r.business_id,r.stay_id,r.status,r.price_per_night,r.title,r.capacity
      into v_room from public.rooms r where r.id=p_room_id for update;
    if not found then
        raise exception 'room_not_found' using errcode='P0002';
    end if;
    -- Demo room is never eligible for real commercial governance.
    if v_room.stay_id='41000000-0000-0000-0000-000000000001'::uuid then
        raise exception 'demo_room_not_commercial' using errcode='42501';
    end if;

    select al.id,al.action,al.entity_type,al.entity_id,al.reason,al.before,al.after
      into v_prev from public.audit_logs al
     where al.actor_id=v_actor and al.request_id=p_request_id
     order by al.created_at,al.id limit 1;
    if v_prev.id is not null then
        if v_prev.action is distinct from v_expected_audit
           or v_prev.entity_type is distinct from 'rooms'
           or v_prev.entity_id is distinct from p_room_id
           or v_prev.reason is distinct from v_reason
           or v_prev.before->>'action' is distinct from p_action then
            raise exception 'room_idempotency_payload_conflict' using errcode='23505';
        end if;
        return pg_catalog.jsonb_build_object(
            'ok',true,'room_id',p_room_id,'action',p_action,
            'status',v_prev.after->>'status','idempotent',true
        );
    end if;

    if p_action='approve' and v_room.status='under_review' then
        v_to := 'approved';
    elsif p_action='reject' and v_room.status='under_review' then
        v_to := 'rejected';
    elsif p_action='publish' and v_room.status='approved' then
        v_to := 'active';
    elsif p_action='unpublish' and v_room.status='active' then
        v_to := 'approved';
    else
        raise exception 'room_status_transition_denied' using errcode='P0001';
    end if;

    if p_action in ('approve','publish') then
        if v_room.title is null or pg_catalog.length(pg_catalog.btrim(v_room.title))=0
           or v_room.capacity < 1 or v_room.price_per_night <= 0
           or v_room.price_per_night::text in ('NaN','Infinity','-Infinity') then
            raise exception 'room_price_capacity_title_invalid' using errcode='P0001';
        end if;
        select s.id,s.business_id,s.status into v_stay
          from public.stays s where s.id=v_room.stay_id for share;
        select p.id,p.status,p.business_status into v_partner
          from public.partners p where p.id=v_room.business_id for share;
        if v_stay.id is null or v_stay.business_id is distinct from v_room.business_id
           or v_stay.status not in ('active','published')
           or v_partner.id is null or v_partner.status <> 'approved'
           or v_partner.business_status <> 'online' then
            raise exception 'room_parent_not_publishable' using errcode='P0001';
        end if;
    end if;
    update public.rooms set status=v_to,updated_at=pg_catalog.now()
      where id=p_room_id;
    insert into public.audit_logs(
      actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
    ) values(
      v_actor,'super_admin',v_expected_audit,'rooms',p_room_id,
      pg_catalog.jsonb_build_object(
         'domain','rooms','action',p_action,'business_id',v_room.business_id,
         'stay_id',v_room.stay_id,'status',v_room.status
      ),
      pg_catalog.jsonb_build_object(
         'domain','rooms','action',p_action,'business_id',v_room.business_id,
         'stay_id',v_room.stay_id,'status',v_to
      ),
      v_reason,p_request_id
    );
    return pg_catalog.jsonb_build_object(
      'ok',true,'room_id',p_room_id,'action',p_action,'status',v_to,'idempotent',false
    );
end;
$$;
revoke all on function private.admin_room_lifecycle_atomic_internal(uuid,text,text,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_room_lifecycle_atomic_internal(uuid,text,text,text) to authenticated;

create or replace function public.admin_room_lifecycle_atomic(
    p_room_id uuid, p_action text, p_request_id text, p_reason text
) returns jsonb language sql security invoker set search_path=''
as $$
    select private.admin_room_lifecycle_atomic_internal(p_room_id,p_action,p_request_id,p_reason);
$$;
revoke all on function public.admin_room_lifecycle_atomic(uuid,text,text,text) from public,anon;
grant execute on function public.admin_room_lifecycle_atomic(uuid,text,text,text) to authenticated;
comment on function public.admin_room_lifecycle_atomic(uuid,text,text,text)
is 'KOL separate super_admin only room approval and publish; audit and idempotency, no inventory creation.';
commit;
