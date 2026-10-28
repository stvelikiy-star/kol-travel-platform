-- Disposable restored-copy test only. Fixtures and all writes roll back.
-- Invoked after the reviewed migration package, never against the live source.
begin;
create temporary table kol_role_actors (id uuid primary key, label text unique, role_name text, tickets integer, messages integer, profiles integer);
insert into kol_role_actors values
(gen_random_uuid(),'owner','client',1,1,1),
(gen_random_uuid(),'unrelated','client',0,0,1),
(gen_random_uuid(),'support','support_admin',1,2,2),
(gen_random_uuid(),'super','super_admin',1,2,2),
(gen_random_uuid(),'finance','finance_admin',1,1,2),
(gen_random_uuid(),'dispatch','dispatcher',1,1,2),
(gen_random_uuid(),'partner','partner_owner',0,0,0),
(gen_random_uuid(),'courier','courier',0,0,0);
create temporary table kol_role_ticket (id uuid primary key);
insert into kol_role_ticket values (gen_random_uuid());
grant select on kol_role_actors, kol_role_ticket to authenticated;
insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'authenticated','authenticated',id::text || '@kol-isolation.example.test','{}'::jsonb,'{}'::jsonb,now(),now() from kol_role_actors;
insert into public.user_roles (user_id,role,is_active) select id,role_name,true from kol_role_actors;
insert into public.client_profiles (user_id) select id from kol_role_actors where role_name='client';
insert into public.support_tickets (id,created_by,category,title)
select t.id,a.id,'general','Restored copy isolation fixture' from kol_role_ticket t cross join kol_role_actors a where a.label='owner';
insert into public.ticket_messages (ticket_id,sender_id,message,visibility)
select t.id,a.id,'Fixture public reply','public' from kol_role_ticket t cross join kol_role_actors a where a.label='support';
insert into public.ticket_messages (ticket_id,sender_id,message,visibility)
select t.id,a.id,'Fixture internal note','internal' from kol_role_ticket t cross join kol_role_actors a where a.label='support';

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='owner'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='owner'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='owner';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for owner: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for owner: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for owner: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for owner: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='unrelated'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='unrelated'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='unrelated';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for unrelated: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for unrelated: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for unrelated: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for unrelated: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='support'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='support'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='support';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for support: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for support: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for support: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for support: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='super'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='super'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='super';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for super: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for super: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for super: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for super: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='finance'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='finance'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='finance';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for finance: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for finance: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for finance: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for finance: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='dispatch'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='dispatch'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='dispatch';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for dispatch: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for dispatch: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for dispatch: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for dispatch: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='partner'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='partner'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='partner';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for partner: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for partner: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for partner: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for partner: %',n; end if;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub',(select id::text from kol_role_actors where label='courier'),true);
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claims',json_build_object('sub',(select id from kol_role_actors where label='courier'),'role','authenticated')::text,true);
do $$
declare a record; n integer;
begin
  select * into strict a from kol_role_actors where label='courier';
  select count(*) into n from public.support_tickets where id in (select id from kol_role_ticket);
  if n <> a.tickets then raise exception 'ticket isolation failed for courier: %',n; end if;
  select count(*) into n from public.ticket_messages where ticket_id in (select id from kol_role_ticket);
  if n <> a.messages then raise exception 'message visibility failed for courier: %',n; end if;
  select count(*) into n from public.client_profiles where user_id in (select id from kol_role_actors);
  if n <> a.profiles then raise exception 'profile isolation failed for courier: %',n; end if;
  select count(*) into n from public.user_roles where user_id in (select id from kol_role_actors);
  if n <> 1 then raise exception 'role isolation failed for courier: %',n; end if;
end $$;
reset role;

do $$ begin
if has_table_privilege('anon','public.client_profiles','SELECT')
 or has_table_privilege('anon','public.user_roles','SELECT') then
 raise exception 'anonymous private table access granted';
end if;
end $$;
rollback;
select 'RESTORED_ROLE_ISOLATION_PASS' as result;
