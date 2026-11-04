-- Read-only verification for 024_support_policy_consolidation.

select tablename, policyname, roles, cmd, qual
from pg_policies
where schemaname = 'public'
  and tablename in ('support_tickets', 'ticket_messages')
  and cmd = 'SELECT'
order by tablename, policyname;

do $$
declare
  v_ticket_policies integer;
  v_message_policies integer;
  v_message_qual text;
begin
  select count(*) into v_ticket_policies
  from pg_policies
  where schemaname = 'public'
    and tablename = 'support_tickets'
    and cmd = 'SELECT'
    and roles = array['authenticated']::name[];

  select count(*), max(qual) into v_message_policies, v_message_qual
  from pg_policies
  where schemaname = 'public'
    and tablename = 'ticket_messages'
    and cmd = 'SELECT'
    and roles = array['authenticated']::name[];

  if v_ticket_policies <> 1 or v_message_policies <> 1 then
    raise exception 'support_select_policy_count_failed: tickets %, messages %',
      v_ticket_policies, v_message_policies;
  end if;

  if v_message_qual not like '%visibility%' or v_message_qual not like '%public%'
     or v_message_qual not like '%internal%' or v_message_qual not like '%support_admin%'
     or v_message_qual not like '%super_admin%' then
    raise exception 'support_message_visibility_scope_missing';
  end if;
end
$$;

-- Structural checks above do not prove authorization behavior by themselves.
-- Explicitly flag every overlapping SELECT policy, including a broad legacy
-- policy which could OR past the visibility guard on internal messages.
select tablename, count(*)::int as select_policy_count,
       array_agg(policyname order by policyname) as select_policy_names
from pg_policies
where schemaname = 'public'
  and tablename in ('support_tickets', 'ticket_messages')
  and cmd = 'SELECT' and roles = array['authenticated']::name[]
group by tablename
having count(*) <> 1;
-- Expected: zero rows. Any result is a release-blocking policy overlap.

-- Inspect grants and RLS flags separately; RLS and SQL grants are independent.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select_grant
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('support_tickets','ticket_messages')
order by c.relname;
-- After applying 024, perform authenticated role tests for ticket owner,
-- unrelated client, support_admin, super_admin, finance_admin and dispatcher.
-- Verify that internal notes are invisible to all except support/super admins.
