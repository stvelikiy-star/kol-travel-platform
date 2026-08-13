# SQL Schema Application Checklist

Stage: 12J-2 - SQL Schema Application Checklist.

This checklist prepares a safe manual SQL application process for the future Supabase TEST project. Do not run SQL automatically from this stage. Do not connect Supabase to the app. Keep `DATA_SOURCE_MODE=mock` as the default.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Prepare a safe manual SQL application process.
- Run SQL only inside the Supabase TEST project later.
- Keep the app in mock mode.
- Avoid production mistakes.
- Review every SQL file before execution.

## 2. Before Running SQL

Before any SQL is executed later:

- confirm Supabase TEST project is open;
- confirm the project is not production;
- review all SQL files manually;
- check table names;
- check enums and custom types;
- check foreign keys;
- check RLS draft;
- check seed data;
- keep app `DATA_SOURCE_MODE=mock`;
- confirm `ALCOHOL_MODULE_ENABLED=false`;
- confirm no real personal data is included.

## 3. SQL Order

Planned SQL order:

1. `supabase/schema/001_initial_schema.sql`
2. `supabase/schema/002_rls_policies_draft.sql`
3. `supabase/schema/003_seed_demo_data_draft.sql`

If file names differ, verify actual file names in `supabase/schema` before running.

## 4. After `001_initial_schema.sql`

Check:

- core tables exist;
- roles/profile tables exist if defined;
- partners table exists;
- couriers table exists;
- orders table exists;
- bookings table exists;
- deliveries table exists;
- catalog and availability tables exist;
- audit, high-risk approval and AI tables exist if included;
- indexes were created where expected;
- foreign keys are valid;
- no SQL errors occurred.

Expected table groups:

- users/profiles/roles;
- partners/couriers;
- marketplace catalog;
- orders/bookings;
- delivery;
- support/reviews/notifications;
- finance;
- audit/high-risk approvals;
- AI recommendations/alerts/logs;
- compliance settings.

## 5. After `002_rls_policies_draft.sql`

Check:

- RLS is enabled on required tables;
- policies are created;
- anon access is restricted;
- authenticated access is role-based later;
- service role key stays private;
- no unsafe public writes exist;
- finance tables are protected;
- admin-only tables are protected;
- AI dispatcher can only write recommendations, alerts and logs later.

RLS draft must be reviewed before production use.

## 6. After `003_seed_demo_data_draft.sql`

Check:

- demo client data exists;
- demo partner data exists;
- demo courier data exists;
- demo admin-related records exist if included;
- demo orders exist;
- demo bookings exist;
- demo deliveries exist;
- demo catalog data exists;
- demo AI recommendation or alert data exists if included;
- seed data does not include real personal data;
- alcohol module seed remains disabled.

## 7. Manual Verification Queries

Example checks:

```sql
select count(*) from partners;
select count(*) from couriers;
select count(*) from orders;
select count(*) from bookings;
select count(*) from deliveries;
select count(*) from catalog_items;
```

These queries are examples only. Table names must match the actual schema before running. If catalog tables are split into `tours`, `stays`, `restaurants`, `menu_items`, `shops` and `products`, use those table names instead.

## 8. Safety

- Never paste service role key into frontend code.
- Never commit `.env.local`.
- Do not switch `DATA_SOURCE_MODE` to `supabase` until schema, RLS and seed pass.
- If SQL fails, stop and fix in the TEST project only.
- Do not delete mock data.
- Do not remove demo actions.
- Do not connect real writes yet.
- Do not connect payments.
- Do not connect Telegram or n8n.

## 9. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 10. Next Stages

Recommended next stages:

1. `12J-3 RLS Verification Checklist`
2. `12J-4 Seed Data Verification Checklist`
3. `12K-1 Real Read Adapter Validation Plan`
4. `12L-1 First Real Write Pilot Plan`
