-- KÖL / PARTNER CATALOG AVAILABILITY — DRAFT / NOT APPLIED
-- Operational availability for food and shop items. Moderation status, price,
-- stock and already accepted orders remain unchanged.

begin;

create schema if not exists private;

create table if not exists public.partner_catalog_item_availability (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.partners(id) on delete cascade,
  item_type text not null check (item_type in ('menu_item', 'product')),
  item_id uuid not null,
  availability_state text not null default 'available'
    check (availability_state in ('available', 'paused', 'out_of_stock')),
  reason text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (item_type, item_id),
  check (reason is null or length(reason) <= 500),
  check (availability_state = 'available' or reason is not null)
);

create index if not exists idx_partner_catalog_availability_business_state
  on public.partner_catalog_item_availability (business_id, availability_state, item_type);
create index if not exists idx_partner_catalog_availability_changed_by
  on public.partner_catalog_item_availability (changed_by)
  where changed_by is not null;

alter table public.partner_catalog_item_availability enable row level security;

drop policy if exists "partners read own catalog availability" on public.partner_catalog_item_availability;
create policy "partners read own catalog availability"
on public.partner_catalog_item_availability for select
to authenticated
using (public.is_partner_for(business_id) or public.is_admin());

revoke all on table public.partner_catalog_item_availability from anon, authenticated;
grant select on table public.partner_catalog_item_availability to authenticated;

create or replace function private.partner_catalog_availability_action_internal(
  p_item_type text,
  p_item_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
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
  v_item_business_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_target_state text;
  v_before jsonb;
  v_after jsonb;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_item_type not in ('menu_item', 'product') then
    raise exception 'unsupported_catalog_item_type' using errcode = '22023';
  end if;
  if p_item_id is null then
    raise exception 'catalog_item_id_required' using errcode = '22023';
  end if;
  if p_action not in ('pause', 'resume', 'out_of_stock') then
    raise exception 'unsupported_catalog_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  if p_action <> 'resume' and v_reason is null then
    raise exception 'catalog_reason_required' using errcode = '22023';
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
    raise exception 'partner_catalog_not_authorized' using errcode = '42501';
  end if;

  if p_item_type = 'menu_item' then
    select business_id into v_item_business_id
    from public.menu_items where id = p_item_id;
  else
    select business_id into v_item_business_id
    from public.products where id = p_item_id;
  end if;

  if v_item_business_id is null then
    raise exception 'catalog_item_not_found' using errcode = 'P0001';
  end if;
  if v_item_business_id <> v_business_id then
    raise exception 'catalog_item_ownership_mismatch' using errcode = '42501';
  end if;

  -- Serialize request-id evaluation so concurrent replays cannot diverge.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id, 0)
  );

  select al.action, al.entity_type, al.entity_id
    into v_existing_action, v_existing_entity_type, v_existing_entity_id
  from public.audit_logs al
  where al.actor_id = v_user_id and al.request_id = p_request_id
  order by al.created_at asc
  limit 1;

  if found then
    if v_existing_action <> 'partner_catalog_' || p_action
       or v_existing_entity_type <> p_item_type
       or v_existing_entity_id <> p_item_id then
      raise exception 'catalog_request_id_conflict' using errcode = '23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'idempotent_replay', true, 'business_id', v_business_id,
      'item_type', p_item_type, 'item_id', p_item_id,
      'availability_state', case p_action when 'pause' then 'paused' when 'out_of_stock' then 'out_of_stock' else 'available' end
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_item_type || ':' || p_item_id::text, 0)
  );

  select pg_catalog.jsonb_build_object(
    'availability_state', availability_state, 'reason', reason
  ) into v_before
  from public.partner_catalog_item_availability
  where item_type = p_item_type and item_id = p_item_id
  for update;

  v_target_state := case p_action
    when 'pause' then 'paused'
    when 'out_of_stock' then 'out_of_stock'
    else 'available'
  end;

  insert into public.partner_catalog_item_availability (
    business_id, item_type, item_id, availability_state, reason,
    changed_by, changed_at, updated_at
  ) values (
    v_business_id, p_item_type, p_item_id, v_target_state,
    case when p_action = 'resume' then null else v_reason end,
    v_user_id, now(), now()
  )
  on conflict (item_type, item_id) do update set
    business_id = excluded.business_id,
    availability_state = excluded.availability_state,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    changed_at = excluded.changed_at,
    updated_at = now();

  select pg_catalog.jsonb_build_object(
    'availability_state', availability_state, 'reason', reason
  ) into v_after
  from public.partner_catalog_item_availability
  where item_type = p_item_type and item_id = p_item_id;

  if not exists (
    select 1 from public.audit_logs al
    where al.actor_id = v_user_id
      and al.action = 'partner_catalog_' || p_action
      and al.entity_type = p_item_type
      and al.entity_id = p_item_id
      and al.request_id = p_request_id
  ) then
    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_user_id, coalesce(v_actor_role, 'partner_manager'),
      'partner_catalog_' || p_action, p_item_type, p_item_id,
      coalesce(v_before, '{}'::jsonb), v_after,
      coalesce(v_reason, 'Partner resumed catalog item.'), p_request_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'business_id', v_business_id,
    'item_type', p_item_type,
    'item_id', p_item_id,
    'availability_state', v_target_state
  );
end;
$$;

revoke all on function private.partner_catalog_availability_action_internal(text,uuid,text,text,text)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_catalog_availability_action_internal(text,uuid,text,text,text)
  to authenticated;

create or replace function public.partner_catalog_availability_action(
  p_item_type text,
  p_item_id uuid,
  p_action text,
  p_request_id text,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_catalog_availability_action_internal(
    p_item_type, p_item_id, p_action, p_request_id, p_reason
  );
$$;

revoke all on function public.partner_catalog_availability_action(text,uuid,text,text,text)
  from public, anon;
grant execute on function public.partner_catalog_availability_action(text,uuid,text,text,text)
  to authenticated;

create or replace function private.reject_unavailable_catalog_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.item_type in ('menu_item', 'product') and new.item_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.item_type || ':' || new.item_id::text, 0)
    );
  end if;
  if new.item_type in ('menu_item', 'product') and exists (
    select 1
    from public.partner_catalog_item_availability a
    join public.orders o on o.id = new.order_id
    where a.business_id = o.business_id
      and a.item_type = new.item_type
      and a.item_id = new.item_id
      and a.availability_state <> 'available'
  ) then
    raise exception 'catalog_item_not_operationally_available' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_unavailable_catalog_order_item()
  from public, anon, authenticated;

drop trigger if exists reject_unavailable_catalog_order_items on public.order_items;
create trigger reject_unavailable_catalog_order_items
before insert on public.order_items
for each row execute function private.reject_unavailable_catalog_order_item();

comment on table public.partner_catalog_item_availability is
  'Operational availability for future food/shop demand; moderation status, price, stock and existing orders are unchanged.';

commit;
