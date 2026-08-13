# Supabase Test Project Setup Checklist

Stage: 12J-1 - Supabase Test Project Setup Checklist.

This checklist prepares a separate Supabase TEST project for future validation. It does not connect Supabase to the app, does not create real backend writes, does not require real environment variables, and does not change UI behavior.

`DATA_SOURCE_MODE=mock` must remain the default. `ALCOHOL_MODULE_ENABLED=false` must remain the default.

## 1. Goal

- Create a separate Supabase TEST project.
- Keep the app in mock mode.
- Verify schema, RLS and seed data before app connection.
- Never test first on production.
- Keep `.env.example` as placeholders only.

## 2. Supabase Project Checklist

- Create a new Supabase project dedicated to testing.
- Confirm the project is not production.
- Save the project URL privately.
- Save the anon key privately.
- Save the service role key privately.
- Never commit real keys.
- Use `.env.local` later only.
- Keep `.env.example` placeholders.
- Do not switch the app to Supabase mode yet.
- Do not connect real writes yet.

## 3. Required Env Values Later

These values will be needed later in local secrets, not in this stage:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATA_SOURCE_MODE=mock
ALCOHOL_MODULE_ENABLED=false
```

Rules:

- `NEXT_PUBLIC_SUPABASE_URL` is public project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public anon key.
- `SUPABASE_SERVICE_ROLE_KEY` is private and server-only.
- `DATA_SOURCE_MODE=mock` remains default until schema, RLS and seed data are verified.
- `ALCOHOL_MODULE_ENABLED=false` remains default.

## 4. SQL Order Later

Planned SQL application order:

1. `supabase/schema/001_initial_schema.sql`
2. `supabase/schema/002_rls_policies_draft.sql`
3. `supabase/schema/003_seed_demo_data_draft.sql`

If file names differ, verify actual files before running SQL.

Do not run SQL from this checklist stage. SQL application belongs to a later stage.

## 5. Safety Checks

Before doing any Supabase setup work:

- confirm the project is TEST, not production;
- do not expose service role key;
- do not switch `DATA_SOURCE_MODE` to `supabase` yet;
- confirm app still works without real Supabase env;
- do not connect real writes yet;
- do not create payments;
- do not connect Telegram or n8n;
- do not enable alcohol module.

## 6. Future Test Users

Future test users to create later:

- test client;
- test partner;
- test courier;
- test admin;
- test `super_admin`.

Only document these users now. Do not create users in this stage.

## 7. Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin cannot enable alcohol.
- Future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Alcohol-related request is critical risk.

## 8. Next Stages

Recommended next stages:

1. `12J-2 SQL Schema Application Checklist`
2. `12J-3 RLS Verification Checklist`
3. `12J-4 Seed Data Verification Checklist`
4. `12K-1 Real Read Adapter Validation Plan`
5. `12L-1 First Real Write Pilot Plan`
