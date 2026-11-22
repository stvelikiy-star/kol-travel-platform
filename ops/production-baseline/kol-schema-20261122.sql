


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "private"."ad_payment_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.payment_status='paid' THEN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
    OR NEW.price_kgs IS DISTINCT FROM OLD.price_kgs
    OR NEW.payment_evidence IS DISTINCT FROM OLD.payment_evidence
    OR NEW.paid_marked_by IS DISTINCT FROM OLD.paid_marked_by
    OR NEW.paid_marked_at IS DISTINCT FROM OLD.paid_marked_at THEN
   RAISE EXCEPTION 'paid_ad_financial_identity_immutable' USING ERRCODE='42501';
  END IF;
 END IF;
 IF NEW.payment_status='paid' AND (TG_OP='INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status) THEN
  IF NOT private.can_confirm_content_payment() THEN
   RAISE EXCEPTION 'payment_requires_super_admin' USING ERRCODE='42501';
  END IF;
  IF NEW.payment_evidence IS NULL OR length(btrim(NEW.payment_evidence))<3 THEN
   RAISE EXCEPTION 'payment_evidence_required' USING ERRCODE='23514';
  END IF;
  NEW.paid_marked_by:=auth.uid();NEW.paid_marked_at:=now();
 ELSE
  IF TG_OP='INSERT' THEN
   IF NEW.payment_evidence IS NOT NULL OR NEW.paid_marked_by IS NOT NULL OR NEW.paid_marked_at IS NOT NULL THEN
    RAISE EXCEPTION 'pending_ad_cannot_claim_settlement' USING ERRCODE='42501';
   END IF;
  ELSIF OLD.payment_status='pending' AND NEW.payment_status='pending' THEN
   IF NEW.payment_evidence IS DISTINCT FROM OLD.payment_evidence
      OR NEW.paid_marked_by IS DISTINCT FROM OLD.paid_marked_by
      OR NEW.paid_marked_at IS DISTINCT FROM OLD.paid_marked_at THEN
    RAISE EXCEPTION 'payment_evidence_change_requires_approval' USING ERRCODE='42501';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END; $$;


ALTER FUNCTION "private"."ad_payment_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."admin_catalog_category_atomic_internal"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "private"."admin_catalog_category_atomic_internal"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."admin_catalog_governance_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."admin_catalog_governance_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."admin_catalog_moderation_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_status text;
  v_target_status text;
  v_business_id uuid;
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
  v_existing_audit_action text;
  v_existing_audit_entity_type text;
  v_existing_audit_entity_id uuid;
  v_existing_audit_reason text;
  v_existing_audit_domain text;
  v_existing_audit_status text;
  v_searchable text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_item_id is null then
    raise exception 'item_id_required' using errcode = '22023';
  end if;

  if p_domain not in ('food', 'tours', 'stays', 'products') then
    raise exception 'unsupported_catalog_domain' using errcode = '22023';
  end if;

  if p_action not in ('approve', 'reject') then
    raise exception 'unsupported_catalog_moderation_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is null or length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'moderation_reason_required' using errcode = '22023';
  end if;

  -- The generic app requireAdmin() is broader than catalog write authority.
  -- Until a subrole permission matrix is explicitly approved, only super_admin
  -- may commit moderation decisions.
  if not exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = v_actor
      and ur.role = 'super_admin'
      and ur.is_active = true
  ) then
    raise exception 'catalog_moderation_not_authorized' using errcode = '42501';
  end if;

  -- A moderation request id is actor-scoped authority, not merely a UI token.
  -- Serialize it before catalog row work so concurrent reuse on another entity
  -- cannot commit two distinct decisions under the same request id.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(p_request_id)
  );

  if p_domain = 'food' then
    v_entity_type := 'menu_items';
    select m.business_id, m.category_id, m.title, m.description, m.metadata, m.price, m.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.menu_items as m
    where m.id = p_item_id
    for update;
  elsif p_domain = 'tours' then
    v_entity_type := 'tours';
    select t.business_id, t.category_id, t.title, t.description, t.metadata, t.price, t.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.tours as t
    where t.id = p_item_id
    for update;
  elsif p_domain = 'stays' then
    v_entity_type := 'stays';
    select s.business_id, s.category_id, s.title, s.description, s.metadata, s.price_from, s.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.stays as s
    where s.id = p_item_id
    for update;
  else
    v_entity_type := 'products';
    select p.business_id, p.category_id, p.title, p.description, p.metadata, p.price, p.status
      into v_business_id, v_category_id, v_title, v_description, v_metadata, v_price, v_status
    from public.products as p
    where p.id = p_item_id
    for update;
  end if;

  if not found then
    raise exception 'catalog_item_not_found' using errcode = 'P0002';
  end if;

  if v_category_id is not null then
    select c.title
      into v_category_title
    from public.categories as c
    where c.id = v_category_id;
  end if;

  v_target_status := case p_action
    when 'approve' then 'approved'
    else 'rejected'
  end;
  v_audit_action := 'admin_catalog_' || p_action;

  select
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.reason,
    al.before ->> 'domain',
    al.after ->> 'status'
  into
    v_existing_audit_id,
    v_existing_audit_action,
    v_existing_audit_entity_type,
    v_existing_audit_entity_id,
    v_existing_audit_reason,
    v_existing_audit_domain,
    v_existing_audit_status
  from public.audit_logs as al
  where al.actor_id = v_actor
    and al.request_id = p_request_id
  order by al.created_at asc, al.id asc
  limit 1;

  if v_existing_audit_id is not null then
    if v_existing_audit_action is distinct from v_audit_action
       or v_existing_audit_entity_type is distinct from v_entity_type
       or v_existing_audit_entity_id is distinct from p_item_id
       or v_existing_audit_reason is distinct from v_reason
       or v_existing_audit_domain is distinct from p_domain then
      raise exception 'catalog_moderation_idempotency_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'domain', p_domain,
      'action', p_action,
      'status', coalesce(v_existing_audit_status, v_target_status),
      'idempotent', true
    );
  end if;

  -- A successful replay must always be backed by the matching immutable audit.
  -- Existing target status without that request evidence is not idempotency.
  if v_status <> 'under_review' then
    raise exception 'invalid_catalog_moderation_status_transition' using errcode = 'P0001';
  end if;

  if p_action = 'approve' then
    if v_category_id is null then
      raise exception 'catalog_category_required_for_approval' using errcode = 'P0001';
    end if;

    if v_price is null or v_price < 0 then
      raise exception 'catalog_price_invalid_for_approval' using errcode = 'P0001';
    end if;

    -- Alcohol is disabled for the whole KÖL catalog, not only Shop products.
    -- Keep this guard at DB authority so a crafted RPC call cannot bypass the UI.
    v_searchable := pg_catalog.lower(
      coalesce(v_title, '') || ' ' ||
      coalesce(v_description, '') || ' ' ||
      coalesce(v_category_title, '') || ' ' ||
      coalesce(v_metadata::text, '')
    );

    if exists (
      select 1
      from pg_catalog.unnest(array[
        'alcohol','beer','wine','vodka','whisky','whiskey','champagne','cognac','liquor',
        'спирт','алкоголь','пиво','вино','водка','виски','шампанское','коньяк','арак'
      ]::text[]) as blocked(keyword)
      where pg_catalog.strpos(v_searchable, blocked.keyword) > 0
    ) then
      raise exception 'alcohol_catalog_approval_blocked' using errcode = 'P0001';
    end if;
  end if;

  if p_domain = 'food' then
    update public.menu_items set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  elsif p_domain = 'tours' then
    update public.tours set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  elsif p_domain = 'stays' then
    update public.stays set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  else
    update public.products set status = v_target_status, updated_at = pg_catalog.now() where id = p_item_id;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    'super_admin',
    v_audit_action,
    v_entity_type,
    p_item_id,
    pg_catalog.jsonb_build_object(
      'domain', p_domain,
      'business_id', v_business_id,
      'status', v_status
    ),
    pg_catalog.jsonb_build_object(
      'domain', p_domain,
      'business_id', v_business_id,
      'status', v_target_status
    ),
    v_reason,
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'item_id', p_item_id,
    'domain', p_domain,
    'action', p_action,
    'status', v_target_status,
    'idempotent', false
  );
end;
$$;


ALTER FUNCTION "private"."admin_catalog_moderation_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."admin_delivery_issue_transition_internal"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_issue public.delivery_issues%ROWTYPE;
  v_prior record;
  v_actor_role text;
  v_from_status text;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role('super_admin')
    OR public.has_role('support_admin')
    OR public.has_role('dispatcher')
  ) THEN
    RAISE EXCEPTION 'delivery_issue_admin_access_denied' USING ERRCODE='42501';
  END IF;
  IF p_issue_id IS NULL OR p_to_status NOT IN ('open','in_review','resolved') THEN
    RAISE EXCEPTION 'invalid_delivery_issue_transition' USING ERRCODE='22023';
  END IF;
  IF p_request_id IS NULL OR length(p_request_id) < 8 OR length(p_request_id) > 128
     OR p_request_id !~ '^[A-Za-z0-9_:-]+$' THEN
    RAISE EXCEPTION 'invalid_delivery_issue_request_id' USING ERRCODE='22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 OR length(btrim(p_reason)) > 500 THEN
    RAISE EXCEPTION 'delivery_issue_reason_required' USING ERRCODE='22023';
  END IF;

  -- Prevent concurrent reuse of one idempotency key across different incidents.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':delivery_issue:' || p_request_id, 0)
  );
  SELECT al.entity_id, al.after, al.reason
    INTO v_prior
    FROM public.audit_logs al
    WHERE al.actor_id=v_actor
      AND al.action='admin_delivery_issue_status_changed'
      AND al.request_id=p_request_id
    ORDER BY al.created_at DESC
    LIMIT 1;
  IF FOUND THEN
    IF v_prior.entity_id = p_issue_id AND v_prior.after->>'status' = p_to_status
       AND v_prior.reason = btrim(p_reason) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok',true,'idempotent',true,'issue_id',p_issue_id,'status',p_to_status
      );
    END IF;
    RAISE EXCEPTION 'delivery_issue_request_id_conflict' USING ERRCODE='23505';
  END IF;

  SELECT * INTO v_issue FROM public.delivery_issues WHERE id=p_issue_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery_issue_not_found' USING ERRCODE='P0002';
  END IF;
  v_from_status := v_issue.status;
  IF NOT (
    (v_from_status='open' AND p_to_status IN ('in_review','resolved'))
    OR (v_from_status='in_review' AND p_to_status IN ('open','resolved'))
    OR (v_from_status='resolved' AND p_to_status='open')
  ) THEN
    RAISE EXCEPTION 'invalid_delivery_issue_status_change' USING ERRCODE='22023';
  END IF;

  UPDATE public.delivery_issues
    SET status=p_to_status,updated_at=pg_catalog.clock_timestamp()
    WHERE id=p_issue_id;
  v_actor_role := CASE
    WHEN public.has_role('super_admin') THEN 'super_admin'
    WHEN public.has_role('support_admin') THEN 'support_admin'
    ELSE 'dispatcher' END;
  INSERT INTO public.audit_logs (
    actor_id,actor_role,action,entity_type,entity_id,
    "before","after",reason,request_id
  ) VALUES (
    v_actor,v_actor_role,'admin_delivery_issue_status_changed','delivery_issue',p_issue_id,
    pg_catalog.jsonb_build_object('status',v_from_status),
    pg_catalog.jsonb_build_object('status',p_to_status),
    btrim(p_reason),p_request_id
  );
  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'idempotent',false,'issue_id',p_issue_id,'status',p_to_status
  );
END $_$;


ALTER FUNCTION "private"."admin_delivery_issue_transition_internal"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."admin_support_lifecycle_atomic_internal"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_action text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_action, '')));
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_status text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, '')));
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_current_status text;
  v_audit_action text;
  v_existing_after jsonb;
  v_existing_entity uuid;
  v_message_id uuid;
  v_message_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_message, '')));
  v_reason_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_reason, '')));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select ur.role
    into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor
    and ur.is_active = true
    and ur.role in ('support_admin','super_admin')
  order by case ur.role when 'super_admin' then 1 else 2 end
  limit 1;

  if v_actor_role is null then
    raise exception 'admin_support_not_authorized' using errcode = '42501';
  end if;

  if p_ticket_id is null then
    raise exception 'invalid_support_ticket_id' using errcode = '22023';
  end if;
  if v_action not in ('reply','status') then
    raise exception 'invalid_support_admin_action' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_action = 'reply' then
    if length(v_message) < 3 or length(v_message) > 4000 then
      raise exception 'invalid_support_reply' using errcode = '22023';
    end if;
    if v_status <> '' or v_reason <> '' then
      raise exception 'support_reply_payload_ambiguous' using errcode = '22023';
    end if;
    v_audit_action := 'admin_support_reply';
  else
    if v_status not in ('in_progress','resolved','closed') then
      raise exception 'invalid_support_status' using errcode = '22023';
    end if;
    if length(v_reason) < 3 or length(v_reason) > 500 then
      raise exception 'support_status_reason_required' using errcode = '22023';
    end if;
    if v_message <> '' then
      raise exception 'support_status_payload_ambiguous' using errcode = '22023';
    end if;
    v_audit_action := 'admin_support_status_changed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.entity_id, al.after
    into v_existing_entity, v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = v_audit_action
    and al.entity_type = 'support_tickets'
    and al.request_id = v_request_id
  limit 1;

  if v_existing_entity is not null then
    if v_existing_entity <> p_ticket_id
       or coalesce(v_existing_after ->> 'action', '') <> v_action then
      raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
    end if;

    if v_action = 'reply' then
      if coalesce(v_existing_after ->> 'message_md5', '') <> v_message_md5
         or coalesce(v_existing_after ->> 'message_length', '') <> length(v_message)::text then
        raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
      end if;
    else
      if coalesce(v_existing_after ->> 'status', '') <> v_status
         or coalesce(v_existing_after ->> 'reason_md5', '') <> v_reason_md5
         or coalesce(v_existing_after ->> 'reason_length', '') <> length(v_reason)::text then
        raise exception 'admin_support_request_id_payload_conflict' using errcode = '23505';
      end if;
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', v_existing_entity,
      'status', coalesce(v_existing_after ->> 'status', ''),
      'message_id', nullif(v_existing_after ->> 'message_id', '')::uuid,
      'idempotent', true
    );
  end if;

  select st.status
    into v_current_status
  from public.support_tickets st
  where st.id = p_ticket_id
  for update;

  if v_current_status is null then
    raise exception 'support_ticket_not_found' using errcode = 'P0002';
  end if;

  if v_action = 'reply' then
    if v_current_status = 'closed' then
      raise exception 'closed_support_ticket_is_immutable' using errcode = '22023';
    end if;

    insert into public.ticket_messages (
      ticket_id,
      sender_id,
      message,
      visibility
    ) values (
      p_ticket_id,
      v_actor,
      v_message,
      'public'
    ) returning id into v_message_id;

    update public.support_tickets
    set updated_at = pg_catalog.now()
    where id = p_ticket_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_actor,
      v_actor_role,
      v_audit_action,
      'support_tickets',
      p_ticket_id,
      pg_catalog.jsonb_build_object('status', v_current_status),
      pg_catalog.jsonb_build_object(
        'action', 'reply',
        'status', v_current_status,
        'message_id', v_message_id,
        'message_md5', v_message_md5,
        'message_length', length(v_message)
      ),
      'Support administrator public reply created atomically.',
      v_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', p_ticket_id,
      'status', v_current_status,
      'message_id', v_message_id,
      'idempotent', false
    );
  end if;

  if v_current_status = 'closed' then
    raise exception 'closed_support_ticket_is_immutable' using errcode = '22023';
  end if;

  if not (
    (v_current_status = 'open' and v_status = 'in_progress')
    or (v_current_status = 'in_progress' and v_status = 'resolved')
    or (v_current_status = 'resolved' and v_status = 'closed')
  ) then
    raise exception 'invalid_support_status_transition' using errcode = '22023';
  end if;

  update public.support_tickets
  set status = v_status,
      updated_at = pg_catalog.now()
  where id = p_ticket_id;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_actor,
    v_actor_role,
    v_audit_action,
    'support_tickets',
    p_ticket_id,
    pg_catalog.jsonb_build_object('status', v_current_status),
    pg_catalog.jsonb_build_object(
      'action', 'status',
      'status', v_status,
      'previous_status', v_current_status,
      'reason_md5', v_reason_md5,
      'reason_length', length(v_reason)
    ),
    v_reason,
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ticket_id', p_ticket_id,
    'status', v_status,
    'message_id', null,
    'idempotent', false
  );
end;
$$;


ALTER FUNCTION "private"."admin_support_lifecycle_atomic_internal"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."assert_courier_profile_delivery_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_status text;
begin
  if tg_op = 'DELETE' then
    v_user_id := old.user_id;
    v_status := null;
  else
    v_user_id := new.user_id;
    v_status := new.availability_status;
  end if;

  if exists (
    select 1
    from public.deliveries d
    where d.assigned_courier_id = v_user_id
      and d.status in (
        'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
        'picked_up','courier_to_client','arrived_at_client'
      )
  ) then
    if tg_op = 'DELETE' then
      raise exception 'cannot_delete_courier_profile_with_active_delivery';
    end if;

    if v_status <> 'busy' then
      raise exception 'courier_with_active_delivery_must_be_busy';
    end if;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "private"."assert_courier_profile_delivery_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."assert_delivery_assignment_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_delivery_id uuid;
  v_status text;
  v_assigned_courier uuid;
  v_active_count integer;
  v_active_courier uuid;
  v_profile_status text;
begin
  if tg_table_name = 'deliveries' then
    if tg_op = 'DELETE' then
      v_delivery_id := old.id;
    else
      v_delivery_id := new.id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_delivery_id := old.delivery_id;
    else
      v_delivery_id := new.delivery_id;
    end if;
  end if;

  select d.status, d.assigned_courier_id
    into v_status, v_assigned_courier
  from public.deliveries d
  where d.id = v_delivery_id;

  -- Delivery may have been deleted with assignments cascading away.
  if not found then
    return null;
  end if;

  select count(*)::integer,
         max(ca.courier_id::text)::uuid
    into v_active_count, v_active_courier
  from public.courier_assignments ca
  where ca.delivery_id = v_delivery_id
    and ca.status in ('assigned','accepted','in_progress');

  if v_status in (
    'courier_assigned','courier_accepted','courier_to_partner','arrived_at_partner',
    'picked_up','courier_to_client','arrived_at_client'
  ) then
    if v_assigned_courier is null then
      raise exception 'active_delivery_missing_assigned_courier';
    end if;

    if v_active_count <> 1 or v_active_courier is distinct from v_assigned_courier then
      raise exception 'active_delivery_assignment_mismatch';
    end if;

    if not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = v_assigned_courier
        and ur.role = 'courier'
        and ur.is_active = true
    ) then
      raise exception 'active_delivery_courier_role_missing';
    end if;

    select cp.availability_status
      into v_profile_status
    from public.courier_profiles cp
    where cp.user_id = v_assigned_courier;

    if v_profile_status is null then
      raise exception 'active_delivery_courier_profile_missing';
    end if;

    if v_profile_status <> 'busy' then
      raise exception 'active_delivery_courier_not_busy';
    end if;
  elsif v_status in ('delivery_pending','courier_searching') then
    if v_active_count <> 0 then
      raise exception 'pending_delivery_has_active_assignment';
    end if;
  elsif v_status in ('delivered','delivery_failed') then
    if v_active_count <> 0 then
      raise exception 'terminal_delivery_has_active_assignment';
    end if;
  else
    raise exception 'unknown_delivery_status_consistency_check';
  end if;

  return null;
end;
$$;


ALTER FUNCTION "private"."assert_delivery_assignment_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."assign_courier_atomic_v1"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries%rowtype;
  v_existing_courier uuid;
  v_courier_status text;
  v_assignment_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.has_role('dispatcher') or public.has_role('super_admin')) then
    raise exception 'dispatcher_role_required' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_courier_id is null then
    raise exception 'delivery_and_courier_required' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select d.* into v_delivery
  from public.deliveries as d
  where d.id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  if v_delivery.status in ('courier_accepted','courier_to_partner','arrived_at_partner','picked_up','courier_to_client','arrived_at_client','delivered','delivery_failed') then
    raise exception 'high_risk_reassignment_required' using errcode = 'P0001';
  end if;

  select cp.availability_status into v_courier_status
  from public.courier_profiles as cp
  where cp.user_id = p_courier_id
  for update;

  if v_courier_status is null then
    raise exception 'courier_profile_not_found' using errcode = 'P0001';
  end if;

  if p_courier_id = v_delivery.assigned_courier_id
     and v_delivery.status = 'courier_assigned' then
    select ca.id into v_assignment_id
    from public.courier_assignments as ca
    where ca.delivery_id = p_delivery_id
      and ca.courier_id = p_courier_id
      and ca.status in ('assigned','accepted','in_progress')
    order by ca.created_at desc
    limit 1;

    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'delivery_id',p_delivery_id,
      'courier_id',p_courier_id,
      'assignment_id',v_assignment_id,
      'status','courier_assigned'
    );
  end if;

  if v_courier_status <> 'online' then
    raise exception 'courier_not_available' using errcode = 'P0001';
  end if;

  v_existing_courier := v_delivery.assigned_courier_id;

  update public.courier_assignments
  set status = 'reassigned', updated_at = now()
  where delivery_id = p_delivery_id
    and status in ('assigned','accepted','in_progress');

  insert into public.courier_assignments (
    delivery_id,
    courier_id,
    status,
    assigned_by
  ) values (
    p_delivery_id,
    p_courier_id,
    'assigned',
    v_actor
  )
  returning id into v_assignment_id;

  update public.deliveries
  set assigned_courier_id = p_courier_id,
      status = 'courier_assigned',
      updated_at = now()
  where id = p_delivery_id;

  update public.courier_profiles
  set availability_status = 'busy', updated_at = now()
  where user_id = p_courier_id;

  if v_existing_courier is not null and v_existing_courier <> p_courier_id then
    update public.courier_profiles cp
    set availability_status = 'online', updated_at = now()
    where cp.user_id = v_existing_courier
      and not exists (
        select 1
        from public.deliveries d2
        where d2.assigned_courier_id = v_existing_courier
          and d2.id <> p_delivery_id
          and d2.status not in ('delivered','delivery_failed')
      );
  end if;

  insert into public.delivery_status_history (
    delivery_id, from_status, to_status, changed_by, reason
  ) values (
    p_delivery_id,
    v_delivery.status,
    'courier_assigned',
    v_actor,
    coalesce(nullif(btrim(p_reason),''),'dispatcher_assignment')
  );

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor,
    'dispatcher',
    'assign_courier',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('assigned_courier_id',v_existing_courier,'status',v_delivery.status),
    jsonb_build_object('assigned_courier_id',p_courier_id,'status','courier_assigned','assignment_id',v_assignment_id),
    coalesce(nullif(btrim(p_reason),''),'Courier assigned by dispatcher.'),
    'delivery-assignment-' || v_assignment_id::text
  );

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'delivery_id',p_delivery_id,
    'courier_id',p_courier_id,
    'assignment_id',v_assignment_id,
    'status','courier_assigned'
  );
end;
$$;


ALTER FUNCTION "private"."assign_courier_atomic_v1"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_confirm_content_payment"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.user_profiles p ON p.user_id=r.user_id
 WHERE r.user_id=auth.uid() AND r.is_active AND p.status='active'
   AND r.role IN ('super_admin','content_manager')) $$;


ALTER FUNCTION "private"."can_confirm_content_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."can_manage_content"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 SELECT EXISTS(SELECT 1 FROM public.user_roles r JOIN public.user_profiles p ON p.user_id=r.user_id
 WHERE r.user_id=auth.uid() AND r.is_active AND p.status='active'
 AND r.role IN ('super_admin','content_manager')) $$;


ALTER FUNCTION "private"."can_manage_content"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."catalog_media_owner_business"("p_owner_type" "text", "p_owner_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_business_id uuid;
begin
  case p_owner_type
    when 'menu_item' then
      select m.business_id into v_business_id
      from public.menu_items as m where m.id = p_owner_id;
    when 'product' then
      select p.business_id into v_business_id
      from public.products as p where p.id = p_owner_id;
    when 'tour' then
      select t.business_id into v_business_id
      from public.tours as t where t.id = p_owner_id;
    when 'stay' then
      select s.business_id into v_business_id
      from public.stays as s where s.id = p_owner_id;
    else
      return null;
  end case;

  return v_business_id;
end;
$$;


ALTER FUNCTION "private"."catalog_media_owner_business"("p_owner_type" "text", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."catalog_media_owner_is_public"("p_owner_type" "text", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_business_id uuid;
  v_visible boolean := false;
begin
  v_business_id := private.catalog_media_owner_business(p_owner_type, p_owner_id);
  if v_business_id is null then
    return false;
  end if;

  case p_owner_type
    when 'menu_item' then
      select exists(
        select 1 from public.menu_items m
        where m.id = p_owner_id
          and m.business_id = v_business_id
          and m.status = 'active'
      ) into v_visible;
    when 'product' then
      select exists(
        select 1 from public.products p
        where p.id = p_owner_id
          and p.business_id = v_business_id
          and p.status = 'active'
      ) into v_visible;
    when 'tour' then
      select exists(
        select 1 from public.tours t
        where t.id = p_owner_id
          and t.business_id = v_business_id
          and t.status = 'active'
      ) into v_visible;
    when 'stay' then
      select exists(
        select 1 from public.stays s
        where s.id = p_owner_id
          and s.business_id = v_business_id
          and s.status = 'active'
      ) into v_visible;
    else
      return false;
  end case;

  if not v_visible then
    return false;
  end if;

  return exists(
    select 1 from public.partners p
    where p.id = v_business_id and p.status = 'approved'
  );
end;
$$;


ALTER FUNCTION "private"."catalog_media_owner_is_public"("p_owner_type" "text", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."catalog_media_partner_can_manage"("p_path" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_folders text[];
  v_business_id uuid;
  v_owner_id uuid;
  v_owner_type text;
begin
  if v_user_id is null or p_path is null then
    return false;
  end if;

  v_folders := storage.foldername(p_path);
  if pg_catalog.array_length(v_folders, 1) <> 3 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  v_business_id := v_folders[1]::uuid;
  v_owner_type := v_folders[2];
  v_owner_id := v_folders[3]::uuid;

  if private.catalog_media_owner_business(v_owner_type, v_owner_id) is distinct from v_business_id then
    return false;
  end if;

  return exists(
    select 1 from public.partner_staff ps
    where ps.business_id = v_business_id
      and ps.user_id = v_user_id
      and ps.is_active = true
  ) or exists(
    select 1 from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'super_admin'
      and ur.is_active = true
  );
end;
$_$;


ALTER FUNCTION "private"."catalog_media_partner_can_manage"("p_path" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."catalog_media_path_matches"("p_path" "text", "p_owner_type" "text", "p_owner_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_folders text[];
  v_business_id uuid;
begin
  if p_path is null or p_owner_type is null or p_owner_id is null then
    return false;
  end if;

  v_folders := storage.foldername(p_path);
  if pg_catalog.array_length(v_folders, 1) <> 3 then
    return false;
  end if;

  if v_folders[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_folders[3] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if v_folders[2] <> p_owner_type or v_folders[3]::uuid <> p_owner_id then
    return false;
  end if;

  v_business_id := private.catalog_media_owner_business(p_owner_type, p_owner_id);
  return v_business_id is not null and v_folders[1]::uuid = v_business_id;
end;
$_$;


ALTER FUNCTION "private"."catalog_media_path_matches"("p_path" "text", "p_owner_type" "text", "p_owner_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."client_onboarding_complete_atomic_internal"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  v_phone text := nullif(pg_catalog.btrim(coalesce(p_phone, '')), '');
  v_locale text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_locale, 'ru')));
  v_default_address text := nullif(pg_catalog.btrim(coalesce(p_default_address, '')), '');
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_email text;
  v_profile_id uuid;
  v_user_profile_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if v_full_name is null or length(v_full_name) < 2 or length(v_full_name) > 120 then
    raise exception 'invalid_client_full_name' using errcode = '22023';
  end if;
  if v_phone is null or length(v_phone) < 5 or length(v_phone) > 40 then
    raise exception 'invalid_client_phone' using errcode = '22023';
  end if;
  if v_locale not in ('ru', 'kg', 'en') then
    raise exception 'invalid_client_locale' using errcode = '22023';
  end if;
  if length(v_default_address) > 500 then
    raise exception 'invalid_client_default_address' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  -- Serialize profile creation and role checks for the authenticated identity.
  -- Self-service onboarding must never reactivate a disabled account or role.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('client_onboarding'), pg_catalog.hashtext(v_actor::text));
  if not exists (select 1 from auth.users where id = v_actor and email_confirmed_at is not null) then
    raise exception 'verified_email_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_profiles where user_id = v_actor and status <> 'active')
    or exists (select 1 from public.user_roles where user_id = v_actor and role = 'client' and is_active = false) then
    raise exception 'client_account_disabled' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id = v_actor and is_active = true and role <> 'client'
  ) then
    raise exception 'client_role_scope_conflict' using errcode = '42501';
  end if;

  select au.email into v_email from auth.users au where au.id = v_actor;

  select al.entity_id into v_profile_id
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_onboarding_completed'
    and al.request_id = v_request_id
  limit 1;

  if v_profile_id is not null then
    return pg_catalog.jsonb_build_object('ok', true, 'user_id', v_actor, 'idempotent', true);
  end if;

  insert into public.user_profiles (user_id, full_name, phone, email, locale, preferred_contact, status)
  values (v_actor, v_full_name, v_phone, v_email, v_locale, 'phone', 'active')
  on conflict (user_id) do update
    set full_name = coalesce(nullif(public.user_profiles.full_name, ''), excluded.full_name),
        phone = coalesce(nullif(public.user_profiles.phone, ''), excluded.phone),
        email = coalesce(nullif(public.user_profiles.email, ''), excluded.email),
        locale = coalesce(public.user_profiles.locale, excluded.locale),
        updated_at = pg_catalog.now();

  select up.id into v_user_profile_id from public.user_profiles up where up.user_id = v_actor;

  if not exists (select 1 from public.user_roles where user_id = v_actor and role = 'client') then
    insert into public.user_roles (user_id, role, is_active) values (v_actor, 'client', true);
  else
    update public.user_roles set is_active = true, updated_at = pg_catalog.now()
    where user_id = v_actor and role = 'client';
  end if;

  insert into public.client_profiles (user_id, default_address)
  values (v_actor, v_default_address)
  on conflict (user_id) do update
    set default_address = coalesce(public.client_profiles.default_address, excluded.default_address),
        updated_at = pg_catalog.now();

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor, 'client', 'client_onboarding_completed', 'user_profiles', v_user_profile_id,
    '{}'::jsonb,
    pg_catalog.jsonb_build_object('full_name_length', length(v_full_name), 'phone_length', length(v_phone), 'locale', v_locale),
    'Client profile created after verified passwordless Auth session.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object('ok', true, 'user_id', v_actor, 'idempotent', false);
end;
$$;


ALTER FUNCTION "private"."client_onboarding_complete_atomic_internal"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."client_profile_update_atomic_internal"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_full_name text := nullif(pg_catalog.btrim(coalesce(p_full_name, '')), '');
  v_locale text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_locale, '')));
  v_default_address text := nullif(pg_catalog.btrim(coalesce(p_default_address, '')), '');
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_profile_id uuid;
  v_old_full_name text;
  v_old_locale text;
  v_old_address text;
  v_existing_after jsonb;
  v_name_md5 text := pg_catalog.md5(coalesce(nullif(pg_catalog.btrim(coalesce(p_full_name, '')), ''), ''));
  v_address_md5 text := pg_catalog.md5(coalesce(nullif(pg_catalog.btrim(coalesce(p_default_address, '')), ''), ''));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_profile_not_authorized' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.user_profiles up
    where up.user_id = v_actor and up.status = 'active'
  ) then
    raise exception 'client_profile_inactive' using errcode = '42501';
  end if;

  if v_full_name is not null and (length(v_full_name) < 2 or length(v_full_name) > 120) then
    raise exception 'invalid_client_full_name' using errcode = '22023';
  end if;
  if v_locale not in ('ru','kg','en') then
    raise exception 'invalid_client_locale' using errcode = '22023';
  end if;
  if v_default_address is not null and length(v_default_address) > 500 then
    raise exception 'invalid_client_default_address' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.after
    into v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_profile_updated'
    and al.entity_type = 'user_profiles'
    and al.request_id = v_request_id
  limit 1;

  if v_existing_after is not null then
    if coalesce(v_existing_after ->> 'full_name_md5', '') <> v_name_md5
       or coalesce(v_existing_after ->> 'full_name_length', '') <> coalesce(length(v_full_name)::text, '0')
       or coalesce(v_existing_after ->> 'locale', '') <> v_locale
       or coalesce(v_existing_after ->> 'default_address_md5', '') <> v_address_md5
       or coalesce(v_existing_after ->> 'default_address_length', '') <> coalesce(length(v_default_address)::text, '0') then
      raise exception 'client_profile_request_id_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'user_id', v_actor,
      'locale', v_locale,
      'idempotent', true
    );
  end if;

  select up.id, up.full_name, up.locale
    into v_profile_id, v_old_full_name, v_old_locale
  from public.user_profiles up
  where up.user_id = v_actor
  for update;

  if v_profile_id is null then
    raise exception 'client_profile_not_found' using errcode = 'P0002';
  end if;

  select cp.default_address
    into v_old_address
  from public.client_profiles cp
  where cp.user_id = v_actor
  for update;

  if not found then
    raise exception 'client_profile_not_found' using errcode = 'P0002';
  end if;

  update public.user_profiles
  set full_name = v_full_name,
      locale = v_locale,
      updated_at = pg_catalog.now()
  where user_id = v_actor;

  update public.client_profiles
  set default_address = v_default_address,
      updated_at = pg_catalog.now()
  where user_id = v_actor;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_actor,
    'client',
    'client_profile_updated',
    'user_profiles',
    v_profile_id,
    pg_catalog.jsonb_build_object(
      'full_name_md5', pg_catalog.md5(coalesce(v_old_full_name, '')),
      'full_name_length', coalesce(length(v_old_full_name), 0),
      'locale', coalesce(v_old_locale, ''),
      'default_address_md5', pg_catalog.md5(coalesce(v_old_address, '')),
      'default_address_length', coalesce(length(v_old_address), 0)
    ),
    pg_catalog.jsonb_build_object(
      'full_name_md5', v_name_md5,
      'full_name_length', coalesce(length(v_full_name), 0),
      'locale', v_locale,
      'default_address_md5', v_address_md5,
      'default_address_length', coalesce(length(v_default_address), 0)
    ),
    'Client updated allowlisted own profile fields atomically.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'user_id', v_actor,
    'locale', v_locale,
    'idempotent', false
  );
end;
$$;


ALTER FUNCTION "private"."client_profile_update_atomic_internal"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."client_stay_booking_create_atomic_internal"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
 v_actor uuid:=auth.uid(); v_business uuid; v_stay uuid; v_capacity integer; v_price numeric;
 v_days integer; v_total numeric:=0; v_date date; v_avail integer; v_status text; v_override numeric;
 v_booking uuid; v_existing uuid; v_existing_after jsonb; v_req text:=pg_catalog.btrim(coalesce(p_request_id,''));
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 if not exists(select 1 from public.user_roles where user_id=v_actor and role='client' and is_active=true) then raise exception 'client_role_required' using errcode='42501'; end if;
 if p_room_id is null or p_start_date is null or p_end_date is null or p_end_date<=p_start_date then raise exception 'invalid_booking_dates' using errcode='22023'; end if;
 if p_start_date<current_date or p_end_date>current_date+365 then raise exception 'booking_dates_out_of_range' using errcode='22023'; end if;
 if p_guests<1 or p_guests>20 then raise exception 'invalid_guests' using errcode='22023'; end if;
 if length(v_req)<8 or length(v_req)>128 then raise exception 'invalid_request_id' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_room_id::text),pg_catalog.hashtext(p_start_date::text||':'||p_end_date::text));
 select entity_id,after into v_existing,v_existing_after from public.audit_logs where actor_id=v_actor and action='client_booking_created' and request_id=v_req limit 1;
 if v_existing is not null then
  if coalesce(v_existing_after->>'room_id','')<>p_room_id::text or coalesce(v_existing_after->>'start_date','')<>p_start_date::text or coalesce(v_existing_after->>'end_date','')<>p_end_date::text or coalesce(v_existing_after->>'guests','')<>p_guests::text then raise exception 'booking_request_id_payload_conflict' using errcode='23505'; end if;
  return jsonb_build_object('ok',true,'booking_id',v_existing,'idempotent',true,'total',coalesce((v_existing_after->>'total')::numeric,0));
 end if;
 select r.business_id,r.stay_id,r.capacity,r.price_per_night into v_business,v_stay,v_capacity,v_price from public.rooms r join public.stays s on s.id=r.stay_id join public.partners p on p.id=r.business_id where r.id=p_room_id and r.status='active' and s.status in('active','published') and p.status='approved' and p.business_status='online' for update of r;
 if v_business is null then raise exception 'room_not_bookable' using errcode='22023'; end if;
 if p_guests>v_capacity then raise exception 'room_capacity_exceeded' using errcode='22023'; end if;
 v_days:=p_end_date-p_start_date;
 for v_date in select generate_series(p_start_date,p_end_date-1,interval '1 day')::date loop
  select ra.status,ra.available_count,ra.price_override into v_status,v_avail,v_override from public.room_availability ra where ra.room_id=p_room_id and ra.date=v_date for update;
  if found then
   if v_status<>'available' or v_avail<1 then raise exception 'room_unavailable' using errcode='P0001'; end if;
   v_total:=v_total+coalesce(v_override,v_price);
  else
   -- Commercial inventory must be explicitly published; absent day is NOT available.
   raise exception 'stay_inventory_not_initialized' using errcode='P0001';
  end if;
 end loop;
 insert into public.bookings(client_id,business_id,booking_type,object_id,status,start_date,end_date,guests_count,total,payment_status,metadata)
 values(v_actor,v_business,'stay',p_room_id,'pending',p_start_date,p_end_date,p_guests,v_total,'pending',jsonb_build_object('stay_id',v_stay,'request_id',v_req,'inventory_reserved',true)) returning id into v_booking;
 for v_date in select generate_series(p_start_date,p_end_date-1,interval '1 day')::date loop
  insert into public.room_availability(room_id,date,status,available_count)
  values(p_room_id,v_date,'booked',0)
  on conflict(room_id,date) do update set available_count=greatest(public.room_availability.available_count-1,0),status=case when public.room_availability.available_count-1<=0 then 'booked' else 'available' end,updated_at=now();
 end loop;
 insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,'client','client_booking_created','bookings',v_booking,null,jsonb_build_object('room_id',p_room_id,'stay_id',v_stay,'start_date',p_start_date,'end_date',p_end_date,'guests',p_guests,'total',v_total,'days',v_days),'Client stay booking created atomically.',v_req);
 return jsonb_build_object('ok',true,'booking_id',v_booking,'idempotent',false,'total',v_total);
