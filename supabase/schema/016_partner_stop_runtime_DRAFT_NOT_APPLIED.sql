-- KÖL / PARTNER STOP RUNTIME — DRAFT / NOT APPLIED
-- Stops future demand only. Existing orders, bookings, payments and inventory remain unchanged.

begin;

create schema if not exists private;

create table if not exists public.partner_stop_statuses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  scope_type text not null check (scope_type in ('new_orders', 'new_bookings')),
  is_paused boolean not null default true,
  reason text,
  paused_by uuid references auth.users(id) on delete set null,
  paused_at timestamptz,
  resume_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (business_id, scope_type),
  check (reason is null or length(reason) <= 500)
);

create index if not exists idx_partner_stop_statuses_business_paused
  on public.partner_stop_statuses (business_id, is_paused, scope_type);

create index if not exists idx_partner_stop_statuses_paused_by
  on public.partner_stop_statuses (paused_by)
  where paused_by is not null;

alter table public.partner_stop_statuses enable row level security;

drop policy if exists "partners read own stop statuses" on public.partner_stop_statuses;
create policy "partners read own stop statuses"
on public.partner_stop_statuses for select
to authenticated
using (public.is_partner_for(business_id) or public.is_admin());

revoke all on table public.partner_stop_statuses from anon, authenticated;
grant select on table public.partner_stop_statuses to authenticated;

create or replace function private.partner_stop_action_atomic_internal(
  p_scope_type text,
  p_action text,
  p_request_id text,
  p_reason text default null,
  p_resume_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_scope text;
  v_scopes text[];
  v_existing_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_audit_action text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_scope_type not in ('new_orders', 'new_bookings', 'business') then
    raise exception 'unsupported_stop_scope' using errcode = '22023';
  end if;
  if p_action not in ('pause', 'resume') then
    raise exception 'unsupported_stop_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  if p_action = 'pause' and v_reason is null then
    raise exception 'pause_reason_required' using errcode = '22023';
  end if;
  if p_resume_at is not null and p_resume_at <= now() then
    raise exception 'resume_at_must_be_future' using errcode = '22023';
  end if;

  select ps.business_id, ps.role
    into v_business_id, v_actor_role
  from public.partner_staff ps
  join public.partner_profiles pp
    on pp.business_id = ps.business_id and pp.user_id = ps.user_id
  where ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'partner_stop_not_authorized' using errcode = '42501';
  end if;

  v_scopes := case when p_scope_type = 'business'
    then array['new_orders', 'new_bookings']::text[]
    else array[p_scope_type]::text[] end;

  foreach v_scope in array v_scopes loop
    -- Serialize identical business/scope mutations even before the first status row exists.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_business_id::text || ':' || v_scope, 0)
    );

    select id, pg_catalog.jsonb_build_object(
      'is_paused', is_paused, 'reason', reason, 'resume_at', resume_at
    ) into v_existing_id, v_before
    from public.partner_stop_statuses
    where business_id = v_business_id and scope_type = v_scope
    for update;

    if p_action = 'pause' then
      insert into public.partner_stop_statuses (
        business_id, scope_type, is_paused, reason, paused_by, paused_at, resume_at, updated_at
      ) values (
        v_business_id, v_scope, true, v_reason, v_user_id, now(), p_resume_at, now()
      )
      on conflict (business_id, scope_type) do update set
        is_paused = true,
        reason = excluded.reason,
        paused_by = excluded.paused_by,
        paused_at = excluded.paused_at,
        resume_at = excluded.resume_at,
        updated_at = now();
    else
      insert into public.partner_stop_statuses (
        business_id, scope_type, is_paused, reason, paused_by, paused_at, resume_at, updated_at
      ) values (
        v_business_id, v_scope, false, v_reason, v_user_id, null, null, now()
      )
      on conflict (business_id, scope_type) do update set
        is_paused = false,
        reason = excluded.reason,
        paused_by = excluded.paused_by,
        paused_at = null,
        resume_at = null,
        updated_at = now();
    end if;

    select pg_catalog.jsonb_build_object(
      'is_paused', is_paused, 'reason', reason, 'resume_at', resume_at
    ) into v_after
    from public.partner_stop_statuses
    where business_id = v_business_id and scope_type = v_scope;

    v_audit_action := 'partner_stop_' || v_scope || '_' || p_action;
    if not exists (
      select 1 from public.audit_logs al
      where al.actor_id = v_user_id and al.action = v_audit_action
        and al.entity_type = 'partner_stop_status' and al.entity_id = v_business_id
        and al.request_id = p_request_id
    ) then
      insert into public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        before, after, reason, request_id
      ) values (
        v_user_id, coalesce(v_actor_role, 'partner_manager'), v_audit_action,
        'partner_stop_status', v_business_id, coalesce(v_before, '{}'::jsonb), v_after,
        coalesce(v_reason, 'Partner resumed future demand.'), p_request_id
      );
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'business_id', v_business_id, 'scope_type', p_scope_type,
    'action', p_action, 'affected_scopes', v_scopes
  );
end;
$$;

revoke all on function private.partner_stop_action_atomic_internal(text,text,text,text,timestamptz) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_stop_action_atomic_internal(text,text,text,text,timestamptz) to authenticated;

create or replace function public.partner_stop_action_atomic(
  p_scope_type text,
  p_action text,
  p_request_id text,
  p_reason text default null,
  p_resume_at timestamptz default null
)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.partner_stop_action_atomic_internal(p_scope_type, p_action, p_request_id, p_reason, p_resume_at);
$$;

revoke all on function public.partner_stop_action_atomic(text,text,text,text,timestamptz) from public, anon;
grant execute on function public.partner_stop_action_atomic(text,text,text,text,timestamptz) to authenticated;

create or replace function private.reject_paused_partner_demand()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_scope text;
begin
  v_scope := case tg_table_name when 'orders' then 'new_orders' when 'bookings' then 'new_bookings' else null end;
  if v_scope is null then raise exception 'unsupported_stop_guard_target'; end if;
  if exists (
    select 1 from public.partner_stop_statuses s
    where s.business_id = new.business_id and s.scope_type = v_scope and s.is_paused = true
      and (s.resume_at is null or s.resume_at > now())
  ) then
    raise exception 'partner_%_paused', v_scope using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_paused_partner_demand() from public, anon, authenticated;

drop trigger if exists reject_paused_partner_orders on public.orders;
create trigger reject_paused_partner_orders before insert on public.orders
for each row execute function private.reject_paused_partner_demand();

drop trigger if exists reject_paused_partner_bookings on public.bookings;
create trigger reject_paused_partner_bookings before insert on public.bookings
for each row execute function private.reject_paused_partner_demand();

comment on table public.partner_stop_statuses is
  'Partner-owned stop state for future demand only. Existing orders, bookings, payments and inventory are immutable to stop/resume.';

commit;
