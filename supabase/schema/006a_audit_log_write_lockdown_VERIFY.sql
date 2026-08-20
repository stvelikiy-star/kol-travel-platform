-- KÖL / 006a audit log verification — READ ONLY

select policyname,roles,cmd,qual,with_check
from pg_policies
where schemaname='public' and tablename='audit_logs'
order by policyname;
-- Expected: authenticated users create audit logs draft absent.

select grantee,privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name='audit_logs'
  and grantee in ('anon','authenticated')
  and privilege_type in ('INSERT','UPDATE','DELETE')
order by grantee,privilege_type;
-- Expected: zero rows.