end $$;


ALTER FUNCTION "private"."client_stay_booking_create_atomic_internal"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."client_support_ticket_create_atomic_internal"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid" DEFAULT NULL::"uuid", "p_related_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_category text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_category, '')));
  v_title text := pg_catalog.btrim(coalesce(p_title, ''));
  v_message text := pg_catalog.btrim(coalesce(p_message, ''));
  v_request_id text := pg_catalog.btrim(coalesce(p_request_id, ''));
  v_ticket_id uuid;
  v_existing_after jsonb;
  v_message_md5 text := pg_catalog.md5(pg_catalog.btrim(coalesce(p_message, '')));
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_actor
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_support_not_authorized' using errcode = '42501';
  end if;

  if v_category !~ '^[a-z][a-z0-9_]{1,31}$' then
    raise exception 'invalid_support_category' using errcode = '22023';
  end if;
  if length(v_title) < 3 or length(v_title) > 160 then
    raise exception 'invalid_support_title' using errcode = '22023';
  end if;
  if length(v_message) < 3 or length(v_message) > 4000 then
    raise exception 'invalid_support_message' using errcode = '22023';
  end if;
  if length(v_request_id) < 8 or length(v_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if p_related_order_id is not null and p_related_booking_id is not null then
    raise exception 'support_reference_ambiguous' using errcode = '22023';
  end if;

  if p_related_order_id is not null and not exists (
    select 1 from public.orders o
    where o.id = p_related_order_id and o.client_id = v_actor
  ) then
    raise exception 'support_order_not_available' using errcode = '42501';
  end if;

  if p_related_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_related_booking_id and b.client_id = v_actor
  ) then
    raise exception 'support_booking_not_available' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text),
    pg_catalog.hashtext(v_request_id)
  );

  select al.entity_id, al.after
    into v_ticket_id, v_existing_after
  from public.audit_logs al
  where al.actor_id = v_actor
    and al.action = 'client_support_ticket_created'
    and al.entity_type = 'support_tickets'
    and al.request_id = v_request_id
  limit 1;

  if v_ticket_id is not null then
    if coalesce(v_existing_after ->> 'category', '') <> v_category
       or coalesce(v_existing_after ->> 'title', '') <> v_title
       or coalesce(v_existing_after ->> 'message_md5', '') <> v_message_md5
       or coalesce(v_existing_after ->> 'message_length', '') <> length(v_message)::text
       or coalesce(v_existing_after ->> 'related_order_id', '') <> coalesce(p_related_order_id::text, '')
       or coalesce(v_existing_after ->> 'related_booking_id', '') <> coalesce(p_related_booking_id::text, '') then
      raise exception 'support_request_id_payload_conflict' using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'ticket_id', v_ticket_id,
      'status', coalesce(v_existing_after ->> 'status', 'open'),
      'idempotent', true
    );
  end if;

  insert into public.support_tickets (
    created_by,
    related_order_id,
    related_booking_id,
    category,
    priority,
    status,
    title
  ) values (
    v_actor,
    p_related_order_id,
    p_related_booking_id,
    v_category,
    'medium',
    'open',
    v_title
  ) returning id into v_ticket_id;

  insert into public.ticket_messages (
    ticket_id,
    sender_id,
    message,
    visibility
  ) values (
    v_ticket_id,
    v_actor,
    v_message,
    'public'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    'client',
    'client_support_ticket_created',
    'support_tickets',
    v_ticket_id,
    null,
    pg_catalog.jsonb_build_object(
      'category', v_category,
      'title', v_title,
      'message_md5', v_message_md5,
      'message_length', length(v_message),
      'related_order_id', p_related_order_id,
      'related_booking_id', p_related_booking_id,
      'priority', 'medium',
      'status', 'open'
    ),
    'Client support ticket and initial message created atomically.',
    v_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'ticket_id', v_ticket_id,
    'status', 'open',
    'idempotent', false
  );
end;
$_$;


ALTER FUNCTION "private"."client_support_ticket_create_atomic_internal"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."content_before"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.content_key IS DISTINCT FROM OLD.content_key
   OR NEW.locale IS DISTINCT FROM OLD.locale THEN
    RAISE EXCEPTION 'content_identity_immutable' USING ERRCODE='42501';
  END IF;
  NEW.version:=OLD.version+1;
 END IF;
 NEW.updated_at:=now();
 IF NEW.status='published' THEN
  IF NEW.is_machine_suggestion THEN RAISE EXCEPTION 'machine_suggestion_not_accepted' USING ERRCODE='42501';END IF;
  IF TG_OP='INSERT' OR NEW.value IS DISTINCT FROM OLD.value OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.published_at:=now();
  END IF;
 END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "private"."content_before"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."content_history_after"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF NEW.status='published' AND (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status
 OR NEW.value IS DISTINCT FROM OLD.value) THEN
  INSERT INTO public.site_content_history(content_key,locale,value,version,published_by,published_at)
  VALUES(NEW.content_key,NEW.locale,NEW.value,NEW.version,auth.uid(),now())
  ON CONFLICT(content_key,locale,version) DO NOTHING;
 END IF;
 RETURN NEW;
END;$$;


ALTER FUNCTION "private"."content_history_after"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."courier_transition_delivery_atomic_v1"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_delivery public.deliveries%rowtype;
  v_expected_next text;
  v_old_order_status text;
  v_new_order_status text;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_delivery_id is null then
    raise exception 'delivery_required' using errcode = '22023';
  end if;

  if p_reason is not null and length(p_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select d.* into v_delivery
  from public.deliveries as d
  where d.id = p_delivery_id
  for update;

  if v_delivery.id is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  if v_delivery.assigned_courier_id is distinct from v_actor then
    raise exception 'delivery_not_assigned_to_courier' using errcode = '42501';
  end if;

  v_expected_next := case v_delivery.status
    when 'courier_assigned' then 'courier_accepted'
    when 'courier_accepted' then 'courier_to_partner'
    when 'courier_to_partner' then 'arrived_at_partner'
    when 'arrived_at_partner' then 'picked_up'
    when 'picked_up' then 'courier_to_client'
    when 'courier_to_client' then 'arrived_at_client'
    when 'arrived_at_client' then 'delivered'
    else null
  end;

  if p_to_status = v_delivery.status then
    return jsonb_build_object(
      'ok',true,
      'idempotent',true,
      'delivery_id',p_delivery_id,
      'status',v_delivery.status
    );
  end if;

  if v_expected_next is null or p_to_status is distinct from v_expected_next then
    raise exception 'invalid_delivery_status_transition' using errcode = 'P0001';
  end if;

  update public.deliveries
  set status = p_to_status, updated_at = now()
  where id = p_delivery_id;

  update public.courier_assignments
  set status = case
        when p_to_status = 'courier_accepted' then 'accepted'
        when p_to_status = 'delivered' then 'completed'
        else 'in_progress'
      end,
      updated_at = now()
  where delivery_id = p_delivery_id
    and courier_id = v_actor
    and status in ('assigned','accepted','in_progress');

  insert into public.delivery_status_history (
    delivery_id, from_status, to_status, changed_by, reason
  ) values (
    p_delivery_id,
    v_delivery.status,
    p_to_status,
    v_actor,
    coalesce(nullif(btrim(p_reason),''),'courier_physical_progress')
  );

  -- Keep operational order state coherent without touching payment truth.
  if p_to_status in ('picked_up','delivered') then
    select o.status into v_old_order_status
    from public.orders o
    where o.id = v_delivery.order_id
    for update;

    v_new_order_status := case
      when p_to_status = 'picked_up' and v_old_order_status in ('ready','ready_for_pickup') then 'delivering'
      when p_to_status = 'delivered' and v_old_order_status in ('ready','ready_for_pickup','delivering') then 'completed'
      else null
    end;

    if v_new_order_status is not null and v_new_order_status <> v_old_order_status then
      update public.orders
      set status = v_new_order_status, updated_at = now()
      where id = v_delivery.order_id;

      insert into public.order_status_history (
        order_id, from_status, to_status, changed_by, reason
      ) values (
        v_delivery.order_id,
        v_old_order_status,
        v_new_order_status,
        v_actor,
        'delivery_progress_' || p_to_status
      );
    end if;
  end if;

  if p_to_status = 'delivered' then
    update public.courier_profiles cp
    set availability_status = 'online', updated_at = now()
    where cp.user_id = v_actor
      and not exists (
        select 1
        from public.deliveries d2
        where d2.assigned_courier_id = v_actor
          and d2.id <> p_delivery_id
          and d2.status not in ('delivered','delivery_failed')
      );
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    v_actor,
    'courier',
    'courier_delivery_transition',
    'deliveries',
    p_delivery_id,
    jsonb_build_object('status',v_delivery.status),
    jsonb_build_object('status',p_to_status),
    coalesce(nullif(btrim(p_reason),''),'Courier physical delivery progress.'),
    'delivery-transition-' || p_delivery_id::text || '-' || p_to_status
  );

  return jsonb_build_object(
    'ok',true,
    'idempotent',false,
    'delivery_id',p_delivery_id,
    'status',p_to_status
  );
end;
$$;


ALTER FUNCTION "private"."courier_transition_delivery_atomic_v1"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."create_order_for_client_atomic_core"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text", "p_client_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_delivery_tariff_id" "uuid" DEFAULT NULL::"uuid", "p_delivery_address" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := p_client_id;
  v_delivery_fee numeric(12,2) := 0;
  v_tariff record;
  v_tariff_zone text := null;
  v_delivery_id uuid;
  v_existing_id uuid;
  v_existing_business_id uuid;
  v_existing_type text;
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_min_order numeric := 0;
  v_title text;
  v_price numeric;
  v_stock integer;
  v_partner_address text;
  v_invalid_items integer;
  v_item_count integer;
  v_item record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_actor_id is null or p_actor_role not in ('client','support_admin','super_admin') then
    raise exception 'invalid_order_actor' using errcode = '42501';
  end if;
  if p_delivery_method not in ('pickup','delivery') then
    raise exception 'unsupported_delivery_method' using errcode = '22023';
  end if;
  if p_delivery_method='pickup' and
     (p_delivery_tariff_id is not null or p_delivery_address is not null) then
    raise exception 'pickup_payload_has_delivery_fields' using errcode = '22023';
  end if;
  if p_delivery_method='delivery' then
    if p_delivery_tariff_id is null or p_delivery_address is null or
       length(pg_catalog.btrim(p_delivery_address)) < 8 or
       length(pg_catalog.btrim(p_delivery_address)) > 500 then
      raise exception 'delivery_price_or_address_missing' using errcode = 'P0001';
    end if;
    select t.id,t.fee_som,t.currency,t.zone_code into v_tariff
      from private.kol_delivery_tariffs t
      where t.id=p_delivery_tariff_id and t.business_id=p_business_id
        and t.active and t.currency='KGS'
        and t.valid_from<=pg_catalog.now()
        and (t.valid_until is null or t.valid_until>pg_catalog.now())
        and exists(select 1 from public.user_roles ar where
          ar.user_id=t.approved_by and ar.is_active
          and ar.role in ('support_admin','super_admin'))
      for share of t;
    if not found then
      raise exception 'approved_delivery_tariff_missing' using errcode = 'P0001';
    end if;
    v_delivery_fee:=v_tariff.fee_som;
    v_tariff_zone:=v_tariff.zone_code;
  end if;

  if p_idempotency_key is null
     or length(pg_catalog.btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array' using errcode = '22023';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'invalid_item_count' using errcode = '22023';
  end if;

  -- Serialize retries with the same client/idempotency pair before inventory locks.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select o.id, o.business_id, o.type
    into v_existing_id, v_existing_business_id, v_existing_type
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id <> p_business_id or v_existing_type <> p_order_type then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select count(*)::integer
    into v_invalid_items
  from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
  where x.item_id is null
     or x.qty is null
     or x.qty < 1
     or x.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_order_item' using errcode = '22023';
  end if;

  select p.address
    into v_partner_address
  from public.partners as p
  where p.id = p_business_id
    and p.status = 'approved';

  if not found then
    raise exception 'business_not_available' using errcode = 'P0001';
  end if;

  if p_order_type = 'food' then
    select r.min_order_amount
      into v_min_order
    from public.restaurants as r
    where r.business_id = p_business_id;

    if not found then
      raise exception 'food_business_not_configured' using errcode = 'P0001';
    end if;

    -- Lock every referenced menu row in deterministic UUID order and calculate
    -- the authoritative subtotal. Duplicate item ids are consolidated.
    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active'
      for update;

      if not found then
        raise exception 'menu_item_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;

    if v_subtotal < coalesce(v_min_order, 0) then
      raise exception 'minimum_order_not_met' using errcode = 'P0001';
    end if;
  else
    -- Shop orders require an actual shop contour and tracked stock. NULL stock
    -- is treated as unknown, never as unlimited.
    perform 1
    from public.shops as s
    where s.business_id = p_business_id;

    if not found then
      raise exception 'shop_business_not_configured' using errcode = 'P0001';
    end if;

    for v_item in
      select x.item_id, sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
      order by x.item_id
    loop
      select p.title, p.price, p.stock_qty
        into v_title, v_price, v_stock
      from public.products as p
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
      for update;

      if not found then
        raise exception 'product_not_available' using errcode = 'P0001';
      end if;

      if v_price <= 0 then
        raise exception 'invalid_server_price' using errcode = 'P0001';
      end if;

      if v_stock is null then
        raise exception 'product_stock_not_tracked' using errcode = 'P0001';
      end if;

      if v_stock < v_item.qty then
        raise exception 'insufficient_product_stock' using errcode = 'P0001';
      end if;

      v_subtotal := v_subtotal + (v_price * v_item.qty);
    end loop;
  end if;

  if v_subtotal <= 0 then
    raise exception 'invalid_order_subtotal' using errcode = 'P0001';
  end if;

  insert into public.orders (
    client_id,
    business_id,
    type,
    status,
    subtotal,
    delivery_fee,
    discount,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    p_business_id,
    p_order_type,
    'new',
    v_subtotal,
    v_delivery_fee,
    0,
    v_subtotal+v_delivery_fee,
    'pending',
    pg_catalog.jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'pricing_authority', 'database',
      'delivery_method', p_delivery_method,
      'delivery_fee_model',case when p_delivery_method='pickup' then 'pickup_zero' else 'approved_zone_tariff' end,
      'delivery_tariff_id',p_delivery_tariff_id,
      'delivery_zone',v_tariff_zone,
      'currency','KGS'
    )
  )
  returning id into v_order_id;

  -- Insert snapshots from the still-locked catalog rows. Shop stock decrement is
  -- performed in the same transaction immediately before its item snapshot.
  for v_item in
    select x.item_id, sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
    order by x.item_id
  loop
    if p_order_type = 'food' then
      select m.title, m.price
        into v_title, v_price
      from public.menu_items as m
      where m.id = v_item.item_id
        and m.business_id = p_business_id
        and m.status = 'active';

      if not found then
        raise exception 'menu_item_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'menu_item', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    else
      update public.products as p
      set stock_qty = p.stock_qty - v_item.qty
      where p.id = v_item.item_id
        and p.business_id = p_business_id
        and p.status = 'active'
        and p.stock_qty is not null
        and p.stock_qty >= v_item.qty
      returning p.title, p.price into v_title, v_price;

      if not found then
        raise exception 'product_stock_changed' using errcode = '40001';
      end if;

      insert into public.order_items (
        order_id, item_type, item_id, title_snapshot, qty, unit_price, total
      ) values (
        v_order_id, 'product', v_item.item_id, v_title,
        v_item.qty, v_price, v_price * v_item.qty
      );
    end if;
  end loop;

  insert into public.order_delivery (
    order_id,
    delivery_method,
    pickup_address,
    dropoff_address
  ) values (
    v_order_id,
    p_delivery_method,
    v_partner_address,
    case when p_delivery_method='delivery' then pg_catalog.btrim(p_delivery_address) else null end
  );

  if p_delivery_method='delivery' then
    insert into public.deliveries
      (order_id,status,pickup_address,dropoff_address,metadata)
    values (v_order_id,'delivery_pending',v_partner_address,
      pg_catalog.btrim(p_delivery_address),
      pg_catalog.jsonb_build_object('tariff_id',v_tariff.id,
        'zone_code',v_tariff.zone_code,'fee_som',v_delivery_fee,'currency','KGS'))
    returning id into v_delivery_id;
    update public.order_delivery set delivery_id=v_delivery_id
      where order_id=v_order_id;
    insert into public.delivery_status_history
      (delivery_id,from_status,to_status,changed_by,reason)
    values (v_delivery_id,null,'delivery_pending',p_actor_id,
      'approved_delivery_order_created');
  end if;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_order_id,
    p_actor_id,
    null,
    'new',
    'atomic_order_created'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    p_actor_id,
    p_actor_role,
    'create_order_atomic',
    'orders',
    v_order_id,
    null,
    pg_catalog.jsonb_build_object(
      'business_id', p_business_id,
      'type', p_order_type,
      'subtotal', v_subtotal,
      'delivery_fee', v_delivery_fee,
      'delivery_id',v_delivery_id,
      'client_id',v_user_id,
      'payment_status', 'pending'
    ),
    'Atomic order created from server-authoritative catalog values.',
    'create-order-' || p_idempotency_key
  );

  return v_order_id;
end;
$$;


ALTER FUNCTION "private"."create_order_for_client_atomic_core"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text", "p_client_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_delivery_tariff_id" "uuid", "p_delivery_address" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."create_payment_attempt_atomic_v1_internal"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_total numeric;
  v_parent_payment_status text;
  v_existing public.payments%rowtype;
  v_payment_id uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_subject_type not in ('order','booking') then
    raise exception 'invalid_payment_subject_type' using errcode = '22023';
  end if;

  if p_subject_id is null then
    raise exception 'payment_subject_required' using errcode = '22023';
  end if;

  if p_provider is null or length(btrim(p_provider)) < 2 or length(p_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if p_provider_reference is null
     or length(btrim(p_provider_reference)) < 4
     or length(p_provider_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if p_method is null or length(btrim(p_method)) < 2 or length(p_method) > 64 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  if p_subject_type = 'order' then
    select o.client_id, o.total, o.payment_status
      into v_user_id, v_total, v_parent_payment_status
    from public.orders as o
    where o.id = p_subject_id
    for update;
  else
    select b.client_id, b.total, b.payment_status
      into v_user_id, v_total, v_parent_payment_status
    from public.bookings as b
    where b.id = p_subject_id
    for update;
  end if;

  if v_user_id is null then
    raise exception 'payment_subject_not_found' using errcode = 'P0001';
  end if;

  if v_total is null or v_total <= 0 then
    raise exception 'invalid_authoritative_total' using errcode = 'P0001';
  end if;

  if v_parent_payment_status in ('paid','refunded') then
    raise exception 'payment_subject_already_settled' using errcode = 'P0001';
  end if;

  select p.* into v_existing
  from public.payments as p
  where p.provider = p_provider
    and p.provider_reference = p_provider_reference
  limit 1;

  if v_existing.id is not null then
    if v_existing.user_id is distinct from v_user_id
       or v_existing.amount is distinct from v_total
       or (p_subject_type = 'order' and v_existing.order_id is distinct from p_subject_id)
       or (p_subject_type = 'booking' and v_existing.booking_id is distinct from p_subject_id) then
      raise exception 'provider_reference_conflict' using errcode = '23505';
    end if;

    return v_existing.id;
  end if;

  insert into public.payments (
    user_id,
    order_id,
    booking_id,
    method,
    status,
    amount,
    provider,
    provider_reference,
    metadata
  ) values (
    v_user_id,
    case when p_subject_type = 'order' then p_subject_id else null end,
    case when p_subject_type = 'booking' then p_subject_id else null end,
    btrim(p_method),
    'pending',
    v_total,
    btrim(p_provider),
    btrim(p_provider_reference),
    jsonb_build_object('source','provider_attempt_rpc','subject_type',p_subject_type)
  )
  returning id into v_payment_id;

  if p_subject_type = 'order' then
    insert into public.order_payments(order_id, payment_id)
    values (p_subject_id, v_payment_id)
    on conflict (order_id, payment_id) do nothing;
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    null,
    'payment_system',
    'payment_attempt_created',
    'payments',
    v_payment_id,
    null,
    jsonb_build_object(
      'status','pending',
      'amount',v_total,
      'provider',btrim(p_provider),
      'subject_type',p_subject_type,
      'subject_id',p_subject_id
    ),
    'Authoritative provider payment attempt created.',
    'payment-attempt-' || v_payment_id::text
  );

  return v_payment_id;
end;
$$;


ALTER FUNCTION "private"."create_payment_attempt_atomic_v1_internal"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."enforce_active_catalog_category"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_scope text;
  v_status text;
  v_expected_scope text;
begin
  if new.category_id is null then
    return new;
  end if;

  v_expected_scope := case tg_table_name
    when 'menu_items' then 'food'
    when 'tours' then 'tour'
    when 'stays' then 'stay'
    when 'products' then 'shop'
    else null
  end;

  if v_expected_scope is null then
    raise exception 'unsupported_catalog_category_guard_table' using errcode = '22023';
  end if;

  select c.scope, c.status
    into v_scope, v_status
  from public.categories c
  where c.id = new.category_id;

  if not found then
    raise exception 'catalog_category_not_found' using errcode = '23503';
  end if;
  if v_status <> 'active' then
    raise exception 'catalog_category_not_active' using errcode = 'P0001';
  end if;
  if v_scope is distinct from v_expected_scope then
    raise exception 'catalog_category_scope_mismatch' using errcode = '22023';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."enforce_active_catalog_category"() OWNER TO "postgres";


COMMENT ON FUNCTION "private"."enforce_active_catalog_category"() IS 'Fail-closed catalog taxonomy guard. New/changed category references must point to an active category with the canonical domain scope.';



CREATE OR REPLACE FUNCTION "private"."guard_category_scope_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.scope is not distinct from old.scope then
    return new;
  end if;

  if exists (
       select 1 from public.menu_items m
       where m.category_id = old.id and m.status <> 'archived'
     )
     or exists (
       select 1 from public.tours t
       where t.category_id = old.id and t.status <> 'archived'
     )
     or exists (
       select 1 from public.stays s
       where s.category_id = old.id and s.status <> 'archived'
     )
     or exists (
       select 1 from public.products p
       where p.category_id = old.id and p.status <> 'archived'
     ) then
    raise exception 'category_scope_change_blocked_by_catalog_references' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.categories c
    where c.parent_id = old.id
      and c.status = 'active'
  ) then
    raise exception 'category_scope_change_blocked_by_active_children' using errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."guard_category_scope_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "private"."guard_category_scope_change"() IS 'Fail-closed taxonomy invariant: domain scope cannot change while non-archived catalog records or active children depend on the category.';



CREATE OR REPLACE FUNCTION "private"."guard_payment_provider_event_replay"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_existing private.payment_provider_events%rowtype;
begin
  -- Two-int advisory key avoids exposing event text and is transaction-scoped.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(new.provider),
    pg_catalog.hashtext(new.event_id)
  );

  select e.* into v_existing
  from private.payment_provider_events as e
  where e.provider = new.provider
    and e.event_id = new.event_id
  limit 1;

  if v_existing.id is null then
    return new;
  end if;

  if v_existing.provider_reference is distinct from new.provider_reference
     or v_existing.event_type is distinct from new.event_type
     or v_existing.requested_status is distinct from new.requested_status
     or v_existing.amount is distinct from new.amount
     or v_existing.payload_hash is distinct from new.payload_hash then
    raise exception 'provider_event_replay_conflict' using errcode = '23505';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."guard_payment_provider_event_replay"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."guard_provider_payment_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if old.provider_reference is not null and (
    new.user_id is distinct from old.user_id
    or new.order_id is distinct from old.order_id
    or new.booking_id is distinct from old.booking_id
    or new.amount is distinct from old.amount
    or new.provider is distinct from old.provider
    or new.provider_reference is distinct from old.provider_reference
    or new.method is distinct from old.method
  ) then
    raise exception 'provider_payment_identity_immutable' using errcode = '23000';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."guard_provider_payment_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."kol_finance_reject_mutation_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
 RAISE EXCEPTION 'finance_journal_append_only' USING ERRCODE='42501';
END;
$$;


ALTER FUNCTION "private"."kol_finance_reject_mutation_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."kol_finance_terms_guard_v1"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN
   RAISE EXCEPTION 'contract_append_only' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.user_roles r
   JOIN public.user_profiles u ON u.user_id=r.user_id
   WHERE r.user_id=NEW.approved_by AND r.role='super_admin' AND r.is_active
     AND u.status='active'
 ) THEN
   RAISE EXCEPTION 'active_owner_approval_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(
   NEW.business_id::text||'|'||NEW.service_line||'|'||NEW.currency,0));
 IF EXISTS(
   SELECT 1 FROM public.kol_finance_terms_v1 t
   WHERE t.business_id=NEW.business_id AND t.service_line=NEW.service_line
     AND t.currency=NEW.currency
     AND daterange(t.valid_from,t.valid_until,'[)') &&
         daterange(NEW.valid_from,NEW.valid_until,'[)')
 ) THEN
   RAISE EXCEPTION 'overlapping_agreement_period' USING ERRCODE='23505';
 END IF;
 RETURN NEW;
END;
$$;


ALTER FUNCTION "private"."kol_finance_terms_guard_v1"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."normalize_order_payment_projection"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_order_id uuid;
  v_amount numeric;
  v_status text;
begin
  select p.order_id, p.amount, p.status
    into v_order_id, v_amount, v_status
  from public.payments as p
  where p.id = new.payment_id;

  if not found or v_order_id is null or v_order_id is distinct from new.order_id then
    raise exception 'order_payment_projection_subject_mismatch' using errcode = '23503';
  end if;

  new.amount := v_amount;
  new.status := v_status;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;


ALTER FUNCTION "private"."normalize_order_payment_projection"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_availability_action_atomic_internal"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_entity_type text;
  v_status text;
  v_target_status text;
  v_date date;
  v_parent_id uuid;
  v_available_count integer;
  v_price_override numeric;
  v_capacity integer;
  v_booked_count integer;
  v_time time;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_scope_id is null then
    raise exception 'availability_scope_id_required' using errcode = '22023';
  end if;

  if p_scope_type not in ('room_date', 'tour_schedule') then
    raise exception 'unsupported_availability_scope_type' using errcode = '22023';
  end if;

  if p_action not in ('close', 'open', 'report_conflict') then
    raise exception 'unsupported_partner_availability_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  if p_scope_type = 'room_date' then
    select r.business_id, ra.room_id, ra.date, ra.status, ra.available_count, ra.price_override
      into v_business_id, v_parent_id, v_date, v_status, v_available_count, v_price_override
    from public.room_availability as ra
    join public.rooms as r on r.id = ra.room_id
    where ra.id = p_scope_id
    for update of ra;

    if not found then
      raise exception 'room_availability_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'room_availability';
  else
    select t.business_id, ts.tour_id, ts.date, ts.time, ts.status, ts.capacity, ts.booked_count
      into v_business_id, v_parent_id, v_date, v_time, v_status, v_capacity, v_booked_count
    from public.tour_schedules as ts
    join public.tours as t on t.id = ts.tour_id
    where ts.id = p_scope_id
    for update of ts;

    if not found then
      raise exception 'tour_schedule_not_found' using errcode = 'P0002';
    end if;

    v_entity_type := 'tour_schedules';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'availability_not_available_for_partner' using errcode = '42501';
  end if;

  if p_action = 'report_conflict' then
    v_audit_action := 'partner_availability_conflict_reported';

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_user_id
      and al.action = v_audit_action
      and al.entity_type = v_entity_type
      and al.entity_id = p_scope_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'scope_type', p_scope_type,
        'scope_id', p_scope_id,
        'action', p_action,
        'status', v_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_user_id,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      v_entity_type,
      p_scope_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'parent_id', v_parent_id,
        'date', v_date,
        'status', v_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'parent_id', v_parent_id,
        'date', v_date,
        'status', v_status,
        'report_only', true
      ),
      coalesce(v_reason, 'Partner reported an availability conflict for operational review.'),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'action', p_action,
      'status', v_status,
      'idempotent', false
    );
  end if;

  if v_date < current_date then
    raise exception 'availability_date_in_past' using errcode = '22023';
  end if;

  v_target_status := case p_action
    when 'close' then 'closed'
    when 'open' then 'available'
    else null
  end;

  if v_status = v_target_status then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'action', p_action,
      'status', v_status,
      'idempotent', true
    );
  end if;

  -- Opening never creates capacity. Existing authoritative counters must still
  -- show at least one unit/seat available for a new booking attempt.
  if p_action = 'open' and p_scope_type = 'room_date' and v_available_count <= 0 then
    raise exception 'room_availability_capacity_exhausted' using errcode = 'P0001';
  end if;

  if p_action = 'open' and p_scope_type = 'tour_schedule' and v_booked_count >= v_capacity then
    raise exception 'tour_schedule_capacity_exhausted' using errcode = 'P0001';
  end if;

  if p_scope_type = 'room_date' then
    update public.room_availability as ra
    set status = v_target_status
    where ra.id = p_scope_id;
  else
    update public.tour_schedules as ts
    set status = v_target_status
    where ts.id = p_scope_id;
  end if;

  v_audit_action := 'partner_availability_' || p_scope_type || '_' || p_action;

  insert into public.audit_logs (
    actor_id, actor_role, action, entity_type, entity_id,
    before, after, reason, request_id
  ) values (
    v_user_id,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    v_entity_type,
    p_scope_id,
    case
      when p_scope_type = 'room_date' then pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'room_id', v_parent_id,
        'date', v_date,
        'status', v_status,
        'available_count', v_available_count,
        'price_override', v_price_override
      )
      else pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'tour_id', v_parent_id,
        'date', v_date,
        'time', v_time,
        'status', v_status,
        'capacity', v_capacity,
        'booked_count', v_booked_count
      )
    end,
    case
      when p_scope_type = 'room_date' then pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'room_id', v_parent_id,
        'date', v_date,
        'status', v_target_status,
        'available_count', v_available_count,
        'price_override', v_price_override
      )
      else pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'tour_id', v_parent_id,
        'date', v_date,
        'time', v_time,
        'status', v_target_status,
        'capacity', v_capacity,
        'booked_count', v_booked_count
      )
    end,
    coalesce(v_reason, 'Partner availability status changed atomically; inventory counters and accepted bookings remain unchanged.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'scope_type', p_scope_type,
    'scope_id', p_scope_id,
    'action', p_action,
    'status', v_target_status,
    'idempotent', false
  );
end;
$$;


ALTER FUNCTION "private"."partner_availability_action_atomic_internal"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_booking_action_atomic_internal"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_status text;
  v_payment_status text;
  v_booking_type text;
  v_object_id uuid;
  v_start_date date;
  v_end_date date;
  v_guests_count integer;
  v_metadata jsonb;
  v_inventory_model text;
  v_target_status text;
  v_actor_role text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_nights integer;
  v_inventory_rows integer;
  v_released_rows integer;
  v_tour_schedule_id uuid;
  v_tour_booked_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_booking_id is null then
    raise exception 'booking_id_required' using errcode = '22023';
  end if;

  if p_action not in ('confirm', 'reject', 'check_in', 'complete', 'report_issue', 'request_cancellation') then
    raise exception 'unsupported_partner_booking_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select
    b.business_id,
    b.status,
    b.payment_status,
    b.booking_type,
    b.object_id,
    b.start_date,
    b.end_date,
    b.guests_count,
    coalesce(b.metadata, '{}'::jsonb)
    into
      v_business_id,
      v_status,
      v_payment_status,
      v_booking_type,
      v_object_id,
      v_start_date,
      v_end_date,
      v_guests_count,
      v_metadata
  from public.bookings as b
  where b.id = p_booking_id
  for update;

  if not found then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'booking_not_available_for_partner' using errcode = '42501';
  end if;

  -- Non-transition actions are persisted only as audit/escalation evidence.
  if p_action in ('report_issue', 'request_cancellation') then
    if p_action = 'request_cancellation' and v_status <> 'confirmed' then
      raise exception 'cancellation_request_requires_confirmed_booking' using errcode = 'P0001';
    end if;

    if p_action = 'report_issue' and v_status in ('completed', 'cancelled', 'rejected', 'no_show') then
      raise exception 'issue_report_not_allowed_for_terminal_booking' using errcode = 'P0001';
    end if;

    v_audit_action := case p_action
      when 'report_issue' then 'partner_booking_issue_reported'
      else 'partner_booking_cancellation_requested'
    end;

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_user_id
      and al.action = v_audit_action
      and al.entity_type = 'bookings'
      and al.entity_id = p_booking_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'booking_id', p_booking_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      before,
      after,
      reason,
      request_id
    ) values (
      v_user_id,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      'bookings',
      p_booking_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'status', v_status,
        'payment_status', v_payment_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'status', v_status,
        'payment_status', v_payment_status,
        'request_only', true
      ),
      coalesce(
        v_reason,
        case p_action
          when 'report_issue' then 'Partner reported a booking issue for admin review.'
          else 'Partner requested cancellation; booking and payment truth were not changed.'
        end
      ),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', false
    );
  end if;

  v_target_status := case p_action
    when 'confirm' then 'confirmed'
    when 'reject' then 'rejected'
    when 'check_in' then 'checked_in'
    when 'complete' then 'completed'
    else null
  end;

  -- A Tour must never use checked_in, even if a legacy/manual row already
  -- carries that status. Status equality alone is not proof that this RPC ran.
  if p_action = 'check_in' and v_booking_type is distinct from 'stay' then
    raise exception 'invalid_partner_booking_check_in_transition' using errcode = 'P0001';
  end if;

  -- Only a previously audited partner transition may be replayed. A legacy or
  -- admin-mutated row with the target status must not masquerade as an accepted
  -- action (or claim that rejection released inventory). The booking row lock
  -- serializes concurrent transitions; the audit is committed in the same txn.
  if v_status = v_target_status then
    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.action = 'partner_booking_' || p_action
      and al.entity_type = 'bookings'
      and al.entity_id = p_booking_id
      and al.after ->> 'status' = v_status
      and al.after ->> 'booking_type' = v_booking_type
      and (
        p_action <> 'reject'
        or al.after ->> 'inventory_released' = 'true'
      )
    limit 1;

    if v_existing_audit_id is null then
      raise exception 'partner_booking_replay_without_audit' using errcode = 'P0001';
    end if;

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'booking_id', p_booking_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', true,
      'inventory_released', p_action = 'reject'
    );
  end if;

  if (p_action in ('confirm', 'reject') and v_status <> 'pending') then
    raise exception 'invalid_partner_booking_status_transition' using errcode = 'P0001';
  end if;

  if p_action = 'check_in' and (v_booking_type <> 'stay' or v_status <> 'confirmed') then
    raise exception 'invalid_partner_booking_check_in_transition' using errcode = 'P0001';
  end if;

  if p_action = 'complete' and not (
    (v_booking_type = 'stay' and v_status = 'checked_in')
    or (v_booking_type = 'tour' and v_status = 'confirmed')
  ) then
    raise exception 'invalid_partner_booking_complete_transition' using errcode = 'P0001';
  end if;

  -- A pending atomic booking has already reserved inventory. Reject must release
  -- that exact reservation in this transaction. Legacy/manual bookings without the
  -- atomic inventory marker fail closed and require an explicit admin repair path.
  if p_action = 'reject' then
    v_inventory_model := v_metadata ->> 'inventory_model';

    if v_booking_type = 'stay' then
      if v_inventory_model is distinct from 'room_availability'
         or v_object_id is null
         or v_start_date is null
         or v_end_date is null
         or v_end_date <= v_start_date then
        raise exception 'stay_rejection_inventory_contract_missing' using errcode = 'P0001';
      end if;

      v_nights := v_end_date - v_start_date;

      perform 1
      from public.room_availability as ra
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date
      order by ra.date
      for update;

      select count(*)::integer
        into v_inventory_rows
      from public.room_availability as ra
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date;

      if v_inventory_rows <> v_nights then
        raise exception 'stay_rejection_inventory_missing' using errcode = 'P0001';
      end if;

      update public.room_availability as ra
      set available_count = ra.available_count + 1
      where ra.room_id = v_object_id
        and ra.date >= v_start_date
        and ra.date < v_end_date;

      get diagnostics v_released_rows = row_count;
      if v_released_rows <> v_nights then
        raise exception 'stay_rejection_inventory_release_changed' using errcode = '40001';
      end if;

    elsif v_booking_type = 'tour' then
      if v_inventory_model is distinct from 'tour_schedules'
         or nullif(v_metadata ->> 'tour_schedule_id', '') is null
         or v_object_id is null
         or v_guests_count is null
         or v_guests_count < 1 then
        raise exception 'tour_rejection_inventory_contract_missing' using errcode = 'P0001';
      end if;

      begin
        v_tour_schedule_id := (v_metadata ->> 'tour_schedule_id')::uuid;
      exception
        when invalid_text_representation then
          raise exception 'tour_rejection_schedule_id_invalid' using errcode = '22023';
      end;

      select ts.booked_count
        into v_tour_booked_count
      from public.tour_schedules as ts
      where ts.id = v_tour_schedule_id
        and ts.tour_id = v_object_id
      for update;

      if not found then
        raise exception 'tour_rejection_schedule_missing' using errcode = 'P0001';
      end if;

      if v_tour_booked_count < v_guests_count then
        raise exception 'tour_rejection_capacity_inconsistent' using errcode = 'P0001';
      end if;

      update public.tour_schedules as ts
      set booked_count = ts.booked_count - v_guests_count
      where ts.id = v_tour_schedule_id
        and ts.tour_id = v_object_id
        and ts.booked_count >= v_guests_count;

      if not found then
        raise exception 'tour_rejection_capacity_changed' using errcode = '40001';
      end if;

    else
      raise exception 'booking_rejection_type_unsupported' using errcode = 'P0001';
    end if;
  end if;

  update public.bookings as b
  set status = v_target_status
  where b.id = p_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_booking_id,
    v_user_id,
    v_status,
    v_target_status,
    'partner_booking_' || p_action || '_atomic'
  );

  v_audit_action := 'partner_booking_' || p_action;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_user_id,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    'bookings',
    p_booking_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'booking_type', v_booking_type,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'booking_type', v_booking_type,
      'status', v_target_status,
      'payment_status', v_payment_status,
      'inventory_released', p_action = 'reject',
      'inventory_model', case when p_action = 'reject' then v_inventory_model else null end
    ),
    coalesce(v_reason, 'Partner booking lifecycle transition committed atomically.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'booking_id', p_booking_id,
    'booking_type', v_booking_type,
    'action', p_action,
    'status', v_target_status,
    'payment_status', v_payment_status,
    'idempotent', false,
    'inventory_released', p_action = 'reject'
  );
