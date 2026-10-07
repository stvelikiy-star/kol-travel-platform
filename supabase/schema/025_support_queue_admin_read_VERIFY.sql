-- KÖL / SUPPORT QUEUE READ SCOPE — READ-ONLY VERIFY

DO $$
DECLARE
  v_count integer;
BEGIN
  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'support_tickets'
    and policyname = 'support admins read all support tickets'
    and cmd = 'SELECT'
    and roles = '{authenticated}'
    and qual ilike '%support_admin%';
  if v_count <> 1 then
    raise exception '025 verification failed: support ticket admin read policy missing';
  end if;

  select count(*) into v_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'ticket_messages'
    and policyname = 'support admins read public ticket messages'
    and cmd = 'SELECT'
    and roles = '{authenticated}'
    and qual ilike '%visibility%';
  if v_count <> 1 then
    raise exception '025 verification failed: ticket message admin read policy missing';
  end if;
END
$$;

select schemaname, tablename, policyname, cmd, roles, qual
from pg_catalog.pg_policies
where schemaname = 'public'
  and policyname in ('support admins read all support tickets', 'support admins read public ticket messages')
order by tablename;
