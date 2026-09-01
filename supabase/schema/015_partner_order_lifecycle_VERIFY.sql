-- KÖL Partner order lifecycle verification. Read-only assertions only.

do $$
begin
  if to_regprocedure('private.partner_order_action_atomic_internal(uuid,text,text,text)') is null then
    raise exception 'private partner order implementation missing';
  end if;

  if to_regprocedure('public.partner_order_action_atomic(uuid,text,text,text)') is null then
    raise exception 'public partner order entrypoint missing';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname = 'partner_order_action_atomic_internal'
      and p.prosecdef = true
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ) then
    raise exception 'private partner order implementation must be SECURITY DEFINER with locked search_path';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'partner_order_action_atomic'
      and p.prosecdef = true
  ) then
    raise exception 'public partner order entrypoint must remain SECURITY INVOKER';
  end if;

  if has_function_privilege('anon', 'public.partner_order_action_atomic(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'anon must not execute partner order lifecycle';
  end if;

  if not has_function_privilege('authenticated', 'public.partner_order_action_atomic(uuid,text,text,text)', 'EXECUTE') then
    raise exception 'authenticated must execute scoped partner order entrypoint';
  end if;

  if has_function_privilege('authenticated', 'public.mark_order_ready_for_pickup_atomic(uuid)', 'EXECUTE') then
    raise exception 'legacy public SECURITY DEFINER ready_for_pickup entrypoint is still executable';
  end if;

  if has_table_privilege('authenticated', 'public.orders', 'UPDATE') then
    raise exception 'authenticated direct order UPDATE must remain revoked';
  end if;

  if has_table_privilege('authenticated', 'public.order_status_history', 'INSERT')
     or has_table_privilege('authenticated', 'public.order_status_history', 'UPDATE')
     or has_table_privilege('authenticated', 'public.order_status_history', 'DELETE') then
    raise exception 'authenticated direct order history mutation must remain revoked';
  end if;

  if not has_schema_privilege('authenticated', 'private', 'USAGE') then
    raise exception 'authenticated requires private schema usage for invoker wrapper';
  end if;
end
$$;

select 'KÖL partner order lifecycle VERIFY: PASS' as result;
