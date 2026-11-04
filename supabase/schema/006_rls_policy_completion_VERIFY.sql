-- KÖL RLS policy completion verification
-- READ-ONLY. Run after 005 + 006 on staging/restored database.

-- 1. Every public RLS-enabled table must have at least one policy.
select c.relname as table_name
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = c.relname
  )
order by c.relname;
-- Expected: zero rows.

-- 2. Inspect newly completed policy surface.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
  and tablename in (
    'admin_profiles','partner_profiles','booking_guests','booking_status_history',
    'order_delivery','order_payments','delivery_status_history','courier_shifts',
    'courier_locations','favorites','loyalty_accounts','loyalty_transactions',
    'notifications','support_tickets','ticket_messages','restaurants','shops','reviews',
    'promo_codes','promo_usage','commissions','transactions','ai_alerts',
    'ai_decision_logs','compliance_reviews','media_files'
  )
order by tablename, policyname;

-- 3. Confirm anon grants opened by 005/006 are SELECT-only on public catalog facade.
select grantee, table_name, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema='public'
  and grantee='anon'
  and table_name in ('partners','categories','tours','stays','restaurants','menu_items','shops','products')
group by grantee, table_name
order by table_name;
-- Expected for these tables from recovery patches: SELECT only.

-- 4. Ensure sensitive/operational policy-less tables did not accidentally get normal writes.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in (
    'booking_guests','booking_status_history','order_delivery','order_payments',
    'delivery_status_history','courier_shifts','courier_locations','loyalty_accounts',
    'loyalty_transactions','notifications','reviews','promo_codes','promo_usage',
    'commissions','transactions','ai_alerts','ai_decision_logs','compliance_reviews','media_files'
  )
  and cmd <> 'SELECT'
order by tablename, policyname;
-- Expected: zero rows.

-- 5. The only direct authenticated user writes intentionally opened by 006.
select tablename, policyname, roles, cmd
from pg_policies
where schemaname='public'
  and tablename in ('favorites','support_tickets','ticket_messages')
order by tablename, policyname;
-- Expected:
-- favorites: SELECT/INSERT/UPDATE/DELETE own rows
-- support_tickets: one SELECT + INSERT; owner and admins per ticket scope
-- ticket_messages: one SELECT + INSERT; owners see public only, support admins also internal


-- 6. Support SELECT contract: exactly one policy per table; internal visibility is
-- restricted to support_admin/super_admin. Finance/dispatch reach the public branch only.
do $$
declare
  v_ticket_count integer;
  v_message_count integer;
  v_message_qual text;
begin
  select count(*) into v_ticket_count
  from pg_policies
  where schemaname = 'public' and tablename = 'support_tickets'
    and cmd = 'SELECT' and roles = array['authenticated']::name[];

  select count(*), max(qual) into v_message_count, v_message_qual
  from pg_policies
  where schemaname = 'public' and tablename = 'ticket_messages'
    and cmd = 'SELECT' and roles = array['authenticated']::name[];

  if v_ticket_count <> 1 or v_message_count <> 1 then
    raise exception 'support_select_policy_count_failed: tickets %, messages %', v_ticket_count, v_message_count;
  end if;
  if v_message_qual not like '%visibility%' or v_message_qual not like '%public%'
     or v_message_qual not like '%internal%' or v_message_qual not like '%support_admin%'
     or v_message_qual not like '%super_admin%' then
    raise exception 'support_message_visibility_role_scope_missing';
  end if;
end
$$;

-- 7. Core live counts for side-effect detection.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.orders) as orders,
  (select count(*) from public.bookings) as bookings,
  (select count(*) from public.payments) as payments,
  (select count(*) from public.deliveries) as deliveries,
  (select count(*) from storage.buckets) as storage_buckets,
  (select count(*) from storage.objects) as storage_objects;

-- 8. Rerun Supabase Security Advisor after staging apply. SQL alone does not replace it.