end;
$$;


ALTER FUNCTION "private"."partner_booking_action_atomic_internal"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_catalog_availability_action_internal"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_item_business_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_target_state text;
  v_before jsonb;
  v_after jsonb;
  v_existing_action text;
  v_existing_entity_type text;
  v_existing_entity_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_item_type not in ('menu_item', 'product') then
    raise exception 'unsupported_catalog_item_type' using errcode = '22023';
  end if;
  if p_item_id is null then
    raise exception 'catalog_item_id_required' using errcode = '22023';
  end if;
  if p_action not in ('pause', 'resume', 'out_of_stock') then
    raise exception 'unsupported_catalog_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  if p_action <> 'resume' and v_reason is null then
    raise exception 'catalog_reason_required' using errcode = '22023';
  end if;

  select ps.business_id, ps.role
    into v_business_id, v_actor_role
  from public.partner_staff ps
  join public.partner_profiles pp
    on pp.business_id = ps.business_id and pp.user_id = ps.user_id
  where ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'partner_catalog_not_authorized' using errcode = '42501';
  end if;

  if p_item_type = 'menu_item' then
    select business_id into v_item_business_id
    from public.menu_items where id = p_item_id;
  else
    select business_id into v_item_business_id
    from public.products where id = p_item_id;
  end if;

  if v_item_business_id is null then
    raise exception 'catalog_item_not_found' using errcode = 'P0001';
  end if;
  if v_item_business_id <> v_business_id then
    raise exception 'catalog_item_ownership_mismatch' using errcode = '42501';
  end if;

  -- Serialize request-id evaluation so concurrent replays cannot diverge.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_request_id, 0)
  );

  select al.action, al.entity_type, al.entity_id
    into v_existing_action, v_existing_entity_type, v_existing_entity_id
  from public.audit_logs al
  where al.actor_id = v_user_id and al.request_id = p_request_id
  order by al.created_at asc
  limit 1;

  if found then
    if v_existing_action <> 'partner_catalog_' || p_action
       or v_existing_entity_type <> p_item_type
       or v_existing_entity_id <> p_item_id then
      raise exception 'catalog_request_id_conflict' using errcode = '23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'idempotent_replay', true, 'business_id', v_business_id,
      'item_type', p_item_type, 'item_id', p_item_id,
      'availability_state', case p_action when 'pause' then 'paused' when 'out_of_stock' then 'out_of_stock' else 'available' end
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_item_type || ':' || p_item_id::text, 0)
  );

  select pg_catalog.jsonb_build_object(
    'availability_state', availability_state, 'reason', reason
  ) into v_before
  from public.partner_catalog_item_availability
  where item_type = p_item_type and item_id = p_item_id
  for update;

  v_target_state := case p_action
    when 'pause' then 'paused'
    when 'out_of_stock' then 'out_of_stock'
    else 'available'
  end;

  insert into public.partner_catalog_item_availability (
    business_id, item_type, item_id, availability_state, reason,
    changed_by, changed_at, updated_at
  ) values (
    v_business_id, p_item_type, p_item_id, v_target_state,
    case when p_action = 'resume' then null else v_reason end,
    v_user_id, now(), now()
  )
  on conflict (item_type, item_id) do update set
    business_id = excluded.business_id,
    availability_state = excluded.availability_state,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    changed_at = excluded.changed_at,
    updated_at = now();

  select pg_catalog.jsonb_build_object(
    'availability_state', availability_state, 'reason', reason
  ) into v_after
  from public.partner_catalog_item_availability
  where item_type = p_item_type and item_id = p_item_id;

  if not exists (
    select 1 from public.audit_logs al
    where al.actor_id = v_user_id
      and al.action = 'partner_catalog_' || p_action
      and al.entity_type = p_item_type
      and al.entity_id = p_item_id
      and al.request_id = p_request_id
  ) then
    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id,
      before, after, reason, request_id
    ) values (
      v_user_id, coalesce(v_actor_role, 'partner_manager'),
      'partner_catalog_' || p_action, p_item_type, p_item_id,
      coalesce(v_before, '{}'::jsonb), v_after,
      coalesce(v_reason, 'Partner resumed catalog item.'), p_request_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'business_id', v_business_id,
    'item_type', p_item_type,
    'item_id', p_item_id,
    'availability_state', v_target_state
  );
end;
$$;


ALTER FUNCTION "private"."partner_catalog_availability_action_internal"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_catalog_write_atomic_internal"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "private"."partner_catalog_write_atomic_internal"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_inventory_publish_atomic_internal"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
 v_actor uuid := auth.uid();
 v_business uuid;
 v_role text;
 v_id uuid;
 v_existing record;
 v_action text;
 v_request_audit record;
begin
 if v_actor is null then
   raise exception 'not_authenticated' using errcode='28000';
 end if;
 if p_scope_type not in ('room_date','tour_schedule') or p_parent_id is null then
   raise exception 'invalid_inventory_scope' using errcode='22023';
 end if;
 if p_date is null or p_date < current_date or p_date > current_date + 365 then
   raise exception 'invalid_inventory_date' using errcode='22023';
 end if;
 if p_capacity is null or p_capacity < 1 or p_capacity > 1000 then
   raise exception 'invalid_inventory_capacity' using errcode='22023';
 end if;
 if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
   raise exception 'invalid_request_id' using errcode='22023';
 end if;
 if p_scope_type='room_date' then
   if p_time is not null or (p_price_override is not null and (p_price_override <= 0 or p_price_override > 10000000)) then
     raise exception 'invalid_room_inventory_price_or_time' using errcode='22023';
   end if;
   select r.business_id into v_business from public.rooms r
    join public.stays s on s.id=r.stay_id and s.business_id=r.business_id
    where r.id=p_parent_id and r.status='active' and s.status='active' and r.price_per_night>0;
 else
   if p_price_override is not null then
     raise exception 'tour_price_override_not_supported' using errcode='22023';
   end if;
   select t.business_id into v_business from public.tours t
    where t.id=p_parent_id and t.status='active' and t.price>0;
 end if;
 if v_business is null then
   raise exception 'inventory_parent_not_active' using errcode='42501';
 end if;
 select ps.role into v_role from public.partner_staff ps
   where ps.user_id=v_actor and ps.business_id=v_business and ps.is_active
   and exists(select 1 from public.user_roles ur where ur.user_id=v_actor
     and ur.role in ('partner_owner','partner_manager','partner_staff') and ur.is_active)
   limit 1;
 if v_role is null then
   raise exception 'inventory_not_owned' using errcode='42501';
 end if;

 -- Serialise by actor/request_id first: a retried request may not be reused
 -- for a different parent, date or capacity, even in another transaction.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('kol_inventory_request:' || v_actor::text),
   pg_catalog.hashtext(p_request_id)
 );
 v_action := 'partner_inventory_' || p_scope_type || '_published';
 select al.entity_id,al.after into v_request_audit
 from public.audit_logs al where al.actor_id=v_actor
   and al.action in ('partner_inventory_room_date_published','partner_inventory_tour_schedule_published')
   and al.request_id=p_request_id
 order by al.created_at desc limit 1;
 if found then
   if v_request_audit.after->>'business_id' <> v_business::text
     or v_request_audit.after->>'parent_id' <> p_parent_id::text
     or v_request_audit.after->>'date' <> p_date::text
     or (v_request_audit.after->>'time') is distinct from p_time::text
     or (v_request_audit.after->>'capacity')::integer <> p_capacity
     or (v_request_audit.after->>'price_override')::numeric is distinct from p_price_override
     or (v_request_audit.after->>'status') <> 'available'
     or v_request_audit.after->>'scope_type' is distinct from p_scope_type
   then raise exception 'inventory_idempotency_key_reused_with_different_payload' using errcode='23505'; end if;
   return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_request_audit.entity_id,'idempotent',true,'status','available');
 end if;

 -- A single parent serialises concurrent publishes. Do not silently change
 -- previously published capacity or override prices.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('kol_inventory_publish'),pg_catalog.hashtext(p_parent_id::text));

 if p_scope_type='room_date' then
   select ra.id,ra.available_count,ra.price_override,ra.status into v_existing
     from public.room_availability ra where ra.room_id=p_parent_id and ra.date=p_date for update;
   if found then
     if v_existing.available_count<>p_capacity or v_existing.price_override is distinct from p_price_override then
       raise exception 'existing_room_inventory_requires_review' using errcode='23505';
     end if;
     return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_existing.id,'idempotent',true,'status',v_existing.status);
   end if;
   insert into public.room_availability(room_id,date,status,available_count,price_override)
    values(p_parent_id,p_date,'available',p_capacity,p_price_override) returning id into v_id;
 else
   select ts.id,ts.capacity,ts.booked_count,ts.status into v_existing
     from public.tour_schedules ts
     where ts.tour_id=p_parent_id and ts.date=p_date and ts.time is not distinct from p_time for update;
   if found then
     if v_existing.capacity<>p_capacity then
       raise exception 'existing_tour_capacity_requires_review' using errcode='23505';
     end if;
     return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_existing.id,'idempotent',true,'status',v_existing.status);
   end if;
   insert into public.tour_schedules(tour_id,date,time,capacity,booked_count,status)
    values(p_parent_id,p_date,p_time,p_capacity,0,'available') returning id into v_id;
 end if;
 v_action := 'partner_inventory_' || p_scope_type || '_published';
 insert into public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,v_role,v_action,
        case when p_scope_type='room_date' then 'room_availability' else 'tour_schedules' end,
        v_id,'{}'::jsonb,
        pg_catalog.jsonb_build_object('business_id',v_business,'parent_id',p_parent_id,'date',p_date,
         'time',p_time,'capacity',p_capacity,'price_override',p_price_override,'status','available','scope_type',p_scope_type),
        'Authorized partner published confirmed dated inventory.',p_request_id);
 return pg_catalog.jsonb_build_object('ok',true,'scope_id',v_id,'idempotent',false,'status','available');
end;
$$;


ALTER FUNCTION "private"."partner_inventory_publish_atomic_internal"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_order_action_atomic_internal"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_business_id uuid;
  v_order_type text;
  v_status text;
  v_payment_status text;
  v_target_status text;
  v_actor_role text;
  v_audit_action text;
  v_existing_audit_id uuid;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_order_id is null then
    raise exception 'order_id_required' using errcode = '22023';
  end if;

  if p_action not in (
    'accept',
    'reject',
    'start_preparing',
    'mark_ready',
    'report_issue',
    'request_cancellation'
  ) then
    raise exception 'unsupported_partner_order_action' using errcode = '22023';
  end if;

  if p_request_id is null
     or length(pg_catalog.btrim(p_request_id)) < 8
     or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;

  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;

  select o.business_id, o.type, o.status, o.payment_status
    into v_business_id, v_order_type, v_status, v_payment_status
  from public.orders as o
  where o.id = p_order_id
    and o.type in ('food', 'shop')
  for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select ps.role
    into v_actor_role
  from public.partner_staff as ps
  where ps.business_id = v_business_id
    and ps.user_id = v_actor
    and ps.is_active = true
    and exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = v_actor
        and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'order_not_available_for_partner' using errcode = '42501';
  end if;

  -- These actions intentionally persist evidence only. They never alter order,
  -- payment, stock, delivery or item truth.
  if p_action in ('report_issue', 'request_cancellation') then
    if v_status in ('completed', 'rejected', 'cancelled') then
      raise exception 'partner_order_action_not_allowed_for_terminal_order' using errcode = 'P0001';
    end if;

    if p_action = 'request_cancellation'
       and v_status not in ('accepted_by_partner', 'preparing', 'ready_for_pickup') then
      raise exception 'cancellation_request_requires_accepted_order' using errcode = 'P0001';
    end if;

    v_audit_action := case p_action
      when 'report_issue' then 'partner_order_issue_reported'
      else 'partner_order_cancellation_requested'
    end;

    select al.id
      into v_existing_audit_id
    from public.audit_logs as al
    where al.actor_id = v_actor
      and al.action = v_audit_action
      and al.entity_type = 'orders'
      and al.entity_id = p_order_id
      and al.request_id = p_request_id
    limit 1;

    if v_existing_audit_id is not null then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    insert into public.audit_logs (
      actor_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      before,
      after,
      reason,
      request_id
    ) values (
      v_actor,
      coalesce(v_actor_role, 'partner'),
      v_audit_action,
      'orders',
      p_order_id,
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'order_type', v_order_type,
        'status', v_status,
        'payment_status', v_payment_status
      ),
      pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'order_type', v_order_type,
        'status', v_status,
        'payment_status', v_payment_status,
        'request_only', true
      ),
      coalesce(
        v_reason,
        case p_action
          when 'report_issue' then 'Partner reported an order issue for admin review.'
          else 'Partner requested cancellation; order, stock and payment truth were not changed.'
        end
      ),
      p_request_id
    );

    return pg_catalog.jsonb_build_object(
      'ok', true,
      'order_id', p_order_id,
      'action', p_action,
      'status', v_status,
      'payment_status', v_payment_status,
      'idempotent', false
    );
  end if;

  if p_action = 'reject' then
    if v_status = 'rejected' then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;

    if v_status <> 'new' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;

    -- Shop stock is decremented atomically at order creation. Until an explicit
    -- reject/restock contract exists, shop rejection must fail closed.
    if v_order_type = 'shop' then
      raise exception 'shop_reject_restock_contract_required' using errcode = 'P0001';
    end if;

    -- A paid food order would require refund/cancellation policy. Do not invent it.
    if v_payment_status <> 'pending' then
      raise exception 'paid_order_rejection_requires_admin_policy' using errcode = 'P0001';
    end if;

    v_target_status := 'rejected';
  elsif p_action = 'accept' then
    v_target_status := 'accepted_by_partner';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'new' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  elsif p_action = 'start_preparing' then
    v_target_status := 'preparing';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'accepted_by_partner' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  elsif p_action = 'mark_ready' then
    v_target_status := 'ready_for_pickup';
    if v_status = v_target_status then
      return pg_catalog.jsonb_build_object(
        'ok', true,
        'order_id', p_order_id,
        'action', p_action,
        'status', v_status,
        'payment_status', v_payment_status,
        'idempotent', true
      );
    end if;
    if v_status <> 'preparing' then
      raise exception 'invalid_partner_order_status_transition' using errcode = 'P0001';
    end if;
  end if;

  if v_payment_status not in ('pending', 'paid') then
    raise exception 'order_payment_state_not_operational' using errcode = 'P0001';
  end if;

  update public.orders as o
  set status = v_target_status,
      updated_at = now()
  where o.id = p_order_id;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_order_id,
    v_actor,
    v_status,
    v_target_status,
    'partner_order_' || p_action || '_atomic'
  );

  v_audit_action := 'partner_order_' || p_action;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_actor,
    coalesce(v_actor_role, 'partner'),
    v_audit_action,
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'order_type', v_order_type,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'order_type', v_order_type,
      'status', v_target_status,
      'payment_status', v_payment_status
    ),
    coalesce(v_reason, 'Partner order lifecycle transition committed atomically.'),
    p_request_id
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'order_id', p_order_id,
    'action', p_action,
    'status', v_target_status,
    'payment_status', v_payment_status,
    'idempotent', false
  );
end;
$$;


ALTER FUNCTION "private"."partner_order_action_atomic_internal"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."partner_stop_action_atomic_internal"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text", "p_resume_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_actor_role text;
  v_reason text := nullif(pg_catalog.btrim(coalesce(p_reason, '')), '');
  v_scope text;
  v_scopes text[];
  v_existing_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_audit_action text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_scope_type not in ('new_orders', 'new_bookings', 'business') then
    raise exception 'unsupported_stop_scope' using errcode = '22023';
  end if;
  if p_action not in ('pause', 'resume') then
    raise exception 'unsupported_stop_action' using errcode = '22023';
  end if;
  if p_request_id is null or length(pg_catalog.btrim(p_request_id)) < 8 or length(p_request_id) > 128 then
    raise exception 'invalid_request_id' using errcode = '22023';
  end if;
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'reason_too_long' using errcode = '22023';
  end if;
  if p_action = 'pause' and v_reason is null then
    raise exception 'pause_reason_required' using errcode = '22023';
  end if;
  if p_resume_at is not null and p_resume_at <= now() then
    raise exception 'resume_at_must_be_future' using errcode = '22023';
  end if;

  select ps.business_id, ps.role
    into v_business_id, v_actor_role
  from public.partner_staff ps
  join public.partner_profiles pp
    on pp.business_id = ps.business_id and pp.user_id = ps.user_id
  where ps.user_id = v_user_id
    and ps.is_active = true
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = v_user_id
        and ur.role in ('partner_owner', 'partner_manager')
        and ur.is_active = true
    )
  limit 1;

  if not found then
    raise exception 'partner_stop_not_authorized' using errcode = '42501';
  end if;

  v_scopes := case when p_scope_type = 'business'
    then array['new_orders', 'new_bookings']::text[]
    else array[p_scope_type]::text[] end;

  foreach v_scope in array v_scopes loop
    -- Serialize identical business/scope mutations even before the first status row exists.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_business_id::text || ':' || v_scope, 0)
    );

    select id, pg_catalog.jsonb_build_object(
      'is_paused', is_paused, 'reason', reason, 'resume_at', resume_at
    ) into v_existing_id, v_before
    from public.partner_stop_statuses
    where business_id = v_business_id and scope_type = v_scope
    for update;

    if p_action = 'pause' then
      insert into public.partner_stop_statuses (
        business_id, scope_type, is_paused, reason, paused_by, paused_at, resume_at, updated_at
      ) values (
        v_business_id, v_scope, true, v_reason, v_user_id, now(), p_resume_at, now()
      )
      on conflict (business_id, scope_type) do update set
        is_paused = true,
        reason = excluded.reason,
        paused_by = excluded.paused_by,
        paused_at = excluded.paused_at,
        resume_at = excluded.resume_at,
        updated_at = now();
    else
      insert into public.partner_stop_statuses (
        business_id, scope_type, is_paused, reason, paused_by, paused_at, resume_at, updated_at
      ) values (
        v_business_id, v_scope, false, v_reason, v_user_id, null, null, now()
      )
      on conflict (business_id, scope_type) do update set
        is_paused = false,
        reason = excluded.reason,
        paused_by = excluded.paused_by,
        paused_at = null,
        resume_at = null,
        updated_at = now();
    end if;

    select pg_catalog.jsonb_build_object(
      'is_paused', is_paused, 'reason', reason, 'resume_at', resume_at
    ) into v_after
    from public.partner_stop_statuses
    where business_id = v_business_id and scope_type = v_scope;

    v_audit_action := 'partner_stop_' || v_scope || '_' || p_action;
    if not exists (
      select 1 from public.audit_logs al
      where al.actor_id = v_user_id and al.action = v_audit_action
        and al.entity_type = 'partner_stop_status' and al.entity_id = v_business_id
        and al.request_id = p_request_id
    ) then
      insert into public.audit_logs (
        actor_id, actor_role, action, entity_type, entity_id,
        before, after, reason, request_id
      ) values (
        v_user_id, coalesce(v_actor_role, 'partner_manager'), v_audit_action,
        'partner_stop_status', v_business_id, coalesce(v_before, '{}'::jsonb), v_after,
        coalesce(v_reason, 'Partner resumed future demand.'), p_request_id
      );
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'business_id', v_business_id, 'scope_type', p_scope_type,
    'action', p_action, 'affected_scopes', v_scopes
  );
end;
$$;


ALTER FUNCTION "private"."partner_stop_action_atomic_internal"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text", "p_resume_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reject_paused_partner_demand"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_scope text;
begin
  v_scope := case tg_table_name when 'orders' then 'new_orders' when 'bookings' then 'new_bookings' else null end;
  if v_scope is null then raise exception 'unsupported_stop_guard_target'; end if;
  if exists (
    select 1 from public.partner_stop_statuses s
    where s.business_id = new.business_id and s.scope_type = v_scope and s.is_paused = true
      and (s.resume_at is null or s.resume_at > now())
  ) then
    raise exception 'partner_%_paused', v_scope using errcode = 'P0001';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."reject_paused_partner_demand"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reject_unavailable_catalog_order_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.item_type in ('menu_item', 'product') and new.item_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.item_type || ':' || new.item_id::text, 0)
    );
  end if;
  if new.item_type in ('menu_item', 'product') and exists (
    select 1
    from public.partner_catalog_item_availability a
    join public.orders o on o.id = new.order_id
    where a.business_id = o.business_id
      and a.item_type = new.item_type
      and a.item_id = new.item_id
      and a.availability_state <> 'available'
  ) then
    raise exception 'catalog_item_not_operationally_available' using errcode = 'P0001';
  end if;
  return new;
end;
$$;


ALTER FUNCTION "private"."reject_unavailable_catalog_order_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."reviews_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE b record; v_exists boolean; v_stay_id uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.source='site' THEN
   IF auth.uid() IS NULL OR NEW.client_id IS DISTINCT FROM auth.uid() THEN
     RAISE EXCEPTION 'review_must_belong_to_user' USING ERRCODE='42501';
   END IF;
   SELECT bk.client_id,bk.business_id,bk.status,bk.booking_type,bk.object_id INTO b
    FROM public.bookings bk WHERE bk.id=NEW.booking_id;
   IF NOT FOUND OR b.client_id IS DISTINCT FROM NEW.client_id
      OR b.business_id IS DISTINCT FROM NEW.business_id
      OR b.status<>'completed' OR b.booking_type NOT IN ('stay','tour') THEN
     RAISE EXCEPTION 'review_requires_completed_own_booking' USING ERRCODE='42501';
   END IF;
   NEW.target_type:=b.booking_type;
   IF b.booking_type='stay' THEN
      SELECT rm.stay_id INTO v_stay_id FROM public.rooms rm
       WHERE rm.id=b.object_id AND rm.business_id=b.business_id;
      IF v_stay_id IS NULL THEN RAISE EXCEPTION 'booking_room_stay_relation_invalid' USING ERRCODE='42501';END IF;
      NEW.target_id:=v_stay_id;
   ELSE
      NEW.target_id:=b.object_id;
   END IF;
   NEW.order_id:=NULL;NEW.source_label:=NULL;NEW.source_evidence_url:=NULL;
   NEW.status:='new';NEW.hidden_reason:=NULL;NEW.admin_reply:=NULL;
  ELSE
   IF NOT private.can_manage_content() THEN
    RAISE EXCEPTION 'review_import_not_authorized' USING ERRCODE='42501';END IF;
   IF NEW.source_label IS NULL OR length(btrim(NEW.source_label))<2
      OR NEW.source_evidence_url IS NULL OR NEW.source_evidence_url !~ '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'review_import_evidence_required' USING ERRCODE='23514';END IF;
   NEW.client_id:=NULL;NEW.booking_id:=NULL;NEW.order_id:=NULL;NEW.status:='new';
  END IF;
  IF NEW.target_type='stay' THEN
   SELECT EXISTS(SELECT 1 FROM public.stays st
     WHERE st.id=NEW.target_id AND st.business_id=NEW.business_id) INTO v_exists;
  ELSE
   SELECT EXISTS(SELECT 1 FROM public.tours t
     WHERE t.id=NEW.target_id AND t.business_id=NEW.business_id) INTO v_exists;
  END IF;
  IF NOT v_exists THEN RAISE EXCEPTION 'review_target_mismatch' USING ERRCODE='42501';END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF NOT private.can_manage_content() THEN
    RAISE EXCEPTION 'review_moderation_not_authorized' USING ERRCODE='42501';
  END IF;
  -- Compare OLD.source and *both* identities: no source-switch or false review.
  IF NEW.source IS DISTINCT FROM OLD.source
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
    OR NEW.business_id IS DISTINCT FROM OLD.business_id
    OR NEW.order_id IS DISTINCT FROM OLD.order_id
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.target_type IS DISTINCT FROM OLD.target_type
    OR NEW.target_id IS DISTINCT FROM OLD.target_id
    OR NEW.rating IS DISTINCT FROM OLD.rating
    OR NEW.text IS DISTINCT FROM OLD.text
    OR NEW.source_label IS DISTINCT FROM OLD.source_label
    OR NEW.source_evidence_url IS DISTINCT FROM OLD.source_evidence_url
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
     RAISE EXCEPTION 'review_content_immutable' USING ERRCODE='42501';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
      OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason
      OR NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN
    NEW.moderated_by:=auth.uid();NEW.moderated_at:=now();
    IF NEW.admin_reply IS DISTINCT FROM OLD.admin_reply THEN NEW.admin_reply_at:=now();END IF;
  END IF;
 END IF;
 RETURN NEW;
END;$_$;


ALTER FUNCTION "private"."reviews_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."site_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE o jsonb; n jsonb; ident uuid;
BEGIN
 IF TG_OP='INSERT' THEN n:=to_jsonb(NEW);ident:=(n->>'id')::uuid;
 ELSIF TG_OP='DELETE' THEN o:=to_jsonb(OLD);ident:=(o->>'id')::uuid;
 ELSE n:=to_jsonb(NEW);o:=to_jsonb(OLD);ident:=(n->>'id')::uuid;END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,before,after)
 VALUES(auth.uid(),(SELECT role FROM public.user_roles WHERE user_id=auth.uid() AND is_active AND
 role IN ('super_admin','content_manager') ORDER BY role LIMIT 1),
 TG_TABLE_NAME||'_'||lower(TG_OP),TG_TABLE_NAME,ident,o,n);
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;$$;


ALTER FUNCTION "private"."site_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."sync_order_payment_projection_after_payment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.order_id is not null then
    update public.order_payments
    set amount = new.amount,
        status = new.status,
        updated_at = pg_catalog.now()
    where payment_id = new.id
      and order_id = new.order_id;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "private"."sync_order_payment_projection_after_payment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_catalog_category_atomic"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.admin_catalog_category_atomic_internal(p_category_id,p_action,p_request_id,p_fields,p_reason);
$$;


ALTER FUNCTION "public"."admin_catalog_category_atomic"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_catalog_category_atomic"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") IS 'Super-admin category create/update/archive authority. Active taxonomy only, referenced-category archive protection, audited and alcohol fail-closed.';



CREATE OR REPLACE FUNCTION "public"."admin_catalog_governance_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.admin_catalog_governance_atomic_internal(p_item_id,p_domain,p_action,p_request_id,p_reason);
$$;


ALTER FUNCTION "public"."admin_catalog_governance_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_catalog_governance_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") IS 'Super-admin catalog lifecycle authority: approved->active publish, active->approved unpublish, controlled archive. Audited, idempotent, alcohol fail-closed.';



CREATE OR REPLACE FUNCTION "public"."admin_catalog_moderation_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.admin_catalog_moderation_atomic_internal(
    p_item_id,
    p_domain,
    p_action,
    p_request_id,
    p_reason
  );
$$;


ALTER FUNCTION "public"."admin_catalog_moderation_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_catalog_moderation_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") IS 'Fail-closed first Admin catalog moderation slice. Super-admin only; approve/reject under_review items with payload-bound idempotency and audit evidence. Alcohol approval is blocked across all supported catalog domains; money/order/booking/delivery truth is untouched.';



CREATE OR REPLACE FUNCTION "public"."admin_confirm_intake_order_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_confirmed_delivery_fee_som" numeric, "p_confirmation_note" "text", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
 v_actor uuid := auth.uid();
 v_role text;
 v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
 v_note text := pg_catalog.btrim(coalesce(p_confirmation_note,''));
 v_ticket record;
 v_client record;
 v_method text;
 v_order_type text;
 v_item_type text;
 v_types integer;
 v_items jsonb;
 v_invalid int;
 v_normalized_invalid int;
 v_cart_count int;
 v_key text;
 v_old uuid;
 v_order uuid;
 v_tariff record;
 v_zone text;
 v_location text;
 v_address text;
 v_existing record;
 v_actual_fee numeric(12,2) := 0;
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 select r.role into v_role from public.user_roles r
  where r.user_id=v_actor and r.is_active and r.role in ('support_admin','super_admin')
  order by case when r.role='super_admin' then 0 else 1 end limit 1;
 if v_role is null then raise exception 'operator_order_role_required' using errcode='42501'; end if;
 if p_ticket_id is null or p_business_id is null
    or length(v_request)<8 or length(v_request)>128
    or length(v_note)<8 or length(v_note)>500 or
    p_confirmed_delivery_fee_som is null or
    p_confirmed_delivery_fee_som<0 then
   raise exception 'operator_order_confirmation_required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext(v_actor::text),pg_catalog.hashtext(v_request));
 select al.entity_id,al.after into v_existing from public.audit_logs al
   where al.actor_id=v_actor and al.action='admin_confirm_intake_order_atomic'
     and al.entity_type='support_tickets' and al.request_id=v_request limit 1;
 if found then
   if v_existing.entity_id is distinct from p_ticket_id
      or v_existing.after->>'business_id' is distinct from p_business_id::text
      or (v_existing.after->>'delivery_fee_som')::numeric is distinct from p_confirmed_delivery_fee_som
      or v_existing.after->>'confirmation_note_hash' is distinct from pg_catalog.md5(v_note) then
     raise exception 'operator_confirmation_request_conflict' using errcode='23505'; end if;
   return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
     'order_id',v_existing.after->>'order_id','idempotent',true);
 end if;

 select st.id,st.created_by,st.category,st.status,st.related_order_id,
        st.request_payload into v_ticket
 from public.support_tickets st where st.id=p_ticket_id for update;
 if not found or v_ticket.category is distinct from 'order_request' then
   raise exception 'intake_not_found' using errcode='P0002'; end if;
 if v_ticket.status not in ('open','in_progress') then
   raise exception 'intake_not_active' using errcode='P0001'; end if;
 if v_ticket.related_order_id is not null then
   raise exception 'intake_already_has_order' using errcode='23505'; end if;
 if v_ticket.created_by is null then
   raise exception 'intake_client_verification_required' using errcode='42501'; end if;
 select pg_catalog.lower(pg_catalog.btrim(u.email)) as email,
        u.email_confirmed_at as verified_at
   into v_client from auth.users u where u.id=v_ticket.created_by;
 if not found or v_client.verified_at is null or v_client.email is null or
    v_client.email is distinct from
      pg_catalog.lower(pg_catalog.btrim(coalesce(v_ticket.request_payload->'contact'->>'email','')))
    or not exists(select 1 from public.user_roles ur where
         ur.user_id=v_ticket.created_by and ur.role='client' and ur.is_active) then
   raise exception 'verified_ticket_client_required' using errcode='42501'; end if;

 v_method:=v_ticket.request_payload->>'delivery_method';
 if v_method not in ('pickup','delivery') then
   raise exception 'unsupported_intake_delivery_method' using errcode='P0001'; end if;
 if pg_catalog.jsonb_typeof(v_ticket.request_payload->'cart_items') is distinct from 'array' then
   raise exception 'unverifiable_intake_cart' using errcode='22023'; end if;
 select count(*),count(distinct x.type),
  count(*) filter(where x.id is null or
      x.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or x.type not in ('food','product') or x.type is null
      or x.quantity is null or x.quantity<1 or x.quantity>99)
 into v_cart_count,v_types,v_invalid
 from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
  as x(id text,type text,quantity integer);
 if v_cart_count<1 or v_cart_count>50 or v_types<>1 or v_invalid<>0 then
   raise exception 'invalid_single_business_intake_cart' using errcode='22023'; end if;
 select x.type into v_item_type
 from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
 as x(id text,type text,quantity integer) limit 1;
 v_order_type:=case when v_item_type='food' then 'food' else 'shop' end;
 select count(*) into v_normalized_invalid
 from (select x.id,pg_catalog.sum(x.quantity)::integer qty
    from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
      as x(id text,type text,quantity integer) group by x.id) m
 where m.qty<1 or m.qty>99;
 if v_normalized_invalid<>0 then
   raise exception 'intake_normalized_quantity_invalid' using errcode='22023'; end if;
 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
   'item_id',x.id::uuid,'qty',x.qty) order by x.id)
 into v_items from (
   select y.id,pg_catalog.sum(y.quantity)::integer qty
   from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
     as y(id text,type text,quantity integer)
   group by y.id) x;
 if v_items is null then raise exception 'intake_empty_cart' using errcode='22023'; end if;

 if v_method='pickup' then
   if p_confirmed_delivery_fee_som<>0 then
     raise exception 'pickup_has_no_delivery_fee' using errcode='22023'; end if;
   v_address:=null;
 else
   v_location:=pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'location',''));
   v_address:=pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'address',''));
   v_zone:=case v_location
     when 'Чолпон-Ата' then 'cholpon-ata'
     when 'Бостери' then 'bosteri'
     when 'Каракол' then 'karakol'
     when 'Тамчы' then 'tamchy'
     when 'Бактуу-Долоноту' then 'baktuu-dolonotu'
     when 'Сары-Ой' then 'sary-oy'
     else null end;
   if v_zone is null or length(v_address)<8 or length(v_address)>500 then
     raise exception 'delivery_address_or_zone_unconfirmed' using errcode='P0001'; end if;
   select t.id,t.fee_som into v_tariff from private.kol_delivery_tariffs t
   where t.business_id=p_business_id and t.zone_code=v_zone
     and t.active and t.currency='KGS'
     and t.valid_from<=pg_catalog.now()
     and (t.valid_until is null or t.valid_until>pg_catalog.now())
     and exists(select 1 from public.user_roles r where r.user_id=t.approved_by
       and r.is_active and r.role in ('support_admin','super_admin'))
   for share of t;
   if not found then raise exception 'delivery_tariff_not_configured' using errcode='P0001'; end if;
   v_actual_fee:=v_tariff.fee_som;
   if v_actual_fee is distinct from p_confirmed_delivery_fee_som then
     raise exception 'delivery_quote_changed_require_reconfirmation' using errcode='P0001'; end if;
 end if;

 v_key:='intake-'||p_ticket_id::text;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext(v_ticket.created_by::text),pg_catalog.hashtext(v_key));
 select o.id into v_old from public.orders o
 where o.client_id=v_ticket.created_by and o.metadata->>'idempotency_key'=v_key
 limit 1;
 if v_old is not null then
   raise exception 'intake_order_exists_use_verified_link' using errcode='23505'; end if;

 -- Shared atomic core: identical pricing, inventory decrement, payment pending,
 -- items/history/audit; delivery aggregate is committed in this same transaction.
 v_order:=private.create_order_for_client_atomic_core(
   p_business_id,v_order_type,v_items,v_method,v_key,
   v_ticket.created_by,v_actor,v_role,
   case when v_method='delivery' then v_tariff.id else null end,
   v_address);
 update public.support_tickets set related_order_id=v_order,
   updated_at=pg_catalog.now() where id=p_ticket_id;
 insert into public.audit_logs
 (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,v_role,'admin_confirm_intake_order_atomic','support_tickets',
  p_ticket_id,pg_catalog.jsonb_build_object('related_order_id',null),
  pg_catalog.jsonb_build_object('order_id',v_order,
    'business_id',p_business_id,'delivery_fee_som',v_actual_fee,
    'delivery_method',v_method,'confirmation_note_hash',pg_catalog.md5(v_note)),
  v_note,v_request);
 return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
   'order_id',v_order,'idempotent',false,'delivery_fee_som',v_actual_fee,
   'delivery_method',v_method);
end;
$_$;


ALTER FUNCTION "public"."admin_confirm_intake_order_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_confirmed_delivery_fee_som" numeric, "p_confirmation_note" "text", "p_request_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_confirm_intake_order_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_confirmed_delivery_fee_som" numeric, "p_confirmation_note" "text", "p_request_id" "text") IS 'Verified-client operator confirmation. Shared DB price/stock core; exact configured KGS fee; atomic linked order/delivery and audit.';



CREATE OR REPLACE FUNCTION "public"."admin_delivery_issue_transition_atomic"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  SELECT private.admin_delivery_issue_transition_internal(
    p_issue_id,p_to_status,p_request_id,p_reason
  );
$$;


