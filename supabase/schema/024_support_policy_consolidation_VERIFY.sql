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
