-- KÖL / kol-travel-platform
-- CLIENT TRANSACTION ROLE SCOPE — DRAFT NOT APPLIED
-- Prepared: 2026-08-21
--
-- 007/008 derive client_id from auth.uid(), but their SECURITY DEFINER RPCs are
-- callable by the authenticated database role. This invariant prevents a user
-- whose active application role is not `client` from creating a booking/order,
-- including direct REST/RPC calls that bypass the Next.js server actions.
--
-- Apply only in the reviewed staging package after backup/baseline gates pass.

begin;

create or replace function public.enforce_active_client_transaction_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.client_id is null then
    raise exception 'client_identity_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = new.client_id
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_role_required' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Trigger-only helper: callers must not invoke it directly.
revoke all on function public.enforce_active_client_transaction_identity() from public;
revoke all on function public.enforce_active_client_transaction_identity() from anon;
revoke all on function public.enforce_active_client_transaction_identity() from authenticated;

drop trigger if exists enforce_active_client_identity_on_bookings on public.bookings;
create trigger enforce_active_client_identity_on_bookings
before insert on public.bookings
for each row
execute function public.enforce_active_client_transaction_identity();

drop trigger if exists enforce_active_client_identity_on_orders on public.orders;
create trigger enforce_active_client_identity_on_orders
before insert on public.orders
for each row
execute function public.enforce_active_client_transaction_identity();

commit;

-- STAGING PROOF:
-- 1. client role + atomic booking/order RPC => insert reaches normal business rules.
-- 2. courier/partner/admin authenticated user calling the same RPC => 42501.
-- 3. direct authenticated INSERT remains denied by 007a/008 privileges.
-- 4. trigger helper has no PUBLIC/anon/authenticated EXECUTE grant.