ALTER FUNCTION "public"."admin_delivery_issue_transition_atomic"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_link_intake_pickup_order_atomic"("p_ticket_id" "uuid", "p_order_id" "uuid", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
  v_ticket record;
  v_order record;
  v_existing record;
  v_expected jsonb;
  v_actual jsonb;
  v_item_count integer;
  v_bad_count integer;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode='28000';
  end if;
  select ur.role into v_role
    from public.user_roles ur
    where ur.user_id = v_actor and ur.is_active
      and ur.role in ('support_admin','super_admin')
    order by case when ur.role='super_admin' then 0 else 1 end
    limit 1;
  if v_role is null then
    raise exception 'intake_link_operator_required' using errcode='42501';
  end if;
  if p_ticket_id is null or p_order_id is null
     or length(v_request) < 8 or length(v_request) > 128 then
    raise exception 'invalid_intake_link_input' using errcode='22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_actor::text), pg_catalog.hashtext(v_request)
  );
  select al.entity_id, al.after into v_existing
    from public.audit_logs al
    where al.actor_id=v_actor and al.action='admin_intake_pickup_order_linked'
      and al.entity_type='support_tickets' and al.request_id=v_request
    limit 1;
  if found then
    if v_existing.entity_id is distinct from p_ticket_id
       or v_existing.after->>'order_id' is distinct from p_order_id::text then
      raise exception 'intake_link_request_payload_conflict' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
      'order_id',p_order_id,'idempotent',true);
  end if;

  select st.id,st.created_by,st.category,st.status,st.related_order_id,
         st.request_payload
    into v_ticket from public.support_tickets st
    where st.id=p_ticket_id for update;
  if not found or v_ticket.category is distinct from 'order_request' then
    raise exception 'intake_order_ticket_not_found' using errcode='P0002';
  end if;
  if v_ticket.created_by is null then
    raise exception 'anonymous_intake_requires_verified_client' using errcode='42501';
  end if;
  if v_ticket.status not in ('open','in_progress') then
    raise exception 'intake_ticket_not_operational' using errcode='P0001';
  end if;
  if v_ticket.related_order_id is not null then
    if v_ticket.related_order_id is distinct from p_order_id then
      raise exception 'intake_ticket_already_linked' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
      'order_id',p_order_id,'idempotent',true);
  end if;

  select o.id,o.client_id,o.type,o.metadata
    into v_order from public.orders o where o.id=p_order_id for update;
  if not found then
    raise exception 'intake_order_not_found' using errcode='P0002';
  end if;
  if v_order.client_id is distinct from v_ticket.created_by then
    raise exception 'intake_client_order_owner_mismatch' using errcode='42501';
  end if;
  if v_order.type not in ('food','shop')
     or v_order.metadata->>'delivery_method' is distinct from 'pickup' then
    raise exception 'intake_delivery_not_configured' using errcode='P0001';
  end if;
  if v_order.metadata->>'idempotency_key' is distinct from
       ('intake-' || p_ticket_id::text) then
    raise exception 'intake_order_key_mismatch' using errcode='23505';
  end if;

  if pg_catalog.jsonb_typeof(v_ticket.request_payload->'cart_items') is distinct from 'array' then
    raise exception 'intake_cart_not_verifiable' using errcode='22023';
  end if;
  select count(*),count(*) filter (where
      id is null or id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or quantity is null or quantity < 1 or quantity > 99
      or type is distinct from case when v_order.type='food' then 'food' else 'product' end)
    into v_item_count,v_bad_count
    from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
      as cart(id text,type text,quantity integer);
  if v_item_count < 1 or v_item_count > 50 or v_bad_count > 0 then
    raise exception 'intake_cart_invalid' using errcode='22023';
  end if;

  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'qty',x.qty)
    order by x.id) into v_expected
    from (select id, pg_catalog.sum(quantity)::integer qty
      from pg_catalog.jsonb_to_recordset(v_ticket.request_payload->'cart_items')
        as cart(id text,type text,quantity integer)
      group by id) x;
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',x.id,'qty',x.qty)
    order by x.id) into v_actual
    from (select oi.item_id::text id,pg_catalog.sum(oi.qty)::integer qty
      from public.order_items oi where oi.order_id=p_order_id
      group by oi.item_id) x;
  if v_expected is distinct from v_actual then
    raise exception 'intake_cart_order_items_mismatch' using errcode='23505';
  end if;

  update public.support_tickets
    set related_order_id=p_order_id,updated_at=pg_catalog.now()
    where id=p_ticket_id;
  insert into public.audit_logs
    (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
    values (v_actor,v_role,'admin_intake_pickup_order_linked','support_tickets',
      p_ticket_id,pg_catalog.jsonb_build_object('related_order_id',null),
      pg_catalog.jsonb_build_object('order_id',p_order_id,'type',v_order.type),
      'Verified existing client-authorized pickup order bound to intake.',v_request);

  return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
    'order_id',p_order_id,'idempotent',false);
end;
$_$;


ALTER FUNCTION "public"."admin_link_intake_pickup_order_atomic"("p_ticket_id" "uuid", "p_order_id" "uuid", "p_request_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_link_intake_pickup_order_atomic"("p_ticket_id" "uuid", "p_order_id" "uuid", "p_request_id" "text") IS 'P0 verified link only. Cannot create or deliver an order; requires already authenticated ticket owner, exact item/quantity and pickup-only DB-authoritative order.';



CREATE OR REPLACE FUNCTION "public"."admin_support_lifecycle_atomic"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT NULL::"text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.admin_support_lifecycle_atomic_internal(
    p_ticket_id,
    p_action,
    p_request_id,
    p_message,
    p_status,
    p_reason
  );
$$;


ALTER FUNCTION "public"."admin_support_lifecycle_atomic"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."admin_support_lifecycle_atomic"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") IS 'Support Admin/Super Admin audited reply/status entrypoint. Role, lifecycle, idempotency and audit are DB-authoritative.';



CREATE OR REPLACE FUNCTION "public"."apply_verified_payment_event_atomic"("p_provider" "text", "p_event_id" "text", "p_event_type" "text", "p_provider_reference" "text", "p_verified_status" "text", "p_amount" numeric, "p_payload_hash" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_event_row_id uuid;
  v_existing_event private.payment_provider_events%rowtype;
  v_payment public.payments%rowtype;
  v_before_status text;
  v_parent_status text;
  v_duplicate_settlement boolean := false;
  v_action text;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if p_provider is null or length(btrim(p_provider)) < 2 or length(p_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if p_event_id is null or length(btrim(p_event_id)) < 3 or length(p_event_id) > 255 then
    raise exception 'invalid_provider_event_id' using errcode = '22023';
  end if;

  if p_provider_reference is null
     or length(btrim(p_provider_reference)) < 4
     or length(p_provider_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if p_verified_status not in ('paid','failed','cancelled','refunded') then
    raise exception 'invalid_verified_payment_status' using errcode = '22023';
  end if;

  if p_payload_hash is null or length(btrim(p_payload_hash)) < 32 or length(p_payload_hash) > 128 then
    raise exception 'invalid_payload_hash' using errcode = '22023';
  end if;

  insert into private.payment_provider_events (
    provider,
    event_id,
    provider_reference,
    event_type,
    requested_status,
    amount,
    payload_hash,
    metadata
  ) values (
    btrim(p_provider),
    btrim(p_event_id),
    btrim(p_provider_reference),
    coalesce(nullif(btrim(p_event_type),''),'unknown'),
    p_verified_status,
    p_amount,
    btrim(p_payload_hash),
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (provider, event_id) do nothing
  returning id into v_event_row_id;

  if v_event_row_id is null then
    select e.* into v_existing_event
    from private.payment_provider_events as e
    where e.provider = btrim(p_provider)
      and e.event_id = btrim(p_event_id)
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'applied', v_existing_event.processing_status = 'applied',
      'processing_status', v_existing_event.processing_status,
      'payment_id', v_existing_event.payment_id
    );
  end if;

  select p.* into v_payment
  from public.payments as p
  where p.provider = btrim(p_provider)
    and p.provider_reference = btrim(p_provider_reference)
  for update;

  if v_payment.id is null then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'payment_not_found',
        processed_at = now()
    where id = v_event_row_id;

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'payment_not_found');
  end if;

  update private.payment_provider_events
  set payment_id = v_payment.id
  where id = v_event_row_id;

  if (v_payment.order_id is null and v_payment.booking_id is null)
     or (v_payment.order_id is not null and v_payment.booking_id is not null) then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'invalid_payment_subject_shape',
        processed_at = now()
    where id = v_event_row_id;

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'invalid_payment_subject_shape');
  end if;

  if p_verified_status = 'paid'
     and (p_amount is null or p_amount is distinct from v_payment.amount) then
    update private.payment_provider_events
    set processing_status = 'rejected',
        processing_note = 'provider_amount_mismatch',
        processed_at = now()
    where id = v_event_row_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
    ) values (
      null,
      'payment_system',
      'payment_amount_mismatch',
      'payments',
      v_payment.id,
      jsonb_build_object('expected_amount',v_payment.amount),
      jsonb_build_object('provider_amount',p_amount,'provider',p_provider,'event_id',p_event_id),
      'Verified provider event amount did not match the authoritative payment amount.',
      'payment-event-' || v_event_row_id::text
    );

    return jsonb_build_object('ok', false, 'applied', false, 'code', 'provider_amount_mismatch');
  end if;

  -- Refund truth is intentionally held for a separate approved workflow.
  if p_verified_status = 'refunded' then
    update private.payment_provider_events
    set processing_status = 'ignored',
        processing_note = 'refund_workflow_not_enabled',
        processed_at = now()
    where id = v_event_row_id;

    insert into public.audit_logs (
      actor_id, actor_role, action, entity_type, entity_id, before, after, reason, request_id
    ) values (
      null,
      'payment_system',
      'provider_refund_event_requires_review',
      'payments',
      v_payment.id,
      jsonb_build_object('status',v_payment.status),
      jsonb_build_object('provider_status','refunded','event_id',p_event_id),
      'Provider refund event recorded but automatic refund application is disabled.',
      'payment-event-' || v_event_row_id::text
    );

    return jsonb_build_object(
      'ok', true,
      'applied', false,
      'processing_status', 'ignored',
      'code', 'refund_workflow_not_enabled',
      'payment_id', v_payment.id
    );
  end if;

  v_before_status := v_payment.status;

  if p_verified_status = 'paid' then
    if v_payment.order_id is not null then
      select o.payment_status into v_parent_status
      from public.orders as o
      where o.id = v_payment.order_id
      for update;
    else
      select b.payment_status into v_parent_status
      from public.bookings as b
      where b.id = v_payment.booking_id
      for update;
    end if;

    v_duplicate_settlement := (v_parent_status = 'paid' and v_before_status <> 'paid');

    if v_before_status <> 'paid' then
      update public.payments
      set status = 'paid', updated_at = now()
      where id = v_payment.id;
    end if;

    if v_payment.order_id is not null then
      update public.orders
      set payment_status = 'paid', updated_at = now()
      where id = v_payment.order_id
        and payment_status <> 'paid';
    else
      update public.bookings
      set payment_status = 'paid', updated_at = now()
      where id = v_payment.booking_id
        and payment_status <> 'paid';
    end if;

    v_action := case
      when v_duplicate_settlement then 'duplicate_payment_settlement_detected'
      else 'payment_marked_paid_from_verified_provider_event'
    end;
  elsif p_verified_status in ('failed','cancelled') then
    -- A failed/cancelled attempt does not mark the parent transaction failed;
    -- another payment attempt may still succeed. Never downgrade paid truth.
    if v_before_status = 'pending' then
      update public.payments
      set status = p_verified_status, updated_at = now()
      where id = v_payment.id;
    end if;

    v_action := 'payment_attempt_' || p_verified_status;
  end if;

  update private.payment_provider_events
  set processing_status = 'applied',
      processing_note = case when v_duplicate_settlement then 'duplicate_settlement_requires_review' else null end,
      processed_at = now()
  where id = v_event_row_id;

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    null,
    'payment_system',
    v_action,
    'payments',
    v_payment.id,
    jsonb_build_object('status',v_before_status),
    jsonb_build_object(
      'status',case when p_verified_status = 'paid' then 'paid' else case when v_before_status = 'pending' then p_verified_status else v_before_status end end,
      'provider',p_provider,
      'event_id',p_event_id,
      'duplicate_settlement',v_duplicate_settlement
    ),
    'Verified provider payment event applied atomically.',
    'payment-event-' || v_event_row_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'applied', true,
    'payment_id', v_payment.id,
    'duplicate_settlement', v_duplicate_settlement
  );
end;
$$;


ALTER FUNCTION "public"."apply_verified_payment_event_atomic"("p_provider" "text", "p_event_id" "text", "p_event_type" "text", "p_provider_reference" "text", "p_verified_status" "text", "p_amount" numeric, "p_payload_hash" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_courier_atomic"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
  v_delivery_status text;
  v_assigned_courier uuid;
  v_active_assignment_count integer;
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not (public.has_role('dispatcher') or public.has_role('super_admin')) then
    raise exception 'dispatcher_role_required' using errcode = '42501';
  end if;

  if p_delivery_id is null or p_courier_id is null then
    raise exception 'delivery_and_courier_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_courier_id
      and ur.role = 'courier'
      and ur.is_active = true
  ) then
    raise exception 'target_user_is_not_active_courier' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = p_courier_id
  ) then
    raise exception 'courier_profile_not_found' using errcode = 'P0001';
  end if;

  select d.status, d.assigned_courier_id
    into v_delivery_status, v_assigned_courier
  from public.deliveries d
  where d.id = p_delivery_id;

  if v_delivery_status is null then
    raise exception 'delivery_not_found' using errcode = 'P0001';
  end if;

  -- The restored 012 RPC treats same courier + courier_assigned as idempotent.
  -- Refuse that shortcut if normalized assignment state is missing/corrupt.
  if v_delivery_status = 'courier_assigned'
     and v_assigned_courier is not distinct from p_courier_id then
    select count(*)::integer
      into v_active_assignment_count
    from public.courier_assignments ca
    where ca.delivery_id = p_delivery_id
      and ca.courier_id = p_courier_id
      and ca.status in ('assigned','accepted','in_progress');

    if v_active_assignment_count <> 1 then
      raise exception 'delivery_assignment_inconsistent' using errcode = 'P0001';
    end if;
  end if;

  return private.assign_courier_atomic_v1(
    p_delivery_id,
    p_courier_id,
    p_reason
  );
end;
$$;


ALTER FUNCTION "public"."assign_courier_atomic"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_anonymous_intake_by_verified_email_atomic"("p_ticket_id" "uuid", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
 v_actor uuid := auth.uid();
 v_request text := pg_catalog.btrim(coalesce(p_request_id,''));
 v_email text;
 v_verified timestamptz;
 v_ticket record;
 v_existing record;
begin
 if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
 if p_ticket_id is null or length(v_request)<8 or length(v_request)>128 then
  raise exception 'invalid_claim_input' using errcode='22023'; end if;
 if not exists (select 1 from public.user_roles r
                where r.user_id=v_actor and r.role='client' and r.is_active) then
  raise exception 'active_client_required' using errcode='42501'; end if;
 select pg_catalog.lower(pg_catalog.btrim(u.email)),u.email_confirmed_at
   into v_email,v_verified
   from auth.users u where u.id=v_actor;
 if v_email is null or v_email='' or v_verified is null then
  raise exception 'verified_email_required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_actor::text),
                                           pg_catalog.hashtext(v_request));
 select al.entity_id, al.after into v_existing
 from public.audit_logs al
 where al.actor_id=v_actor and al.action='client_anonymous_intake_claimed'
   and al.entity_type='support_tickets' and al.request_id=v_request limit 1;
 if found then
  if v_existing.entity_id is distinct from p_ticket_id then
    raise exception 'intake_claim_request_conflict' using errcode='23505'; end if;
  return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
    'idempotent',true);
 end if;
 select st.id,st.created_by,st.category,st.status,st.request_payload
 into v_ticket
 from public.support_tickets st where st.id=p_ticket_id for update;
 if not found or v_ticket.category is distinct from 'order_request' then
  raise exception 'intake_order_ticket_not_found' using errcode='P0002'; end if;
 if v_ticket.created_by is not null and v_ticket.created_by is distinct from v_actor then
  raise exception 'intake_owned_by_other_client' using errcode='42501'; end if;
 if v_ticket.status not in ('open','in_progress') then
  raise exception 'intake_ticket_not_claimable' using errcode='P0001'; end if;
 if pg_catalog.lower(pg_catalog.btrim(coalesce(v_ticket.request_payload->'contact'->>'email','')))
    is distinct from v_email then
  raise exception 'intake_email_verification_mismatch' using errcode='42501'; end if;
 if v_ticket.created_by is null then
  update public.support_tickets set created_by=v_actor,updated_at=pg_catalog.now()
    where id=p_ticket_id;
 end if;
 insert into public.audit_logs
 (actor_id,actor_role,action,entity_type,entity_id,before,after,reason,request_id)
 values(v_actor,'client','client_anonymous_intake_claimed','support_tickets',
  p_ticket_id,pg_catalog.jsonb_build_object('created_by',null),
  pg_catalog.jsonb_build_object('created_by',v_actor),
  'Customer proved the intake email via confirmed Supabase Auth.',v_request);
 return pg_catalog.jsonb_build_object('ok',true,'ticket_id',p_ticket_id,
   'idempotent',false);
end;
$$;


ALTER FUNCTION "public"."claim_anonymous_intake_by_verified_email_atomic"("p_ticket_id" "uuid", "p_request_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."claim_anonymous_intake_by_verified_email_atomic"("p_ticket_id" "uuid", "p_request_id" "text") IS 'Verified email + exact ticket identifier; phone-only and wrong-client claims denied.';



CREATE OR REPLACE FUNCTION "public"."client_onboarding_complete_atomic"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
  select private.client_onboarding_complete_atomic_internal(
    p_full_name, p_phone, p_locale, p_default_address, p_request_id
  );
$$;


ALTER FUNCTION "public"."client_onboarding_complete_atomic"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."client_onboarding_complete_atomic"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") IS 'Creates or completes the authenticated KOL client profile after passwordless onboarding; idempotent and audited.';



CREATE OR REPLACE FUNCTION "public"."client_profile_update_atomic"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.client_profile_update_atomic_internal(
    p_full_name,
    p_locale,
    p_default_address,
    p_request_id
  );
$$;


ALTER FUNCTION "public"."client_profile_update_atomic"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."client_profile_update_atomic"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") IS 'Authenticated active Client profile update entrypoint. Only full_name, locale and default_address may change; identity, role, idempotency and audit are DB-authoritative.';



CREATE OR REPLACE FUNCTION "public"."client_stay_booking_create_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$ select private.client_stay_booking_create_atomic_internal(p_room_id,p_start_date,p_end_date,p_guests,p_request_id); $$;


ALTER FUNCTION "public"."client_stay_booking_create_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_support_ticket_create_atomic"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid" DEFAULT NULL::"uuid", "p_related_booking_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.client_support_ticket_create_atomic_internal(
    p_category,
    p_title,
    p_message,
    p_request_id,
    p_related_order_id,
    p_related_booking_id
  );
$$;


ALTER FUNCTION "public"."client_support_ticket_create_atomic"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."client_support_ticket_create_atomic"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") IS 'Authenticated Client support entrypoint. Identity, ownership, priority/status, idempotency and audit are DB-authoritative.';



CREATE OR REPLACE FUNCTION "public"."courier_transition_delivery_atomic"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_role('courier') then
    raise exception 'courier_role_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.courier_profiles cp
    where cp.user_id = v_actor
  ) then
    raise exception 'courier_profile_not_found' using errcode = '42501';
  end if;

  return private.courier_transition_delivery_atomic_v1(
    p_delivery_id,
    p_to_status,
    p_reason
  );
end;
$$;


ALTER FUNCTION "public"."courier_transition_delivery_atomic"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_atomic"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_business_id uuid;
  v_existing_type text;
  v_existing_delivery_method text;
  v_incoming_cart jsonb;
  v_existing_cart jsonb;
  v_invalid_items integer;
  v_item_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_id is null then
    raise exception 'business_required' using errcode = '22023';
  end if;

  if p_order_type is null or p_order_type not in ('food', 'shop') then
    raise exception 'unsupported_order_type' using errcode = '22023';
  end if;

  if p_delivery_method is distinct from 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null
     or length(pg_catalog.btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception 'items_must_be_array' using errcode = '22023';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'invalid_item_count' using errcode = '22023';
  end if;

  select count(*)::integer
    into v_invalid_items
  from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
  where x.item_id is null
     or x.qty is null
     or x.qty < 1
     or x.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_order_item' using errcode = '22023';
  end if;

  -- 008 consolidates duplicate item ids. Enforce the same per-item maximum on
  -- the consolidated cart as well so repeated rows cannot bypass qty <= 99.
  select count(*)::integer
    into v_invalid_items
  from (
    select x.item_id, pg_catalog.sum(x.qty)::integer as qty
    from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
    group by x.item_id
  ) as normalized
  where normalized.qty < 1 or normalized.qty > 99;

  if v_invalid_items > 0 then
    raise exception 'invalid_normalized_order_item' using errcode = '22023';
  end if;

  -- Serialize all retries before the internal 008 implementation takes any
  -- catalog/inventory row locks. The internal function takes the same xact lock
  -- again for new orders; PostgreSQL releases all transaction-level advisory
  -- locks automatically at transaction end.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    pg_catalog.hashtext(p_idempotency_key)
  );

  select
    o.id,
    o.business_id,
    o.type,
    o.metadata ->> 'delivery_method'
  into
    v_existing_id,
    v_existing_business_id,
    v_existing_type,
    v_existing_delivery_method
  from public.orders as o
  where o.client_id = v_user_id
    and o.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_business_id is distinct from p_business_id
       or v_existing_type is distinct from p_order_type
       or v_existing_delivery_method is distinct from p_delivery_method then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', normalized.item_id::text,
        'qty', normalized.qty
      )
      order by normalized.item_id::text
    )
    into v_incoming_cart
    from (
      select x.item_id, pg_catalog.sum(x.qty)::integer as qty
      from pg_catalog.jsonb_to_recordset(p_items) as x(item_id uuid, qty integer)
      group by x.item_id
    ) as normalized;

    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'item_id', stored.item_id::text,
        'qty', stored.qty
      )
      order by stored.item_id::text
    )
    into v_existing_cart
    from (
      select oi.item_id, pg_catalog.sum(oi.qty)::integer as qty
      from public.order_items as oi
      where oi.order_id = v_existing_id
      group by oi.item_id
    ) as stored;

    if coalesce(v_existing_cart, '[]'::jsonb) <> coalesce(v_incoming_cart, '[]'::jsonb) then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  return public.create_order_atomic_v1_internal(
    p_business_id,
    p_order_type,
    p_items,
    p_delivery_method,
    p_idempotency_key
  );
end;
$$;


ALTER FUNCTION "public"."create_order_atomic"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_atomic_v1_internal"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  -- Preserve client route as pickup-only until a separate accepted UX/fee flow.
  if p_delivery_method is distinct from 'pickup' then
    raise exception 'delivery_pricing_not_configured' using errcode='P0001';
  end if;
  return private.create_order_for_client_atomic_core(
    p_business_id,p_order_type,p_items,p_delivery_method,p_idempotency_key,
    v_actor,v_actor,'client',null,null);
end;
$$;


ALTER FUNCTION "public"."create_order_atomic_v1_internal"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_payment_attempt_atomic"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_payment_id uuid;
  v_payment public.payments%rowtype;
  v_provider text := pg_catalog.btrim(p_provider);
  v_reference text := pg_catalog.btrim(p_provider_reference);
  v_method text := pg_catalog.btrim(p_method);
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required' using errcode = '42501';
  end if;

  if v_provider is null or length(v_provider) < 2 or length(v_provider) > 64 then
    raise exception 'invalid_payment_provider' using errcode = '22023';
  end if;

  if v_reference is null or length(v_reference) < 4 or length(v_reference) > 255 then
    raise exception 'invalid_provider_reference' using errcode = '22023';
  end if;

  if v_method is null or length(v_method) < 2 or length(v_method) > 64 then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_provider || E'\x1f' || v_reference, 0)
  );

  v_payment_id := private.create_payment_attempt_atomic_v1_internal(
    p_subject_type,
    p_subject_id,
    v_provider,
    v_reference,
    v_method
  );

  select p.* into v_payment
  from public.payments as p
  where p.id = v_payment_id;

  if v_payment.id is null then
    raise exception 'payment_attempt_result_missing' using errcode = 'P0001';
  end if;

  if v_payment.provider is distinct from v_provider
     or v_payment.provider_reference is distinct from v_reference
     or v_payment.method is distinct from v_method
     or (p_subject_type = 'order' and (
       v_payment.order_id is distinct from p_subject_id or v_payment.booking_id is not null
     ))
     or (p_subject_type = 'booking' and (
       v_payment.booking_id is distinct from p_subject_id or v_payment.order_id is not null
     )) then
    raise exception 'provider_reference_payload_conflict' using errcode = '23505';
  end if;

  return v_payment_id;
end;
$$;


ALTER FUNCTION "public"."create_payment_attempt_atomic"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_stay_booking_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_existing_object_id uuid;
  v_existing_start_date date;
  v_existing_end_date date;
  v_existing_guests_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.object_id, b.start_date, b.end_date, b.guests_count
    into v_existing_id, v_existing_type, v_existing_object_id,
         v_existing_start_date, v_existing_end_date, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay'
       or v_existing_object_id <> p_room_id
       or v_existing_start_date <> p_start_date
       or v_existing_end_date is distinct from p_end_date
       or v_existing_guests_count <> p_guests_count then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  if p_start_date is null or p_start_date < current_date then
    raise exception 'stay_start_date_in_past' using errcode = '22023';
  end if;

  return public.create_stay_booking_atomic_unlocked(
    p_room_id,
    p_start_date,
    p_end_date,
    p_guests_count,
    p_idempotency_key
  );
end;
$$;


ALTER FUNCTION "public"."create_stay_booking_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_stay_booking_atomic_unlocked"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_business_id uuid;
  v_room_capacity integer;
  v_base_price numeric;
  v_nights integer;
  v_inventory_rows integer;
  v_available_rows integer;
  v_updated_rows integer;
  v_total numeric;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date <= p_start_date then
    raise exception 'invalid_stay_dates' using errcode = '22023';
  end if;

  if p_guests_count is null or p_guests_count < 1 then
    raise exception 'invalid_guests_count' using errcode = '22023';
  end if;

  -- Fast retry path before inventory locking.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select r.business_id, r.capacity, r.price_per_night
    into v_business_id, v_room_capacity, v_base_price
  from public.rooms as r
  where r.id = p_room_id
    and r.status = 'active';

  if v_business_id is null then
    raise exception 'room_not_available' using errcode = 'P0001';
  end if;

  if p_guests_count > v_room_capacity then
    raise exception 'room_capacity_exceeded' using errcode = '22023';
  end if;

  v_nights := p_end_date - p_start_date;

  -- Lock the exact date rows in deterministic order. Missing rows fail closed.
  perform 1
  from public.room_availability as ra
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date
  order by ra.date
  for update;

  -- Concurrent retry path after lock wait.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'stay' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  select
    count(*)::integer,
    count(*) filter (where ra.status = 'available' and ra.available_count > 0)::integer,
    coalesce(sum(coalesce(ra.price_override, v_base_price)), 0)
    into v_inventory_rows, v_available_rows, v_total
  from public.room_availability as ra
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date;

  if v_inventory_rows <> v_nights then
    raise exception 'stay_inventory_not_initialized' using errcode = 'P0001';
  end if;

  if v_available_rows <> v_nights then
    raise exception 'stay_not_available' using errcode = 'P0001';
  end if;

  if v_total <= 0 then
    raise exception 'invalid_server_price' using errcode = 'P0001';
  end if;

  update public.room_availability as ra
  set available_count = ra.available_count - 1
  where ra.room_id = p_room_id
    and ra.date >= p_start_date
    and ra.date < p_end_date
    and ra.status = 'available'
    and ra.available_count > 0;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> v_nights then
    raise exception 'stay_inventory_changed' using errcode = '40001';
  end if;

  insert into public.bookings (
    client_id,
    business_id,
    booking_type,
    object_id,
    status,
    start_date,
    end_date,
    guests_count,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    v_business_id,
    'stay',
    p_room_id,
    'pending',
    p_start_date,
    p_end_date,
    p_guests_count,
    v_total,
    'pending',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'inventory_model', 'room_availability',
      'end_date_exclusive', true
    )
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_booking_id,
    v_user_id,
    null,
    'pending',
    'atomic_stay_booking_created'
  );

  return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."create_stay_booking_atomic_unlocked"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tour_booking_atomic"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_existing_schedule_id text;
  v_existing_guests_count integer;
  v_schedule_date date;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key, 0)
  );

  select b.id, b.booking_type, b.metadata ->> 'tour_schedule_id', b.guests_count
    into v_existing_id, v_existing_type, v_existing_schedule_id, v_existing_guests_count
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour'
       or v_existing_schedule_id is distinct from p_tour_schedule_id::text
       or v_existing_guests_count <> p_participants then
      raise exception 'idempotency_key_payload_conflict' using errcode = '23505';
    end if;

    return v_existing_id;
  end if;

  select ts.date
    into v_schedule_date
  from public.tour_schedules as ts
  where ts.id = p_tour_schedule_id
  for update;

  if v_schedule_date is not null and v_schedule_date < current_date then
    raise exception 'tour_schedule_in_past' using errcode = '22023';
  end if;

  return public.create_tour_booking_atomic_unlocked(
    p_tour_schedule_id,
    p_participants,
    p_idempotency_key
  );
end;
$$;


ALTER FUNCTION "public"."create_tour_booking_atomic"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_tour_booking_atomic_unlocked"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_type text;
  v_tour_id uuid;
  v_business_id uuid;
  v_date date;
  v_time time;
  v_capacity integer;
  v_booked_count integer;
  v_price numeric;
  v_total numeric;
  v_booking_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) < 8
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;

  if p_participants is null or p_participants < 1 then
    raise exception 'invalid_participants' using errcode = '22023';
  end if;

  -- Fast retry path.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  -- Lock one authoritative capacity row and fetch server-side tour price/business.
  select ts.tour_id, t.business_id, ts.date, ts.time, ts.capacity, ts.booked_count, t.price
    into v_tour_id, v_business_id, v_date, v_time, v_capacity, v_booked_count, v_price
  from public.tour_schedules as ts
  join public.tours as t on t.id = ts.tour_id
  where ts.id = p_tour_schedule_id
    and ts.status = 'available'
    and t.status = 'active'
  for update of ts;

  if v_tour_id is null then
    raise exception 'tour_schedule_not_available' using errcode = 'P0001';
  end if;

  -- Concurrent retry path after lock wait.
  select b.id, b.booking_type
    into v_existing_id, v_existing_type
  from public.bookings as b
  where b.client_id = v_user_id
    and b.metadata ->> 'idempotency_key' = p_idempotency_key
  limit 1;

  if v_existing_id is not null then
    if v_existing_type <> 'tour' then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return v_existing_id;
  end if;

  if v_capacity <= 0 or v_booked_count + p_participants > v_capacity then
    raise exception 'tour_capacity_exceeded' using errcode = 'P0001';
  end if;

  if v_price <= 0 then
    raise exception 'invalid_server_price' using errcode = 'P0001';
  end if;

  v_total := v_price * p_participants;

  update public.tour_schedules
  set booked_count = booked_count + p_participants
  where id = p_tour_schedule_id
    and booked_count + p_participants <= capacity;

  if not found then
    raise exception 'tour_capacity_changed' using errcode = '40001';
  end if;

  insert into public.bookings (
    client_id,
    business_id,
    booking_type,
    object_id,
    status,
    start_date,
    end_date,
    guests_count,
    total,
    payment_status,
    metadata
  ) values (
    v_user_id,
    v_business_id,
    'tour',
    v_tour_id,
    'pending',
    v_date,
    null,
    p_participants,
    v_total,
    'pending',
    jsonb_build_object(
      'idempotency_key', p_idempotency_key,
      'tour_schedule_id', p_tour_schedule_id,
      'schedule_time', v_time,
      'inventory_model', 'tour_schedules'
    )
  )
  returning id into v_booking_id;

  insert into public.booking_status_history (
    booking_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    v_booking_id,
    v_user_id,
    null,
    'pending',
    'atomic_tour_booking_created'
  );

  return v_booking_id;
end;
$$;


ALTER FUNCTION "public"."create_tour_booking_atomic_unlocked"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_active_client_transaction_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if new.client_id is null then
    raise exception 'client_identity_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = new.client_id
      and ur.role = 'client'
      and ur.is_active = true
  ) then
    raise exception 'client_role_required' using errcode = '42501';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_active_client_transaction_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_courier_active_deliveries"() RETURNS TABLE("delivery_id" "uuid", "order_id" "uuid", "client_id" "uuid", "business_id" "uuid", "type" "text", "delivery_status" "text", "payment_status" "text", "total" numeric, "delivery_fee" numeric, "metadata" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "partner_title" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not public.has_role('courier') then
    raise exception 'courier_role_required' using errcode = '42501';
  end if;

  return query
  select
    d.id as delivery_id,
    o.id as order_id,
    o.client_id,
    o.business_id,
    o.type,
    d.status as delivery_status,
    o.payment_status,
    o.total,
    o.delivery_fee,
    o.metadata,
    o.created_at,
    greatest(o.updated_at, d.updated_at) as updated_at,
    p.title as partner_title
  from public.courier_assignments ca
  join public.deliveries d
    on d.id = ca.delivery_id
   and d.assigned_courier_id = v_actor
  join public.orders o
    on o.id = d.order_id
  left join public.partners p
    on p.id = o.business_id
  where ca.courier_id = v_actor
    and ca.status in ('assigned','accepted','in_progress')
    and d.status not in ('delivered','delivery_failed')
  order by d.updated_at desc, d.id;
end;
$$;


ALTER FUNCTION "public"."get_courier_active_deliveries"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_courier_active_deliveries"() IS 'Constrained active-delivery read projection for the authenticated courier UI. Direct order SELECT remains unchanged.';



