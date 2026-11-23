-- Read-only contract verification after 025. Raises on unsafe/missing privileges.
do $$
declare
  v_public regprocedure := pg_catalog.to_regprocedure('public.client_onboarding_complete_atomic(text,text,text,text,text)');
  v_private regprocedure := pg_catalog.to_regprocedure('private.client_onboarding_complete_atomic_internal(text,text,text,text,text)');
begin
  if v_public is null or v_private is null then
    raise exception 'onboarding_rpc_missing';
  end if;
  if pg_catalog.has_function_privilege('anon', v_public, 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', v_private, 'EXECUTE')
    or not pg_catalog.has_function_privilege('authenticated', v_public, 'EXECUTE') then
    raise exception 'onboarding_execute_scope_invalid';
  end if;
  if not (select prosecdef from pg_catalog.pg_proc where oid = v_private)
    or (select prosecdef from pg_catalog.pg_proc where oid = v_public) then
    raise exception 'onboarding_security_context_invalid';
  end if;
end;
$$;
