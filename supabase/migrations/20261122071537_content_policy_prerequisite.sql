-- Supabase starts before the isolated role suites install the KÖL application
-- tables. Install the real predicate before policies reference it. PL/pgSQL
-- resolves table references on invocation; missing prerequisites cannot grant access.
begin;
create schema if not exists private;

do $bootstrap$
begin
  if to_regprocedure('private.can_manage_content()') is null then
    execute $ddl$
      create function private.can_manage_content()
      returns boolean
      language plpgsql stable security definer
      set search_path = ''
      as $body$
      begin
        return exists (
          select 1
          from public.user_roles r
          join public.user_profiles p on p.user_id = r.user_id
          where r.user_id = auth.uid()
            and r.is_active
            and p.status = 'active'
            and r.role in ('super_admin', 'content_manager')
        );
      end;
      $body$
    $ddl$;
    revoke all on function private.can_manage_content() from public, anon;
    grant execute on function private.can_manage_content() to authenticated;
  end if;
end;
$bootstrap$;
commit;