CREATE OR REPLACE FUNCTION "public"."get_public_stay_inventory"("p_stay_id" "uuid", "p_from" "date", "p_to" "date") RETURNS TABLE("room_id" "uuid", "stay_id" "uuid", "room_title" "text", "room_capacity" integer, "room_price_per_night" numeric, "room_status" "text", "availability_date" "date", "availability_status" "text", "available_count" integer, "price_override" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    r.id as room_id,
    r.stay_id,
    r.title as room_title,
    r.capacity as room_capacity,
    r.price_per_night as room_price_per_night,
    r.status as room_status,
    ra.date as availability_date,
    ra.status as availability_status,
    ra.available_count,
    ra.price_override
  from public.stays as s
  join public.partners as partner
    on partner.id = s.business_id
   and partner.status = 'approved'
   and partner.business_status = 'online'
  join public.rooms as r
    on r.stay_id = s.id
   and r.status = 'active'
  left join public.room_availability as ra
    on ra.room_id = r.id
   and ra.date >= p_from
   and ra.date < p_to
  where p_stay_id is not null
    and p_from is not null
    and p_to is not null
    and p_to > p_from
    and (p_to - p_from) <= 366
    and s.id = p_stay_id
    and s.status = 'active'
  order by r.title, ra.date;
$$;


ALTER FUNCTION "public"."get_public_stay_inventory"("p_stay_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_tour_schedules"("p_tour_id" "uuid", "p_from" "date", "p_to" "date") RETURNS TABLE("schedule_id" "uuid", "tour_id" "uuid", "schedule_date" "date", "start_time" time without time zone, "capacity" integer, "booked_count" integer, "remaining_count" integer, "schedule_status" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    ts.id as schedule_id,
    ts.tour_id,
    ts.date as schedule_date,
    ts.time as start_time,
    ts.capacity,
    ts.booked_count,
    greatest(ts.capacity - ts.booked_count, 0) as remaining_count,
    ts.status as schedule_status
  from public.tours as t
  join public.partners as partner
    on partner.id = t.business_id
   and partner.status = 'approved'
   and partner.business_status = 'online'
  join public.tour_schedules as ts
    on ts.tour_id = t.id
  where p_tour_id is not null
    and p_from is not null
    and p_to is not null
    and p_to > p_from
    and (p_to - p_from) <= 366
    and t.id = p_tour_id
    and t.status = 'active'
    and ts.status = 'available'
    and ts.date >= p_from
    and ts.date < p_to
    and ts.capacity > ts.booked_count
  order by ts.date, ts.time, ts.id;
$$;


ALTER FUNCTION "public"."get_public_tour_schedules"("p_tour_id" "uuid", "p_from" "date", "p_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("required_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.user_roles as ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
      and ur.is_active = true
  );
$$;


ALTER FUNCTION "public"."has_role"("required_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select public.has_role('super_admin')
    or public.has_role('support_admin')
    or public.has_role('finance_admin')
    or public.has_role('dispatcher');
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_assigned_courier"("delivery" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select (
    public.has_role('courier')
    and exists (
      select 1
      from public.courier_profiles cp
      where cp.user_id = (select auth.uid())
    )
    and exists (
      select 1
      from public.courier_assignments ca
      where ca.courier_id = (select auth.uid())
        and ca.delivery_id = delivery
        and ca.status in ('assigned','accepted','in_progress')
    )
  )
  or public.has_role('dispatcher')
  or public.has_role('super_admin');
$$;


ALTER FUNCTION "public"."is_assigned_courier"("delivery" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_finance_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select public.has_role('finance_admin')
    or public.has_role('super_admin');
$$;


ALTER FUNCTION "public"."is_finance_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_partner_for"("business" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.partner_staff as ps
    where ps.user_id = (select auth.uid())
      and ps.business_id = business
      and ps.is_active = true
      -- Staff membership alone must not survive application-role revocation.
      and exists (
        select 1 from public.user_roles as ur
        where ur.user_id = ps.user_id
          and ur.role in ('partner_owner', 'partner_manager', 'partner_staff')
          and ur.is_active = true
      )
  ) or public.has_role('super_admin');
$$;


ALTER FUNCTION "public"."is_partner_for"("business" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_create_finance_request_v1"("p_kind" "text", "p_source_id" "uuid", "p_amount" numeric, "p_requested_by" "uuid", "p_idempotency_key" "text", "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE v_business uuid;v_gross numeric;v_currency text;v_paid_status text;
 v_model text;v_customer uuid;v_payment_id uuid;v_journal_id uuid;
 v_requester_ok boolean;v_existing public.kol_finance_requests_v1%ROWTYPE;
BEGIN
 IF p_kind NOT IN ('refund','payout') OR p_source_id IS NULL OR p_requested_by IS NULL OR
    p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR
    p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 12 AND 128 OR
    p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 1000 THEN
  RAISE EXCEPTION 'invalid_finance_request' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance-request:'||p_kind||p_source_id::text,2));
 IF p_kind='refund' THEN
   SELECT p.id,p.amount,p.status,
     coalesce(o.business_id,b.business_id),
     coalesce(o.client_id,b.client_id),
     CASE WHEN o.id IS NOT NULL THEN 'KGS'
       WHEN b.booking_type='stay' THEN coalesce(nullif(btrim(st.currency),''),'UNKNOWN')
       WHEN b.booking_type='tour' THEN coalesce(nullif(btrim(t.currency),''),'UNKNOWN')
       ELSE 'UNKNOWN' END
   INTO v_payment_id,v_gross,v_paid_status,v_business,v_customer,v_currency
   FROM public.payments p
   LEFT JOIN public.orders o ON o.id=p.order_id
   LEFT JOIN public.bookings b ON b.id=p.booking_id
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours t ON b.booking_type='tour' AND t.id=b.object_id
   WHERE p.id=p_source_id FOR UPDATE OF p;
   IF v_payment_id IS NULL OR v_business IS NULL OR v_currency='UNKNOWN' OR
      v_paid_status<>'paid' OR p_amount>v_gross OR
      EXISTS(SELECT 1 FROM public.refunds rf WHERE rf.payment_id=v_payment_id) OR
      NOT EXISTS(
        SELECT 1 FROM private.payment_provider_events ev
        JOIN public.payments p ON p.id=ev.payment_id
        WHERE ev.payment_id=v_payment_id AND ev.provider=p.provider
          AND ev.provider_reference=p.provider_reference
          AND ev.processing_status='applied' AND ev.requested_status='paid'
          AND ev.amount=p.amount
      ) THEN
      RAISE EXCEPTION 'paid_refund_source_not_eligible' USING ERRCODE='42501';
   END IF;
   v_requester_ok:=p_requested_by=v_customer OR EXISTS(
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id=p_requested_by AND r.is_active AND r.role IN ('super_admin','finance_admin'));
 ELSE
   SELECT j.id,j.business_id,j.partner_allocation,j.currency,j.collection_model,j.payment_id
   INTO v_journal_id,v_business,v_gross,v_currency,v_model,v_payment_id
   FROM public.kol_finance_journals_v1 j WHERE j.id=p_source_id;
   IF v_journal_id IS NULL OR v_model<>'platform' OR p_amount>v_gross OR
     EXISTS(SELECT 1 FROM public.refunds rf WHERE rf.payment_id=v_payment_id) THEN
     RAISE EXCEPTION 'partner_payout_source_not_eligible' USING ERRCODE='42501';
   END IF;
   v_requester_ok:=EXISTS(
    SELECT 1 FROM public.user_roles r WHERE r.user_id=p_requested_by AND r.is_active
      AND r.role IN ('super_admin','finance_admin')
   ) OR EXISTS(
    SELECT 1 FROM public.user_roles r
    JOIN public.partner_profiles p ON p.user_id=r.user_id AND p.business_id=v_business
    WHERE r.user_id=p_requested_by AND r.is_active
      AND r.role IN ('partner_owner','partner_manager')
   );
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.user_profiles u
    WHERE u.user_id=p_requested_by AND u.status='active') OR NOT v_requester_ok THEN
  RAISE EXCEPTION 'requester_not_authorized_for_finance_source' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_existing FROM public.kol_finance_requests_v1
   WHERE (p_kind='refund' AND payment_id=p_source_id)
      OR (p_kind='payout' AND journal_id=p_source_id);
 IF FOUND THEN
   IF v_existing.idempotency_key=p_idempotency_key AND
      v_existing.requested_by=p_requested_by AND v_existing.amount=p_amount AND
      v_existing.reason=p_reason THEN
      RETURN jsonb_build_object('ok',true,'duplicate',true,'request_id',v_existing.id);
   END IF;
   RAISE EXCEPTION 'request_already_exists_for_source' USING ERRCODE='23505';
 END IF;
 IF EXISTS(SELECT 1 FROM public.kol_finance_requests_v1 WHERE idempotency_key=p_idempotency_key) THEN
   RAISE EXCEPTION 'request_idempotency_key_reuse' USING ERRCODE='23505';
 END IF;
 INSERT INTO public.kol_finance_requests_v1(
   request_kind,payment_id,journal_id,business_id,amount,currency,idempotency_key,
   requested_by,reason
 ) VALUES(p_kind,CASE WHEN p_kind='refund' THEN v_payment_id ELSE NULL END,
   CASE WHEN p_kind='payout' THEN v_journal_id ELSE NULL END,v_business,p_amount,
   v_currency,p_idempotency_key,p_requested_by,p_reason) RETURNING * INTO v_existing;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,reason,request_id,after)
 VALUES(p_requested_by,'kol_finance_request_created','kol_finance_requests_v1',
 v_existing.id,p_reason,p_idempotency_key,jsonb_build_object(
  'kind',p_kind,'business_id',v_business,'amount',p_amount,'currency',v_currency));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'request_id',v_existing.id);
END;
$$;


ALTER FUNCTION "public"."kol_create_finance_request_v1"("p_kind" "text", "p_source_id" "uuid", "p_amount" numeric, "p_requested_by" "uuid", "p_idempotency_key" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_decide_finance_request_v1"("p_request_id" "uuid", "p_decision" "text", "p_decided_by" "uuid", "p_evidence_ref" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE v_req public.kol_finance_requests_v1%ROWTYPE;
        v_dec public.kol_finance_decisions_v1%ROWTYPE;
BEGIN
 IF p_request_id IS NULL OR p_decision NOT IN ('approved','rejected')
   OR p_decided_by IS NULL OR p_evidence_ref IS NULL OR
   length(btrim(p_evidence_ref)) NOT BETWEEN 8 AND 500 THEN
   RAISE EXCEPTION 'invalid_decision_request' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('finance-decision:'||p_request_id::text,3));
 SELECT * INTO v_req FROM public.kol_finance_requests_v1
   WHERE id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found' USING ERRCODE='22023';END IF;
 IF v_req.requested_by=p_decided_by OR
   NOT EXISTS(SELECT 1 FROM public.user_roles r
     JOIN public.user_profiles u ON u.user_id=r.user_id
     WHERE r.user_id=p_decided_by AND r.role='super_admin' AND r.is_active
      AND u.status='active') THEN
  RAISE EXCEPTION 'independent_owner_approval_required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_dec FROM public.kol_finance_decisions_v1 WHERE request_id=p_request_id;
 IF FOUND THEN
  IF v_dec.decision=p_decision AND v_dec.decided_by=p_decided_by
     AND v_dec.decision_reference=p_evidence_ref THEN
    RETURN jsonb_build_object('ok',true,'duplicate',true,
     'decision_id',v_dec.id,'money_transferred',false);
  END IF;
  RAISE EXCEPTION 'request_already_decided' USING ERRCODE='23505';
 END IF;
 IF p_decision='approved' THEN
  IF v_req.request_kind='refund' AND
    (NOT EXISTS(SELECT 1 FROM public.payments p
       WHERE p.id=v_req.payment_id AND p.status='paid') OR
     EXISTS(SELECT 1 FROM public.refunds r WHERE r.payment_id=v_req.payment_id)) THEN
    RAISE EXCEPTION 'refund_source_changed' USING ERRCODE='42501';
  END IF;
  IF v_req.request_kind='payout' AND
    EXISTS(SELECT 1 FROM public.refunds r
      JOIN public.kol_finance_journals_v1 j ON j.payment_id=r.payment_id
      WHERE j.id=v_req.journal_id) THEN
    RAISE EXCEPTION 'payout_source_refunded' USING ERRCODE='42501';
  END IF;
 END IF;
 INSERT INTO public.kol_finance_decisions_v1(request_id,decision,decided_by,decision_reference)
  VALUES(p_request_id,p_decision,p_decided_by,p_evidence_ref)
  RETURNING * INTO v_dec;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,after)
 VALUES(p_decided_by,'super_admin','kol_finance_request_decided','kol_finance_decisions_v1',
  v_dec.id,p_evidence_ref,
  jsonb_build_object('request_id',p_request_id,'decision',p_decision,
   'money_transferred',false));
 RETURN jsonb_build_object('ok',true,'duplicate',false,
    'decision_id',v_dec.id,'money_transferred',false);
END;
$$;


ALTER FUNCTION "public"."kol_decide_finance_request_v1"("p_request_id" "uuid", "p_decision" "text", "p_decided_by" "uuid", "p_evidence_ref" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_finance_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from OR p_to - p_from > 366 THEN
   RAISE EXCEPTION 'Invalid reporting period' USING ERRCODE = '22023';
 END IF;
 RETURN (
 WITH
 os AS (
   SELECT id,business_id,type,status,total,(created_at AT TIME ZONE 'Asia/Bishkek')::date AS day
   FROM public.orders WHERE created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR business_id=p_business_id)
 ),
 bs AS (
   SELECT b.id,b.business_id,b.booking_type,b.status,b.total,
     (b.created_at AT TIME ZONE 'Asia/Bishkek')::date AS day,
     COALESCE(CASE WHEN b.booking_type='stay' THEN NULLIF(BTRIM(st.currency),'')
       WHEN b.booking_type='tour' THEN NULLIF(BTRIM(tr.currency),'') END,'UNKNOWN') AS currency
   FROM public.bookings b
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours tr ON b.booking_type='tour' AND tr.id=b.object_id
   WHERE b.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND b.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR b.business_id=p_business_id)
 ),
 linked_payments AS (
   SELECT p.id,p.order_id,p.booking_id,p.status,p.amount,p.created_at,
    (p.created_at AT TIME ZONE 'Asia/Bishkek')::date AS day,
    COALESCE(o.business_id,b.business_id) AS business_id,
    CASE WHEN o.id IS NOT NULL THEN 'KGS'
      WHEN b.booking_type='stay' THEN COALESCE(NULLIF(BTRIM(st.currency),''),'UNKNOWN')
      WHEN b.booking_type='tour' THEN COALESCE(NULLIF(BTRIM(tr.currency),''),'UNKNOWN')
      ELSE 'UNKNOWN' END AS currency
   FROM public.payments p
   LEFT JOIN public.orders o ON o.id=p.order_id
   LEFT JOIN public.bookings b ON b.id=p.booking_id
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours tr ON b.booking_type='tour' AND tr.id=b.object_id
   WHERE (o.id IS NOT NULL) <> (b.id IS NOT NULL)
   AND (p_business_id IS NULL OR COALESCE(o.business_id,b.business_id)=p_business_id)
 ),
 ps AS (SELECT * FROM linked_payments WHERE created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')),
 fr AS (
   SELECT r.id,r.status,r.amount,p.currency FROM public.refunds r
   JOIN linked_payments p ON p.id=r.payment_id
   WHERE r.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND r.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
 ),
 po AS (
   SELECT id,status FROM public.payouts WHERE created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR (recipient_type='partner' AND recipient_id=p_business_id))
 ),
 od AS (SELECT day,count(*) AS n FROM os GROUP BY day),
 bd AS (SELECT day,count(*) AS n FROM bs GROUP BY day),
 pd AS (SELECT day,count(*) FILTER (WHERE status='paid') AS n FROM ps GROUP BY day),
 days AS (
   SELECT d::date AS day,COALESCE(od.n,0) AS orders_count,
    COALESCE(bd.n,0) AS bookings_count,COALESCE(pd.n,0) AS paid_payment_records
   FROM generate_series(p_from::timestamp,(p_to-1)::timestamp,interval '1 day') d
   LEFT JOIN od ON od.day=d::date
   LEFT JOIN bd ON bd.day=d::date
   LEFT JOIN pd ON pd.day=d::date
 )
 SELECT jsonb_build_object(
  'schema_version',1,'timezone','Asia/Bishkek',
  'period_from',p_from,'period_to_exclusive',p_to,'business_id',p_business_id,
  'orders',jsonb_build_object(
    'count',(SELECT count(*) FROM os),
    'submitted_value_kgs',COALESCE((SELECT sum(total) FROM os),0),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM os GROUP BY status) v),
    'by_type',(SELECT COALESCE(jsonb_object_agg(type,n),'{}'::jsonb)
               FROM (SELECT type,count(*) AS n FROM os GROUP BY type) v)
  ),
  'bookings',jsonb_build_object(
    'count',(SELECT count(*) FROM bs),
    'submitted_value_by_currency',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('currency',currency,'amount',amount,'count',n) ORDER BY currency),'[]'::jsonb)
       FROM (SELECT currency,sum(total) AS amount,count(*) AS n FROM bs GROUP BY currency) v),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM bs GROUP BY status) v)
  ),
  'payments',jsonb_build_object(
    'attempts',(SELECT count(*) FROM ps),
    'recorded_paid_count',(SELECT count(*) FROM ps WHERE status='paid'),
    'recorded_paid_by_currency',
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('currency',currency,'amount',amount,'count',n) ORDER BY currency),'[]'::jsonb)
       FROM (SELECT currency,sum(amount) AS amount,count(*) AS n
             FROM ps WHERE status='paid' GROUP BY currency) v),
    'duplicate_paid_subjects',
      (SELECT count(*) FROM (SELECT COALESCE('order:'||order_id::text,'booking:'||booking_id::text) AS subject
         FROM ps WHERE status='paid'
         GROUP BY COALESCE('order:'||order_id::text,'booking:'||booking_id::text)
         HAVING count(*)>1) duplicates)
  ),
  'refunds',jsonb_build_object(
    'records',(SELECT count(*) FROM fr),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM fr GROUP BY status) v)
  ),
  'payouts',jsonb_build_object(
    'records',(SELECT count(*) FROM po),
    'by_status',(SELECT COALESCE(jsonb_object_agg(status,n),'{}'::jsonb)
                 FROM (SELECT status,count(*) AS n FROM po GROUP BY status) v)
  ),
  'commissions',jsonb_build_object(
    'active_terms',(SELECT count(*) FROM public.commissions
                   WHERE is_active AND (p_business_id IS NULL OR business_id=p_business_id)),
    'earned_amount',NULL
  ),
  'daily',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
     'date',day,'orders',orders_count,'bookings',bookings_count,
     'recorded_paid_payments',paid_payment_records) ORDER BY day),'[]'::jsonb) FROM days),
  'unconfirmed',jsonb_build_array(
    'net_platform_revenue','profit','partner_payable','courier_earnings','marketing_conversion')
 )
 );
END;
$$;


ALTER FUNCTION "public"."kol_finance_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_finance_cost_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 SELECT jsonb_build_object(
   'schema_version',1,'kind','owner_attested_expense_activity',
   'period_from',p_from,'period_to_exclusive',p_to,
   'business_id',p_business_id,'date_basis','posted_at','timezone','Asia/Bishkek',
   'cost_entries',(SELECT count(*) FROM public.kol_finance_cost_journals_v1 j
     WHERE j.posted_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND j.posted_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND (p_business_id IS NULL OR j.business_id=p_business_id)),
   'by_currency',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'currency',currency,'recognized_expense_activity',net_cost,
     'original_expenses',expense_count,'reversals',reversal_count) ORDER BY currency),'[]'::jsonb)
    FROM (
     SELECT currency,
      sum(CASE WHEN operation='expense' THEN amount ELSE -amount END) AS net_cost,
      count(*) FILTER (WHERE operation='expense') AS expense_count,
      count(*) FILTER (WHERE operation='reversal') AS reversal_count
     FROM public.kol_finance_cost_journals_v1 j
     WHERE j.posted_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND j.posted_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND (p_business_id IS NULL OR j.business_id=p_business_id)
     GROUP BY currency
    ) v),
   'actual_bank_outflow',NULL,'net_profit',NULL,
   'warning','Owner-attested accrued costs only. Completeness of expenses, receipts, taxes, bank transfers and net profit not verified.'
 )
 );
END;
$$;


ALTER FUNCTION "public"."kol_finance_cost_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_finance_journal_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 WITH journals AS (
  SELECT * FROM public.kol_finance_journals_v1 j
  WHERE j.recognized_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND j.recognized_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
   AND (p_business_id IS NULL OR j.business_id=p_business_id)
 ),
 sums AS (
  SELECT j.currency, count(*) AS n,sum(j.gross_amount) gross,
    sum(j.platform_fee) fee,
    sum(CASE WHEN j.collection_model='platform' THEN j.partner_allocation ELSE 0 END) partner_payable,
    sum(CASE WHEN j.collection_model='partner' THEN j.platform_fee ELSE 0 END) partner_receivable
  FROM journals j GROUP BY j.currency
 )
 SELECT jsonb_build_object(
  'schema_version',1,'kind','posted_recognition_journal',
  'period_from',p_from,'period_to_exclusive',p_to,
  'date_basis','recognized_at','timezone','Asia/Bishkek',
  'business_id',p_business_id,
  'journal_count',(SELECT count(*) FROM journals),
  'by_currency',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'currency',currency,'recognitions',n,'verified_provider_gross',gross,
     'recognized_platform_fee',fee,
     'posted_partner_payable_before_payouts',partner_payable,
     'posted_partner_receivable_before_collections',partner_receivable
  ) ORDER BY currency),'[]'::jsonb) FROM sums),
  'bank_settled',NULL,'actual_paid_payout',NULL,'net_profit',NULL,
  'warning','Ledger recognition is approved and source-verified; bank settlement, payouts, costs, and profit require separate postings.'
 )
 );
END;
$$;


ALTER FUNCTION "public"."kol_finance_journal_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_finance_requests_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
   RAISE EXCEPTION 'invalid_reporting_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 SELECT jsonb_build_object(
   'schema_version',1,'kind','approval_workflow_not_transfer',
   'period_from',p_from,'period_to_exclusive',p_to,
   'business_id',p_business_id,'timezone','Asia/Bishkek',
   'requests',(SELECT count(*) FROM public.kol_finance_requests_v1 r
     WHERE r.requested_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND r.requested_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
       AND (p_business_id IS NULL OR r.business_id=p_business_id)),
   'by_kind_and_decision',(
     SELECT coalesce(jsonb_agg(jsonb_build_object(
       'kind',kind,'decision',decision,'count',n) ORDER BY kind,decision),'[]'::jsonb)
     FROM (
       SELECT r.request_kind kind,coalesce(d.decision,'pending') decision,count(*) n
       FROM public.kol_finance_requests_v1 r
       LEFT JOIN public.kol_finance_decisions_v1 d ON d.request_id=r.id
       WHERE r.requested_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
         AND r.requested_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
         AND (p_business_id IS NULL OR r.business_id=p_business_id)
       GROUP BY r.request_kind,coalesce(d.decision,'pending')
     ) v),
   'actual_refund_executed',NULL,'actual_payout_transferred',NULL,
   'warning','Approval is not evidence that funds moved. No settlement is executed.'
 )
 );
END;
$$;


ALTER FUNCTION "public"."kol_finance_requests_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_finance_settlement_preview_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
   RAISE EXCEPTION 'invalid_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 WITH subjects AS (
   SELECT 'order'::text AS subject_type,o.id,o.business_id,o.type AS service_line,
     'KGS'::text AS currency,o.total AS gross,o.status,o.payment_status,o.created_at
   FROM public.orders o
   WHERE o.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND o.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND (p_business_id IS NULL OR o.business_id=p_business_id)
   UNION ALL
   SELECT 'booking'::text,b.id,b.business_id,b.booking_type,
     COALESCE(CASE WHEN b.booking_type='stay' THEN NULLIF(btrim(st.currency),'')
       WHEN b.booking_type='tour' THEN NULLIF(btrim(tr.currency),'') END,'UNKNOWN'),
     b.total,b.status,b.payment_status,b.created_at
   FROM public.bookings b
   LEFT JOIN public.rooms rm ON b.booking_type='stay' AND rm.id=b.object_id
   LEFT JOIN public.stays st ON st.id=rm.stay_id
   LEFT JOIN public.tours tr ON b.booking_type='tour' AND tr.id=b.object_id
   WHERE b.created_at >= (p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND b.created_at < (p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
     AND (p_business_id IS NULL OR b.business_id=p_business_id)
 ),
 checks AS (
   SELECT s.*,
     coalesce(paid.paid_count,0) AS paid_count,
     coalesce(paid.verified_count,0) AS verified_count,
     paid.amount AS verified_amount,
     coalesce(paid.has_refund,false) AS has_refund,
     coalesce(term.contract_count,0) AS contract_count,
     term.rate_percent,term.fixed_fee,term.collection_model,
     round((paid.amount * term.rate_percent/100 + term.fixed_fee)::numeric,2) AS projected_fee
   FROM subjects s
   LEFT JOIN LATERAL (
     SELECT count(*) AS paid_count,
       count(*) FILTER (WHERE EXISTS (
         SELECT 1 FROM private.payment_provider_events ev
         WHERE ev.payment_id=p.id AND ev.provider=p.provider
           AND ev.provider_reference=p.provider_reference
           AND ev.requested_status='paid' AND ev.processing_status='applied'
           AND ev.amount=p.amount
       )) AS verified_count,
       max(p.amount) FILTER (WHERE EXISTS (
         SELECT 1 FROM private.payment_provider_events ev
         WHERE ev.payment_id=p.id AND ev.provider=p.provider
           AND ev.provider_reference=p.provider_reference
           AND ev.requested_status='paid' AND ev.processing_status='applied'
           AND ev.amount=p.amount
       )) AS amount,
       bool_or(EXISTS(
         SELECT 1 FROM public.refunds rf WHERE rf.payment_id=p.id
       )) AS has_refund
     FROM public.payments p
     WHERE p.status='paid'
       AND ((s.subject_type='order' AND p.order_id=s.id)
         OR (s.subject_type='booking' AND p.booking_id=s.id))
   ) paid ON true
   LEFT JOIN LATERAL (
     SELECT count(*) AS contract_count,min(t.rate_percent) AS rate_percent,
       min(t.fixed_fee) AS fixed_fee,min(t.collection_model) AS collection_model
     FROM public.kol_finance_terms_v1 t
     WHERE t.business_id=s.business_id AND t.service_line=s.service_line
       AND t.currency=s.currency
       AND (s.created_at AT TIME ZONE 'Asia/Bishkek')::date >= t.valid_from
       AND (s.created_at AT TIME ZONE 'Asia/Bishkek')::date < t.valid_until
   ) term ON true
 ),
 marked AS (
   SELECT *,(
     status='completed' AND payment_status='paid' AND paid_count=1
     AND verified_count=1 AND NOT has_refund AND contract_count=1
     AND currency<>'UNKNOWN' AND verified_amount=gross AND gross>=0
     AND projected_fee IS NOT NULL AND projected_fee<=verified_amount
   ) AS is_preview_eligible
   FROM checks
 )
 SELECT jsonb_build_object(
   'schema_version',1,'kind','non_posting_settlement_preview',
   'period_from',p_from,'period_to_exclusive',p_to,
   'timezone','Asia/Bishkek','business_id',p_business_id,
   'counts',jsonb_build_object(
     'subjects',(SELECT count(*) FROM marked),
     'completed',(SELECT count(*) FROM marked WHERE status='completed'),
     'paid_rows',(SELECT count(*) FROM marked WHERE paid_count>0),
     'verified_paid_rows',(SELECT count(*) FROM marked WHERE verified_count=1 AND paid_count=1),
     'preview_eligible',(SELECT count(*) FROM marked WHERE is_preview_eligible),
     'unverified_paid_subjects',(SELECT count(*) FROM marked WHERE paid_count>verified_count),
     'duplicate_paid_subjects',(SELECT count(*) FROM marked WHERE paid_count>1),
     'refund_blocked',(SELECT count(*) FROM marked WHERE has_refund),
     'missing_terms',(SELECT count(*) FROM marked WHERE verified_count=1 AND contract_count=0),
     'ambiguous_terms',(SELECT count(*) FROM marked WHERE contract_count>1),
     'overpriced_fee',(SELECT count(*) FROM marked WHERE projected_fee>verified_amount)
   ),
   'by_currency',(SELECT coalesce(jsonb_agg(jsonb_build_object(
     'currency',currency,'eligible_count',n,
     'provider_verified_gross',gross_total,
     'provisional_platform_fee',fee_total,
     'provisional_partner_allocation_if_platform_collects',partner_share,
     'provisional_platform_receivable_if_partner_collects',partner_collected_fee
   ) ORDER BY currency),'[]'::jsonb)
   FROM (
     SELECT currency,count(*) AS n,sum(verified_amount) AS gross_total,
       sum(projected_fee) AS fee_total,
       sum(CASE WHEN collection_model='platform' THEN verified_amount-projected_fee ELSE 0 END)
         AS partner_share,
       sum(CASE WHEN collection_model='partner' THEN projected_fee ELSE 0 END)
         AS partner_collected_fee
     FROM marked WHERE is_preview_eligible GROUP BY currency
   ) t),
   'recognized_revenue',NULL,'actual_partner_payable',NULL,
   'actual_paid_payout',NULL,'profit',NULL,'posted_financial_transactions',0,
   'warning','PROVISIONAL ONLY: contracts and provider events do not substitute for bank reconciliation or a posted ledger.'
 )
 );
END;
$$;


ALTER FUNCTION "public"."kol_finance_settlement_preview_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_operations_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
 IF p_from IS NULL OR p_to IS NULL OR p_to<=p_from OR p_to-p_from>366 THEN
  RAISE EXCEPTION 'invalid_analytics_period' USING ERRCODE='22023';
 END IF;
 RETURN (
 WITH os AS (
   SELECT o.client_id,o.business_id,o.status,o.type,o.total,
     (o.created_at AT TIME ZONE 'Asia/Bishkek')::date AS local_date,
     extract(hour FROM o.created_at AT TIME ZONE 'Asia/Bishkek')::integer AS local_hour
   FROM public.orders o
   WHERE o.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND o.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR o.business_id=p_business_id)
 ),
 bs AS (
   SELECT b.client_id,b.business_id,b.status,b.booking_type,
     (b.created_at AT TIME ZONE 'Asia/Bishkek')::date AS local_date,
     extract(hour FROM b.created_at AT TIME ZONE 'Asia/Bishkek')::integer AS local_hour
   FROM public.bookings b
   WHERE b.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND b.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR b.business_id=p_business_id)
 ),
 activity AS (
   SELECT os.client_id,os.local_date,os.local_hour,'order'::text AS source FROM os
   UNION ALL SELECT bs.client_id,bs.local_date,bs.local_hour,'booking'::text FROM bs
 ),
 client_counts AS (
   SELECT client_id,count(*) AS n FROM activity GROUP BY client_id
 ),
 deliveries_scope AS (
   SELECT d.status,d.risk_level
   FROM public.deliveries d JOIN public.orders o ON o.id=d.order_id
   WHERE d.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND d.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR o.business_id=p_business_id)
 ),
 supports AS (
   SELECT t.id,t.status FROM public.support_tickets t
   LEFT JOIN public.orders oo ON oo.id=t.related_order_id
   LEFT JOIN public.bookings bb ON bb.id=t.related_booking_id
   WHERE t.created_at >=(p_from::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND t.created_at <(p_to::timestamp AT TIME ZONE 'Asia/Bishkek')
    AND (p_business_id IS NULL OR oo.business_id=p_business_id OR bb.business_id=p_business_id)
 )
 SELECT jsonb_build_object(
   'schema_version',1,'kind','operational_not_financial',
   'business_id',p_business_id,'period_from',p_from,'period_to_exclusive',p_to,
   'timezone','Asia/Bishkek',
   'orders',jsonb_build_object(
      'count',(SELECT count(*) FROM os),
      'completed',(SELECT count(*) FROM os WHERE status='completed'),
      'cancelled',(SELECT count(*) FROM os WHERE status IN ('cancelled','rejected')),
      'submitted_value_kgs',(SELECT coalesce(sum(total),0) FROM os),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM os GROUP BY status) x),
      'by_service',(SELECT coalesce(jsonb_object_agg(type,n),'{}'::jsonb)
       FROM (SELECT type,count(*) AS n FROM os GROUP BY type) x)
   ),
   'bookings',jsonb_build_object(
      'count',(SELECT count(*) FROM bs),
      'completed',(SELECT count(*) FROM bs WHERE status='completed'),
      'cancelled',(SELECT count(*) FROM bs WHERE status IN ('cancelled','rejected','no_show')),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM bs GROUP BY status) x),
      'by_service',(SELECT coalesce(jsonb_object_agg(booking_type,n),'{}'::jsonb)
       FROM (SELECT booking_type,count(*) AS n FROM bs GROUP BY booking_type) x)
   ),
   'clients',jsonb_build_object(
      'unique_in_period',(SELECT count(*) FROM client_counts),
      'repeat_in_period',(SELECT count(*) FROM client_counts WHERE n>=2),
      'repeat_percentage_in_period',(SELECT
         round((count(*) FILTER(WHERE n>=2))::numeric*100/NULLIF(count(*),0),2)
         FROM client_counts)
   ),
   'deliveries',jsonb_build_object(
      'count',(SELECT count(*) FROM deliveries_scope),
      'high_risk',(SELECT count(*) FROM deliveries_scope WHERE risk_level IN ('high','critical')),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM deliveries_scope GROUP BY status) x),
      'sla_minutes',NULL
   ),
   'support',jsonb_build_object(
      'count',(SELECT count(*) FROM supports),
      'by_status',(SELECT coalesce(jsonb_object_agg(status,n),'{}'::jsonb)
       FROM (SELECT status,count(*) AS n FROM supports GROUP BY status) x)
   ),
   'daily',(SELECT coalesce(jsonb_agg(jsonb_build_object(
       'date',dt.local_date,
       'orders',(SELECT count(*) FROM os WHERE local_date=dt.local_date),
       'bookings',(SELECT count(*) FROM bs WHERE local_date=dt.local_date),
       'completed_orders',(SELECT count(*) FROM os WHERE local_date=dt.local_date AND status='completed'),
       'completed_bookings',(SELECT count(*) FROM bs WHERE local_date=dt.local_date AND status='completed')
     ) ORDER BY dt.local_date),'[]'::jsonb)
     FROM (SELECT generate_series(p_from::timestamp,(p_to-1)::timestamp,interval '1 day')::date AS local_date) dt),
   'hourly_created_operations',(SELECT coalesce(jsonb_agg(jsonb_build_object(
       'hour',h.hh,'count',(SELECT count(*) FROM activity WHERE local_hour=h.hh)
     ) ORDER BY h.hh),'[]'::jsonb)
     FROM generate_series(0,23) AS h(hh)),
   'traffic_visits',NULL,'conversion_rate',NULL,'marketing_attribution',NULL,
   'paid_revenue',NULL,'profit',NULL,
   'warning','Real recorded operations only. Repeat customers are within this period; no traffic conversion, attribution or revenue inferred.'
 )
 );
END;
$$;


ALTER FUNCTION "public"."kol_operations_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_post_finance_cost_v1"("p_operation" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_business_id" "uuid", "p_document_reference" "text", "p_approved_by" "uuid", "p_approval_reference" "text", "p_idempotency_key" "text", "p_original_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE v_old public.kol_finance_cost_journals_v1%ROWTYPE;
 v_prev public.kol_finance_cost_journals_v1%ROWTYPE;
 v_id uuid;v_debits numeric;v_credits numeric;
 v_amount numeric;v_currency text;v_category text;v_business_id uuid;
BEGIN
 IF p_operation NOT IN ('expense','reversal') OR
    p_idempotency_key IS NULL OR length(p_idempotency_key) NOT BETWEEN 12 AND 128 OR
    p_document_reference IS NULL OR length(btrim(p_document_reference)) NOT BETWEEN 8 AND 500 OR
    p_approval_reference IS NULL OR length(btrim(p_approval_reference)) NOT BETWEEN 8 AND 500 OR
    p_approved_by IS NULL THEN
    RAISE EXCEPTION 'invalid_cost_request' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.user_roles r
  JOIN public.user_profiles u ON u.user_id=r.user_id
  WHERE r.user_id=p_approved_by AND r.is_active AND r.role='super_admin'
    AND u.status='active'
 ) THEN
  RAISE EXCEPTION 'active_owner_approval_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('kol-cost-key:'||p_idempotency_key,4));
 SELECT * INTO v_prev FROM public.kol_finance_cost_journals_v1 WHERE idempotency_key=p_idempotency_key;
 IF FOUND THEN
  IF v_prev.operation=p_operation AND v_prev.amount=p_amount
   AND v_prev.currency IS NOT DISTINCT FROM p_currency
   AND v_prev.category IS NOT DISTINCT FROM p_category
   AND v_prev.business_id IS NOT DISTINCT FROM p_business_id
   AND v_prev.document_reference=p_document_reference
   AND v_prev.approved_by=p_approved_by
   AND v_prev.approval_reference=p_approval_reference
   AND v_prev.original_id IS NOT DISTINCT FROM p_original_id THEN
   RETURN jsonb_build_object('ok',true,'duplicate',true,'journal_id',v_prev.id,
    'operation',v_prev.operation,'recognized_cost',CASE WHEN v_prev.operation='expense' THEN v_prev.amount ELSE -v_prev.amount END);
  END IF;
  RAISE EXCEPTION 'cost_idempotency_conflict' USING ERRCODE='23505';
 END IF;
 IF p_operation='expense' THEN
  IF p_original_id IS NOT NULL OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2)
   OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$'
   OR p_category NOT IN ('hosting','marketing','staff','logistics','operations','other') THEN
   RAISE EXCEPTION 'invalid_expense_terms' USING ERRCODE='22023';
  END IF;
  v_amount:=p_amount;v_currency:=p_currency;v_category:=p_category;v_business_id:=p_business_id;
 ELSE
  IF p_original_id IS NULL THEN RAISE EXCEPTION 'original_expense_required' USING ERRCODE='22023';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('kol-cost-reversal:'||p_original_id::text,5));
  SELECT * INTO v_old FROM public.kol_finance_cost_journals_v1 WHERE id=p_original_id;
  IF NOT FOUND OR v_old.operation<>'expense' THEN
   RAISE EXCEPTION 'expense_to_reverse_not_found' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM public.kol_finance_cost_journals_v1 WHERE original_id=p_original_id) THEN
   RAISE EXCEPTION 'expense_already_reversed' USING ERRCODE='23505';
  END IF;
  IF p_amount IS DISTINCT FROM v_old.amount OR p_currency IS DISTINCT FROM v_old.currency
    OR p_category IS DISTINCT FROM v_old.category OR p_business_id IS DISTINCT FROM v_old.business_id THEN
   RAISE EXCEPTION 'expense_reversal_amount_or_scope_mismatch' USING ERRCODE='23514';
  END IF;
  v_amount:=v_old.amount;v_currency:=v_old.currency;v_category:=v_old.category;
  v_business_id:=v_old.business_id;
 END IF;
 INSERT INTO public.kol_finance_cost_journals_v1(
  operation,idempotency_key,original_id,business_id,category,amount,currency,
  document_reference,approved_by,approval_reference
 ) VALUES(p_operation,p_idempotency_key,p_original_id,v_business_id,v_category,
  v_amount,v_currency,p_document_reference,p_approved_by,p_approval_reference)
 RETURNING id INTO v_id;
 IF p_operation='expense' THEN
  INSERT INTO public.kol_finance_cost_entries_v1(cost_journal_id,ledger_account,entry_side,amount,currency)
  VALUES(v_id,'operating_expense','debit',v_amount,v_currency),
        (v_id,'accrued_expense_liability','credit',v_amount,v_currency);
 ELSE
  INSERT INTO public.kol_finance_cost_entries_v1(cost_journal_id,ledger_account,entry_side,amount,currency)
  VALUES(v_id,'accrued_expense_liability','debit',v_amount,v_currency),
        (v_id,'operating_expense','credit',v_amount,v_currency);
 END IF;
 SELECT coalesce(sum(amount) FILTER (WHERE entry_side='debit'),0),
        coalesce(sum(amount) FILTER (WHERE entry_side='credit'),0)
 INTO v_debits,v_credits FROM public.kol_finance_cost_entries_v1 WHERE cost_journal_id=v_id;
 IF v_debits<>v_credits OR v_debits<>v_amount THEN
  RAISE EXCEPTION 'unbalanced_cost_posting' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,request_id,after)
 VALUES(p_approved_by,'super_admin','kol_finance_cost_'||p_operation,
  'kol_finance_cost_journals_v1',v_id,p_approval_reference,p_idempotency_key,
  jsonb_build_object('operation',p_operation,'amount',v_amount,'currency',v_currency,
    'category',v_category,'document_reference',p_document_reference,
    'original_id',p_original_id,'business_id',v_business_id));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'journal_id',v_id,
  'operation',p_operation,'recognized_cost',CASE WHEN p_operation='expense' THEN v_amount ELSE -v_amount END);
END;
$_$;


