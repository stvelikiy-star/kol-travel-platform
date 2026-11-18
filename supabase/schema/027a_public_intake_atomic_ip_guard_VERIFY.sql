-- Read-only VERIFY; run only after 027a on disposable local Supabase.
do $$
declare
  f oid;
begin
  select to_regprocedure('public.public_intake_create_atomic(uuid,text,text,jsonb,text,text,text,uuid)')::oid into f;
  if f is null then raise exception 'public_intake_atomic_rpc_missing'; end if;
  if not has_function_privilege('service_role',f,'EXECUTE')
     or has_function_privilege('anon',f,'EXECUTE')
     or has_function_privilege('authenticated',f,'EXECUTE') then
    raise exception 'public_intake_rpc_execute_privileges_incorrect';
  end if;
  if (select prosecdef from pg_proc where oid=f) then
    raise exception 'public_intake_rpc_must_be_security_invoker';
  end if;
  if not exists (
    select 1 from pg_index i join pg_class c on c.oid=i.indrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='support_tickets'
      and i.indisprimary
  ) then raise exception 'public_intake_request_id_primary_key_missing'; end if;
  if has_table_privilege('anon','public.support_tickets','INSERT')
     or has_table_privilege('authenticated','public.support_tickets','INSERT') then
    raise exception 'public_intake_direct_insert_exposure';
  end if;
end
$$;
select 'KOL_INTAKE_ATOMIC_IP_GUARD_VERIFY_PASS' as result;
