-- KÖL / 016 admin catalog moderation verification
-- READ-ONLY. Run after local/staging apply.

DO $$
DECLARE
  v_public_definer boolean;
  v_public_fixed_path boolean;
  v_private_definer boolean;
  v_private_fixed_path boolean;
BEGIN
  select p.prosecdef,
         exists (
           select 1
           from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           where cfg like 'search_path=%'
         )
    into v_public_definer, v_public_fixed_path
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'admin_catalog_moderation_atomic'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_item_id uuid, p_domain text, p_action text, p_request_id text, p_reason text';

  if v_public_definer is null then
    raise exception '016 verify: public moderation RPC missing';
  end if;
  if v_public_definer is distinct from false or v_public_fixed_path is distinct from true then
    raise exception '016 verify: public moderation RPC must remain SECURITY INVOKER with fixed search_path';
  end if;

  select p.prosecdef,
         exists (
           select 1
           from pg_catalog.unnest(coalesce(p.proconfig, '{}'::text[])) cfg
           where cfg like 'search_path=%'
         )
    into v_private_definer, v_private_fixed_path
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname = 'admin_catalog_moderation_atomic_internal'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_item_id uuid, p_domain text, p_action text, p_request_id text, p_reason text';

  if v_private_definer is distinct from true or v_private_fixed_path is distinct from true then
    raise exception '016 verify: private moderation function must be SECURITY DEFINER with fixed search_path';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.admin_catalog_moderation_atomic(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception '016 verify: anon must not execute public moderation RPC';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.admin_catalog_moderation_atomic(uuid,text,text,text,text)', 'EXECUTE') then
    raise exception '016 verify: authenticated wrapper EXECUTE grant missing';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.menu_items', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.menu_items', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.menu_items', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.tours', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.tours', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.tours', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.stays', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.stays', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.stays', 'DELETE')
     or pg_catalog.has_table_privilege('authenticated', 'public.products', 'INSERT')
     or pg_catalog.has_table_privilege('authenticated', 'public.products', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.products', 'DELETE') then
    raise exception '016 verify: direct authenticated catalog INSERT/UPDATE/DELETE must remain revoked';
  end if;
END
$$;

select '016 admin catalog moderation verification: PASS' as result;