ALTER FUNCTION "public"."kol_post_finance_cost_v1"("p_operation" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_business_id" "uuid", "p_document_reference" "text", "p_approved_by" "uuid", "p_approval_reference" "text", "p_idempotency_key" "text", "p_original_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_post_verified_recognition_v1"("p_subject_type" "text", "p_subject_id" "uuid", "p_idempotency_key" "text", "p_approved_by" "uuid", "p_approval_reference" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
 v_existing public.kol_finance_journals_v1%ROWTYPE;
 v_business uuid;v_type text;v_currency text;v_gross numeric;v_status text;
 v_payment_status text;v_created_at timestamptz;
 v_payment_count int;v_payment_id uuid;v_paid_amount numeric;v_provider text;v_provider_ref text;
 v_event_id uuid;v_term_count int;v_term_id uuid;v_rate numeric;v_fixed numeric;v_model text;
 v_fee numeric;v_partner_share numeric;v_journal_id uuid;v_debit numeric;v_credit numeric;
BEGIN
 IF p_subject_type NOT IN ('order','booking') OR p_subject_id IS NULL OR
    p_approved_by IS NULL OR p_idempotency_key IS NULL OR
    length(p_idempotency_key) NOT BETWEEN 12 AND 128 OR
    p_approval_reference IS NULL OR length(btrim(p_approval_reference)) NOT BETWEEN 8 AND 200 THEN
  RAISE EXCEPTION 'invalid_journal_request' USING ERRCODE='22023';
 END IF;
 IF NOT EXISTS(
   SELECT 1 FROM public.user_roles r JOIN public.user_profiles u ON u.user_id=r.user_id
   WHERE r.user_id=p_approved_by AND r.role='super_admin'
     AND r.is_active AND u.status='active'
 ) THEN
  RAISE EXCEPTION 'active_owner_approval_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_subject_type||':'||p_subject_id::text,1));
 SELECT * INTO v_existing FROM public.kol_finance_journals_v1
   WHERE journal_kind='recognition' AND subject_type=p_subject_type AND subject_id=p_subject_id;
 IF FOUND THEN
   IF v_existing.idempotency_key=p_idempotency_key AND
      v_existing.approved_by=p_approved_by AND
      v_existing.approval_reference=p_approval_reference THEN
     RETURN jsonb_build_object('ok',true,'duplicate',true,'journal_id',v_existing.id,
       'gross_amount',v_existing.gross_amount,'platform_fee',v_existing.platform_fee,
       'currency',v_existing.currency,'recognized_at',v_existing.recognized_at);
   END IF;
   RAISE EXCEPTION 'recognition_already_posted_with_other_request' USING ERRCODE='23505';
 END IF;
 IF EXISTS(SELECT 1 FROM public.kol_finance_journals_v1 WHERE idempotency_key=p_idempotency_key) THEN
   RAISE EXCEPTION 'idempotency_key_reused' USING ERRCODE='23505';
 END IF;
 IF p_subject_type='order' THEN
   SELECT o.business_id,o.type,'KGS',o.total,o.status,o.payment_status,o.created_at
    INTO v_business,v_type,v_currency,v_gross,v_status,v_payment_status,v_created_at
   FROM public.orders o WHERE o.id=p_subject_id FOR UPDATE;
 ELSE
   SELECT b.business_id,b.booking_type,
     coalesce(CASE WHEN b.booking_type='stay' THEN nullif(btrim(st.currency),'')
       WHEN b.booking_type='tour' THEN nullif(btrim(t.currency),'') END,'UNKNOWN'),
     b.total,b.status,b.payment_status,b.created_at
    INTO v_business,v_type,v_currency,v_gross,v_status,v_payment_status,v_created_at
   FROM public.bookings b
   LEFT JOIN public.rooms r ON b.booking_type='stay' AND r.id=b.object_id
   LEFT JOIN public.stays st ON st.id=r.stay_id
   LEFT JOIN public.tours t ON b.booking_type='tour' AND t.id=b.object_id
   WHERE b.id=p_subject_id FOR UPDATE OF b;
 END IF;
 IF v_business IS NULL OR v_status<>'completed' OR v_payment_status<>'paid' OR
    v_currency='UNKNOWN' OR v_gross IS NULL OR v_gross<=0 OR
    v_gross<>round(v_gross,2) THEN
  RAISE EXCEPTION 'subject_not_ready_for_recognition' USING ERRCODE='42501';
 END IF;
 SELECT count(*) INTO v_payment_count
 FROM public.payments p WHERE p.status='paid'
   AND ((p_subject_type='order' AND p.order_id=p_subject_id) OR
        (p_subject_type='booking' AND p.booking_id=p_subject_id));
 IF v_payment_count=1 THEN
   SELECT p.id,p.amount,p.provider,p.provider_reference
     INTO v_payment_id,v_paid_amount,v_provider,v_provider_ref
   FROM public.payments p WHERE p.status='paid'
     AND ((p_subject_type='order' AND p.order_id=p_subject_id) OR
          (p_subject_type='booking' AND p.booking_id=p_subject_id))
   LIMIT 1;
 END IF;
 IF v_payment_count<>1 OR v_paid_amount IS DISTINCT FROM v_gross OR
    v_provider IS NULL OR v_provider_ref IS NULL THEN
  RAISE EXCEPTION 'exactly_one_matching_paid_payment_required' USING ERRCODE='42501';
 END IF;
 IF EXISTS(SELECT 1 FROM public.refunds f WHERE f.payment_id=v_payment_id) THEN
  RAISE EXCEPTION 'refund_or_dispute_blocks_recognition' USING ERRCODE='42501';
 END IF;
 SELECT e.id INTO v_event_id FROM private.payment_provider_events e
 WHERE e.payment_id=v_payment_id AND e.provider=v_provider
   AND e.provider_reference=v_provider_ref AND e.requested_status='paid'
   AND e.processing_status='applied' AND e.amount=v_gross
 ORDER BY e.processed_at DESC NULLS LAST,e.id DESC LIMIT 1;
 IF v_event_id IS NULL THEN
  RAISE EXCEPTION 'verified_provider_payment_event_required' USING ERRCODE='42501';
 END IF;
 SELECT count(*) INTO v_term_count
 FROM public.kol_finance_terms_v1 t
 WHERE t.business_id=v_business AND t.service_line=v_type AND t.currency=v_currency
   AND (v_created_at AT TIME ZONE 'Asia/Bishkek')::date>=t.valid_from
   AND (v_created_at AT TIME ZONE 'Asia/Bishkek')::date<t.valid_until;
 IF v_term_count=1 THEN
   SELECT t.id,t.rate_percent,t.fixed_fee,t.collection_model
     INTO v_term_id,v_rate,v_fixed,v_model
   FROM public.kol_finance_terms_v1 t
   WHERE t.business_id=v_business AND t.service_line=v_type AND t.currency=v_currency
     AND (v_created_at AT TIME ZONE 'Asia/Bishkek')::date>=t.valid_from
     AND (v_created_at AT TIME ZONE 'Asia/Bishkek')::date<t.valid_until
   LIMIT 1;
 END IF;
 IF v_term_count<>1 THEN
  RAISE EXCEPTION 'exactly_one_owner_approved_contract_required' USING ERRCODE='42501';
 END IF;
 v_fee:=round(v_gross*v_rate/100+v_fixed,2);
 v_partner_share:=v_gross-v_fee;
 IF v_fee<0 OR v_fee>v_gross OR (v_model='partner' AND v_fee=0) THEN
  RAISE EXCEPTION 'invalid_commission_for_posting' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.kol_finance_journals_v1(
   journal_kind,idempotency_key,subject_type,subject_id,business_id,payment_id,
   verified_event_id,contract_id,currency,collection_model,gross_amount,
   platform_fee,partner_allocation,approved_by,approval_reference
 ) VALUES('recognition',p_idempotency_key,p_subject_type,p_subject_id,v_business,v_payment_id,
   v_event_id,v_term_id,v_currency,v_model,v_gross,v_fee,v_partner_share,p_approved_by,p_approval_reference)
 RETURNING id INTO v_journal_id;
 IF v_model='platform' THEN
   INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
    VALUES(v_journal_id,'provider_clearing','debit',v_gross,v_currency);
   IF v_partner_share>0 THEN
     INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
      VALUES(v_journal_id,'partner_payable','credit',v_partner_share,v_currency);
   END IF;
 ELSE
   INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
    VALUES(v_journal_id,'partner_receivable','debit',v_fee,v_currency);
 END IF;
 IF v_fee>0 THEN
   INSERT INTO public.kol_finance_entries_v1(journal_id,ledger_account,entry_side,amount,currency)
    VALUES(v_journal_id,'platform_commission_revenue','credit',v_fee,v_currency);
 END IF;
 SELECT coalesce(sum(amount) FILTER (WHERE entry_side='debit'),0),
        coalesce(sum(amount) FILTER (WHERE entry_side='credit'),0)
 INTO v_debit,v_credit FROM public.kol_finance_entries_v1 WHERE journal_id=v_journal_id;
 IF v_debit IS DISTINCT FROM v_credit OR v_debit<=0 THEN
   RAISE EXCEPTION 'unbalanced_financial_journal' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.audit_logs(actor_id,actor_role,action,entity_type,entity_id,reason,request_id,after)
 VALUES(p_approved_by,'super_admin','kol_finance_recognition_posted','kol_finance_journals_v1',
   v_journal_id,p_approval_reference,p_idempotency_key,
   jsonb_build_object('subject_type',p_subject_type,'subject_id',p_subject_id,
    'payment_id',v_payment_id,'contract_id',v_term_id,
    'gross',v_gross,'fee',v_fee,'currency',v_currency));
 RETURN jsonb_build_object('ok',true,'duplicate',false,'journal_id',v_journal_id,
    'gross_amount',v_gross,'platform_fee',v_fee,'currency',v_currency,
    'recognized_at',(SELECT recognized_at FROM public.kol_finance_journals_v1 WHERE id=v_journal_id));
END;
$$;


ALTER FUNCTION "public"."kol_post_verified_recognition_v1"("p_subject_type" "text", "p_subject_id" "uuid", "p_idempotency_key" "text", "p_approved_by" "uuid", "p_approval_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_public_intake_atomic"("p_id" "uuid", "p_kind" "text", "p_title" "text", "p_created_by" "uuid", "p_payload" "jsonb", "p_fingerprint" "text", "p_phone_hash" "text", "p_ip_hash" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_ticket public.support_tickets%rowtype;
  v_recent_ip integer;
  v_recent_phone integer;
begin
  if p_id is null or p_kind not in ('order_request','booking_request','support')
     or length(coalesce(p_title,'')) < 3
     or p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_phone_hash !~ '^[0-9a-f]{64}$'
     or p_ip_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid intake request' using errcode='22023';
  end if;

  -- Serialize concurrent requests for one IP and separately by phone.
  -- Ordering by advisory lock key avoids deadlocks when scopes differ.
  perform pg_catalog.pg_advisory_xact_lock(v.lock_key)
  from (select distinct hashtextextended(key, 1407) as lock_key
        from (values ('ip:'||p_ip_hash),('phone:'||p_phone_hash)) as k(key)
        order by lock_key) v;

  select * into v_ticket from public.support_tickets where id=p_id;
  if found then
    if v_ticket.category = p_kind
       and v_ticket.request_payload->>'request_fingerprint' = p_fingerprint then
      return 'replay';
    end if;
    return 'conflict';
  end if;

  select count(*) into v_recent_ip from (
    select 1 from public.support_tickets
      where request_payload->>'contact_ip_hash'=p_ip_hash
      and created_at>=pg_catalog.now()-interval '15 minutes' limit 4
  ) q;
  select count(*) into v_recent_phone from (
    select 1 from public.support_tickets
      where request_payload->>'contact_phone_hash'=p_phone_hash
      and created_at>=pg_catalog.now()-interval '15 minutes' limit 4
  ) q;
  if v_recent_ip>=4 or v_recent_phone>=4 then
    return 'rate_limited';
  end if;

  insert into public.support_tickets (
    id,created_by,related_order_id,related_booking_id,category,priority,status,title,request_payload
  ) values (
    p_id,p_created_by,null,null,p_kind,'medium','open',p_title,
    p_payload || pg_catalog.jsonb_build_object(
      'request_fingerprint',p_fingerprint,'contact_phone_hash',p_phone_hash,
      'contact_ip_hash',p_ip_hash,'intake_version',3
    )
  );
  return 'inserted';
exception
  when unique_violation then
    select * into v_ticket from public.support_tickets where id=p_id;
    if found and v_ticket.category=p_kind
       and v_ticket.request_payload->>'request_fingerprint'=p_fingerprint then
      return 'replay';
    end if;
    return 'conflict';
end
$_$;


ALTER FUNCTION "public"."kol_public_intake_atomic"("p_id" "uuid", "p_kind" "text", "p_title" "text", "p_created_by" "uuid", "p_payload" "jsonb", "p_fingerprint" "text", "p_phone_hash" "text", "p_ip_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."kol_site_content_write_v1"("p_operation" "text", "p_key" "text", "p_locale" "text", "p_value" "text" DEFAULT NULL::"text", "p_version" integer DEFAULT NULL::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE v public.site_content%ROWTYPE; v_history public.site_content_history%ROWTYPE;
BEGIN
 IF NOT private.can_manage_content() THEN
   RAISE EXCEPTION 'content_role_required' USING ERRCODE='42501';
 END IF;
 IF p_operation NOT IN ('draft','publish','restore')
    OR p_key IS NULL OR p_key !~ '^[a-z0-9_.-]{3,80}$'
    OR p_locale NOT IN ('ru','ky','en') THEN
   RAISE EXCEPTION 'invalid_content_input' USING ERRCODE='22023';
 END IF;
 IF p_operation='draft' THEN
   IF p_value IS NULL OR length(p_value)>2000 THEN
     RAISE EXCEPTION 'invalid_content_value' USING ERRCODE='22023';END IF;
   INSERT INTO public.site_content(content_key,locale,status,value,is_machine_suggestion,updated_by)
   VALUES(p_key,p_locale,'draft',p_value,false,auth.uid())
   ON CONFLICT(content_key,locale,status)
    DO UPDATE SET value=EXCLUDED.value,is_machine_suggestion=false,updated_by=EXCLUDED.updated_by
   RETURNING * INTO v;
 ELSIF p_operation='publish' THEN
   IF p_version IS NULL OR p_version<1 THEN
     RAISE EXCEPTION 'draft_version_required' USING ERRCODE='22023';END IF;
   SELECT * INTO v FROM public.site_content
    WHERE content_key=p_key AND locale=p_locale AND status='draft' FOR UPDATE;
   IF NOT FOUND OR v.version<>p_version THEN
     RAISE EXCEPTION 'stale_or_missing_draft' USING ERRCODE='40001';END IF;
   IF v.is_machine_suggestion THEN
     RAISE EXCEPTION 'translation_not_accepted' USING ERRCODE='42501';END IF;
   INSERT INTO public.site_content(content_key,locale,status,value,is_machine_suggestion,updated_by,published_at,
              version)
   VALUES(p_key,p_locale,'published',v.value,false,auth.uid(),now(),
      COALESCE((SELECT max(version)+1 FROM public.site_content_history
                 WHERE content_key=p_key AND locale=p_locale),1))
   ON CONFLICT(content_key,locale,status)
    DO UPDATE SET value=EXCLUDED.value,is_machine_suggestion=false,updated_by=EXCLUDED.updated_by
   RETURNING * INTO v;
   DELETE FROM public.site_content
    WHERE content_key=p_key AND locale=p_locale AND status='draft';
 ELSIF p_operation='restore' THEN
   IF p_version IS NULL OR p_version<1 THEN
     RAISE EXCEPTION 'history_version_required' USING ERRCODE='22023';END IF;
   SELECT * INTO v_history FROM public.site_content_history
     WHERE content_key=p_key AND locale=p_locale AND version=p_version;
   IF NOT FOUND THEN RAISE EXCEPTION 'history_not_found' USING ERRCODE='22023';END IF;
   INSERT INTO public.site_content(content_key,locale,status,value,is_machine_suggestion,updated_by,published_at,
                                   version)
   VALUES(p_key,p_locale,'published',v_history.value,false,auth.uid(),now(),
      COALESCE((SELECT max(version)+1 FROM public.site_content_history
                 WHERE content_key=p_key AND locale=p_locale),1))
   ON CONFLICT(content_key,locale,status)
    DO UPDATE SET value=EXCLUDED.value,is_machine_suggestion=false,updated_by=EXCLUDED.updated_by
   RETURNING * INTO v;
 END IF;
 RETURN jsonb_build_object('ok',true,'operation',p_operation,'id',v.id,
    'key',v.content_key,'locale',v.locale,'status',v.status,'version',v.version);
END;
$_$;


ALTER FUNCTION "public"."kol_site_content_write_v1"("p_operation" "text", "p_key" "text", "p_locale" "text", "p_value" "text", "p_version" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_order_ready_for_pickup_atomic"("p_order_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
  v_business_id uuid;
  v_status text;
  v_payment_status text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select o.business_id, o.status, o.payment_status
    into v_business_id, v_status, v_payment_status
  from public.orders as o
  where o.id = p_order_id
    and o.type in ('food', 'shop')
    and exists (
      select 1
      from public.partner_staff as ps
      where ps.business_id = o.business_id
        and ps.user_id = v_user_id
        and ps.is_active = true
    )
  for update;

  if not found then
    raise exception 'order_not_available_for_partner' using errcode = '42501';
  end if;

  -- Idempotent retry after a fully committed previous call.
  if v_status = 'ready_for_pickup' then
    return p_order_id;
  end if;

  if v_status not in ('preparing', 'accepted_by_partner') then
    raise exception 'invalid_status_transition' using errcode = 'P0001';
  end if;

  update public.orders
  set status = 'ready_for_pickup'
  where id = p_order_id;

  insert into public.order_status_history (
    order_id,
    changed_by,
    from_status,
    to_status,
    reason
  ) values (
    p_order_id,
    v_user_id,
    v_status,
    'ready_for_pickup',
    'partner_marked_ready_for_pickup_atomic'
  );

  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before,
    after,
    reason,
    request_id
  ) values (
    v_user_id,
    'partner',
    'mark_order_ready_for_pickup',
    'orders',
    p_order_id,
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'status', v_status,
      'payment_status', v_payment_status
    ),
    pg_catalog.jsonb_build_object(
      'business_id', v_business_id,
      'status', 'ready_for_pickup',
      'payment_status', v_payment_status
    ),
    'Partner order status transition committed atomically with history and audit.',
    'mark-ready-' || p_order_id::text
  );

  return p_order_id;
end;
$$;


ALTER FUNCTION "public"."mark_order_ready_for_pickup_atomic"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partner_availability_action_atomic"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.partner_availability_action_atomic_internal(
    p_scope_type,
    p_scope_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;


ALTER FUNCTION "public"."partner_availability_action_atomic"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."partner_availability_action_atomic"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") IS 'Partner-scoped room/tour availability status entrypoint. Never changes capacity, price, booking status or payment truth.';



CREATE OR REPLACE FUNCTION "public"."partner_booking_action_atomic"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.partner_booking_action_atomic_internal(
    p_booking_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;


ALTER FUNCTION "public"."partner_booking_action_atomic"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."partner_booking_action_atomic"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") IS 'Partner-scoped booking lifecycle entrypoint. Stay supports confirmed->checked_in->completed; Tour supports confirmed->completed. Reject releases trusted reserved inventory. Payment/refund truth is unchanged.';



CREATE OR REPLACE FUNCTION "public"."partner_catalog_availability_action"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.partner_catalog_availability_action_internal(
    p_item_type, p_item_id, p_action, p_request_id, p_reason
  );
$$;


ALTER FUNCTION "public"."partner_catalog_availability_action"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partner_catalog_write_atomic"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.partner_catalog_write_atomic_internal(
    p_domain,p_action,p_item_id,p_request_id,p_fields
  );
$$;


ALTER FUNCTION "public"."partner_catalog_write_atomic"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."partner_catalog_write_atomic"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") IS 'Partner owner/manager RPC for own-business catalog create draft, edit draft/rejected, and draft -> under_review submission. Payload-bound idempotency, audit evidence, ownership, category scope and alcohol safety are enforced. No publish/approve/payment/order/booking/delivery authority.';



CREATE OR REPLACE FUNCTION "public"."partner_inventory_publish_atomic"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
 select private.partner_inventory_publish_atomic_internal(p_scope_type,p_parent_id,p_date,p_time,p_capacity,p_price_override,p_request_id);
$$;


ALTER FUNCTION "public"."partner_inventory_publish_atomic"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partner_order_action_atomic"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.partner_order_action_atomic_internal(
    p_order_id,
    p_action,
    p_request_id,
    p_reason
  );
$$;


ALTER FUNCTION "public"."partner_order_action_atomic"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."partner_order_action_atomic"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") IS 'Partner-scoped food/shop lifecycle entrypoint. Never changes payment, delivery, item or price truth; cancellation is request-only.';



CREATE OR REPLACE FUNCTION "public"."partner_stop_action_atomic"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text" DEFAULT NULL::"text", "p_resume_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "sql"
    SET "search_path" TO ''
    AS $$
  select private.partner_stop_action_atomic_internal(p_scope_type, p_action, p_request_id, p_reason, p_resume_at);
$$;


ALTER FUNCTION "public"."partner_stop_action_atomic"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text", "p_resume_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."quote_intake_delivery_fee_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_zone_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_ticket record;
  v_rate record;
  v_zone text;
  v_location text;
  v_address text;
begin
  if v_actor is null then raise exception 'not_authenticated' using errcode='28000'; end if;
  select ur.role into v_role from public.user_roles ur
    where ur.user_id=v_actor and ur.is_active
      and ur.role in ('support_admin','super_admin')
    order by case when ur.role='super_admin' then 0 else 1 end limit 1;
  if v_role is null then
    raise exception 'delivery_quote_operator_required' using errcode='42501'; end if;
  if p_ticket_id is null or p_business_id is null
     or p_zone_code is null or p_zone_code !~ '^[a-z][a-z0-9-]{2,63}$' then
    raise exception 'invalid_delivery_quote_input' using errcode='22023'; end if;
  select st.category,st.status,st.request_payload into v_ticket
  from public.support_tickets st where st.id=p_ticket_id;
  if not found or v_ticket.category is distinct from 'order_request'
     or v_ticket.status not in ('open','in_progress') then
    raise exception 'intake_not_quotable' using errcode='P0002'; end if;
  if v_ticket.request_payload->>'delivery_method' is distinct from 'delivery' then
    raise exception 'intake_does_not_request_delivery' using errcode='P0001'; end if;
  v_location := pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'location',''));
  v_address := pg_catalog.btrim(coalesce(v_ticket.request_payload->'delivery'->>'address',''));
  if length(v_address)<8 or length(v_address)>500 then
    raise exception 'delivery_address_requires_operator_confirmation' using errcode='P0001'; end if;
  v_zone := case v_location
    when 'Чолпон-Ата' then 'cholpon-ata'
    when 'Бостери' then 'bosteri'
    when 'Каракол' then 'karakol'
    when 'Тамчы' then 'tamchy'
    when 'Бактуу-Долоноту' then 'baktuu-dolonotu'
    when 'Сары-Ой' then 'sary-oy'
    else null
  end;
  if v_zone is null or v_zone is distinct from p_zone_code then
    raise exception 'delivery_zone_not_confirmed' using errcode='42501'; end if;
  if not exists(select 1 from public.partners p
    where p.id=p_business_id and p.status='approved') then
    raise exception 'delivery_business_not_approved' using errcode='42501'; end if;
  select t.id,t.fee_som,t.currency,t.valid_from,t.valid_until into v_rate
    from private.kol_delivery_tariffs t
    where t.business_id=p_business_id and t.zone_code=v_zone
      and t.active and t.approved_by is not null and t.approved_at is not null
      and t.valid_from<=pg_catalog.now()
      and (t.valid_until is null or t.valid_until>pg_catalog.now())
      and exists(select 1 from public.user_roles ar where ar.user_id=t.approved_by
         and ar.is_active and ar.role in ('support_admin','super_admin'));
  if not found then
    raise exception 'delivery_tariff_not_configured' using errcode='P0001'; end if;
  return pg_catalog.jsonb_build_object(
    'ok',true,'ticket_id',p_ticket_id,'business_id',p_business_id,
    'tariff_id',v_rate.id,'currency',v_rate.currency,
    'fee_som',v_rate.fee_som,'zone_code',v_zone,
    'quote_at',pg_catalog.now(),'expires_at',v_rate.valid_until,
    'price_source','approved_database_tariff',
    'operator_address_review_required',true,
    'order_created',false);
end;
$_$;


ALTER FUNCTION "public"."quote_intake_delivery_fee_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_zone_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."quote_intake_delivery_fee_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_zone_code" "text") IS 'Operator-only authoritative KGS zone tariff quote; no delivery order created; address must be confirmed.';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "private"."kol_delivery_tariffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "zone_code" "text" NOT NULL,
    "fee_som" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'KGS'::"text" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_until" timestamp with time zone,
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_delivery_tariffs_check" CHECK ((("valid_until" IS NULL) OR ("valid_until" > "valid_from"))),
    CONSTRAINT "kol_delivery_tariffs_check1" CHECK (((NOT "active") OR (("approved_by" IS NOT NULL) AND ("approved_at" IS NOT NULL)))),
    CONSTRAINT "kol_delivery_tariffs_currency_check" CHECK (("currency" = 'KGS'::"text")),
    CONSTRAINT "kol_delivery_tariffs_fee_som_check" CHECK ((("fee_som" >= (0)::numeric) AND ("fee_som" <= (100000)::numeric))),
    CONSTRAINT "kol_delivery_tariffs_zone_code_check" CHECK (("zone_code" ~ '^[a-z][a-z0-9-]{2,63}$'::"text"))
);


ALTER TABLE "private"."kol_delivery_tariffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "private"."payment_provider_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "event_id" "text" NOT NULL,
    "provider_reference" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "requested_status" "text" NOT NULL,
    "amount" numeric,
    "payload_hash" "text" NOT NULL,
    "processing_status" "text" DEFAULT 'received'::"text" NOT NULL,
    "payment_id" "uuid",
    "processing_note" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "payment_provider_events_payload_hash_sha256_check" CHECK (("payload_hash" ~ '^[0-9a-f]{64}$'::"text")),
    CONSTRAINT "payment_provider_events_processing_status_check" CHECK (("processing_status" = ANY (ARRAY['received'::"text", 'applied'::"text", 'ignored'::"text", 'rejected'::"text"]))),
    CONSTRAINT "payment_provider_events_requested_status_check" CHECK (("requested_status" = ANY (ARRAY['paid'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);


ALTER TABLE "private"."payment_provider_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "admin_level" "text" DEFAULT 'support_admin'::"text" NOT NULL,
    "department" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "recipient_role" "text" NOT NULL,
    "message" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_decision_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "situation_summary" "text" NOT NULL,
    "risk_level" "text" NOT NULL,
    "who_to_notify" "text"[],
    "messages" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "human_approval_required" boolean DEFAULT true NOT NULL,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_decision_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_dispatcher_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "risk_level" "text" DEFAULT 'low'::"text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_dispatcher_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "recommended_action" "text" NOT NULL,
    "human_approval_required" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ai_recommendations" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_recommendations" IS 'AI can recommend actions only. AI cannot cancel orders, change payment status, or enable alcohol delivery.';



CREATE TABLE IF NOT EXISTS "public"."alcohol_module_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_enabled" boolean DEFAULT false NOT NULL,
    "enabled_by" "uuid",
    "enabled_at" timestamp with time zone,
    "legal_review_id" "uuid",
    "notes" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."alcohol_module_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."alcohol_module_settings" IS 'Alcohol module must remain disabled unless legal compliance is approved.';



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "before" "jsonb",
    "after" "jsonb",
    "reason" "text",
    "request_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "name" "text",
    "age_group" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."booking_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "booking_type" "text" NOT NULL,
    "object_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "guests_count" integer DEFAULT 1 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "parent_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "categories_status_valid" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "default_address" "text",
    "loyalty_account_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid",
    "scope" "text" DEFAULT 'default'::"text" NOT NULL,
    "rate" numeric(6,4) DEFAULT 0 NOT NULL,
    "fixed_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "review_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reviewed_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compliance_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courier_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "courier_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'assigned'::"text" NOT NULL,
    "assigned_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courier_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courier_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "courier_id" "uuid" NOT NULL,
    "lat" numeric(10,7) NOT NULL,
    "lng" numeric(10,7) NOT NULL,
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courier_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courier_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "vehicle_type" "text",
    "vehicle_number" "text",
    "working_zone" "text",
    "availability_status" "text" DEFAULT 'offline'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courier_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courier_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "courier_id" "uuid" NOT NULL,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "zone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."courier_shifts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deliveries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "assigned_courier_id" "uuid",
    "status" "text" DEFAULT 'delivery_pending'::"text" NOT NULL,
    "pickup_address" "text",
    "dropoff_address" "text",
    "risk_level" "text" DEFAULT 'low'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."deliveries" OWNER TO "postgres";


COMMENT ON TABLE "public"."deliveries" IS 'Courier controls physical delivery only. Courier must not change payment status or order contents.';



CREATE TABLE IF NOT EXISTS "public"."delivery_issues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "description" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delivery_issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."delivery_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "delivery_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."delivery_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."editorial_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "score" numeric(2,1) NOT NULL,
    "note" "text",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "editorial_scores_note_check" CHECK ((("note" IS NULL) OR ("length"("note") <= 1500))),
    CONSTRAINT "editorial_scores_score_check" CHECK ((("score" >= 1.0) AND ("score" <= 5.0))),
    CONSTRAINT "editorial_scores_target_type_check" CHECK (("target_type" = ANY (ARRAY['stay'::"text", 'tour'::"text"])))
);


ALTER TABLE "public"."editorial_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_cost_entries_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cost_journal_id" "uuid" NOT NULL,
    "ledger_account" "text" NOT NULL,
    "entry_side" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_cost_entries_v1_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "kol_finance_cost_entries_v1_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "kol_finance_cost_entries_v1_entry_side_check" CHECK (("entry_side" = ANY (ARRAY['debit'::"text", 'credit'::"text"]))),
    CONSTRAINT "kol_finance_cost_entries_v1_ledger_account_check" CHECK (("ledger_account" = ANY (ARRAY['operating_expense'::"text", 'accrued_expense_liability'::"text"])))
);


ALTER TABLE "public"."kol_finance_cost_entries_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_cost_journals_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "operation" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "original_id" "uuid",
    "business_id" "uuid",
    "category" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" NOT NULL,
    "document_reference" "text" NOT NULL,
    "approved_by" "uuid" NOT NULL,
    "approval_reference" "text" NOT NULL,
    "posted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_cost_journals_v1_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "kol_finance_cost_journals_v1_approval_reference_check" CHECK ((("length"("btrim"("approval_reference")) >= 8) AND ("length"("btrim"("approval_reference")) <= 500))),
    CONSTRAINT "kol_finance_cost_journals_v1_category_check" CHECK (("category" = ANY (ARRAY['hosting'::"text", 'marketing'::"text", 'staff'::"text", 'logistics'::"text", 'operations'::"text", 'other'::"text"]))),
    CONSTRAINT "kol_finance_cost_journals_v1_check" CHECK (((("operation" = 'expense'::"text") AND ("original_id" IS NULL)) OR (("operation" = 'reversal'::"text") AND ("original_id" IS NOT NULL)))),
    CONSTRAINT "kol_finance_cost_journals_v1_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "kol_finance_cost_journals_v1_document_reference_check" CHECK ((("length"("btrim"("document_reference")) >= 8) AND ("length"("btrim"("document_reference")) <= 500))),
    CONSTRAINT "kol_finance_cost_journals_v1_idempotency_key_check" CHECK ((("length"("idempotency_key") >= 12) AND ("length"("idempotency_key") <= 128))),
    CONSTRAINT "kol_finance_cost_journals_v1_operation_check" CHECK (("operation" = ANY (ARRAY['expense'::"text", 'reversal'::"text"])))
);


ALTER TABLE "public"."kol_finance_cost_journals_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_decisions_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "decided_by" "uuid" NOT NULL,
    "decision_reference" "text" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_decisions_v1_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "kol_finance_decisions_v1_decision_reference_check" CHECK ((("length"("btrim"("decision_reference")) >= 8) AND ("length"("btrim"("decision_reference")) <= 500)))
);


ALTER TABLE "public"."kol_finance_decisions_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_entries_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_id" "uuid" NOT NULL,
    "ledger_account" "text" NOT NULL,
    "entry_side" "text" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_entries_v1_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "kol_finance_entries_v1_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "kol_finance_entries_v1_entry_side_check" CHECK (("entry_side" = ANY (ARRAY['debit'::"text", 'credit'::"text"]))),
    CONSTRAINT "kol_finance_entries_v1_ledger_account_check" CHECK (("ledger_account" = ANY (ARRAY['provider_clearing'::"text", 'partner_payable'::"text", 'partner_receivable'::"text", 'platform_commission_revenue'::"text"])))
);


ALTER TABLE "public"."kol_finance_entries_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_journals_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "journal_kind" "text" DEFAULT 'recognition'::"text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "subject_type" "text" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "verified_event_id" "uuid" NOT NULL,
    "contract_id" "uuid" NOT NULL,
    "currency" "text" NOT NULL,
    "collection_model" "text" NOT NULL,
    "gross_amount" numeric(14,2) NOT NULL,
    "platform_fee" numeric(14,2) NOT NULL,
    "partner_allocation" numeric(14,2) NOT NULL,
    "approved_by" "uuid" NOT NULL,
    "approval_reference" "text" NOT NULL,
    "recognized_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_journals_v1_approval_reference_check" CHECK ((("length"("btrim"("approval_reference")) >= 8) AND ("length"("btrim"("approval_reference")) <= 200))),
    CONSTRAINT "kol_finance_journals_v1_check" CHECK ((("platform_fee" >= (0)::numeric) AND ("platform_fee" <= "gross_amount"))),
    CONSTRAINT "kol_finance_journals_v1_collection_model_check" CHECK (("collection_model" = ANY (ARRAY['platform'::"text", 'partner'::"text"]))),
    CONSTRAINT "kol_finance_journals_v1_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "kol_finance_journals_v1_gross_amount_check" CHECK (("gross_amount" > (0)::numeric)),
    CONSTRAINT "kol_finance_journals_v1_idempotency_key_check" CHECK ((("length"("idempotency_key") >= 12) AND ("length"("idempotency_key") <= 128))),
    CONSTRAINT "kol_finance_journals_v1_journal_kind_check" CHECK (("journal_kind" = 'recognition'::"text")),
    CONSTRAINT "kol_finance_journals_v1_partner_allocation_check" CHECK (("partner_allocation" >= (0)::numeric)),
    CONSTRAINT "kol_finance_journals_v1_subject_type_check" CHECK (("subject_type" = ANY (ARRAY['order'::"text", 'booking'::"text"]))),
    CONSTRAINT "kol_recognition_amount_check" CHECK (("partner_allocation" = ("gross_amount" - "platform_fee")))
);


ALTER TABLE "public"."kol_finance_journals_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_requests_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "request_kind" "text" NOT NULL,
    "payment_id" "uuid",
    "journal_id" "uuid",
    "business_id" "uuid" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "currency" "text" NOT NULL,
    "idempotency_key" "text" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "reason" "text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_request_source_shape" CHECK (((("request_kind" = 'refund'::"text") AND ("payment_id" IS NOT NULL) AND ("journal_id" IS NULL)) OR (("request_kind" = 'payout'::"text") AND ("journal_id" IS NOT NULL) AND ("payment_id" IS NULL)))),
    CONSTRAINT "kol_finance_requests_v1_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "kol_finance_requests_v1_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "kol_finance_requests_v1_idempotency_key_check" CHECK ((("length"("idempotency_key") >= 12) AND ("length"("idempotency_key") <= 128))),
    CONSTRAINT "kol_finance_requests_v1_reason_check" CHECK ((("length"("btrim"("reason")) >= 8) AND ("length"("btrim"("reason")) <= 1000))),
    CONSTRAINT "kol_finance_requests_v1_request_kind_check" CHECK (("request_kind" = ANY (ARRAY['refund'::"text", 'payout'::"text"])))
);


ALTER TABLE "public"."kol_finance_requests_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kol_finance_terms_v1" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "service_line" "text" NOT NULL,
    "currency" "text" NOT NULL,
    "rate_percent" numeric(7,4) NOT NULL,
    "fixed_fee" numeric(12,2) NOT NULL,
    "collection_model" "text" NOT NULL,
    "valid_from" "date" NOT NULL,
    "valid_until" "date" NOT NULL,
    "agreement_reference" "text" NOT NULL,
    "approved_by" "uuid" NOT NULL,
    "approved_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kol_finance_terms_date_check" CHECK (("valid_until" > "valid_from")),
    CONSTRAINT "kol_finance_terms_v1_agreement_reference_check" CHECK ((("length"("btrim"("agreement_reference")) >= 6) AND ("length"("btrim"("agreement_reference")) <= 250))),
    CONSTRAINT "kol_finance_terms_v1_collection_model_check" CHECK (("collection_model" = ANY (ARRAY['platform'::"text", 'partner'::"text"]))),
    CONSTRAINT "kol_finance_terms_v1_currency_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "kol_finance_terms_v1_fixed_fee_check" CHECK (("fixed_fee" >= (0)::numeric)),
    CONSTRAINT "kol_finance_terms_v1_rate_percent_check" CHECK ((("rate_percent" >= (0)::numeric) AND ("rate_percent" <= (100)::numeric))),
    CONSTRAINT "kol_finance_terms_v1_service_line_check" CHECK (("service_line" = ANY (ARRAY['food'::"text", 'shop'::"text", 'stay'::"text", 'tour'::"text"])))
);


ALTER TABLE "public"."kol_finance_terms_v1" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listing_promotions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "label" "text" DEFAULT 'recommended'::"text" NOT NULL,
    "starts_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ends_at" timestamp with time zone,
    "price_kgs" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_evidence" "text",
    "paid_marked_by" "uuid",
    "paid_marked_at" timestamp with time zone,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "listing_promotions_check" CHECK ((("ends_at" IS NULL) OR ("ends_at" > "starts_at"))),
    CONSTRAINT "listing_promotions_check1" CHECK ((("price_kgs" = (0)::numeric) OR ("label" = 'ad'::"text"))),
    CONSTRAINT "listing_promotions_check2" CHECK ((("price_kgs" = (0)::numeric) OR (NOT "is_active") OR (("payment_status" = 'paid'::"text") AND ("payment_evidence" IS NOT NULL) AND ("paid_marked_by" IS NOT NULL) AND ("paid_marked_at" IS NOT NULL)))),
    CONSTRAINT "listing_promotions_label_check" CHECK (("label" = ANY (ARRAY['none'::"text", 'recommended'::"text", 'ad'::"text"]))),
    CONSTRAINT "listing_promotions_payment_evidence_check" CHECK ((("payment_evidence" IS NULL) OR (("length"("btrim"("payment_evidence")) >= 3) AND ("length"("btrim"("payment_evidence")) <= 500)))),
    CONSTRAINT "listing_promotions_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text"]))),
    CONSTRAINT "listing_promotions_position_check" CHECK ((("position" >= 1) AND ("position" <= 50))),
    CONSTRAINT "listing_promotions_price_kgs_check" CHECK (("price_kgs" >= (0)::numeric)),
    CONSTRAINT "listing_promotions_target_type_check" CHECK (("target_type" = ANY (ARRAY['stay'::"text", 'tour'::"text"])))
);


ALTER TABLE "public"."listing_promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points_balance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loyalty_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "account_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "points" integer NOT NULL,
    "source_type" "text",
    "source_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."loyalty_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "url" "text",
    "alt" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "storage_bucket" "text",
    "storage_path" "text",
    "mime_type" "text",
    "size_bytes" bigint,
    "uploaded_by" "uuid"
);


ALTER TABLE "public"."media_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "preparation_time_minutes" integer,
    "status" "text" DEFAULT 'under_review'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text",
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_delivery" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "delivery_id" "uuid",
    "delivery_method" "text" DEFAULT 'delivery'::"text" NOT NULL,
    "pickup_address" "text",
    "dropoff_address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_delivery" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid",
    "title_snapshot" "text" NOT NULL,
    "qty" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_status_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "from_status" "text",
    "to_status" "text" NOT NULL,
    "changed_by" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_status_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0 NOT NULL,
    "delivery_fee" numeric(12,2) DEFAULT 0 NOT NULL,
    "discount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_catalog_item_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "availability_state" "text" DEFAULT 'available'::"text" NOT NULL,
    "reason" "text",
    "changed_by" "uuid",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "partner_catalog_item_availability_availability_state_check" CHECK (("availability_state" = ANY (ARRAY['available'::"text", 'paused'::"text", 'out_of_stock'::"text"]))),
    CONSTRAINT "partner_catalog_item_availability_check" CHECK ((("availability_state" = 'available'::"text") OR ("reason" IS NOT NULL))),
    CONSTRAINT "partner_catalog_item_availability_item_type_check" CHECK (("item_type" = ANY (ARRAY['menu_item'::"text", 'product'::"text"]))),
    CONSTRAINT "partner_catalog_item_availability_reason_check" CHECK ((("reason" IS NULL) OR ("length"("reason") <= 500)))
);


ALTER TABLE "public"."partner_catalog_item_availability" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_catalog_item_availability" IS 'Operational availability for future food/shop demand; moderation status, price, stock and existing orders are unchanged.';



CREATE TABLE IF NOT EXISTS "public"."partner_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "position" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partner_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'partner_staff'::"text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partner_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_stop_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "scope_type" "text" NOT NULL,
    "is_paused" boolean DEFAULT true NOT NULL,
    "reason" "text",
    "paused_by" "uuid",
    "paused_at" timestamp with time zone,
    "resume_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "partner_stop_statuses_reason_check" CHECK ((("reason" IS NULL) OR ("length"("reason") <= 500))),
    CONSTRAINT "partner_stop_statuses_scope_type_check" CHECK (("scope_type" = ANY (ARRAY['new_orders'::"text", 'new_bookings'::"text"])))
);


