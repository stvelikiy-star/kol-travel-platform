-- KÖL / kol-travel-platform
-- PARTNER CATALOG CREATE / EDIT / SUBMIT — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Scope:
-- - partner_owner / partner_manager only;
-- - create own-business catalog draft;
-- - edit own draft or rejected item (rejected returns to draft);
-- - submit own draft to under_review;
-- - direct authenticated catalog DML remains revoked; writes are RPC-only;
-- - every committed mutation writes immutable audit evidence;
-- - request ids are actor-scoped, payload-bound and concurrency-serialized;
-- - alcohol-like catalog content is blocked at DB authority across all domains;
-- - no publish/approve/archive, payment, order, booking, delivery or availability truth is mutated.
--
-- Explicitly excluded:
-- - Admin publish/unpublish/archive/category management;
-- - Partner direct active/published/approved status changes;
-- - Stage 21 optional catalog fields;
-- - live/production apply;
-- - alcohol enablement.

begin;

create schema if not exists private;

-- Keep the authority surface single-path. Migration 018 already revoked these;
-- repeat the revoke here so 019 is fail-closed even when reviewed independently.
revoke insert, update, delete on table public.menu_items from anon, authenticated;
revoke insert, update, delete on table public.tours from anon, authenticated;
revoke insert, update, delete on table public.stays from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;

