-- KÖL / kol-travel-platform
-- ADMIN CATALOG GOVERNANCE — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Scope:
-- - super_admin-only catalog publish / unpublish / archive authority;
-- - super_admin-only category create / update / archive authority;
-- - public catalog visibility remains status='active'; publish maps approved -> active;
-- - category archive is fail-closed while referenced by any non-archived catalog record;
-- - direct authenticated catalog/category DML remains revoked; writes are RPC-only;
-- - every committed mutation writes immutable audit evidence;
-- - actor/request idempotency is concurrency-serialized and payload-bound;
-- - alcohol-like content/categories remain blocked while the alcohol module is OFF;
-- - no payment, order, booking, delivery, availability, partner or role truth is mutated.
--
-- Explicitly excluded:
-- - partner verification/user blocking/role changes;
-- - cancellation/refund/payout/settlement;
-- - live/production apply;
-- - alcohol enablement.

begin;

create schema if not exists private;

-- Minimal category lifecycle state required for reversible public taxonomy control.
alter table public.categories
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'categories_status_valid'
      and conrelid = 'public.categories'::regclass
  ) then
    alter table public.categories
      add constraint categories_status_valid check (status in ('active','archived'));
  end if;
end
$$;

create index if not exists idx_categories_status_scope_sort
  on public.categories (status, scope, sort_order, title);

-- Categories are public taxonomy only while active. Admins retain visibility for governance.
drop policy if exists "public reads categories" on public.categories;
drop policy if exists "public read categories" on public.categories;
drop policy if exists "anon read active categories" on public.categories;
drop policy if exists "authenticated read visible categories" on public.categories;

create policy "anon read active categories"
on public.categories for select
to anon
using (status = 'active');

create policy "authenticated read visible categories"
on public.categories for select
to authenticated
using (status = 'active' or public.is_admin());

-- Keep all governance writes behind audited RPC authority.
revoke insert, update, delete on table public.categories from anon, authenticated;
revoke insert, update, delete on table public.menu_items from anon, authenticated;
revoke insert, update, delete on table public.tours from anon, authenticated;
revoke insert, update, delete on table public.stays from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;
grant select on table public.categories to anon, authenticated;

