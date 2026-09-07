-- KÖL / kol-travel-platform
-- CATALOG ACTIVE CATEGORY GUARD — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Hardens migration 020: once category lifecycle exists, no new or changed
-- catalog row may attach an archived category through a crafted RPC or future writer.
-- This is staging-only and does not mutate existing catalog rows.

begin;

create schema if not exists private;

create or replace function private.enforce_active_catalog_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function private.enforce_active_catalog_category() from public, anon, authenticated;

drop trigger if exists trg_menu_items_active_category on public.menu_items;
create trigger trg_menu_items_active_category
before insert or update of category_id on public.menu_items
for each row execute function private.enforce_active_catalog_category();

drop trigger if exists trg_tours_active_category on public.tours;
create trigger trg_tours_active_category
before insert or update of category_id on public.tours
for each row execute function private.enforce_active_catalog_category();

drop trigger if exists trg_stays_active_category on public.stays;
create trigger trg_stays_active_category
before insert or update of category_id on public.stays
for each row execute function private.enforce_active_catalog_category();

drop trigger if exists trg_products_active_category on public.products;
create trigger trg_products_active_category
before insert or update of category_id on public.products
for each row execute function private.enforce_active_catalog_category();

comment on function private.enforce_active_catalog_category() is
  'Fail-closed catalog taxonomy guard. New/changed category references must point to an active category with the canonical domain scope.';

commit;
