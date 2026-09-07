#!/usr/bin/env bash
set -Eeuo pipefail

DB_URL="${SUPABASE_LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

case "$DB_URL" in
  *"@127.0.0.1:"*|*"@localhost:"*) ;;
  *) echo "Refusing catalog taxonomy hardening QA against non-local database." >&2; exit 1 ;;
esac

psql "$DB_URL" -X -v ON_ERROR_STOP=1 -q <<'SQL'
do $$
declare
  v_business uuid := gen_random_uuid();
  v_archived_category uuid := gen_random_uuid();
  v_referenced_category uuid := gen_random_uuid();
  v_parent_category uuid := gen_random_uuid();
  v_child_category uuid := gen_random_uuid();
  v_product uuid := gen_random_uuid();
begin
  insert into public.partners (
    id, owner_user_id, type, title, slug, description, location, status, business_status, rating
  ) values (
    v_business, null, 'shop', 'QA Taxonomy Guard Business',
    'qa-taxonomy-guard-' || replace(v_business::text, '-', ''),
    'Local-only taxonomy guard fixture', 'Cholpon-Ata', 'approved', 'online', 5.0
  );

  insert into public.categories (id, scope, title, slug, sort_order, status) values
    (v_archived_category, 'shop', 'QA Archived Category', 'qa-archived-' || replace(v_archived_category::text, '-', ''), 9901, 'active'),
    (v_referenced_category, 'shop', 'QA Referenced Scope Category', 'qa-referenced-' || replace(v_referenced_category::text, '-', ''), 9902, 'active'),
    (v_parent_category, 'shop', 'QA Parent Scope Category', 'qa-parent-' || replace(v_parent_category::text, '-', ''), 9903, 'active');

  update public.categories set status = 'archived' where id = v_archived_category;

  begin
    insert into public.products (
      id, business_id, category_id, title, description, price, stock_qty, status, metadata
    ) values (
      gen_random_uuid(), v_business, v_archived_category,
      'QA Archived Category Product', 'Must be rejected by 020a', 100, 1, 'draft', '{}'::jsonb
    );
    raise exception 'taxonomy_hardening_expected_archived_category_rejection_missing';
  exception
    when others then
      if sqlerrm not like '%catalog_category_not_active%' then
        raise;
      end if;
  end;

  insert into public.products (
    id, business_id, category_id, title, description, price, stock_qty, status, metadata
  ) values (
    v_product, v_business, v_referenced_category,
    'QA Referenced Scope Product', 'Keeps category scope immutable', 150, 2, 'approved', '{}'::jsonb
  );

  begin
    update public.categories set scope = 'food' where id = v_referenced_category;
    raise exception 'taxonomy_hardening_expected_reference_scope_rejection_missing';
  exception
    when others then
      if sqlerrm not like '%category_scope_change_blocked_by_catalog_references%' then
        raise;
      end if;
  end;

  insert into public.categories (id, scope, title, slug, parent_id, sort_order, status) values (
    v_child_category, 'shop', 'QA Child Scope Category',
    'qa-child-' || replace(v_child_category::text, '-', ''),
    v_parent_category, 9904, 'active'
  );

  begin
    update public.categories set scope = 'food' where id = v_parent_category;
    raise exception 'taxonomy_hardening_expected_child_scope_rejection_missing';
  exception
    when others then
      if sqlerrm not like '%category_scope_change_blocked_by_active_children%' then
        raise;
      end if;
  end;

  if (select status from public.categories where id = v_archived_category) <> 'archived' then
    raise exception 'taxonomy_hardening_archived_category_state_changed';
  end if;
  if (select scope from public.categories where id = v_referenced_category) <> 'shop' then
    raise exception 'taxonomy_hardening_referenced_category_scope_changed';
  end if;
  if (select scope from public.categories where id = v_parent_category) <> 'shop' then
    raise exception 'taxonomy_hardening_parent_category_scope_changed';
  end if;
end
$$;
SQL

echo "Catalog taxonomy archived-category reuse guard: PASS"
echo "Catalog taxonomy referenced scope-change guard: PASS"
echo "Catalog taxonomy active-child scope-change guard: PASS"