create or replace function private.admin_catalog_governance_atomic_internal(
  p_item_id uuid,
  p_domain text,
  p_action text,
  p_request_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_target_status text;
  v_business_id uuid;
  v_partner_status text;
  v_business_status text;
  v_category_id uuid;
  v_category_title text;
  v_title text;
  v_description text;
  v_metadata jsonb;
  v_price numeric(12,2);
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_entity_type text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_reason text;
  v_existing_domain text;
  v_existing_status text;
  v_searchable text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_item_id is null then
    raise exception 'item_id_required' using errcode = '22023';
  end if;
  if p_domain not in ('food','tours','stays','products') then
    raise exception 'unsupported_catalog_domain' using errcode = '22023';
  end if;
  if p_action not in ('publish','unpublish','archive') then
    raise exception 'unsupported_catalog_governance_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'governance_reason_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'super_admin'
      and ur.is_active = true
  ) then
    raise exception 'catalog_governance_not_authorized' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(p_request_id)
  );

  if p_domain = 'food' then
    v_entity_type := 'menu_items';
    select m.business_id,m.category_id,m.title,m.description,m.metadata,m.price,m.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.menu_items m where m.id=p_item_id for update;
  elsif p_domain = 'tours' then
    v_entity_type := 'tours';
    select t.business_id,t.category_id,t.title,t.description,t.metadata,t.price,t.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.tours t where t.id=p_item_id for update;
  elsif p_domain = 'stays' then
    v_entity_type := 'stays';
    select s.business_id,s.category_id,s.title,s.description,s.metadata,s.price_from,s.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.stays s where s.id=p_item_id for update;
  else
    v_entity_type := 'products';
    select p.business_id,p.category_id,p.title,p.description,p.metadata,p.price,p.status
      into v_business_id,v_category_id,v_title,v_description,v_metadata,v_price,v_status
    from public.products p where p.id=p_item_id for update;
  end if;

  if not found then
    raise exception 'catalog_item_not_found' using errcode = 'P0002';
  end if;

  if v_category_id is not null then
    select c.title into v_category_title
    from public.categories c
    where c.id=v_category_id and c.status='active';
  end if;

  v_target_status := case p_action
    when 'publish' then 'active'
    when 'unpublish' then 'approved'
    else 'archived'
  end;
  v_audit_action := 'admin_catalog_' || p_action;

  select al.id,al.action,al.entity_type,al.entity_id,al.reason,
         al.before->>'domain',al.after->>'status'
    into v_existing_audit_id,v_existing_action,v_existing_entity_type,
         v_existing_entity_id,v_existing_reason,v_existing_domain,v_existing_status
  from public.audit_logs al
  where al.actor_id=v_actor and al.request_id=p_request_id
  order by al.created_at asc, al.id asc
  limit 1;

  if v_existing_audit_id is not null then
    if v_existing_action is distinct from v_audit_action
       or v_existing_entity_type is distinct from v_entity_type
       or v_existing_entity_id is distinct from p_item_id
       or v_existing_reason is distinct from v_reason
       or v_existing_domain is distinct from p_domain then
      raise exception 'catalog_governance_idempotency_payload_conflict' using errcode = '23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,
      'status',coalesce(v_existing_status,v_target_status),'idempotent',true
    );
  end if;

  if p_action='publish' and v_status <> 'approved' then
    raise exception 'catalog_publish_requires_approved' using errcode = 'P0001';
  elsif p_action='unpublish' and v_status <> 'active' then
    raise exception 'catalog_unpublish_requires_active' using errcode = 'P0001';
  elsif p_action='archive' and v_status not in ('under_review','approved','rejected','active') then
    raise exception 'catalog_archive_invalid_status' using errcode = 'P0001';
  end if;

  if p_action='publish' then
    if v_category_id is null or v_category_title is null then
      raise exception 'active_category_required_for_publish' using errcode = 'P0001';
    end if;
    if v_price is null or v_price < 0 then
      raise exception 'catalog_price_invalid_for_publish' using errcode = 'P0001';
    end if;

    select p.status,p.business_status into v_partner_status,v_business_status
    from public.partners p where p.id=v_business_id;
    if not found
       or v_partner_status <> 'approved'
       or coalesce(v_business_status,'') in ('inactive','suspended','blocked','disabled') then
      raise exception 'partner_business_not_publishable' using errcode = 'P0001';
    end if;

    v_searchable := pg_catalog.lower(
      coalesce(v_title,'') || ' ' || coalesce(v_description,'') || ' ' ||
      coalesce(v_category_title,'') || ' ' || coalesce(v_metadata::text,'')
    );
    if exists (
      select 1 from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) blocked(keyword)
      where pg_catalog.strpos(v_searchable,blocked.keyword)>0
    ) then
      raise exception 'alcohol_catalog_publish_blocked' using errcode = 'P0001';
    end if;
  end if;

  if p_domain='food' then
    update public.menu_items set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='tours' then
    update public.tours set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='stays' then
    update public.stays set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  else
    update public.products set status=v_target_status,updated_at=pg_catalog.now() where id=p_item_id;
  end if;

  insert into public.audit_logs(
    actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
  ) values (
    v_actor,'super_admin',v_audit_action,v_entity_type,p_item_id,
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',v_status),
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',v_target_status),
    v_reason,p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,
    'status',v_target_status,'idempotent',false
  );
end;
$$;