create or replace function private.partner_catalog_write_atomic_internal(
  p_domain text,
  p_action text,
  p_item_id uuid,
  p_request_id text,
  p_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_business_id uuid;
  v_business_status text;
  v_partner_status text;
  v_entity_type text;
  v_audit_action text;
  v_status text;
  v_target_status text;
  v_new_id uuid;
  v_row_business_id uuid;

  v_title text;
  v_description text;
  v_category_id uuid;
  v_category_scope text;
  v_category_title text;
  v_price numeric(12,2);
  v_slug text;
  v_location text;
  v_duration text;
  v_stay_type text;
  v_prep integer;
  v_stock integer;
  v_searchable text;
  v_expected_scope text;

  v_existing_audit_id uuid;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
  v_existing_domain text;
  v_existing_input jsonb;
  v_existing_status text;
  v_input jsonb := coalesce(p_fields, '{}'::jsonb);
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_domain not in ('food', 'tours', 'stays', 'products') then
    raise exception 'unsupported_catalog_domain' using errcode = '22023';
  end if;

  if p_action not in ('create', 'update', 'submit') then
    raise exception 'unsupported_partner_catalog_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  select pp.business_id, ur.role
    into v_business_id, v_actor_role
  from public.partner_profiles as pp
  join public.user_roles as ur
    on ur.user_id = pp.user_id
   and ur.is_active = true
   and ur.role in ('partner_owner', 'partner_manager')
   and (ur.scope_id is null or ur.scope_id = pp.business_id)
  where pp.user_id = v_actor
  order by case ur.role when 'partner_owner' then 0 else 1 end
  limit 1;

  if v_business_id is null then
    raise exception 'partner_catalog_write_not_authorized' using errcode = '42501';
  end if;

  select p.status, p.business_status
    into v_partner_status, v_business_status
  from public.partners as p
  where p.id = v_business_id;

  if not found
     or coalesce(v_partner_status, '') in ('inactive','suspended','blocked','disabled')
     or coalesce(v_business_status, '') in ('inactive','suspended','blocked','disabled') then
    raise exception 'partner_business_not_writable' using errcode = '42501';
  end if;

  v_entity_type := case p_domain
    when 'food' then 'menu_items'
    when 'tours' then 'tours'
    when 'stays' then 'stays'
    else 'products'
  end;
  v_audit_action := 'partner_catalog_' || case p_action
    when 'create' then 'create_draft'
    when 'update' then 'update_draft'
    else 'submit_for_review'
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(p_request_id)
  );

  select
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.after ->> 'domain',
    al.after -> 'input',
    al.after ->> 'status'
  into
    v_existing_audit_id,
    v_existing_action,
    v_existing_entity_type,
    v_existing_entity_id,
    v_existing_domain,
    v_existing_input,
    v_existing_status
  from public.audit_logs as al
  where al.actor_id = v_actor
    and al.request_id = p_request_id
  order by al.created_at asc, al.id asc
  limit 1;

  if v_existing_audit_id is not null then
    if v_existing_action is distinct from v_audit_action
       or v_existing_entity_type is distinct from v_entity_type
       or v_existing_domain is distinct from p_domain
       or (p_action <> 'create' and v_existing_entity_id is distinct from p_item_id)
       or coalesce(v_existing_input, '{}'::jsonb) is distinct from v_input then
      raise exception 'partner_catalog_idempotency_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'item_id', v_existing_entity_id,
      'domain', p_domain,
      'action', p_action,
      'status', v_existing_status,
      'idempotent', true
    );
  end if;

  if p_action in ('create', 'update') then
    v_title := pg_catalog.btrim(coalesce(v_input ->> 'title', ''));
    v_description := nullif(pg_catalog.btrim(coalesce(v_input ->> 'description', '')), '');

    if length(v_title) < 2 or length(v_title) > 160 then
      raise exception 'catalog_title_invalid' using errcode = '22023';
    end if;
    if v_description is not null and length(v_description) > 2000 then
      raise exception 'catalog_description_too_long' using errcode = '22023';
    end if;

    if coalesce(v_input ->> 'category_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'catalog_category_required' using errcode = '22023';
    end if;
    v_category_id := (v_input ->> 'category_id')::uuid;

    v_expected_scope := case p_domain
      when 'food' then 'food'
      when 'tours' then 'tour'
      when 'stays' then 'stay'
      else 'shop'
    end;

    select c.scope, c.title
      into v_category_scope, v_category_title
    from public.categories as c
    where c.id = v_category_id;

    if not found or v_category_scope is distinct from v_expected_scope then
      raise exception 'catalog_category_scope_mismatch' using errcode = '22023';
    end if;

    if coalesce(v_input ->> 'price', '') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'catalog_price_invalid' using errcode = '22023';
    end if;
    v_price := (v_input ->> 'price')::numeric(12,2);
    if v_price < 0 or v_price > 100000000 then
      raise exception 'catalog_price_out_of_range' using errcode = '22023';
    end if;

    if p_domain in ('tours', 'stays') then
      v_slug := pg_catalog.lower(pg_catalog.btrim(coalesce(v_input ->> 'slug', '')));
      v_location := pg_catalog.btrim(coalesce(v_input ->> 'location', ''));
      if length(v_slug) < 3 or length(v_slug) > 120 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
        raise exception 'catalog_slug_invalid' using errcode = '22023';
      end if;
      if length(v_location) < 2 or length(v_location) > 200 then
        raise exception 'catalog_location_invalid' using errcode = '22023';
      end if;
    end if;

    if p_domain = 'tours' then
      v_duration := nullif(pg_catalog.btrim(coalesce(v_input ->> 'duration', '')), '');
      if v_duration is not null and length(v_duration) > 100 then
        raise exception 'tour_duration_invalid' using errcode = '22023';
      end if;
    elsif p_domain = 'stays' then
      v_stay_type := nullif(pg_catalog.btrim(coalesce(v_input ->> 'type', '')), '');
      if v_stay_type is not null and length(v_stay_type) > 100 then
        raise exception 'stay_type_invalid' using errcode = '22023';
      end if;
    elsif p_domain = 'food' then
      if nullif(pg_catalog.btrim(coalesce(v_input ->> 'preparation_time_minutes', '')), '') is not null then
        if (v_input ->> 'preparation_time_minutes') !~ '^[0-9]+$' then
          raise exception 'food_preparation_time_invalid' using errcode = '22023';
        end if;
        v_prep := (v_input ->> 'preparation_time_minutes')::integer;
        if v_prep < 1 or v_prep > 1440 then
          raise exception 'food_preparation_time_out_of_range' using errcode = '22023';
        end if;
      end if;
    else
      if coalesce(v_input ->> 'stock_qty', '') !~ '^[0-9]+$' then
        raise exception 'product_stock_invalid' using errcode = '22023';
      end if;
      v_stock := (v_input ->> 'stock_qty')::integer;
      if v_stock < 0 or v_stock > 1000000 then
        raise exception 'product_stock_out_of_range' using errcode = '22023';
      end if;
    end if;

    v_searchable := pg_catalog.lower(
      coalesce(v_title, '') || ' ' ||
      coalesce(v_description, '') || ' ' ||
      coalesce(v_category_title, '')
    );
    if exists (
      select 1
      from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) as blocked(keyword)
      where pg_catalog.strpos(v_searchable, blocked.keyword) > 0
    ) then
      raise exception 'alcohol_catalog_write_blocked' using errcode = 'P0001';
    end if;
  end if;

  if p_action = 'create' then
    if p_item_id is not null then
      raise exception 'create_item_id_must_be_null' using errcode = '22023';
    end if;

    v_new_id := gen_random_uuid();
    v_target_status := 'draft';

    if p_domain = 'food' then
      insert into public.menu_items (
        id,business_id,category_id,title,description,price,preparation_time_minutes,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_description,v_price,v_prep,'draft','{}'::jsonb
      );
    elsif p_domain = 'tours' then
      insert into public.tours (
        id,business_id,category_id,title,slug,description,location,price,currency,duration,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_slug,v_description,v_location,v_price,'KGS',v_duration,'draft','{}'::jsonb
      );
    elsif p_domain = 'stays' then
      insert into public.stays (
        id,business_id,category_id,title,slug,type,description,location,price_from,currency,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_slug,v_stay_type,v_description,v_location,v_price,'KGS','draft','{}'::jsonb
      );
    else
      insert into public.products (
        id,business_id,category_id,title,description,price,stock_qty,status,metadata
      ) values (
        v_new_id,v_business_id,v_category_id,v_title,v_description,v_price,v_stock,'draft','{}'::jsonb
      );
    end if;

    insert into public.audit_logs (
      actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
    ) values (
      v_actor,v_actor_role,v_audit_action,v_entity_type,v_new_id,
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',null,'input',v_input),
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','draft','input',v_input),
      'Partner catalog draft created',p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok',true,'item_id',v_new_id,'domain',p_domain,'action',p_action,'status','draft','idempotent',false
    );
  end if;

  if p_item_id is null then
    raise exception 'item_id_required' using errcode = '22023';
  end if;

  if p_domain = 'food' then
    select m.business_id,m.status into v_row_business_id,v_status
    from public.menu_items as m where m.id=p_item_id for update;
  elsif p_domain = 'tours' then
    select t.business_id,t.status into v_row_business_id,v_status
    from public.tours as t where t.id=p_item_id for update;
  elsif p_domain = 'stays' then
    select s.business_id,s.status into v_row_business_id,v_status
    from public.stays as s where s.id=p_item_id for update;
  else
    select p.business_id,p.status into v_row_business_id,v_status
    from public.products as p where p.id=p_item_id for update;
  end if;

  if not found then
    raise exception 'catalog_item_not_found' using errcode = 'P0002';
  end if;
  if v_row_business_id is distinct from v_business_id then
    raise exception 'catalog_item_not_owned_by_partner' using errcode = '42501';
  end if;

  if p_action = 'update' then
    if v_status not in ('draft','rejected') then
      raise exception 'catalog_item_not_editable' using errcode = 'P0001';
    end if;
    v_target_status := 'draft';

    if p_domain = 'food' then
      update public.menu_items set
        category_id=v_category_id,title=v_title,description=v_description,price=v_price,
        preparation_time_minutes=v_prep,status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    elsif p_domain = 'tours' then
      update public.tours set
        category_id=v_category_id,title=v_title,slug=v_slug,description=v_description,location=v_location,
        price=v_price,currency='KGS',duration=v_duration,status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    elsif p_domain = 'stays' then
      update public.stays set
        category_id=v_category_id,title=v_title,slug=v_slug,type=v_stay_type,description=v_description,
        location=v_location,price_from=v_price,currency='KGS',status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    else
      update public.products set
        category_id=v_category_id,title=v_title,description=v_description,price=v_price,
        stock_qty=v_stock,status='draft',updated_at=pg_catalog.now()
      where id=p_item_id;
    end if;

    insert into public.audit_logs (
      actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
    ) values (
      v_actor,v_actor_role,v_audit_action,v_entity_type,p_item_id,
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status',v_status),
      pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','draft','input',v_input),
      'Partner catalog draft updated',p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,'status','draft','idempotent',false
    );
  end if;

  if v_status <> 'draft' then
    raise exception 'catalog_item_not_submittable' using errcode = 'P0001';
  end if;

  -- Re-read authoritative row values before review submission. This prevents a
  -- crafted empty submit request from bypassing required fields or alcohol guards.
  if p_domain = 'food' then
    select m.category_id,m.title,m.description,m.price,m.preparation_time_minutes
      into v_category_id,v_title,v_description,v_price,v_prep
    from public.menu_items as m where m.id=p_item_id;
  elsif p_domain = 'tours' then
    select t.category_id,t.title,t.slug,t.description,t.location,t.price,t.duration
      into v_category_id,v_title,v_slug,v_description,v_location,v_price,v_duration
    from public.tours as t where t.id=p_item_id;
  elsif p_domain = 'stays' then
    select s.category_id,s.title,s.slug,s.type,s.description,s.location,s.price_from
      into v_category_id,v_title,v_slug,v_stay_type,v_description,v_location,v_price
    from public.stays as s where s.id=p_item_id;
  else
    select p.category_id,p.title,p.description,p.price,p.stock_qty
      into v_category_id,v_title,v_description,v_price,v_stock
    from public.products as p where p.id=p_item_id;
  end if;

  if v_category_id is null then
    raise exception 'catalog_category_required_for_review' using errcode = 'P0001';
  end if;
  select c.scope,c.title into v_category_scope,v_category_title
  from public.categories as c where c.id=v_category_id;
  v_expected_scope := case p_domain when 'food' then 'food' when 'tours' then 'tour' when 'stays' then 'stay' else 'shop' end;
  if not found or v_category_scope is distinct from v_expected_scope then
    raise exception 'catalog_category_scope_mismatch' using errcode = 'P0001';
  end if;
  if length(pg_catalog.btrim(coalesce(v_title,''))) < 2 or v_price is null or v_price < 0 then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;
  if p_domain in ('tours','stays') and (
    length(coalesce(v_slug,'')) < 3 or length(pg_catalog.btrim(coalesce(v_location,''))) < 2
  ) then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;
  if p_domain='food' and v_prep is not null and (v_prep < 1 or v_prep > 1440) then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;
  if p_domain='products' and (v_stock is null or v_stock < 0) then
    raise exception 'catalog_item_incomplete_for_review' using errcode = 'P0001';
  end if;

  v_searchable := pg_catalog.lower(
    coalesce(v_title,'') || ' ' || coalesce(v_description,'') || ' ' || coalesce(v_category_title,'')
  );
  if exists (
    select 1
    from pg_catalog.unnest(array[
      'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
      'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
    ]::text[]) as blocked(keyword)
    where pg_catalog.strpos(v_searchable, blocked.keyword) > 0
  ) then
    raise exception 'alcohol_catalog_write_blocked' using errcode = 'P0001';
  end if;

  if p_domain='food' then
    update public.menu_items set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='tours' then
    update public.tours set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  elsif p_domain='stays' then
    update public.stays set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  else
    update public.products set status='under_review',updated_at=pg_catalog.now() where id=p_item_id;
  end if;

  insert into public.audit_logs (
    actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id
  ) values (
    v_actor,v_actor_role,v_audit_action,v_entity_type,p_item_id,
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','draft'),
    pg_catalog.jsonb_build_object('domain',p_domain,'business_id',v_business_id,'status','under_review','input',v_input),
    'Partner catalog submitted for review',p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok',true,'item_id',p_item_id,'domain',p_domain,'action',p_action,'status','under_review','idempotent',false
  );
end;
$$;

revoke all on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) from public;
revoke all on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) from anon;
revoke all on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.partner_catalog_write_atomic_internal(text,text,uuid,text,jsonb) to authenticated;

create or replace function public.partner_catalog_write_atomic(
  p_domain text,
  p_action text,
  p_item_id uuid,
  p_request_id text,
  p_fields jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.partner_catalog_write_atomic_internal(
    p_domain,p_action,p_item_id,p_request_id,p_fields
  );
$$;

revoke all on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) from public;
revoke all on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) from anon;
grant execute on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) to authenticated;

comment on function public.partner_catalog_write_atomic(text,text,uuid,text,jsonb) is
  'Partner owner/manager RPC for own-business catalog create draft, edit draft/rejected, and draft -> under_review submission. Payload-bound idempotency, audit evidence, ownership, category scope and alcohol safety are enforced. No publish/approve/payment/order/booking/delivery authority.';

commit;
