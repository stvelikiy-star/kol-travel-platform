# Seed Data Verification Checklist

Stage: 12J-4 - Seed Data Verification Checklist.

This checklist defines how to verify demo seed data in the future Supabase TEST project after SQL is applied later. Do not run SQL automatically from this stage. Do not connect Supabase to the app. Keep `DATA_SOURCE_MODE=mock` as the default.

`ALCOHOL_MODULE_ENABLED=false` by default. Alcohol sales and delivery are disabled.

## 1. Goal

- Verify demo seed data after SQL is applied later.
- Confirm the TEST project has enough data for public, catalog and internal operations testing.
- Keep the app in mock mode until seed data is verified.
- Never use real personal data in seed files.
- Confirm seed data supports the internal partner -> courier -> admin/AI flow.

## 2. Seed File

Planned seed file:

- `supabase/schema/003_seed_demo_data_draft.sql`

If file name differs, verify the actual file name in `supabase/schema` before running.

## 3. Required Demo Data Groups

### Users and Profiles

Verify future seed data includes:

- demo client;
- demo partner user;
- demo courier user;
- demo admin;
- demo `super_admin` if needed.

### Partners

Verify partner examples include:

- tour partner;
- stay/accommodation partner;
- food partner;
- shop/product partner.

### Couriers

Verify courier examples include:

- available courier;
- busy courier;
- offline courier if needed.

### Catalog

Verify catalog examples include:

- demo tours;
- demo stays/rooms;
- demo food items;
- demo products;
- active item;
- paused item;
- out-of-stock item.

### Availability

Verify availability examples include:

- available date;
- blocked date;
- available slot;
- blocked slot;
- booking conflict example if needed.

### Orders

Verify order examples include:

- `new_order`;
- `accepted_by_partner`;
- `preparing`;
- `ready_for_pickup`;
- `courier_assigned`;
- `picked_up`;
- `delivered`;
- `issue_reported`.

### Bookings

Verify booking examples include:

- new booking;
- confirmed booking;
- cancelled/requested cancellation example if needed;
- guest arrived/completed example if needed.

### Deliveries

Verify delivery examples include:

- available delivery;
- assigned delivery;
- `courier_to_partner`;
- `picked_up`;
- `courier_to_client`;
- `delivered`;
- `issue_reported`.

### Issues

Verify issue examples include:

- partner not ready;
- courier late;
- client not answering;
- address problem;
- payment risk example as demo only.

### AI

Verify AI examples include:

- AI recommendation;
- AI alert;
- AI decision log;
- AI safety refusal log.

### Audit and High-Risk

Verify safety examples include:

- audit log example;
- high-risk approval request example.

## 4. Manual Verification Queries

Example checks:

```sql
select count(*) from partners;
select count(*) from couriers;
select count(*) from orders;
select count(*) from bookings;
select count(*) from deliveries;
select count(*) from catalog_items;
select count(*) from audit_logs;
select count(*) from ai_recommendations;
```

These queries are examples only. Table names must match the actual schema. If catalog tables are split into `tours`, `stays`, `restaurants`, `menu_items`, `shops` and `products`, verify those tables instead of `catalog_items`.

## 5. Quality Checks

Verify:

- no real phone numbers;
- no real personal addresses;
- no real payment data;
- no real client private info;
- demo data is clearly marked as demo;
- demo statuses cover full internal flow;
- partner dashboards can be tested later;
- courier dashboards can be tested later;
- admin dashboards can be tested later;
- public catalogs can be tested later;
- seed data does not enable alcohol module.

## 6. Safety

- Do not switch `DATA_SOURCE_MODE` to `supabase` until seed data is verified.
- Do not connect real writes before RLS and seed verification.
- Do not commit `.env.local`.
- Do not expose service role key.
- Keep mock fallback.
- Keep demo actions until real actions are stable.
- Do not remove mock data.
- Do not connect payments.
- Do not connect Telegram or n8n.

## 7. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- Seed data must not enable alcohol products or alcohol delivery.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 8. Next Stages

Recommended next stages:

1. `12K-1 Real Read Adapter Validation Plan`
2. `12K-2 Public Catalog Read Pilot Plan`
3. `12K-3 Internal Read Validation Plan`
4. `12L-1 First Real Write Pilot Plan`