revoke all on function private.admin_catalog_governance_atomic_internal(uuid,text,text,text,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_catalog_governance_atomic_internal(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_catalog_governance_atomic(
  p_item_id uuid,p_domain text,p_action text,p_request_id text,p_reason text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.admin_catalog_governance_atomic_internal(p_item_id,p_domain,p_action,p_request_id,p_reason);
$$;
revoke all on function public.admin_catalog_governance_atomic(uuid,text,text,text,text) from public,anon;
grant execute on function public.admin_catalog_governance_atomic(uuid,text,text,text,text) to authenticated;

create or replace function private.admin_catalog_category_atomic_internal(
  p_category_id uuid,
  p_action text,
  p_request_id text,
  p_fields jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason,'')),'');
  v_input jsonb := coalesce(p_fields,'{}'::jsonb);
  v_id uuid;
  v_title text;
  v_slug text;
  v_scope text;
  v_parent_id uuid;
  v_sort integer;
  v_status text;
  v_before jsonb;
  v_after jsonb;
  v_audit_action text;
  v_existing_id uuid;
  v_existing_action text;
  v_existing_entity_id uuid;
  v_existing_reason text;
  v_existing_input jsonb;
  v_existing_status text;
  v_parent_scope text;
  v_parent_status text;
  v_searchable text;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  if p_action not in ('create','update','archive') then
    raise exception 'unsupported_category_governance_action' using errcode='22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id))<8 or length(p_request_id)>128 then
    raise exception 'invalid_request_id' using errcode='22023';
  end if;
  if v_reason is null or length(v_reason)<3 or length(v_reason)>500 then
    raise exception 'category_governance_reason_required' using errcode='22023';
  end if;
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id=v_actor and ur.role='super_admin' and ur.is_active=true
  ) then
    raise exception 'category_governance_not_authorized' using errcode='42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),pg_catalog.hashtext(p_request_id)
  );
  v_audit_action := 'admin_category_' || p_action;

  select al.id,al.action,al.entity_id,al.reason,al.after->'input',al.after->>'status'
    into v_existing_id,v_existing_action,v_existing_entity_id,v_existing_reason,v_existing_input,v_existing_status
  from public.audit_logs al
  where al.actor_id=v_actor and al.request_id=p_request_id
  order by al.created_at asc,al.id asc limit 1;

  if v_existing_id is not null then
    if v_existing_action is distinct from v_audit_action
       or v_existing_reason is distinct from v_reason
       or coalesce(v_existing_input,'{}'::jsonb) is distinct from v_input
       or (p_action<>'create' and v_existing_entity_id is distinct from p_category_id) then
      raise exception 'category_governance_idempotency_payload_conflict' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok',true,'category_id',v_existing_entity_id,'action',p_action,
      'status',coalesce(v_existing_status,'active'),'idempotent',true
    );
  end if;

  if p_action in ('create','update') then
    v_title := pg_catalog.btrim(coalesce(v_input->>'title',''));
    v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(v_input->>'slug','')));
    v_scope := pg_catalog.lower(pg_catalog.btrim(coalesce(v_input->>'scope','')));
    if length(v_title)<2 or length(v_title)>120 then raise exception 'category_title_invalid' using errcode='22023'; end if;
    if length(v_slug)<2 or length(v_slug)>120 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'category_slug_invalid' using errcode='22023';
    end if;
    if v_scope not in ('food','tour','stay','shop') then raise exception 'category_scope_invalid' using errcode='22023'; end if;

    if nullif(pg_catalog.btrim(coalesce(v_input->>'sort_order','')),'') is null then
      v_sort := 0;
    elsif (v_input->>'sort_order') !~ '^-?[0-9]+$' then
      raise exception 'category_sort_invalid' using errcode='22023';
    else
      v_sort := (v_input->>'sort_order')::integer;
      if v_sort < -100000 or v_sort > 100000 then raise exception 'category_sort_out_of_range' using errcode='22023'; end if;
    end if;

    if nullif(pg_catalog.btrim(coalesce(v_input->>'parent_id','')),'') is not null then
      if (v_input->>'parent_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'category_parent_invalid' using errcode='22023';
      end if;
      v_parent_id := (v_input->>'parent_id')::uuid;
      select c.scope,c.status into v_parent_scope,v_parent_status from public.categories c where c.id=v_parent_id;
      if not found or v_parent_scope is distinct from v_scope or v_parent_status <> 'active' then
        raise exception 'category_parent_not_available' using errcode='P0001';
      end if;
    end if;

    v_searchable := pg_catalog.lower(v_title || ' ' || v_slug);
    if exists (
      select 1 from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) blocked(keyword)
      where pg_catalog.strpos(v_searchable,blocked.keyword)>0
    ) then
      raise exception 'alcohol_category_write_blocked' using errcode='P0001';
    end if;
  end if;

  if p_action='create' then
    if p_category_id is not null then raise exception 'create_category_id_must_be_null' using errcode='22023'; end if;
    v_id := gen_random_uuid();
    insert into public.categories(id,scope,title,slug,parent_id,sort_order,status,created_at,updated_at)
    values(v_id,v_scope,v_title,v_slug,v_parent_id,v_sort,'active',pg_catalog.now(),pg_catalog.now());
    v_before := pg_catalog.jsonb_build_object('status',null,'input',v_input);
    v_after := pg_catalog.jsonb_build_object('status','active','input',v_input);
  else
    if p_category_id is null then raise exception 'category_id_required' using errcode='22023'; end if;
    select c.status,
           pg_catalog.jsonb_build_object('scope',c.scope,'title',c.title,'slug',c.slug,'parent_id',c.parent_id,'sort_order',c.sort_order,'status',c.status)
      into v_status,v_before
    from public.categories c where c.id=p_category_id for update;
    if not found then raise exception 'category_not_found' using errcode='P0002'; end if;

    if p_action='update' then
      if v_status <> 'active' then raise exception 'category_update_requires_active' using errcode='P0001'; end if;
      if v_parent_id = p_category_id then raise exception 'category_parent_cycle' using errcode='P0001'; end if;
      if v_parent_id is not null and exists (
        with recursive descendants as (
          select c.id from public.categories c where c.parent_id=p_category_id
          union all
          select c.id from public.categories c join descendants d on c.parent_id=d.id
        ) select 1 from descendants where id=v_parent_id
      ) then
        raise exception 'category_parent_cycle' using errcode='P0001';
      end if;
      update public.categories set scope=v_scope,title=v_title,slug=v_slug,parent_id=v_parent_id,
        sort_order=v_sort,updated_at=pg_catalog.now() where id=p_category_id;
      v_id := p_category_id;
      v_after := pg_catalog.jsonb_build_object('scope',v_scope,'title',v_title,'slug',v_slug,'parent_id',v_parent_id,'sort_order',v_sort,'status','active','input',v_input);
    else
      if v_status <> 'active' then raise exception 'category_archive_requires_active' using errcode='P0001'; end if;
      if exists(select 1 from public.menu_items m where m.category_id=p_category_id and m.status<>'archived')
         or exists(select 1 from public.tours t where t.category_id=p_category_id and t.status<>'archived')
         or exists(select 1 from public.stays s where s.category_id=p_category_id and s.status<>'archived')
         or exists(select 1 from public.products p where p.category_id=p_category_id and p.status<>'archived') then
        raise exception 'category_archive_blocked_by_catalog_references' using errcode='P0001';
      end if;
      if exists(select 1 from public.categories c where c.parent_id=p_category_id and c.status='active') then
        raise exception 'category_archive_blocked_by_active_children' using errcode='P0001';
      end if;
      update public.categories set status='archived',updated_at=pg_catalog.now() where id=p_category_id;
      v_id := p_category_id;
      v_after := pg_catalog.jsonb_build_object('status','archived','input',v_input);
    end if;
  end if;

  insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
  values(v_actor,'super_admin',v_audit_action,'categories',v_id,v_before,v_after,v_reason,p_request_id);

  return pg_catalog.jsonb_build_object(
    'ok',true,'category_id',v_id,'action',p_action,
    'status',case when p_action='archive' then 'archived' else 'active' end,'idempotent',false
  );
end;
$$;

revoke all on function private.admin_catalog_category_atomic_internal(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.admin_catalog_category_atomic_internal(uuid,text,text,jsonb,text) to authenticated;

create or replace function public.admin_catalog_category_atomic(
  p_category_id uuid,p_action text,p_request_id text,p_fields jsonb,p_reason text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.admin_catalog_category_atomic_internal(p_category_id,p_action,p_request_id,p_fields,p_reason);
$$;
revoke all on function public.admin_catalog_category_atomic(uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.admin_catalog_category_atomic(uuid,text,text,jsonb,text) to authenticated;

comment on function public.admin_catalog_governance_atomic(uuid,text,text,text,text) is
  'Super-admin catalog lifecycle authority: approved->active publish, active->approved unpublish, controlled archive. Audited, idempotent, alcohol fail-closed.';
comment on function public.admin_catalog_category_atomic(uuid,text,text,jsonb,text) is
  'Super-admin category create/update/archive authority. Active taxonomy only, referenced-category archive protection, audited and alcohol fail-closed.';

commit;