ALTER TABLE "public"."partner_stop_statuses" OWNER TO "postgres";


COMMENT ON TABLE "public"."partner_stop_statuses" IS 'Partner-owned stop state for future demand only. Existing orders, bookings, payments and inventory are immutable to stop/resume.';



CREATE TABLE IF NOT EXISTS "public"."partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "business_status" "text" DEFAULT 'offline'::"text" NOT NULL,
    "rating" numeric(3,2) DEFAULT 0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partners" OWNER TO "postgres";


COMMENT ON TABLE "public"."partners" IS 'Partner businesses. Partners must see only their own business data.';



CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "order_id" "uuid",
    "booking_id" "uuid",
    "method" "text" DEFAULT 'manual'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "provider" "text",
    "provider_reference" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_provider_pair_check" CHECK (((("provider" IS NULL) AND ("provider_reference" IS NULL)) OR (("provider" IS NOT NULL) AND ("provider_reference" IS NOT NULL)))),
    CONSTRAINT "payments_provider_status_check" CHECK ((("provider_reference" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"])))),
    CONSTRAINT "payments_provider_subject_shape_check" CHECK ((("provider_reference" IS NULL) OR (("order_id" IS NULL) <> ("booking_id" IS NULL))))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_type" "text" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "period_start" "date",
    "period_end" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "stock_qty" integer,
    "status" "text" DEFAULT 'under_review'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "business_id" "uuid",
    "scope" "text" DEFAULT 'global'::"text" NOT NULL,
    "discount_type" "text" NOT NULL,
    "discount_value" numeric(12,2) DEFAULT 0 NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promo_code_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "booking_id" "uuid",
    "used_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."promo_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid",
    "business_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "booking_id" "uuid",
    "rating" integer NOT NULL,
    "text" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target_type" "text",
    "target_id" "uuid",
    "source" "text" DEFAULT 'site'::"text" NOT NULL,
    "source_label" "text",
    "source_evidence_url" "text",
    "hidden_reason" "text",
    "moderated_by" "uuid",
    "moderated_at" timestamp with time zone,
    "admin_reply" "text",
    "admin_reply_at" timestamp with time zone,
    CONSTRAINT "reviews_admin_reply_check" CHECK ((("admin_reply" IS NULL) OR ("length"("admin_reply") <= 1000))),
    CONSTRAINT "reviews_hidden_needs_reason" CHECK ((("status" <> 'hidden'::"text") OR ("hidden_reason" IS NOT NULL))),
    CONSTRAINT "reviews_hidden_reason_check" CHECK (("hidden_reason" = ANY (ARRAY['spam'::"text", 'abuse'::"text", 'off_topic'::"text", 'personal_data'::"text", 'wrong_object'::"text", 'duplicate'::"text", 'other'::"text"]))),
    CONSTRAINT "reviews_integrity_contract" CHECK (((("source" = 'site'::"text") AND ("client_id" IS NOT NULL) AND ("booking_id" IS NOT NULL) AND ("target_type" IS NOT NULL) AND ("target_id" IS NOT NULL)) OR (("source" = 'import'::"text") AND ("client_id" IS NULL) AND ("booking_id" IS NULL) AND ("target_type" IS NOT NULL) AND ("target_id" IS NOT NULL) AND ("source_label" IS NOT NULL) AND ("length"("btrim"("source_label")) >= 2) AND ("source_evidence_url" IS NOT NULL)))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "reviews_source_check" CHECK (("source" = ANY (ARRAY['site'::"text", 'import'::"text"]))),
    CONSTRAINT "reviews_source_evidence_url_check" CHECK ((("source_evidence_url" IS NULL) OR ("source_evidence_url" ~ '^https://[^[:space:]]+$'::"text"))),
    CONSTRAINT "reviews_status_contract" CHECK (("status" = ANY (ARRAY['new'::"text", 'published'::"text", 'hidden'::"text"]))),
    CONSTRAINT "reviews_target_type_check" CHECK (("target_type" = ANY (ARRAY['stay'::"text", 'tour'::"text"]))),
    CONSTRAINT "reviews_text_size" CHECK ((("text" IS NULL) OR ("length"("text") <= 2000)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."public_listing_ratings" WITH ("security_invoker"='true') AS
 SELECT "target_type",
    "target_id",
    "round"("avg"("rating"), 1) AS "guest_rating",
    ("count"(*))::integer AS "review_count"
   FROM "public"."reviews"
  WHERE (("status" = 'published'::"text") AND ("source" = 'site'::"text") AND ("target_id" IS NOT NULL))
  GROUP BY "target_type", "target_id";


ALTER VIEW "public"."public_listing_ratings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "reason" "text",
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."restaurants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "delivery_enabled" boolean DEFAULT true NOT NULL,
    "working_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "min_order_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."restaurants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "available_count" integer DEFAULT 1 NOT NULL,
    "price_override" numeric(12,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."room_availability" OWNER TO "postgres";


COMMENT ON TABLE "public"."room_availability" IS 'Source of truth for room availability. Closed dates block only new bookings.';



CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stay_id" "uuid" NOT NULL,
    "business_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "capacity" integer DEFAULT 1 NOT NULL,
    "price_per_night" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'under_review'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shops" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "delivery_enabled" boolean DEFAULT true NOT NULL,
    "working_hours" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."shops" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_ad_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slot_code" "text" NOT NULL,
    "advertiser_name" "text" NOT NULL,
    "title_ru" "text" NOT NULL,
    "title_ky" "text",
    "title_en" "text",
    "image_path" "text",
    "link_url" "text",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "priority" integer DEFAULT 100 NOT NULL,
    "price_kgs" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_evidence" "text",
    "paid_marked_by" "uuid",
    "paid_marked_at" timestamp with time zone,
    "disclosure_label" "text" DEFAULT 'Реклама'::"text" NOT NULL,
    "impressions" bigint DEFAULT 0 NOT NULL,
    "clicks" bigint DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_ad_campaigns_advertiser_name_check" CHECK ((("length"("advertiser_name") >= 2) AND ("length"("advertiser_name") <= 160))),
    CONSTRAINT "site_ad_campaigns_check" CHECK (("ends_at" > "starts_at")),
    CONSTRAINT "site_ad_campaigns_check1" CHECK ((("price_kgs" = (0)::numeric) OR ("status" <> ALL (ARRAY['scheduled'::"text", 'active'::"text"])) OR (("payment_status" = 'paid'::"text") AND ("payment_evidence" IS NOT NULL) AND ("paid_marked_by" IS NOT NULL) AND ("paid_marked_at" IS NOT NULL)))),
    CONSTRAINT "site_ad_campaigns_clicks_check" CHECK (("clicks" >= 0)),
    CONSTRAINT "site_ad_campaigns_disclosure_label_check" CHECK (("length"("btrim"("disclosure_label")) >= 3)),
    CONSTRAINT "site_ad_campaigns_impressions_check" CHECK (("impressions" >= 0)),
    CONSTRAINT "site_ad_campaigns_link_url_check" CHECK ((("link_url" IS NULL) OR ("link_url" ~ '^(https://|/)[^[:space:]]*$'::"text"))),
    CONSTRAINT "site_ad_campaigns_payment_evidence_check" CHECK ((("payment_evidence" IS NULL) OR (("length"("btrim"("payment_evidence")) >= 3) AND ("length"("btrim"("payment_evidence")) <= 500)))),
    CONSTRAINT "site_ad_campaigns_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text"]))),
    CONSTRAINT "site_ad_campaigns_price_kgs_check" CHECK (("price_kgs" >= (0)::numeric)),
    CONSTRAINT "site_ad_campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'review'::"text", 'scheduled'::"text", 'active'::"text", 'paused'::"text", 'ended'::"text"]))),
    CONSTRAINT "site_ad_campaigns_title_ru_check" CHECK ((("length"("title_ru") >= 1) AND ("length"("title_ru") <= 120)))
);


ALTER TABLE "public"."site_ad_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_ad_slots" (
    "code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "width" integer,
    "height" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "site_ad_slots_code_check" CHECK (("code" ~ '^[a-z0-9_]{3,40}$'::"text"))
);


ALTER TABLE "public"."site_ad_slots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_key" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "value" "text" NOT NULL,
    "is_machine_suggestion" boolean DEFAULT false NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "published_at" timestamp with time zone,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_content_check" CHECK ((("status" <> 'published'::"text") OR (("published_at" IS NOT NULL) AND (NOT "is_machine_suggestion")))),
    CONSTRAINT "site_content_content_key_check" CHECK (("content_key" ~ '^[a-z0-9_.-]{3,80}$'::"text")),
    CONSTRAINT "site_content_locale_check" CHECK (("locale" = ANY (ARRAY['ru'::"text", 'ky'::"text", 'en'::"text"]))),
    CONSTRAINT "site_content_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text"]))),
    CONSTRAINT "site_content_value_check" CHECK (("length"("value") <= 2000)),
    CONSTRAINT "site_content_version_check" CHECK (("version" >= 1))
);


ALTER TABLE "public"."site_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."site_content_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content_key" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "value" "text" NOT NULL,
    "version" integer NOT NULL,
    "published_by" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "site_content_history_locale_check" CHECK (("locale" = ANY (ARRAY['ru'::"text", 'ky'::"text", 'en'::"text"])))
);


ALTER TABLE "public"."site_content_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "type" "text",
    "description" "text",
    "location" "text",
    "price_from" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'KGS'::"text" NOT NULL,
    "status" "text" DEFAULT 'under_review'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "related_order_id" "uuid",
    "related_booking_id" "uuid",
    "category" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_id" "uuid",
    "message" "text" NOT NULL,
    "visibility" "text" DEFAULT 'public'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ticket_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tour_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tour_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone,
    "capacity" integer DEFAULT 0 NOT NULL,
    "booked_count" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tour_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."tour_schedules" IS 'Source of truth for tour dates and seats. Closed dates block only new bookings.';



CREATE TABLE IF NOT EXISTS "public"."tours" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "business_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'KGS'::"text" NOT NULL,
    "duration" "text",
    "status" "text" DEFAULT 'under_review'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tours" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "uuid",
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "direction" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "phone" "text",
    "email" "text",
    "avatar_url" "text",
    "locale" "text" DEFAULT 'ru'::"text" NOT NULL,
    "preferred_contact" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "scope_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "private"."kol_delivery_tariffs"
    ADD CONSTRAINT "kol_delivery_tariffs_business_id_zone_code_key" UNIQUE ("business_id", "zone_code");



ALTER TABLE ONLY "private"."kol_delivery_tariffs"
    ADD CONSTRAINT "kol_delivery_tariffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "private"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "private"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_provider_event_unique" UNIQUE ("provider", "event_id");



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."ai_alerts"
    ADD CONSTRAINT "ai_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_decision_logs"
    ADD CONSTRAINT "ai_decision_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_dispatcher_events"
    ADD CONSTRAINT "ai_dispatcher_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_recommendations"
    ADD CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."alcohol_module_settings"
    ADD CONSTRAINT "alcohol_module_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_guests"
    ADD CONSTRAINT "booking_guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_scope_slug_key" UNIQUE ("scope", "slug");



