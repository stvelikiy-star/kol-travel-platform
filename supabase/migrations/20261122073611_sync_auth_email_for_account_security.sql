-- Keep the visible KÖL login email consistent with verified Supabase Auth changes.
-- Supabase Auth owns passwords and email verification; no credentials are stored here.
begin;

create or replace function private.kol_sync_auth_email_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.user_profiles
       set email = lower(trim(new.email)),
           updated_at = now()
     where user_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.kol_sync_auth_email_v1() from public, anon, authenticated;

-- Fired only once Supabase Auth actually changes the canonical email.
-- A pending/unconfirmed new email must not replace the old login in KÖL.
create trigger kol_sync_auth_email_v1
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.kol_sync_auth_email_v1();

commit;
