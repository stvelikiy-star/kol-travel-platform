-- KÖL / kol-travel-platform
-- ADMIN CATALOG MODERATION — DRAFT / NOT APPLIED
-- Prepared: 2026-09-01
--
-- Scope:
-- - fail-closed first moderation slice: approve/reject under_review catalog items;
-- - write authority is intentionally restricted to super_admin until a broader
--   admin-subrole moderation permission contract is explicitly approved;
-- - direct authenticated catalog INSERT/UPDATE/DELETE is revoked; moderation is RPC-only;
-- - every committed decision writes immutable audit evidence with actor/reason/request_id;
-- - product approval fails closed on alcohol keywords while the alcohol module is OFF;
-- - no order, booking, payment, availability, delivery, category or partner state is mutated.
--
-- Explicitly excluded:
-- - partner catalog create/edit/submit RPCs (direct DML stays closed until that authority exists);
-- - publish/unpublish/archive/category management;
-- - partner verification or user blocking;
-- - role changes;
-- - finance/payment/refund/payout actions;
-- - live/production apply;
-- - alcohol enablement.

begin;

create schema if not exists private;

-- Catalog moderation must not have an alternate authenticated DML path.
-- Earlier partner INSERT policies only checked business ownership and did not
-- constrain status, so retaining INSERT would allow a direct active-row bypass.
revoke insert, update, delete on table public.menu_items from anon, authenticated;
revoke insert, update, delete on table public.tours from anon, authenticated;
revoke insert, update, delete on table public.stays from anon, authenticated;
revoke insert, update, delete on table public.products from anon, authenticated;

create or replace function private.admin_catalog_moderation_atomic_internal(
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

  select al.id
    into v_existing_audit_id
  from public.audit_logs as al
  where al.actor_id = v_actor
    and al.action = v_audit_action
    and al.entity_type = v_entity_type
    and al.entity_id = p_item_id
    and al.request_id = p_request_id
  limit 1;

  if v_existing_audit_id is not null then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'domain', p_domain,
      'action', p_action,
      'status', v_status,
      'idempotent', true
    );
  end if;

  if v_status = v_target_status then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'item_id', p_item_id,
      'domain', p_domain,
      'action', p_action,
      'status', v_status,
      'idempotent', true
    );
  end if;

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

    if p_domain = 'products' then
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

revoke all on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) from public;
revoke all on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) from anon;
revoke all on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) from authenticated;
grant usage on schema private to authenticated;
grant execute on function private.admin_catalog_moderation_atomic_internal(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_catalog_moderation_atomic(
  p_item_id uuid,
  p_domain text,
  p_action text,
  p_request_id text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_catalog_moderation_atomic_internal(
    p_item_id,
    p_domain,
    p_action,
    p_request_id,
    p_reason
  );
$$;

revoke all on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) from public;
revoke all on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) from anon;
grant execute on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) to authenticated;

comment on function public.admin_catalog_moderation_atomic(uuid,text,text,text,text) is
  'Fail-closed first Admin catalog moderation slice. Super-admin only; approve/reject under_review items with audit evidence. Never enables alcohol or mutates money/order/booking/delivery truth.';

commit;