ALTER TABLE ONLY "public"."client_profiles"
    ADD CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_profiles"
    ADD CONSTRAINT "client_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_reviews"
    ADD CONSTRAINT "compliance_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courier_assignments"
    ADD CONSTRAINT "courier_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courier_locations"
    ADD CONSTRAINT "courier_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courier_profiles"
    ADD CONSTRAINT "courier_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courier_profiles"
    ADD CONSTRAINT "courier_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."courier_shifts"
    ADD CONSTRAINT "courier_shifts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_issues"
    ADD CONSTRAINT "delivery_issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."delivery_status_history"
    ADD CONSTRAINT "delivery_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."editorial_scores"
    ADD CONSTRAINT "editorial_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."editorial_scores"
    ADD CONSTRAINT "editorial_scores_target_type_target_id_key" UNIQUE ("target_type", "target_id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_entity_type_entity_id_key" UNIQUE ("user_id", "entity_type", "entity_id");



ALTER TABLE ONLY "public"."kol_finance_cost_entries_v1"
    ADD CONSTRAINT "kol_finance_cost_entries_v1_cost_journal_id_ledger_account__key" UNIQUE ("cost_journal_id", "ledger_account", "entry_side");



ALTER TABLE ONLY "public"."kol_finance_cost_entries_v1"
    ADD CONSTRAINT "kol_finance_cost_entries_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_cost_journals_v1"
    ADD CONSTRAINT "kol_finance_cost_journals_v1_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."kol_finance_cost_journals_v1"
    ADD CONSTRAINT "kol_finance_cost_journals_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_decisions_v1"
    ADD CONSTRAINT "kol_finance_decisions_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_decisions_v1"
    ADD CONSTRAINT "kol_finance_decisions_v1_request_id_key" UNIQUE ("request_id");



ALTER TABLE ONLY "public"."kol_finance_entries_v1"
    ADD CONSTRAINT "kol_finance_entries_v1_journal_id_ledger_account_entry_side_key" UNIQUE ("journal_id", "ledger_account", "entry_side");



ALTER TABLE ONLY "public"."kol_finance_entries_v1"
    ADD CONSTRAINT "kol_finance_entries_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_requests_v1"
    ADD CONSTRAINT "kol_finance_requests_v1_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."kol_finance_requests_v1"
    ADD CONSTRAINT "kol_finance_requests_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_terms_v1"
    ADD CONSTRAINT "kol_finance_terms_v1_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_recognition_one_per_subject" UNIQUE ("journal_kind", "subject_type", "subject_id");



ALTER TABLE ONLY "public"."listing_promotions"
    ADD CONSTRAINT "listing_promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_files"
    ADD CONSTRAINT "media_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_delivery"
    ADD CONSTRAINT "order_delivery_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_delivery"
    ADD CONSTRAINT "order_delivery_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_order_id_payment_id_key" UNIQUE ("order_id", "payment_id");



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_catalog_item_availability"
    ADD CONSTRAINT "partner_catalog_item_availability_item_type_item_id_key" UNIQUE ("item_type", "item_id");



ALTER TABLE ONLY "public"."partner_catalog_item_availability"
    ADD CONSTRAINT "partner_catalog_item_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_profiles"
    ADD CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_profiles"
    ADD CONSTRAINT "partner_profiles_user_id_business_id_key" UNIQUE ("user_id", "business_id");



ALTER TABLE ONLY "public"."partner_staff"
    ADD CONSTRAINT "partner_staff_business_id_user_id_key" UNIQUE ("business_id", "user_id");



ALTER TABLE ONLY "public"."partner_staff"
    ADD CONSTRAINT "partner_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_stop_statuses"
    ADD CONSTRAINT "partner_stop_statuses_business_id_scope_type_key" UNIQUE ("business_id", "scope_type");



ALTER TABLE ONLY "public"."partner_stop_statuses"
    ADD CONSTRAINT "partner_stop_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promo_usage"
    ADD CONSTRAINT "promo_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_availability"
    ADD CONSTRAINT "room_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_availability"
    ADD CONSTRAINT "room_availability_room_id_date_key" UNIQUE ("room_id", "date");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_business_id_key" UNIQUE ("business_id");



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_ad_campaigns"
    ADD CONSTRAINT "site_ad_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_ad_slots"
    ADD CONSTRAINT "site_ad_slots_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_content_key_locale_status_key" UNIQUE ("content_key", "locale", "status");



ALTER TABLE ONLY "public"."site_content_history"
    ADD CONSTRAINT "site_content_history_content_key_locale_version_key" UNIQUE ("content_key", "locale", "version");



ALTER TABLE ONLY "public"."site_content_history"
    ADD CONSTRAINT "site_content_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tour_schedules"
    ADD CONSTRAINT "tour_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_scope_id_key" UNIQUE ("user_id", "role", "scope_id");



CREATE INDEX "idx_kol_delivery_tariffs_active_business" ON "private"."kol_delivery_tariffs" USING "btree" ("business_id", "zone_code") WHERE "active";



CREATE INDEX "idx_payment_provider_events_payment_id" ON "private"."payment_provider_events" USING "btree" ("payment_id");



CREATE INDEX "idx_payment_provider_events_reference" ON "private"."payment_provider_events" USING "btree" ("provider", "provider_reference");



CREATE INDEX "idx_ai_alerts_event_id" ON "public"."ai_alerts" USING "btree" ("event_id");



CREATE INDEX "idx_ai_decision_logs_approved_by" ON "public"."ai_decision_logs" USING "btree" ("approved_by");



CREATE INDEX "idx_ai_recommendations_event_id" ON "public"."ai_recommendations" USING "btree" ("event_id");



CREATE INDEX "idx_alcohol_module_settings_enabled_by" ON "public"."alcohol_module_settings" USING "btree" ("enabled_by");



CREATE INDEX "idx_audit_admin_support_request" ON "public"."audit_logs" USING "btree" ("actor_id", "action", "request_id") WHERE ("action" = ANY (ARRAY['admin_support_reply'::"text", 'admin_support_status_changed'::"text"]));



CREATE INDEX "idx_audit_client_booking_request" ON "public"."audit_logs" USING "btree" ("actor_id", "action", "request_id") WHERE ("action" = 'client_booking_created'::"text");



CREATE INDEX "idx_audit_client_profile_request" ON "public"."audit_logs" USING "btree" ("actor_id", "action", "request_id") WHERE ("action" = 'client_profile_updated'::"text");



CREATE INDEX "idx_audit_client_support_request" ON "public"."audit_logs" USING "btree" ("actor_id", "action", "request_id") WHERE ("action" = 'client_support_ticket_created'::"text");



CREATE INDEX "idx_audit_logs_actor_id" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_booking_guests_booking_id" ON "public"."booking_guests" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_status_history_booking_id" ON "public"."booking_status_history" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_status_history_changed_by" ON "public"."booking_status_history" USING "btree" ("changed_by");



CREATE INDEX "idx_bookings_business_id" ON "public"."bookings" USING "btree" ("business_id");



CREATE INDEX "idx_bookings_client_id" ON "public"."bookings" USING "btree" ("client_id");



CREATE INDEX "idx_bookings_status" ON "public"."bookings" USING "btree" ("status");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_status_scope_sort" ON "public"."categories" USING "btree" ("status", "scope", "sort_order", "title");



CREATE INDEX "idx_commissions_business_id" ON "public"."commissions" USING "btree" ("business_id");



CREATE INDEX "idx_compliance_reviews_reviewed_by" ON "public"."compliance_reviews" USING "btree" ("reviewed_by");



CREATE INDEX "idx_courier_assignments_assigned_by" ON "public"."courier_assignments" USING "btree" ("assigned_by");



CREATE INDEX "idx_courier_assignments_courier_id" ON "public"."courier_assignments" USING "btree" ("courier_id");



CREATE INDEX "idx_courier_assignments_delivery_id" ON "public"."courier_assignments" USING "btree" ("delivery_id");



CREATE INDEX "idx_courier_locations_courier_id" ON "public"."courier_locations" USING "btree" ("courier_id");



CREATE INDEX "idx_courier_shifts_courier_id" ON "public"."courier_shifts" USING "btree" ("courier_id");



CREATE INDEX "idx_deliveries_courier_id" ON "public"."deliveries" USING "btree" ("assigned_courier_id");



CREATE INDEX "idx_deliveries_order_id" ON "public"."deliveries" USING "btree" ("order_id");



CREATE INDEX "idx_delivery_issues_created_by" ON "public"."delivery_issues" USING "btree" ("created_by");



CREATE INDEX "idx_delivery_issues_delivery_id" ON "public"."delivery_issues" USING "btree" ("delivery_id");



CREATE INDEX "idx_delivery_status_history_changed_by" ON "public"."delivery_status_history" USING "btree" ("changed_by");



CREATE INDEX "idx_delivery_status_history_delivery_id" ON "public"."delivery_status_history" USING "btree" ("delivery_id");



CREATE INDEX "idx_loyalty_transactions_account_id" ON "public"."loyalty_transactions" USING "btree" ("account_id");



CREATE INDEX "idx_media_files_owner" ON "public"."media_files" USING "btree" ("owner_type", "owner_id", "sort_order");



CREATE INDEX "idx_media_files_uploaded_by" ON "public"."media_files" USING "btree" ("uploaded_by");



CREATE INDEX "idx_menu_items_business_id" ON "public"."menu_items" USING "btree" ("business_id");



CREATE INDEX "idx_menu_items_category_id" ON "public"."menu_items" USING "btree" ("category_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_order_delivery_delivery_id" ON "public"."order_delivery" USING "btree" ("delivery_id");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_payments_payment_id" ON "public"."order_payments" USING "btree" ("payment_id");



CREATE INDEX "idx_order_status_history_changed_by" ON "public"."order_status_history" USING "btree" ("changed_by");



CREATE INDEX "idx_order_status_history_order_id" ON "public"."order_status_history" USING "btree" ("order_id");



CREATE INDEX "idx_orders_business_id" ON "public"."orders" USING "btree" ("business_id");



CREATE INDEX "idx_orders_client_id" ON "public"."orders" USING "btree" ("client_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_partner_catalog_availability_business_state" ON "public"."partner_catalog_item_availability" USING "btree" ("business_id", "availability_state", "item_type");



CREATE INDEX "idx_partner_catalog_availability_changed_by" ON "public"."partner_catalog_item_availability" USING "btree" ("changed_by") WHERE ("changed_by" IS NOT NULL);



CREATE INDEX "idx_partner_profiles_business_id" ON "public"."partner_profiles" USING "btree" ("business_id");



CREATE INDEX "idx_partner_staff_business_id" ON "public"."partner_staff" USING "btree" ("business_id");



CREATE INDEX "idx_partner_staff_user_id" ON "public"."partner_staff" USING "btree" ("user_id");



CREATE INDEX "idx_partner_stop_statuses_business_paused" ON "public"."partner_stop_statuses" USING "btree" ("business_id", "is_paused", "scope_type");



CREATE INDEX "idx_partner_stop_statuses_paused_by" ON "public"."partner_stop_statuses" USING "btree" ("paused_by") WHERE ("paused_by" IS NOT NULL);



CREATE INDEX "idx_partners_owner_user_id" ON "public"."partners" USING "btree" ("owner_user_id");



CREATE INDEX "idx_partners_status" ON "public"."partners" USING "btree" ("status");



CREATE INDEX "idx_payments_booking_id" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_payments_order_id" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "idx_payments_user_id" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "idx_products_business_id" ON "public"."products" USING "btree" ("business_id");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_promo_codes_business_id" ON "public"."promo_codes" USING "btree" ("business_id");



CREATE INDEX "idx_promo_usage_booking_id" ON "public"."promo_usage" USING "btree" ("booking_id");



CREATE INDEX "idx_promo_usage_order_id" ON "public"."promo_usage" USING "btree" ("order_id");



CREATE INDEX "idx_promo_usage_promo_code_id" ON "public"."promo_usage" USING "btree" ("promo_code_id");



CREATE INDEX "idx_promo_usage_user_id" ON "public"."promo_usage" USING "btree" ("user_id");



CREATE INDEX "idx_refunds_approved_by" ON "public"."refunds" USING "btree" ("approved_by");



CREATE INDEX "idx_refunds_payment_id" ON "public"."refunds" USING "btree" ("payment_id");



CREATE INDEX "idx_reviews_booking_id" ON "public"."reviews" USING "btree" ("booking_id");



CREATE INDEX "idx_reviews_business_id" ON "public"."reviews" USING "btree" ("business_id");



CREATE INDEX "idx_reviews_client_id" ON "public"."reviews" USING "btree" ("client_id");



CREATE INDEX "idx_reviews_order_id" ON "public"."reviews" USING "btree" ("order_id");



CREATE INDEX "idx_room_availability_room_date" ON "public"."room_availability" USING "btree" ("room_id", "date");



CREATE INDEX "idx_rooms_business_id" ON "public"."rooms" USING "btree" ("business_id");



CREATE INDEX "idx_rooms_stay_id" ON "public"."rooms" USING "btree" ("stay_id");



CREATE INDEX "idx_stays_business_id" ON "public"."stays" USING "btree" ("business_id");



CREATE INDEX "idx_stays_category_id" ON "public"."stays" USING "btree" ("category_id");



CREATE INDEX "idx_support_tickets_created_by" ON "public"."support_tickets" USING "btree" ("created_by");



CREATE INDEX "idx_support_tickets_intake_phone_recent" ON "public"."support_tickets" USING "btree" ((("request_payload" ->> 'contact_phone_hash'::"text")), "created_at" DESC);



CREATE INDEX "idx_support_tickets_related_booking_id" ON "public"."support_tickets" USING "btree" ("related_booking_id");



CREATE INDEX "idx_support_tickets_related_order_id" ON "public"."support_tickets" USING "btree" ("related_order_id");



CREATE INDEX "idx_ticket_messages_sender_id" ON "public"."ticket_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_ticket_messages_ticket_id" ON "public"."ticket_messages" USING "btree" ("ticket_id");



CREATE INDEX "idx_tour_schedules_tour_date" ON "public"."tour_schedules" USING "btree" ("tour_id", "date");



CREATE INDEX "idx_tours_business_id" ON "public"."tours" USING "btree" ("business_id");



CREATE INDEX "idx_tours_category_id" ON "public"."tours" USING "btree" ("category_id");



CREATE INDEX "idx_user_roles_role" ON "public"."user_roles" USING "btree" ("role");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "kol_cost_entries_by_journal_v1" ON "public"."kol_finance_cost_entries_v1" USING "btree" ("cost_journal_id");



CREATE UNIQUE INDEX "kol_cost_one_reversal_v1" ON "public"."kol_finance_cost_journals_v1" USING "btree" ("original_id") WHERE ("original_id" IS NOT NULL);



CREATE INDEX "kol_finance_cost_report_v1" ON "public"."kol_finance_cost_journals_v1" USING "btree" ("posted_at", "currency", "business_id");



CREATE INDEX "kol_finance_entries_journal_v1" ON "public"."kol_finance_entries_v1" USING "btree" ("journal_id");



CREATE INDEX "kol_finance_journals_recognition_date_v1" ON "public"."kol_finance_journals_v1" USING "btree" ("recognized_at", "business_id");



CREATE UNIQUE INDEX "kol_finance_one_payout_request_v1" ON "public"."kol_finance_requests_v1" USING "btree" ("journal_id") WHERE ("request_kind" = 'payout'::"text");



CREATE UNIQUE INDEX "kol_finance_one_refund_request_v1" ON "public"."kol_finance_requests_v1" USING "btree" ("payment_id") WHERE ("request_kind" = 'refund'::"text");



CREATE INDEX "kol_finance_requests_scope_v1" ON "public"."kol_finance_requests_v1" USING "btree" ("business_id", "requested_at", "request_kind");



CREATE INDEX "kol_finance_terms_lookup" ON "public"."kol_finance_terms_v1" USING "btree" ("business_id", "service_line", "currency", "valid_from", "valid_until");



CREATE INDEX "listing_promotions_type_pos_idx" ON "public"."listing_promotions" USING "btree" ("target_type", "is_active", "position");



CREATE UNIQUE INDEX "reviews_one_per_booking_idx" ON "public"."reviews" USING "btree" ("client_id", "booking_id") WHERE ("source" = 'site'::"text");



CREATE INDEX "site_ad_campaigns_slot_active_idx" ON "public"."site_ad_campaigns" USING "btree" ("slot_code", "status", "starts_at", "ends_at");



CREATE UNIQUE INDEX "uq_bookings_client_id_idempotency_key" ON "public"."bookings" USING "btree" ("client_id", (("metadata" ->> 'idempotency_key'::"text"))) WHERE ("metadata" ? 'idempotency_key'::"text");



CREATE UNIQUE INDEX "uq_courier_assignments_active_delivery" ON "public"."courier_assignments" USING "btree" ("delivery_id") WHERE ("status" = ANY (ARRAY['assigned'::"text", 'accepted'::"text", 'in_progress'::"text"]));



CREATE UNIQUE INDEX "uq_kol_client_booking_request" ON "public"."audit_logs" USING "btree" ("actor_id", "request_id") WHERE (("action" = 'client_booking_created'::"text") AND ("request_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_kol_intake_order_link" ON "public"."support_tickets" USING "btree" ("related_order_id") WHERE (("category" = 'order_request'::"text") AND ("related_order_id" IS NOT NULL));



CREATE UNIQUE INDEX "uq_kol_tour_schedule_exact_slot" ON "public"."tour_schedules" USING "btree" ("tour_id", "date", "time") NULLS NOT DISTINCT;



CREATE UNIQUE INDEX "uq_media_files_storage_object" ON "public"."media_files" USING "btree" ("storage_bucket", "storage_path") WHERE (("storage_bucket" IS NOT NULL) AND ("storage_path" IS NOT NULL));



CREATE UNIQUE INDEX "uq_orders_client_id_idempotency_key" ON "public"."orders" USING "btree" ("client_id", (("metadata" ->> 'idempotency_key'::"text"))) WHERE ("metadata" ? 'idempotency_key'::"text");



CREATE UNIQUE INDEX "uq_payments_provider_reference" ON "public"."payments" USING "btree" ("provider", "provider_reference") WHERE (("provider" IS NOT NULL) AND ("provider_reference" IS NOT NULL));



CREATE OR REPLACE TRIGGER "trg_payment_provider_event_replay_guard" BEFORE INSERT ON "private"."payment_provider_events" FOR EACH ROW EXECUTE FUNCTION "private"."guard_payment_provider_event_replay"();



CREATE OR REPLACE TRIGGER "campaign_payment_before" BEFORE INSERT OR UPDATE ON "public"."site_ad_campaigns" FOR EACH ROW EXECUTE FUNCTION "private"."ad_payment_before"();



CREATE OR REPLACE TRIGGER "editorial_score_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."editorial_scores" FOR EACH ROW EXECUTE FUNCTION "private"."site_audit"();



CREATE OR REPLACE TRIGGER "enforce_active_client_identity_on_bookings" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_active_client_transaction_identity"();



CREATE OR REPLACE TRIGGER "enforce_active_client_identity_on_orders" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_active_client_transaction_identity"();



CREATE OR REPLACE TRIGGER "kol_cost_entries_immutable_v1" BEFORE DELETE OR UPDATE ON "public"."kol_finance_cost_entries_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_reject_mutation_v1"();



CREATE OR REPLACE TRIGGER "kol_cost_journal_immutable_v1" BEFORE DELETE OR UPDATE ON "public"."kol_finance_cost_journals_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_reject_mutation_v1"();



CREATE OR REPLACE TRIGGER "kol_decisions_immutable_v1" BEFORE DELETE OR UPDATE ON "public"."kol_finance_decisions_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_reject_mutation_v1"();



CREATE OR REPLACE TRIGGER "kol_entries_immutable_v1" BEFORE DELETE OR UPDATE ON "public"."kol_finance_entries_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_reject_mutation_v1"();



CREATE OR REPLACE TRIGGER "kol_finance_terms_guard_v1" BEFORE INSERT OR DELETE OR UPDATE ON "public"."kol_finance_terms_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_terms_guard_v1"();



CREATE OR REPLACE TRIGGER "kol_journals_immutable_v1" BEFORE DELETE OR UPDATE ON "public"."kol_finance_journals_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_reject_mutation_v1"();



CREATE OR REPLACE TRIGGER "kol_requests_immutable_v1" BEFORE DELETE OR UPDATE ON "public"."kol_finance_requests_v1" FOR EACH ROW EXECUTE FUNCTION "private"."kol_finance_reject_mutation_v1"();



CREATE OR REPLACE TRIGGER "promotion_payment_before" BEFORE INSERT OR UPDATE ON "public"."listing_promotions" FOR EACH ROW EXECUTE FUNCTION "private"."ad_payment_before"();



CREATE OR REPLACE TRIGGER "reject_paused_partner_bookings" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "private"."reject_paused_partner_demand"();



CREATE OR REPLACE TRIGGER "reject_paused_partner_orders" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "private"."reject_paused_partner_demand"();



CREATE OR REPLACE TRIGGER "reject_unavailable_catalog_order_items" BEFORE INSERT ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "private"."reject_unavailable_catalog_order_item"();



CREATE OR REPLACE TRIGGER "reviews_guard" BEFORE INSERT OR UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "private"."reviews_guard"();



CREATE OR REPLACE TRIGGER "reviews_insert_audit" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "private"."site_audit"();



CREATE OR REPLACE TRIGGER "reviews_moderation_audit" AFTER UPDATE ON "public"."reviews" FOR EACH ROW WHEN ((("old"."status" IS DISTINCT FROM "new"."status") OR ("old"."admin_reply" IS DISTINCT FROM "new"."admin_reply") OR ("old"."hidden_reason" IS DISTINCT FROM "new"."hidden_reason"))) EXECUTE FUNCTION "private"."site_audit"();



CREATE OR REPLACE TRIGGER "set_updated_at_admin_profiles" BEFORE UPDATE ON "public"."admin_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_bookings" BEFORE UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_categories" BEFORE UPDATE ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_client_profiles" BEFORE UPDATE ON "public"."client_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_courier_profiles" BEFORE UPDATE ON "public"."courier_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_deliveries" BEFORE UPDATE ON "public"."deliveries" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_menu_items" BEFORE UPDATE ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_orders" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_partner_profiles" BEFORE UPDATE ON "public"."partner_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_partner_staff" BEFORE UPDATE ON "public"."partner_staff" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_partners" BEFORE UPDATE ON "public"."partners" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_products" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_restaurants" BEFORE UPDATE ON "public"."restaurants" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_rooms" BEFORE UPDATE ON "public"."rooms" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_shops" BEFORE UPDATE ON "public"."shops" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_stays" BEFORE UPDATE ON "public"."stays" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_tours" BEFORE UPDATE ON "public"."tours" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_user_profiles" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_user_roles" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "site_ad_campaign_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."site_ad_campaigns" FOR EACH ROW EXECUTE FUNCTION "private"."site_audit"();



CREATE OR REPLACE TRIGGER "site_content_after" AFTER INSERT OR UPDATE ON "public"."site_content" FOR EACH ROW EXECUTE FUNCTION "private"."content_history_after"();



CREATE OR REPLACE TRIGGER "site_content_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."site_content" FOR EACH ROW EXECUTE FUNCTION "private"."site_audit"();



CREATE OR REPLACE TRIGGER "site_content_before" BEFORE INSERT OR UPDATE ON "public"."site_content" FOR EACH ROW EXECUTE FUNCTION "private"."content_before"();



CREATE OR REPLACE TRIGGER "site_promotion_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."listing_promotions" FOR EACH ROW EXECUTE FUNCTION "private"."site_audit"();



CREATE OR REPLACE TRIGGER "trg_categories_scope_reference_guard" BEFORE UPDATE OF "scope" ON "public"."categories" FOR EACH ROW EXECUTE FUNCTION "private"."guard_category_scope_change"();



CREATE CONSTRAINT TRIGGER "trg_courier_profile_delivery_consistency" AFTER INSERT OR DELETE OR UPDATE ON "public"."courier_profiles" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_courier_profile_delivery_consistency"();



CREATE CONSTRAINT TRIGGER "trg_delivery_assignment_consistency_on_assignment" AFTER INSERT OR DELETE OR UPDATE ON "public"."courier_assignments" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_delivery_assignment_consistency"();



CREATE CONSTRAINT TRIGGER "trg_delivery_assignment_consistency_on_delivery" AFTER INSERT OR DELETE OR UPDATE ON "public"."deliveries" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "private"."assert_delivery_assignment_consistency"();



CREATE OR REPLACE TRIGGER "trg_guard_provider_payment_identity" BEFORE UPDATE OF "user_id", "order_id", "booking_id", "amount", "provider", "provider_reference", "method" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "private"."guard_provider_payment_identity"();



CREATE OR REPLACE TRIGGER "trg_menu_items_active_category" BEFORE INSERT OR UPDATE OF "category_id" ON "public"."menu_items" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_active_catalog_category"();



CREATE OR REPLACE TRIGGER "trg_normalize_order_payment_projection" BEFORE INSERT OR UPDATE OF "order_id", "payment_id", "amount", "status" ON "public"."order_payments" FOR EACH ROW EXECUTE FUNCTION "private"."normalize_order_payment_projection"();



CREATE OR REPLACE TRIGGER "trg_products_active_category" BEFORE INSERT OR UPDATE OF "category_id" ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_active_catalog_category"();



CREATE OR REPLACE TRIGGER "trg_stays_active_category" BEFORE INSERT OR UPDATE OF "category_id" ON "public"."stays" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_active_catalog_category"();



CREATE OR REPLACE TRIGGER "trg_sync_order_payment_projection_after_payment" AFTER UPDATE OF "amount", "status" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "private"."sync_order_payment_projection_after_payment"();



CREATE OR REPLACE TRIGGER "trg_tours_active_category" BEFORE INSERT OR UPDATE OF "category_id" ON "public"."tours" FOR EACH ROW EXECUTE FUNCTION "private"."enforce_active_catalog_category"();



ALTER TABLE ONLY "private"."kol_delivery_tariffs"
    ADD CONSTRAINT "kol_delivery_tariffs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "private"."kol_delivery_tariffs"
    ADD CONSTRAINT "kol_delivery_tariffs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "private"."payment_provider_events"
    ADD CONSTRAINT "payment_provider_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_profiles"
    ADD CONSTRAINT "admin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_alerts"
    ADD CONSTRAINT "ai_alerts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."ai_dispatcher_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_decision_logs"
    ADD CONSTRAINT "ai_decision_logs_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ai_recommendations"
    ADD CONSTRAINT "ai_recommendations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."ai_dispatcher_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."alcohol_module_settings"
    ADD CONSTRAINT "alcohol_module_settings_enabled_by_fkey" FOREIGN KEY ("enabled_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."booking_guests"
    ADD CONSTRAINT "booking_guests_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_status_history"
    ADD CONSTRAINT "booking_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_profiles"
    ADD CONSTRAINT "client_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_reviews"
    ADD CONSTRAINT "compliance_reviews_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."courier_assignments"
    ADD CONSTRAINT "courier_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."courier_assignments"
    ADD CONSTRAINT "courier_assignments_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courier_assignments"
    ADD CONSTRAINT "courier_assignments_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courier_locations"
    ADD CONSTRAINT "courier_locations_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courier_profiles"
    ADD CONSTRAINT "courier_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."courier_shifts"
    ADD CONSTRAINT "courier_shifts_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_assigned_courier_id_fkey" FOREIGN KEY ("assigned_courier_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deliveries"
    ADD CONSTRAINT "deliveries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_issues"
    ADD CONSTRAINT "delivery_issues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."delivery_issues"
    ADD CONSTRAINT "delivery_issues_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."delivery_status_history"
    ADD CONSTRAINT "delivery_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."delivery_status_history"
    ADD CONSTRAINT "delivery_status_history_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."editorial_scores"
    ADD CONSTRAINT "editorial_scores_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kol_finance_cost_entries_v1"
    ADD CONSTRAINT "kol_finance_cost_entries_v1_cost_journal_id_fkey" FOREIGN KEY ("cost_journal_id") REFERENCES "public"."kol_finance_cost_journals_v1"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_cost_journals_v1"
    ADD CONSTRAINT "kol_finance_cost_journals_v1_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_cost_journals_v1"
    ADD CONSTRAINT "kol_finance_cost_journals_v1_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_cost_journals_v1"
    ADD CONSTRAINT "kol_finance_cost_journals_v1_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "public"."kol_finance_cost_journals_v1"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_decisions_v1"
    ADD CONSTRAINT "kol_finance_decisions_v1_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_decisions_v1"
    ADD CONSTRAINT "kol_finance_decisions_v1_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "public"."kol_finance_requests_v1"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_entries_v1"
    ADD CONSTRAINT "kol_finance_entries_v1_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."kol_finance_journals_v1"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "public"."kol_finance_terms_v1"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_journals_v1"
    ADD CONSTRAINT "kol_finance_journals_v1_verified_event_id_fkey" FOREIGN KEY ("verified_event_id") REFERENCES "private"."payment_provider_events"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_requests_v1"
    ADD CONSTRAINT "kol_finance_requests_v1_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_requests_v1"
    ADD CONSTRAINT "kol_finance_requests_v1_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "public"."kol_finance_journals_v1"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_requests_v1"
    ADD CONSTRAINT "kol_finance_requests_v1_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_requests_v1"
    ADD CONSTRAINT "kol_finance_requests_v1_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_terms_v1"
    ADD CONSTRAINT "kol_finance_terms_v1_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kol_finance_terms_v1"
    ADD CONSTRAINT "kol_finance_terms_v1_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."listing_promotions"
    ADD CONSTRAINT "listing_promotions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listing_promotions"
    ADD CONSTRAINT "listing_promotions_paid_marked_by_fkey" FOREIGN KEY ("paid_marked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_accounts"
    ADD CONSTRAINT "loyalty_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."loyalty_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_files"
    ADD CONSTRAINT "media_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_delivery"
    ADD CONSTRAINT "order_delivery_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_delivery"
    ADD CONSTRAINT "order_delivery_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_payments"
    ADD CONSTRAINT "order_payments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."partner_catalog_item_availability"
    ADD CONSTRAINT "partner_catalog_item_availability_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_catalog_item_availability"
    ADD CONSTRAINT "partner_catalog_item_availability_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_profiles"
    ADD CONSTRAINT "partner_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_profiles"
    ADD CONSTRAINT "partner_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_staff"
    ADD CONSTRAINT "partner_staff_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_staff"
    ADD CONSTRAINT "partner_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_stop_statuses"
    ADD CONSTRAINT "partner_stop_statuses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_stop_statuses"
    ADD CONSTRAINT "partner_stop_statuses_paused_by_fkey" FOREIGN KEY ("paused_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partners"
    ADD CONSTRAINT "partners_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_usage"
    ADD CONSTRAINT "promo_usage_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promo_usage"
    ADD CONSTRAINT "promo_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."promo_usage"
    ADD CONSTRAINT "promo_usage_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_usage"
    ADD CONSTRAINT "promo_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."restaurants"
    ADD CONSTRAINT "restaurants_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_moderated_by_fkey" FOREIGN KEY ("moderated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."room_availability"
    ADD CONSTRAINT "room_availability_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_stay_id_fkey" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shops"
    ADD CONSTRAINT "shops_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."site_ad_campaigns"
    ADD CONSTRAINT "site_ad_campaigns_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_ad_campaigns"
    ADD CONSTRAINT "site_ad_campaigns_paid_marked_by_fkey" FOREIGN KEY ("paid_marked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_ad_campaigns"
    ADD CONSTRAINT "site_ad_campaigns_slot_code_fkey" FOREIGN KEY ("slot_code") REFERENCES "public"."site_ad_slots"("code");



ALTER TABLE ONLY "public"."site_content_history"
    ADD CONSTRAINT "site_content_history_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stays"
    ADD CONSTRAINT "stays_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_related_booking_id_fkey" FOREIGN KEY ("related_booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_related_order_id_fkey" FOREIGN KEY ("related_order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tour_schedules"
    ADD CONSTRAINT "tour_schedules_tour_id_fkey" FOREIGN KEY ("tour_id") REFERENCES "public"."tours"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "public"."partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tours"
    ADD CONSTRAINT "tours_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "private"."kol_delivery_tariffs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins read admin profiles" ON "public"."admin_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "admins read ai alerts" ON "public"."ai_alerts" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins read ai decision logs" ON "public"."ai_decision_logs" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins read ai events" ON "public"."ai_dispatcher_events" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read ai recommendations" ON "public"."ai_recommendations" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read audit logs" ON "public"."audit_logs" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read compliance reviews" ON "public"."compliance_reviews" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "admins read own admin profile" ON "public"."admin_profiles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."ai_alerts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_decision_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_dispatcher_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."alcohol_module_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon read active categories" ON "public"."categories" FOR SELECT TO "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "anon read active menu items" ON "public"."menu_items" FOR SELECT TO "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "anon read active products" ON "public"."products" FOR SELECT TO "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "anon read active stays" ON "public"."stays" FOR SELECT TO "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "anon read active tours" ON "public"."tours" FOR SELECT TO "anon" USING (("status" = 'active'::"text"));



CREATE POLICY "anon read approved partners" ON "public"."partners" FOR SELECT TO "anon" USING (("status" = 'approved'::"text"));



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "authenticated read visible categories" ON "public"."categories" FOR SELECT TO "authenticated" USING ((("status" = 'active'::"text") OR "public"."is_admin"()));



CREATE POLICY "authenticated read visible menu items" ON "public"."menu_items" FOR SELECT TO "authenticated" USING ((("status" = 'active'::"text") OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "authenticated read visible partners" ON "public"."partners" FOR SELECT TO "authenticated" USING ((("status" = 'approved'::"text") OR "public"."is_partner_for"("id") OR "public"."is_admin"()));



CREATE POLICY "authenticated read visible products" ON "public"."products" FOR SELECT TO "authenticated" USING ((("status" = 'active'::"text") OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "authenticated read visible stays" ON "public"."stays" FOR SELECT TO "authenticated" USING ((("status" = 'active'::"text") OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "authenticated read visible tours" ON "public"."tours" FOR SELECT TO "authenticated" USING ((("status" = 'active'::"text") OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "booking guests follow booking access" ON "public"."booking_guests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE ("b"."id" = "booking_guests"."booking_id"))));



CREATE POLICY "booking history follows booking access" ON "public"."booking_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."bookings" "b"
  WHERE ("b"."id" = "booking_status_history"."booking_id"))));



ALTER TABLE "public"."booking_guests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."booking_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients read own bookings" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((("client_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "clients read own client profile" ON "public"."client_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "clients read own orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("client_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "clients read own user profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "content managers import reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((("source" = 'import'::"text") AND "private"."can_manage_content"()));



CREATE POLICY "content managers moderate reviews" ON "public"."reviews" FOR UPDATE TO "authenticated" USING ("private"."can_manage_content"()) WITH CHECK ("private"."can_manage_content"());



CREATE POLICY "content managers read all reviews" ON "public"."reviews" FOR SELECT TO "authenticated" USING ("private"."can_manage_content"());



CREATE POLICY "courier owner or admin reads delivery issues" ON "public"."delivery_issues" FOR SELECT TO "authenticated" USING (((("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."has_role"('courier'::"text")) OR "public"."is_admin"()));



ALTER TABLE "public"."courier_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courier_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courier_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courier_shifts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "couriers create delivery issues" ON "public"."delivery_issues" FOR INSERT WITH CHECK (("public"."is_admin"() OR (("created_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'open'::"text") AND ("category" = ANY (ARRAY['partner_pickup'::"text", 'client_address'::"text", 'damaged_order'::"text", 'route_safety'::"text", 'payment_admin'::"text"])) AND ("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])) AND ("description" IS NOT NULL) AND (("char_length"("btrim"("description")) >= 12) AND ("char_length"("btrim"("description")) <= 1000)) AND (EXISTS ( SELECT 1
   FROM "public"."deliveries" "d"
  WHERE (("d"."id" = "delivery_issues"."delivery_id") AND "public"."is_assigned_courier"("d"."id")))))));



CREATE POLICY "couriers read own assignments" ON "public"."courier_assignments" FOR SELECT TO "authenticated" USING ((("courier_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "couriers read own courier profile" ON "public"."courier_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "couriers read own locations" ON "public"."courier_locations" FOR SELECT TO "authenticated" USING ((("courier_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "couriers read own shifts" ON "public"."courier_shifts" FOR SELECT TO "authenticated" USING ((("courier_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "couriers update own courier status" ON "public"."courier_profiles" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."deliveries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delivery history follows delivery access" ON "public"."delivery_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."deliveries" "d"
  WHERE ("d"."id" = "delivery_status_history"."delivery_id"))));



CREATE POLICY "delivery scoped read" ON "public"."deliveries" FOR SELECT TO "authenticated" USING (("public"."is_assigned_courier"("id") OR (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "deliveries"."order_id") AND (("o"."client_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_partner_for"("o"."business_id"))))) OR "public"."is_admin"()));



ALTER TABLE "public"."delivery_issues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."delivery_status_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dispatcher creates ai events draft" ON "public"."ai_dispatcher_events" FOR INSERT WITH CHECK (("public"."has_role"('dispatcher'::"text") OR "public"."has_role"('super_admin'::"text")));



CREATE POLICY "dispatcher creates recommendations only" ON "public"."ai_recommendations" FOR INSERT WITH CHECK (("public"."has_role"('dispatcher'::"text") OR "public"."has_role"('super_admin'::"text")));



CREATE POLICY "editorial_read" ON "public"."editorial_scores" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."editorial_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "editorial_write" ON "public"."editorial_scores" TO "authenticated" USING ("private"."can_manage_content"()) WITH CHECK ("private"."can_manage_content"());



ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finance admins manage refunds" ON "public"."refunds" USING ("public"."is_finance_admin"()) WITH CHECK ("public"."is_finance_admin"());



CREATE POLICY "finance admins read payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_finance_admin"() OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "finance admins read payouts" ON "public"."payouts" FOR SELECT USING ("public"."is_finance_admin"());



CREATE POLICY "finance admins read transactions" ON "public"."transactions" FOR SELECT TO "authenticated" USING ("public"."is_finance_admin"());



CREATE POLICY "finance and partner read commissions" ON "public"."commissions" FOR SELECT TO "authenticated" USING (("public"."is_finance_admin"() OR (("business_id" IS NOT NULL) AND "public"."is_partner_for"("business_id"))));



CREATE POLICY "guests insert own review" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((("source" = 'site'::"text") AND ("client_id" = "auth"."uid"())));



ALTER TABLE "public"."kol_finance_cost_entries_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kol_finance_cost_journals_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kol_finance_decisions_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kol_finance_entries_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kol_finance_journals_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kol_finance_requests_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kol_finance_terms_v1" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listing_promotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "no ai alcohol enablement" ON "public"."alcohol_module_settings" FOR UPDATE USING ("public"."has_role"('super_admin'::"text")) WITH CHECK (("public"."has_role"('super_admin'::"text") AND ("is_enabled" = false)));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order delivery follows order access" ON "public"."order_delivery" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE ("o"."id" = "order_delivery"."order_id"))));



CREATE POLICY "order items follow order access" ON "public"."order_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND (("o"."client_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_partner_for"("o"."business_id") OR "public"."is_admin"())))));



CREATE POLICY "order payments follow order access" ON "public"."order_payments" FOR SELECT TO "authenticated" USING (("public"."is_finance_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE ("o"."id" = "order_payments"."order_id")))));



CREATE POLICY "order status history follows order access" ON "public"."order_status_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_status_history"."order_id") AND (("o"."client_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_partner_for"("o"."business_id") OR "public"."is_admin"())))));



ALTER TABLE "public"."order_delivery" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_status_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_catalog_item_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_staff" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_stop_statuses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partners" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "partners admins read promo codes" ON "public"."promo_codes" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (("business_id" IS NOT NULL) AND "public"."is_partner_for"("business_id"))));



CREATE POLICY "partners create own catalog media metadata" ON "public"."media_files" FOR INSERT TO "authenticated" WITH CHECK ((("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND ("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'image/avif'::"text"])) AND (("size_bytes" >= 1) AND ("size_bytes" <= 8388608)) AND "private"."catalog_media_path_matches"("storage_path", "owner_type", "owner_id") AND "private"."catalog_media_partner_can_manage"("storage_path")));



CREATE POLICY "partners delete own catalog media metadata" ON "public"."media_files" FOR DELETE TO "authenticated" USING ((("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND "private"."catalog_media_path_matches"("storage_path", "owner_type", "owner_id") AND "private"."catalog_media_partner_can_manage"("storage_path")));



CREATE POLICY "partners delete own menu items" ON "public"."menu_items" FOR DELETE TO "authenticated" USING ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners delete own products" ON "public"."products" FOR DELETE TO "authenticated" USING ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners delete own stays" ON "public"."stays" FOR DELETE TO "authenticated" USING ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners delete own tours" ON "public"."tours" FOR DELETE TO "authenticated" USING ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners insert own menu items" ON "public"."menu_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners insert own products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners insert own stays" ON "public"."stays" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners insert own tours" ON "public"."tours" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners manage own rooms" ON "public"."rooms" USING ("public"."is_partner_for"("business_id")) WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners read own catalog availability" ON "public"."partner_catalog_item_availability" FOR SELECT TO "authenticated" USING (("public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "partners read own catalog media metadata" ON "public"."media_files" FOR SELECT TO "authenticated" USING (((("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND "private"."catalog_media_path_matches"("storage_path", "owner_type", "owner_id") AND "private"."catalog_media_partner_can_manage"("storage_path")) OR (("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND "private"."catalog_media_path_matches"("storage_path", "owner_type", "owner_id") AND "private"."catalog_media_owner_is_public"("owner_type", "owner_id")) OR "public"."is_admin"()));



CREATE POLICY "partners read own partner profile" ON "public"."partner_profiles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "partners read own room availability" ON "public"."room_availability" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."rooms" "r"
  WHERE (("r"."id" = "room_availability"."room_id") AND ("public"."is_partner_for"("r"."business_id") OR "public"."is_admin"())))));



CREATE POLICY "partners read own staff" ON "public"."partner_staff" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "partners read own stop statuses" ON "public"."partner_stop_statuses" FOR SELECT TO "authenticated" USING (("public"."is_partner_for"("business_id") OR "public"."is_admin"()));



CREATE POLICY "partners read own tour schedules" ON "public"."tour_schedules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tours" "t"
  WHERE (("t"."id" = "tour_schedules"."tour_id") AND ("public"."is_partner_for"("t"."business_id") OR "public"."is_admin"())))));



CREATE POLICY "partners update own business" ON "public"."partners" FOR UPDATE TO "authenticated" USING ("public"."is_partner_for"("id")) WITH CHECK ("public"."is_partner_for"("id"));



CREATE POLICY "partners update own catalog media metadata" ON "public"."media_files" FOR UPDATE TO "authenticated" USING ((("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND "private"."catalog_media_partner_can_manage"("storage_path"))) WITH CHECK ((("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND ("mime_type" = ANY (ARRAY['image/jpeg'::"text", 'image/png'::"text", 'image/webp'::"text", 'image/avif'::"text"])) AND (("size_bytes" >= 1) AND ("size_bytes" <= 8388608)) AND "private"."catalog_media_path_matches"("storage_path", "owner_type", "owner_id") AND "private"."catalog_media_partner_can_manage"("storage_path")));



CREATE POLICY "partners update own menu items" ON "public"."menu_items" FOR UPDATE TO "authenticated" USING ("public"."is_partner_for"("business_id")) WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners update own products" ON "public"."products" FOR UPDATE TO "authenticated" USING ("public"."is_partner_for"("business_id")) WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners update own stays" ON "public"."stays" FOR UPDATE TO "authenticated" USING ("public"."is_partner_for"("business_id")) WITH CHECK ("public"."is_partner_for"("business_id"));



CREATE POLICY "partners update own tours" ON "public"."tours" FOR UPDATE TO "authenticated" USING ("public"."is_partner_for"("business_id")) WITH CHECK ("public"."is_partner_for"("business_id"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promo_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public read visible restaurants" ON "public"."restaurants" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."partners" "p"
  WHERE ("p"."id" = "restaurants"."business_id"))));



CREATE POLICY "public read visible shops" ON "public"."shops" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."partners" "p"
  WHERE ("p"."id" = "shops"."business_id"))));



CREATE POLICY "public reads published reviews" ON "public"."reviews" FOR SELECT TO "authenticated", "anon" USING (("status" = 'published'::"text"));



CREATE POLICY "public reads visible catalog media metadata" ON "public"."media_files" FOR SELECT TO "anon" USING ((("storage_bucket" = 'catalog-media'::"text") AND ("storage_path" IS NOT NULL) AND "private"."catalog_media_path_matches"("storage_path", "owner_type", "owner_id") AND "private"."catalog_media_owner_is_public"("owner_type", "owner_id")));



ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."restaurants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "review participants read relevant reviews" ON "public"."reviews" FOR SELECT TO "authenticated" USING ((("client_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_partner_for"("business_id") OR "public"."is_admin"()));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_availability" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shops" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_ad_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_ad_slots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_campaign_read" ON "public"."site_ad_campaigns" FOR SELECT TO "authenticated", "anon" USING ((("status" = 'active'::"text") AND ("starts_at" <= "now"()) AND ("ends_at" > "now"()) AND (("price_kgs" = (0)::numeric) OR (("payment_status" = 'paid'::"text") AND ("paid_marked_by" IS NOT NULL) AND ("payment_evidence" IS NOT NULL)))));



CREATE POLICY "site_campaign_write" ON "public"."site_ad_campaigns" TO "authenticated" USING ("private"."can_manage_content"()) WITH CHECK ("private"."can_manage_content"());



ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_content_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "site_content_read" ON "public"."site_content" FOR SELECT TO "authenticated", "anon" USING (("status" = 'published'::"text"));



CREATE POLICY "site_content_write" ON "public"."site_content" TO "authenticated" USING ("private"."can_manage_content"()) WITH CHECK ("private"."can_manage_content"());



CREATE POLICY "site_history_read" ON "public"."site_content_history" FOR SELECT TO "authenticated" USING ("private"."can_manage_content"());



CREATE POLICY "site_promo_read" ON "public"."listing_promotions" FOR SELECT TO "authenticated", "anon" USING (("is_active" AND ("starts_at" <= "now"()) AND (("ends_at" IS NULL) OR ("ends_at" > "now"())) AND (("price_kgs" = (0)::numeric) OR (("payment_status" = 'paid'::"text") AND ("paid_marked_by" IS NOT NULL) AND ("payment_evidence" IS NOT NULL)))));



CREATE POLICY "site_promo_write" ON "public"."listing_promotions" TO "authenticated" USING ("private"."can_manage_content"()) WITH CHECK ("private"."can_manage_content"());



CREATE POLICY "site_slots_read" ON "public"."site_ad_slots" FOR SELECT TO "authenticated", "anon" USING ("is_active");



ALTER TABLE "public"."stays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super admins read alcohol settings" ON "public"."alcohol_module_settings" FOR SELECT USING ("public"."has_role"('super_admin'::"text"));



CREATE POLICY "support message visibility follows ticket access" ON "public"."ticket_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."support_tickets" "st"
  WHERE (("st"."id" = "ticket_messages"."ticket_id") AND (("st"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()) AND (("ticket_messages"."visibility" = 'public'::"text") OR (("ticket_messages"."visibility" = 'internal'::"text") AND ("public"."has_role"('support_admin'::"text") OR "public"."has_role"('super_admin'::"text"))))))));



CREATE POLICY "support ticket owners and admins read tickets" ON "public"."support_tickets" FOR SELECT TO "authenticated" USING ((("created_by" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tour_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tours" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users create own favorites" ON "public"."favorites" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users delete own favorites" ON "public"."favorites" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users read own favorites" ON "public"."favorites" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users read own loyalty account" ON "public"."loyalty_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "users read own loyalty transactions" ON "public"."loyalty_transactions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."loyalty_accounts" "la"
  WHERE ("la"."id" = "loyalty_transactions"."account_id"))));



CREATE POLICY "users read own notifications" ON "public"."notifications" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "users read own promo usage" ON "public"."promo_usage" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_admin"()));



CREATE POLICY "users read own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users update own favorites" ON "public"."favorites" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "private" TO "service_role";
GRANT USAGE ON SCHEMA "private" TO "authenticated";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT ALL ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "private"."ad_payment_before"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."admin_catalog_category_atomic_internal"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."admin_catalog_category_atomic_internal"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."admin_catalog_governance_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."admin_catalog_governance_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."admin_catalog_moderation_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."admin_catalog_moderation_atomic_internal"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."admin_delivery_issue_transition_internal"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."admin_delivery_issue_transition_internal"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."admin_support_lifecycle_atomic_internal"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."admin_support_lifecycle_atomic_internal"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."assert_courier_profile_delivery_consistency"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."assert_delivery_assignment_consistency"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."assign_courier_atomic_v1"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."can_confirm_content_payment"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_confirm_content_payment"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."can_manage_content"() FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."can_manage_content"() TO "authenticated";



REVOKE ALL ON FUNCTION "private"."catalog_media_owner_business"("p_owner_type" "text", "p_owner_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."catalog_media_owner_is_public"("p_owner_type" "text", "p_owner_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."catalog_media_owner_is_public"("p_owner_type" "text", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "private"."catalog_media_owner_is_public"("p_owner_type" "text", "p_owner_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."catalog_media_partner_can_manage"("p_path" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."catalog_media_partner_can_manage"("p_path" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."catalog_media_path_matches"("p_path" "text", "p_owner_type" "text", "p_owner_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."catalog_media_path_matches"("p_path" "text", "p_owner_type" "text", "p_owner_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "private"."catalog_media_path_matches"("p_path" "text", "p_owner_type" "text", "p_owner_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."client_onboarding_complete_atomic_internal"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."client_onboarding_complete_atomic_internal"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."client_profile_update_atomic_internal"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."client_profile_update_atomic_internal"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."client_stay_booking_create_atomic_internal"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."client_stay_booking_create_atomic_internal"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."client_support_ticket_create_atomic_internal"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."client_support_ticket_create_atomic_internal"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."content_before"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."content_history_after"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."courier_transition_delivery_atomic_v1"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."create_order_for_client_atomic_core"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text", "p_client_id" "uuid", "p_actor_id" "uuid", "p_actor_role" "text", "p_delivery_tariff_id" "uuid", "p_delivery_address" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."create_payment_attempt_atomic_v1_internal"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."create_payment_attempt_atomic_v1_internal"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "private"."enforce_active_catalog_category"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_category_scope_change"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_payment_provider_event_replay"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."guard_provider_payment_identity"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."kol_finance_reject_mutation_v1"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."kol_finance_terms_guard_v1"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."normalize_order_payment_projection"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."partner_availability_action_atomic_internal"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_availability_action_atomic_internal"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."partner_booking_action_atomic_internal"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_booking_action_atomic_internal"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."partner_catalog_availability_action_internal"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_catalog_availability_action_internal"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."partner_catalog_write_atomic_internal"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_catalog_write_atomic_internal"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."partner_inventory_publish_atomic_internal"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_inventory_publish_atomic_internal"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."partner_order_action_atomic_internal"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_order_action_atomic_internal"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "private"."partner_stop_action_atomic_internal"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text", "p_resume_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "private"."partner_stop_action_atomic_internal"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text", "p_resume_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "private"."reject_paused_partner_demand"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."reject_unavailable_catalog_order_item"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."reviews_guard"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."site_audit"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "private"."sync_order_payment_projection_after_payment"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."admin_catalog_category_atomic"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_catalog_category_atomic"("p_category_id" "uuid", "p_action" "text", "p_request_id" "text", "p_fields" "jsonb", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_catalog_governance_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_catalog_governance_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_catalog_moderation_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_catalog_moderation_atomic"("p_item_id" "uuid", "p_domain" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_confirm_intake_order_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_confirmed_delivery_fee_som" numeric, "p_confirmation_note" "text", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_confirm_intake_order_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_confirmed_delivery_fee_som" numeric, "p_confirmation_note" "text", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_delivery_issue_transition_atomic"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_delivery_issue_transition_atomic"("p_issue_id" "uuid", "p_to_status" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_link_intake_pickup_order_atomic"("p_ticket_id" "uuid", "p_order_id" "uuid", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_link_intake_pickup_order_atomic"("p_ticket_id" "uuid", "p_order_id" "uuid", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_support_lifecycle_atomic"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_support_lifecycle_atomic"("p_ticket_id" "uuid", "p_action" "text", "p_request_id" "text", "p_message" "text", "p_status" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."apply_verified_payment_event_atomic"("p_provider" "text", "p_event_id" "text", "p_event_type" "text", "p_provider_reference" "text", "p_verified_status" "text", "p_amount" numeric, "p_payload_hash" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_verified_payment_event_atomic"("p_provider" "text", "p_event_id" "text", "p_event_type" "text", "p_provider_reference" "text", "p_verified_status" "text", "p_amount" numeric, "p_payload_hash" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."assign_courier_atomic"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_courier_atomic"("p_delivery_id" "uuid", "p_courier_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."claim_anonymous_intake_by_verified_email_atomic"("p_ticket_id" "uuid", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_anonymous_intake_by_verified_email_atomic"("p_ticket_id" "uuid", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."client_onboarding_complete_atomic"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."client_onboarding_complete_atomic"("p_full_name" "text", "p_phone" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."client_profile_update_atomic"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."client_profile_update_atomic"("p_full_name" "text", "p_locale" "text", "p_default_address" "text", "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."client_stay_booking_create_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."client_stay_booking_create_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests" integer, "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."client_support_ticket_create_atomic"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."client_support_ticket_create_atomic"("p_category" "text", "p_title" "text", "p_message" "text", "p_request_id" "text", "p_related_order_id" "uuid", "p_related_booking_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."courier_transition_delivery_atomic"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."courier_transition_delivery_atomic"("p_delivery_id" "uuid", "p_to_status" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_order_atomic"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_order_atomic"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_order_atomic_v1_internal"("p_business_id" "uuid", "p_order_type" "text", "p_items" "jsonb", "p_delivery_method" "text", "p_idempotency_key" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_payment_attempt_atomic"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_payment_attempt_atomic"("p_subject_type" "text", "p_subject_id" "uuid", "p_provider" "text", "p_provider_reference" "text", "p_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_stay_booking_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_stay_booking_atomic"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_stay_booking_atomic_unlocked"("p_room_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_guests_count" integer, "p_idempotency_key" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_tour_booking_atomic"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_tour_booking_atomic"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_tour_booking_atomic_unlocked"("p_tour_schedule_id" "uuid", "p_participants" integer, "p_idempotency_key" "text") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."enforce_active_client_transaction_identity"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."get_courier_active_deliveries"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_courier_active_deliveries"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_public_stay_inventory"("p_stay_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_stay_inventory"("p_stay_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_stay_inventory"("p_stay_id" "uuid", "p_from" "date", "p_to" "date") TO "anon";



REVOKE ALL ON FUNCTION "public"."get_public_tour_schedules"("p_tour_id" "uuid", "p_from" "date", "p_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_tour_schedules"("p_tour_id" "uuid", "p_from" "date", "p_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_public_tour_schedules"("p_tour_id" "uuid", "p_from" "date", "p_to" "date") TO "anon";



GRANT ALL ON FUNCTION "public"."has_role"("required_role" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_assigned_courier"("delivery" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_finance_admin"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_partner_for"("business" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."kol_create_finance_request_v1"("p_kind" "text", "p_source_id" "uuid", "p_amount" numeric, "p_requested_by" "uuid", "p_idempotency_key" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_create_finance_request_v1"("p_kind" "text", "p_source_id" "uuid", "p_amount" numeric, "p_requested_by" "uuid", "p_idempotency_key" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_decide_finance_request_v1"("p_request_id" "uuid", "p_decision" "text", "p_decided_by" "uuid", "p_evidence_ref" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_decide_finance_request_v1"("p_request_id" "uuid", "p_decision" "text", "p_decided_by" "uuid", "p_evidence_ref" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_finance_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_finance_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_finance_cost_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_finance_cost_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_finance_journal_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_finance_journal_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_finance_requests_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_finance_requests_report_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_finance_settlement_preview_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_finance_settlement_preview_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_operations_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_operations_analytics_v1"("p_from" "date", "p_to" "date", "p_business_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_post_finance_cost_v1"("p_operation" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_business_id" "uuid", "p_document_reference" "text", "p_approved_by" "uuid", "p_approval_reference" "text", "p_idempotency_key" "text", "p_original_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_post_finance_cost_v1"("p_operation" "text", "p_amount" numeric, "p_currency" "text", "p_category" "text", "p_business_id" "uuid", "p_document_reference" "text", "p_approved_by" "uuid", "p_approval_reference" "text", "p_idempotency_key" "text", "p_original_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_post_verified_recognition_v1"("p_subject_type" "text", "p_subject_id" "uuid", "p_idempotency_key" "text", "p_approved_by" "uuid", "p_approval_reference" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_post_verified_recognition_v1"("p_subject_type" "text", "p_subject_id" "uuid", "p_idempotency_key" "text", "p_approved_by" "uuid", "p_approval_reference" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_public_intake_atomic"("p_id" "uuid", "p_kind" "text", "p_title" "text", "p_created_by" "uuid", "p_payload" "jsonb", "p_fingerprint" "text", "p_phone_hash" "text", "p_ip_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_public_intake_atomic"("p_id" "uuid", "p_kind" "text", "p_title" "text", "p_created_by" "uuid", "p_payload" "jsonb", "p_fingerprint" "text", "p_phone_hash" "text", "p_ip_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."kol_site_content_write_v1"("p_operation" "text", "p_key" "text", "p_locale" "text", "p_value" "text", "p_version" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."kol_site_content_write_v1"("p_operation" "text", "p_key" "text", "p_locale" "text", "p_value" "text", "p_version" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."mark_order_ready_for_pickup_atomic"("p_order_id" "uuid") FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."partner_availability_action_atomic"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_availability_action_atomic"("p_scope_type" "text", "p_scope_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."partner_booking_action_atomic"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_booking_action_atomic"("p_booking_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."partner_catalog_availability_action"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_catalog_availability_action"("p_item_type" "text", "p_item_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."partner_catalog_write_atomic"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_catalog_write_atomic"("p_domain" "text", "p_action" "text", "p_item_id" "uuid", "p_request_id" "text", "p_fields" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."partner_inventory_publish_atomic"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_inventory_publish_atomic"("p_scope_type" "text", "p_parent_id" "uuid", "p_date" "date", "p_time" time without time zone, "p_capacity" integer, "p_price_override" numeric, "p_request_id" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."partner_order_action_atomic"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_order_action_atomic"("p_order_id" "uuid", "p_action" "text", "p_request_id" "text", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."partner_stop_action_atomic"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text", "p_resume_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."partner_stop_action_atomic"("p_scope_type" "text", "p_action" "text", "p_request_id" "text", "p_reason" "text", "p_resume_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."quote_intake_delivery_fee_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_zone_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."quote_intake_delivery_fee_atomic"("p_ticket_id" "uuid", "p_business_id" "uuid", "p_zone_code" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";


















GRANT SELECT,INSERT,UPDATE ON TABLE "private"."kol_delivery_tariffs" TO "service_role";



GRANT SELECT,INSERT,UPDATE ON TABLE "private"."payment_provider_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."admin_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_alerts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_decision_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_decision_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_dispatcher_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_dispatcher_events" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."ai_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_recommendations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."alcohol_module_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."alcohol_module_settings" TO "service_role";



GRANT SELECT ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."booking_guests" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_guests" TO "service_role";



GRANT SELECT ON TABLE "public"."booking_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_status_history" TO "service_role";



GRANT SELECT ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT SELECT ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";
GRANT SELECT ON TABLE "public"."categories" TO "anon";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."client_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."client_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."commissions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."compliance_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_reviews" TO "service_role";



GRANT SELECT ON TABLE "public"."courier_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."courier_assignments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."courier_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."courier_locations" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."courier_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."courier_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."courier_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."courier_shifts" TO "service_role";



GRANT SELECT ON TABLE "public"."deliveries" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."delivery_issues" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_issues" TO "service_role";



GRANT SELECT ON TABLE "public"."delivery_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."delivery_status_history" TO "service_role";



GRANT ALL ON TABLE "public"."editorial_scores" TO "service_role";
GRANT INSERT,DELETE,UPDATE ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("id") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("target_type") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("target_type") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("target_id") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("target_id") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("score") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("score") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("note") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("note") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."editorial_scores" TO "anon";
GRANT SELECT("updated_at") ON TABLE "public"."editorial_scores" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_cost_entries_v1" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_cost_journals_v1" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_decisions_v1" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_entries_v1" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_journals_v1" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_requests_v1" TO "service_role";



GRANT SELECT,INSERT ON TABLE "public"."kol_finance_terms_v1" TO "service_role";



GRANT ALL ON TABLE "public"."listing_promotions" TO "service_role";
GRANT INSERT,DELETE,UPDATE ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("id") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("target_type") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("target_type") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("target_id") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("target_id") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("position") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("position") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("label") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("label") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("starts_at") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("starts_at") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("ends_at") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("ends_at") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT("is_active") ON TABLE "public"."listing_promotions" TO "anon";
GRANT SELECT("is_active") ON TABLE "public"."listing_promotions" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_accounts" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."loyalty_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."loyalty_transactions" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."media_files" TO "authenticated";
GRANT ALL ON TABLE "public"."media_files" TO "service_role";
GRANT SELECT ON TABLE "public"."media_files" TO "anon";



GRANT SELECT ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";
GRANT SELECT ON TABLE "public"."menu_items" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT SELECT ON TABLE "public"."order_delivery" TO "authenticated";
GRANT ALL ON TABLE "public"."order_delivery" TO "service_role";



GRANT SELECT ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT SELECT ON TABLE "public"."order_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."order_payments" TO "service_role";



GRANT SELECT ON TABLE "public"."order_status_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_status_history" TO "service_role";



GRANT SELECT ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."partner_catalog_item_availability" TO "service_role";
GRANT SELECT ON TABLE "public"."partner_catalog_item_availability" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."partner_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."partner_staff" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_staff" TO "service_role";



GRANT ALL ON TABLE "public"."partner_stop_statuses" TO "service_role";
GRANT SELECT ON TABLE "public"."partner_stop_statuses" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."partners" TO "authenticated";
GRANT ALL ON TABLE "public"."partners" TO "service_role";
GRANT SELECT ON TABLE "public"."partners" TO "anon";



GRANT SELECT ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT SELECT ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";
GRANT SELECT ON TABLE "public"."products" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."promo_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_usage" TO "service_role";



GRANT INSERT,DELETE,UPDATE ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT SELECT("id") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("id") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("client_id") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("business_id") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("booking_id") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("rating") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("rating") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("text") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("text") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("status") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("created_at") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("created_at") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("updated_at") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("target_type") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("target_type") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("target_id") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("target_id") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("source") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("source") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("source_label") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("source_label") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("hidden_reason") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("moderated_at") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("admin_reply") ON TABLE "public"."reviews" TO "anon";
GRANT SELECT("admin_reply") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT("admin_reply_at") ON TABLE "public"."reviews" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."public_listing_ratings" TO "authenticated";
GRANT ALL ON TABLE "public"."public_listing_ratings" TO "service_role";
GRANT SELECT ON TABLE "public"."public_listing_ratings" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."refunds" TO "authenticated";
GRANT ALL ON TABLE "public"."refunds" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."restaurants" TO "authenticated";
GRANT ALL ON TABLE "public"."restaurants" TO "service_role";
GRANT SELECT ON TABLE "public"."restaurants" TO "anon";



GRANT SELECT ON TABLE "public"."room_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."room_availability" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."shops" TO "authenticated";
GRANT ALL ON TABLE "public"."shops" TO "service_role";
GRANT SELECT ON TABLE "public"."shops" TO "anon";



GRANT ALL ON TABLE "public"."site_ad_campaigns" TO "service_role";
GRANT INSERT,DELETE,UPDATE ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("id") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("id") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("slot_code") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("slot_code") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("advertiser_name") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("advertiser_name") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("title_ru") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("title_ru") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("title_ky") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("title_ky") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("title_en") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("title_en") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("image_path") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("image_path") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("link_url") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("link_url") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("starts_at") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("starts_at") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("ends_at") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("ends_at") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("status") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("status") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("priority") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("priority") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT SELECT("disclosure_label") ON TABLE "public"."site_ad_campaigns" TO "anon";
GRANT SELECT("disclosure_label") ON TABLE "public"."site_ad_campaigns" TO "authenticated";



GRANT ALL ON TABLE "public"."site_ad_slots" TO "service_role";
GRANT SELECT ON TABLE "public"."site_ad_slots" TO "anon";
GRANT SELECT ON TABLE "public"."site_ad_slots" TO "authenticated";



GRANT ALL ON TABLE "public"."site_content" TO "service_role";
GRANT SELECT ON TABLE "public"."site_content" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."site_content" TO "authenticated";



GRANT ALL ON TABLE "public"."site_content_history" TO "service_role";
GRANT SELECT ON TABLE "public"."site_content_history" TO "authenticated";



GRANT SELECT ON TABLE "public"."stays" TO "authenticated";
GRANT ALL ON TABLE "public"."stays" TO "service_role";
GRANT SELECT ON TABLE "public"."stays" TO "anon";



GRANT SELECT ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT SELECT ON TABLE "public"."ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_messages" TO "service_role";



GRANT SELECT ON TABLE "public"."tour_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."tour_schedules" TO "service_role";



GRANT SELECT ON TABLE "public"."tours" TO "authenticated";
GRANT ALL ON TABLE "public"."tours" TO "service_role";
GRANT SELECT ON TABLE "public"."tours" TO "anon";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT SELECT,INSERT,DELETE ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




























