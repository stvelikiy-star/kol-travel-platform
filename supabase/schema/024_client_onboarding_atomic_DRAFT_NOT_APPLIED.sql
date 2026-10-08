-- KÖL CLIENT ONBOARDING — DRAFT / NOT APPLIED
-- Creates one client profile after a verified passwordless Auth session.
-- Run only in the Supabase TEST project after review and RLS verification.

begin;

create schema if not exists private;

create or replace function private.client_onboarding_complete_atomic_internal(
  p_full_name text,
  p_phone text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(pg_catalog.btrim(coalesce(p_phone, '')), '');
  v_locale text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_locale, 'ru')));
  v_default_address text := nullif(pg_catalog.btrim(coalesce(p_default_address, '')), '');
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_email text;
  v_profile_id uuid;
  v_user_profile_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_full_name is null or length(v_full_name) < 2 or length(v_full_name) > 120 then
    raise exception 'invalid_client_full_name' using errcode = '22023';
  end if;
  if v_phone is null or length(v_phone) < 5 or length(v_phone) > 40 then
    raise exception 'invalid_client_phone' using errcode = '22023';
  end if;
  if v_locale not in ('ru', 'kg', 'en') then
    raise exception 'invalid_client_locale' using errcode = '22023';
  end if;
  if length(v_default_address) > 500 then
    raise exception 'invalid_client_default_address' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_actor and is_active = true and role <> 'client'
  ) then
    raise exception 'client_role_scope_conflict' using errcode = '42501';
  end if;

  select au.email into v_email from auth.users au where au.id = v_actor;

  select al.entity_id into v_profile_id
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_onboarding_completed'
    and al.request_id = v_request_id
  limit 1;

  if v_profile_id is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'user_id', v_actor, 'idempotent', true);
  end if;

  insert into public.user_profiles (user_id, full_name, phone, email, locale, preferred_contact, status)
  values (v_actor, v_full_name, v_phone, v_email, v_locale, 'phone', 'active')
  on conflict (user_id) do update
    set full_name = coalesce(nullif(public.user_profiles.full_name, ''), excluded.full_name),
        phone = coalesce(nullif(public.user_profiles.phone, ''), excluded.phone),
        email = coalesce(nullif(public.user_profiles.email, ''), excluded.email),
        locale = coalesce(public.user_profiles.locale, excluded.locale),
        updated_at = pg_catalog.now();

  select up.id into v_user_profile_id from public.user_profiles up where up.user_id = v_actor;

  if not exists (select 1 from public.user_roles where user_id = v_actor and role = 'client') then
    insert into public.user_roles (user_id, role, is_active) values (v_actor, 'client', true);
  else
    update public.user_roles set is_active = true, updated_at = pg_catalog.now()
    where user_id = v_actor and role = 'client';
  end if;

  insert into public.client_profiles (user_id, default_address)
  values (v_actor, v_default_address)
  on conflict (user_id) do update
    set default_address = coalesce(public.client_profiles.default_address, excluded.default_address),
        updated_at = pg_catalog.now();

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor, 'client', 'client_onboarding_completed', 'user_profiles', v_user_profile_id,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object('full_name_length', length(v_full_name), 'phone_length', length(v_phone), 'locale', v_locale),
    'Client profile created after verified passwordless Auth session.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object('ok', true, 'user_id', v_actor, 'idempotent', false);
end;
$$;

revoke all on function private.client_onboarding_complete_atomic_internal(text, text, text, text, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_onboarding_complete_atomic_internal(text, text, text, text, text) to authenticated;

create or replace function public.client_onboarding_complete_atomic(
  p_full_name text,
  p_phone text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language sql
security invoker
set search_path = public, pg_catalog
as $$
  select private.client_onboarding_complete_atomic_internal(
    p_full_name, p_phone, p_locale, p_default_address, p_request_id
  );
$$;

revoke all on function public.client_onboarding_complete_atomic(text, text, text, text, text) from public, anon;
grant execute on function public.client_onboarding_complete_atomic(text, text, text, text, text) to authenticated;

comment on function public.client_onboarding_complete_atomic(text, text, text, text, text)
is 'Creates or completes the authenticated KOL client profile after passwordless onboarding; idempotent and audited.';

commit;
