-- KÖL / kol-travel-platform
-- CATEGORY SCOPE REFERENCE GUARD — DRAFT / NOT APPLIED
-- Prepared: 2026-09-05
--
-- Prevents a taxonomy scope change from silently invalidating existing catalog
-- references or active child-category relationships. Staging-only hardening.

begin;

create schema if not exists private;

create or replace function private.guard_category_scope_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

revoke all on function private.guard_category_scope_change() from public, anon, authenticated;

drop trigger if exists trg_categories_scope_reference_guard on public.categories;
create trigger trg_categories_scope_reference_guard
before update of scope on public.categories
for each row execute function private.guard_category_scope_change();

comment on function private.guard_category_scope_change() is
  'Fail-closed taxonomy invariant: domain scope cannot change while non-archived catalog records or active children depend on the category.';

commit;
