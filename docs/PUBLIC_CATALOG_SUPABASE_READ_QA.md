# Stage 17-5 - Public Catalog Supabase Read QA

## QA Scope

Selected page:

- `/food`

Read path:

- `getPublicFoodReadResult()`
- `getPublicFoodFromSupabase()`

This QA does not wire more public pages, add writes, create database tables, change payments or enable the alcohol module.

## Mock Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open [http://localhost:3000/food](http://localhost:3000/food).

Expected:

- page opens
- current mock/static food catalog appears
- `Mock data mode` label is visible
- no Supabase read is required
- no crash
- no raw errors
- layout remains stable

Actual result:

- Page opens:
- Label:
- Food cards visible:
- Raw errors exposed:
- Issues:

## Supabase Read Mode QA

Manual steps:

1. Set:

```env
DATA_SOURCE_MODE=supabase
ALCOHOL_MODULE_ENABLED=false
```

2. Restart dev server.
3. Open [http://localhost:3000/food](http://localhost:3000/food).

Expected:

- page opens
- `Supabase read pilot` label is visible if real adapter works
- fallback/table-missing safe message is visible if schema or relationship is missing
- mock fallback keeps the public catalog usable
- no raw Supabase, SQL or env errors are shown

Expected seeded data if read succeeds:

- active demo menu item from `public.menu_items`
- category from `public.categories` if join succeeds
- partner data from `public.partners` if join succeeds

Actual result:

- Page opens:
- Label:
- Food item id/title:
- Category:
- Fallback used:
- Safe code:
- Issues:

## No Writes On Page Load

Refreshing `/food` must not change:

- orders
- audit logs count
- alcohol module settings
- payments or checkout state

## SQL Checks

Before opening page and after opening page:

```sql
select
  id::text as order_id,
  client_id::text as client_id,
  business_id::text as business_id,
  status,
  payment_status,
  total,
  updated_at
from public.orders;
```

Audit count:

```sql
select count(*) as audit_count
from public.audit_logs;
```

Alcohol:

```sql
select *
from public.alcohol_module_settings;
```

Expected:

- orders unchanged from read-only page load
- audit count unchanged from read-only page load
- `alcohol_module_settings.is_enabled = false`

## Public UX

Confirm:

- page does not look broken
- layout preserved
- mobile layout preserved
- CTA buttons do not perform real writes
- SEO-visible content remains
- fallback keeps the public page usable

## Fallback Test

If Supabase read fails or table is missing:

- UI should not crash
- fallback to mock
- safe message/code only
- no secrets

Allowed safe codes:

- `supabase_not_configured`
- `table_missing`
- `read_failed`
- `empty_result`
- `server_error`

## Alcohol Safety

Confirm:

- no alcohol category/items shown
- alcohol module remains disabled
- food/shop alcohol sales and delivery remain disabled

## Issues Found

Code-level QA found no blocking issue.

Manual Supabase QA is still required:

- confirm `menu_items` read succeeds in TEST project
- confirm category/partner relationship behavior
- confirm no order/audit/payment/alcohol changes on page refresh

## Final Decision

Code-level decision:

- `/food` public catalog read pilot is safe for manual Supabase TEST-project verification.
- Mock rollback remains available through `DATA_SOURCE_MODE=mock`.
- Do not add public writes until manual SQL verification is complete.
