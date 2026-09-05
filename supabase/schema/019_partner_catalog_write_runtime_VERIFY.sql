-- KÖL / 019 partner catalog write runtime verification
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
    and p.proname = 'partner_catalog_write_atomic'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_domain text, p_action text, p_item_id uuid, p_request_id text, p_fields jsonb';

  if v_public_definer is null then
    raise exception '019 verify: public Partner catalog write RPC missing';
  end if;
  if v_public_definer is distinct from false or v_public_fixed_path is distinct from true then
    raise exception '019 verify: public Partner catalog write RPC must remain SECURITY INVOKER with fixed search_path';
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
    and p.proname = 'partner_catalog_write_atomic_internal'
    and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_domain text, p_action text, p_item_id uuid, p_request_id text, p_fields jsonb';

  if v_private_definer is distinct from true or v_private_fixed_path is distinct from true then
    raise exception '019 verify: private Partner catalog write function must be SECURITY DEFINER with fixed search_path';
  end if;

  if pg_catalog.has_function_privilege('anon', 'public.partner_catalog_write_atomic(text,text,uuid,text,jsonb)', 'EXECUTE') then
    raise exception '019 verify: anon must not execute Partner catalog write RPC';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.partner_catalog_write_atomic(text,text,uuid,text,jsonb)', 'EXECUTE') then
    raise exception '019 verify: authenticated wrapper EXECUTE grant missing';
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
    raise exception '019 verify: direct authenticated catalog INSERT/UPDATE/DELETE must remain revoked';
  end if;
END
$$;

select '019 partner catalog write runtime verification: PASS' as result;
