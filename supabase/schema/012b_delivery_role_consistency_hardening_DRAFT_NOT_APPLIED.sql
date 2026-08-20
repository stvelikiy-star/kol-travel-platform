-- KÖL / kol-travel-platform
-- DELIVERY ROLE + ASSIGNMENT CONSISTENCY HARDENING — DRAFT NOT APPLIED
-- Prepared: 2026-08-20
-- Depends on: 012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql
--             012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql
--
-- Purpose:
-- - keep the restored 012 transaction core intact;
-- - move the original delivery RPC implementations behind private wrappers;
-- - require active dispatcher/super_admin for assignment and active courier role for progress;
-- - fix is_assigned_courier() to recognize the normalized in_progress assignment state;
-- - enforce deferred consistency between deliveries and courier_assignments;
-- - require active delivery couriers to retain a courier role/profile and busy availability.
--
-- No delivery pricing, failure/reassignment override, payout or payment behavior is added here.
-- MUST NOT be applied to live before backup + accepted baseline + staging role/concurrency proof.

begin;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Fix courier read helper to match the normalized assignment state machine.
-- ---------------------------------------------------------------------------

create or replace function public.is_assigned_courier(delivery uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (
    public.has_role('courier')
    and exists (
      select 1
      from public.courier_profiles cp
      where cp.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.courier_assignments ca
      where ca.courier_id = (select auth.uid())
        and ca.delivery_id = delivery
        and ca.status in ('assigned','accepted','in_progress')
    )
  )
  or public.has_role('dispatcher')
  or public.has_role('super_admin');
$$;

-- ---------------------------------------------------------------------------
-- 2. Hide the restored RPC implementations behind role-aware public wrappers.
-- ---------------------------------------------------------------------------

alter function public.assign_courier_atomic(uuid,uuid,text)
  rename to assign_courier_atomic_v1;
alter function public.assign_courier_atomic_v1(uuid,uuid,text)
  set schema private;

revoke all on function private.assign_courier_atomic_v1(uuid,uuid,text) from public;
revoke all on function private.assign_courier_atomic_v1(uuid,uuid,text) from anon, authenticated;

create or replace function public.assign_courier_atomic(
  p_delivery_id uuid,
  p_courier_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_delivery_status text;
  v_assigned_courier uuid;
  v_active_assignment_count integer;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.has_role('dispatcher') or public.has_role('super_admin')) then
    raise exception 'dispatcher_role_required' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_courier_id is null then
    raise exception 'delivery_and_courier_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_courier_id
      and ur.role = 'courier'
      and ur.is_active = true
  ) then
    raise exception 'target_user_is_not_active_courier' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = p_courier_id
  ) then
    raise exception 'courier_profile_not_found' using errcode = 'P0001';
  end if;

  select d.status, d.assigned_courier_id
    into v_delivery_status, v_assigned_courier
  from public.deliveries d
  where d.id = p_delivery_id;

  if v_delivery_status is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  -- The restored 012 RPC treats same courier + courier_assigned as idempotent.
  -- Refuse that shortcut if normalized assignment state is missing/corrupt.
  if v_delivery_status = 'courier_assigned'
     and v_assigned_courier is not distinct from p_courier_id then
    select count(*)::integer
      into v_active_assignment_count
    from public.courier_assignments ca
    where ca.delivery_id = p_delivery_id
      and ca.courier_id = p_courier_id
      and ca.status in ('assigned','accepted','in_progress');

    if v_active_assignment_count <> 1 then
      raise exception 'delivery_assignment_inconsistent' using errcode = 'P0001';
    end if;
  end if;

  return private.assign_courier_atomic_v1(
    p_delivery_id,
    p_courier_id,
    p_reason
  );
end;
$$;

revoke all on function public.assign_courier_atomic(uuid,uuid,text) from public;
revoke all on function public.assign_courier_atomic(uuid,uuid,text) from anon;
grant execute on function public.assign_courier_atomic(uuid,uuid,text) to authenticated;

alter function public.courier_transition_delivery_atomic(uuid,text,text)
  rename to courier_transition_delivery_atomic_v1;
alter function public.courier_transition_delivery_atomic_v1(uuid,text,text)
  set schema private;

revoke all on function private.courier_transition_delivery_atomic_v1(uuid,text,text) from public;
revoke all on function private.courier_transition_delivery_atomic_v1(uuid,text,text) from anon, authenticated;

create or replace function public.courier_transition_delivery_atomic(
  p_delivery_id uuid,
  p_to_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_role('courier') then
    raise exception 'courier_role_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = v_actor
  ) then
    raise exception 'courier_profile_not_found' using errcode = '42501';
  end if;

  return private.courier_transition_delivery_atomic_v1(
    p_delivery_id,
    p_to_status,
    p_reason
  );
end;
$$;

revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from public;
revoke all on function public.courier_transition_delivery_atomic(uuid,text,text) from anon;
grant execute on function public.courier_transition_delivery_atomic(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Deferred delivery <-> assignment consistency.
-- 012a repairs the recovered demo inconsistency before these triggers are installed.
-- ---------------------------------------------------------------------------

create or replace function private.assert_delivery_assignment_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delivery_id uuid;
  v_status text;
  v_assigned_courier uuid;
  v_active_count integer;
  v_active_courier uuid;
  v_profile_status text;
begin
  if tg_table_name = 'deliveries' then
    if tg_op = 'DELETE' then
      v_delivery_id := old.id;
    else
      v_delivery_id := new.id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_delivery_id := old.delivery_id;
    else
      v_delivery_id := new.delivery_id;
    end if;
  end if;

  select d.status, d.assigned_courier_id
    into v_status, v_assigned_courier
  from public.deliveries d
  where d.id = v_delivery_id;

  -- Delivery may have been deleted with assignments cascading away.
  if not found then
    return null;
  end if;

  select count(*)::integer,
         max(ca.courier_id::text)::uuid
    into v_active_count, v_active_courier
  from public.courier_assignments ca
  where ca.delivery_id = v_delivery_id
    and ca.status in ('assigned','accepted','in_progress');

  if v_status in (
    'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
    'picked_up','courier_to_client','arrived_at_client'
  ) then
    if v_assigned_courier is null then
      raise exception 'active_delivery_missing_assigned_courier';
    end if;

    if v_active_count <> 1 or v_active_courier is distinct from v_assigned_courier then
      raise exception 'active_delivery_assignment_mismatch';
    end if;

    if not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_assigned_courier
        and ur.role = 'courier'
        and ur.is_active = true
    ) then
      raise exception 'active_delivery_courier_role_missing';
    end if;

    select cp.availability_status
      into v_profile_status
    from public.courier_profiles cp
    where cp.user_id = v_assigned_courier;

    if v_profile_status is null then
      raise exception 'active_delivery_courier_profile_missing';
    end if;

    if v_profile_status <> 'busy' then
      raise exception 'active_delivery_courier_not_busy';
    end if;
  elsif v_status in ('delivery_pending','courier_searching') then
    if v_active_count <> 0 then
      raise exception 'pending_delivery_has_active_assignment';
    end if;
  elsif v_status in ('delivered','delivery_failed') then
    if v_active_count <> 0 then
      raise exception 'terminal_delivery_has_active_assignment';
    end if;
  else
    raise exception 'unknown_delivery_status_consistency_check';
  end if;

  return null;
end;
$$;

revoke all on function private.assert_delivery_assignment_consistency() from public;
revoke all on function private.assert_delivery_assignment_consistency() from anon, authenticated;

drop trigger if exists trg_delivery_assignment_consistency_on_delivery on public.deliveries;
create constraint trigger trg_delivery_assignment_consistency_on_delivery
after insert or update or delete on public.deliveries
deferrable initially deferred
for each row
execute function private.assert_delivery_assignment_consistency();

drop trigger if exists trg_delivery_assignment_consistency_on_assignment on public.courier_assignments;
create constraint trigger trg_delivery_assignment_consistency_on_assignment
after insert or update or delete on public.courier_assignments
deferrable initially deferred
for each row
execute function private.assert_delivery_assignment_consistency();

create or replace function private.assert_courier_profile_delivery_consistency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_status := null;
  else
    v_user_id := new.user_id;
    v_status := new.availability_status;
  end if;

  if exists (
    select 1
    from public.deliveries d
    where d.assigned_courier_id = v_user_id
      and d.status in (
        'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
        'picked_up','courier_to_client','arrived_at_client'
      )
  ) then
    if tg_op = 'DELETE' then
      raise exception 'cannot_delete_courier_profile_with_active_delivery';
    end if;

    if v_status <> 'busy' then
      raise exception 'courier_with_active_delivery_must_be_busy';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function private.assert_courier_profile_delivery_consistency() from public;
revoke all on function private.assert_courier_profile_delivery_consistency() from anon, authenticated;

drop trigger if exists trg_courier_profile_delivery_consistency on public.courier_profiles;
create constraint trigger trg_courier_profile_delivery_consistency
after insert or update or delete on public.courier_profiles
deferrable initially deferred
for each row
execute function private.assert_courier_profile_delivery_consistency();

commit;

-- REQUIRED STAGING PROOF
-- 1. 012a repairs the recovered assigned_courier_id / missing assignment mismatch.
-- 2. Same-courier replay returns idempotently only when exactly one active assignment exists.
-- 3. Target without active courier role/profile cannot be assigned.
-- 4. Courier whose role is inactive cannot progress even an already-assigned delivery.
-- 5. delivery read helper recognizes in_progress and stops recognizing stale "active" state.
-- 6. Active delivery must have exactly one matching active assignment and busy courier profile.
-- 7. Terminal delivery cannot retain an active assignment.
-- 8. Direct browser/session mutations remain revoked by 012.
-- 9. payment_status is untouched by all delivery functions/triggers.
