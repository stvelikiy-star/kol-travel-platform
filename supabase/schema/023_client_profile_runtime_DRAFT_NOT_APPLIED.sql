-- KÖL / kol-travel-platform
-- CLIENT PROFILE RUNTIME — DRAFT / NOT APPLIED
-- Prepared: 2026-09-07
--
-- Scope:
-- - authenticated active Client reads only own profile through existing RLS;
-- - Client may update only full_name, locale and default_address;
-- - email, phone, avatar, preferred_contact, status, metadata and roles are immutable here;
-- - writes are RPC-only, payload-bound idempotent and audited;
-- - audit evidence stores hashes/lengths for PII, not raw name/address values.
--
-- Explicitly excluded:
-- - email/phone/password verification or mutation;
-- - notification/contact preferences;
-- - role/status/admin user management;
-- - live/production apply.

begin;

create schema if not exists private;

-- Move profile mutation authority behind one audited RPC.
drop policy if exists "users update own user profile" on public.user_profiles;
drop policy if exists "clients update own client profile" on public.client_profiles;
revoke update on table public.user_profiles from anon, authenticated;
revoke update on table public.client_profiles from anon, authenticated;

create index if not exists idx_audit_client_profile_request
  on public.audit_logs (actor_id, action, request_id)
  where action = 'client_profile_updated';

create or replace function private.client_profile_update_atomic_internal(
  p_full_name text,
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
  v_locale text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_locale, '')));
  v_default_address text := nullif(pg_catalog.btrim(coalesce(p_default_address, '')), '');
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_profile_id uuid;
  v_old_full_name text;
  v_old_locale text;
  v_old_address text;
  v_existing_after jsonb;
  v_name_md5 text := pg_catalog.md5(coalesce(nullif(pg_catalog.btrim(coalesce(p_full_name, '')), ''), ''));
  v_address_md5 text := pg_catalog.md5(coalesce(nullif(pg_catalog.btrim(coalesce(p_default_address, '')), ''), ''));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_profile_not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_profiles up
    where up.user_id = v_actor and up.status = 'active'
  ) then
    raise exception 'client_profile_inactive' using errcode = '42501';
  end if;

  if v_full_name is not null and (length(v_full_name) < 2 or length(v_full_name) > 120) then
    raise exception 'invalid_client_full_name' using errcode = '22023';
  end if;
  if v_locale not in ('ru','kg','en') then
    raise exception 'invalid_client_locale' using errcode = '22023';
  end if;
  if v_default_address is not null and length(v_default_address) > 500 then
    raise exception 'invalid_client_default_address' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.after
    into v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_profile_updated'
    and al.entity_type = 'user_profiles'
    and al.request_id = v_request_id
  limit 1;

  if v_existing_after is not null then
    if coalesce(v_existing_after ->> 'full_name_md5', '') <> v_name_md5
       or coalesce(v_existing_after ->> 'full_name_length', '') <> coalesce(length(v_full_name)::text, '0')
       or coalesce(v_existing_after ->> 'locale', '') <> v_locale
       or coalesce(v_existing_after ->> 'default_address_md5', '') <> v_address_md5
       or coalesce(v_existing_after ->> 'default_address_length', '') <> coalesce(length(v_default_address)::text, '0') then
      raise exception 'client_profile_request_id_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'user_id', v_actor,
      'locale', v_locale,
      'idempotent', true
    );
  end if;

  select up.id, up.full_name, up.locale
    into v_profile_id, v_old_full_name, v_old_locale
  from public.user_profiles up
  where up.user_id = v_actor
  for update;

  if v_profile_id is null then
    raise exception 'client_profile_not_found' using errcode = 'P0002';
  end if;

  select cp.default_address
    into v_old_address
  from public.client_profiles cp
  where cp.user_id = v_actor
  for update;

  if not found then
    raise exception 'client_profile_not_found' using errcode = 'P0002';
  end if;

  update public.user_profiles
  set full_name = v_full_name,
      locale = v_locale,
      updated_at = pg_catalog.now()
  where user_id = v_actor;

  update public.client_profiles
  set default_address = v_default_address,
      updated_at = pg_catalog.now()
  where user_id = v_actor;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_actor,
    'client',
    'client_profile_updated',
    'user_profiles',
    v_profile_id,
    pg_catalog.jsonb_build_object(
      'full_name_md5', pg_catalog.md5(coalesce(v_old_full_name, '')),
      'full_name_length', coalesce(length(v_old_full_name), 0),
      'locale', coalesce(v_old_locale, ''),
      'default_address_md5', pg_catalog.md5(coalesce(v_old_address, '')),
      'default_address_length', coalesce(length(v_old_address), 0)
    ),
    pg_catalog.jsonb_build_object(
      'full_name_md5', v_name_md5,
      'full_name_length', coalesce(length(v_full_name), 0),
      'locale', v_locale,
      'default_address_md5', v_address_md5,
      'default_address_length', coalesce(length(v_default_address), 0)
    ),
    'Client updated allowlisted own profile fields atomically.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'user_id', v_actor,
    'locale', v_locale,
    'idempotent', false
  );
end;
$$;

revoke all on function private.client_profile_update_atomic_internal(text,text,text,text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.client_profile_update_atomic_internal(text,text,text,text) to authenticated;

create or replace function public.client_profile_update_atomic(
  p_full_name text,
  p_locale text,
  p_default_address text,
  p_request_id text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.client_profile_update_atomic_internal(
    p_full_name,
    p_locale,
    p_default_address,
    p_request_id
  );
$$;

revoke all on function public.client_profile_update_atomic(text,text,text,text) from public, anon;
grant execute on function public.client_profile_update_atomic(text,text,text,text) to authenticated;

comment on function public.client_profile_update_atomic(text,text,text,text) is
  'Authenticated active Client profile update entrypoint. Only full_name, locale and default_address may change; identity, role, idempotency and audit are DB-authoritative.';

commit;