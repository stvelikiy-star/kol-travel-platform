-- KÖL / kol-travel-platform
-- CLIENT PROFILE RUNTIME — VERIFY / READ-ONLY
-- Assertions only; this file must not mutate schema or data.

DO $$
DECLARE
  v_count integer;
  v_def text;
  v_public_security_definer boolean;
BEGIN
  select count(*), bool_or(p.prosecdef)
    into v_count, v_public_security_definer
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'client_profile_update_atomic'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_full_name text, p_locale text, p_default_address text, p_request_id text';
  if v_count <> 1 then
    raise exception 'client_profile_verify_failed: public update RPC missing or ambiguous (% rows)', v_count;
  end if;
  if v_public_security_definer is distinct from false then
    raise exception 'client_profile_verify_failed: public update RPC must remain SECURITY INVOKER';
  end if;

  select pg_catalog.pg_get_functiondef(p.oid) into v_def
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'client_profile_update_atomic_internal'
  limit 1;

  -- pg_get_functiondef normalizes PL/pgSQL formatting, casts and expression syntax.
  -- Verify semantic authority/allowlist/idempotency/audit markers here; exact
  -- role/status behavior and field immutability are covered by the dedicated
  -- browser -> server action -> RPC -> DB runtime smoke.
  if v_def is null
     or v_def not ilike '%SECURITY DEFINER%'
     or v_def not ilike '%auth.uid()%'
     or v_def not ilike '%user_roles%'
     or v_def not ilike '%client%'
     or v_def not ilike '%is_active%'
     or v_def not ilike '%user_profiles%'
     or v_def not ilike '%active%'
     or v_def not ilike '%client_profile_not_authorized%'
     or v_def not ilike '%client_profile_inactive%'
     or v_def not ilike '%pg_advisory_xact_lock%'
     or v_def not ilike '%client_profile_request_id_payload_conflict%'
     or v_def not ilike '%client_profile_updated%'
     or v_def not ilike '%full_name%'
     or v_def not ilike '%locale%'
     or v_def not ilike '%default_address%'
     or v_def ilike '%set email =%'
     or v_def ilike '%set phone =%'
     or v_def ilike '%user_roles%update%' then
    raise exception 'client_profile_verify_failed: internal RPC lost authority/allowlist/idempotency/audit guards';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.client_profile_update_atomic(text,text,text,text)', 'EXECUTE') then
    raise exception 'client_profile_verify_failed: anon may execute update RPC';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.client_profile_update_atomic(text,text,text,text)', 'EXECUTE') then
    raise exception 'client_profile_verify_failed: authenticated lacks update RPC execute';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.user_profiles', 'UPDATE') then
    raise exception 'client_profile_verify_failed: authenticated retains direct user_profiles UPDATE';
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.client_profiles', 'UPDATE') then
    raise exception 'client_profile_verify_failed: authenticated retains direct client_profiles UPDATE';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename in ('user_profiles','client_profiles')
    and cmd = 'UPDATE';
  if v_count <> 0 then
    raise exception 'client_profile_verify_failed: direct profile UPDATE RLS policies remain (% rows)', v_count;
  end if;

  if not pg_catalog.has_table_privilege('authenticated', 'public.user_profiles', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.client_profiles', 'SELECT') then
    raise exception 'client_profile_verify_failed: authenticated profile SELECT grant missing';
  end if;
END
$$;

select n.nspname as schema_name,
       p.proname,
       p.prosecdef as security_definer,
       pg_catalog.pg_get_function_identity_arguments(p.oid) as args
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where p.proname in ('client_profile_update_atomic','client_profile_update_atomic_internal')
order by n.nspname, p.proname;
