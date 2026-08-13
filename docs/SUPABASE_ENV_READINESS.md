# Supabase Env Readiness

Stage: 12I-2 - Supabase Env Readiness.

This document defines environment readiness rules before switching KOL from mock mode to future Supabase mode. Supabase is not connected in this stage, no real backend writes are created, no UI behavior is changed, and mock data is not mutated.

## Current Mode

- `DATA_SOURCE_MODE=mock`.
- The app works without real Supabase environment variables.
- Supabase read adapters are prepared only.
- Real writes are not connected.
- Demo actions do not write to the database.
- Payment, Telegram and n8n integrations remain inactive.
- `ALCOHOL_MODULE_ENABLED=false`.

## Required Variables

`NEXT_PUBLIC_SUPABASE_URL`

- Purpose: public Supabase project URL.
- Browser exposure: allowed.
- Current `.env.example` value: empty placeholder.

`NEXT_PUBLIC_SUPABASE_ANON_KEY`

- Purpose: public Supabase anon key for browser-safe reads later.
- Browser exposure: allowed.
- Important: anon key is not enough for unsafe writes.
- Current `.env.example` value: empty placeholder.

`SUPABASE_SERVICE_ROLE_KEY`

- Purpose: private server-only service role key for future protected server operations.
- Browser exposure: never allowed.
- Current `.env.example` value: empty placeholder.

`DATA_SOURCE_MODE`

- Purpose: switches between local mock data and future Supabase reads.
- Allowed values: `mock`, `supabase`.
- Current default: `mock`.

`ALCOHOL_MODULE_ENABLED`

- Purpose: controls alcohol module availability.
- Current default: `false`.
- Must remain false unless legal and compliance approval is completed.

## Security Rules

- Never commit real `.env.local`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Never import the service role key into client components.
- Server-only writes must be protected by auth, role checks, RLS, ownership checks and audit logs.
- Public anon key must not be used for unsafe writes.
- High-risk actions require audit and admin approval later.
- Payment status changes, refunds, cancellations and force-complete actions require strict server-side approval flows.

## Mode Switching

Mock mode is default:

```env
DATA_SOURCE_MODE=mock
```

Supabase mode must only be used after:

- Supabase test project is created;
- schema is applied;
- RLS policies are reviewed and tested;
- seed data is verified;
- auth roles are connected;
- rollback plan is ready.

Rollback plan:

```env
DATA_SOURCE_MODE=mock
```

The site must continue to compile without real Supabase env variables while mock mode is active.

## Alcohol Compliance

- `ALCOHOL_MODULE_ENABLED=false`.
- Alcohol sales and delivery are disabled.
- AI cannot enable alcohol module.
- Partner, courier and admin demo actions cannot enable alcohol module.
- Any future activation requires legal review, licensing, partner verification and `super_admin` approval.
- Any alcohol-related request is critical risk.

## Readiness Checklist

Before switching to `DATA_SOURCE_MODE=supabase`:

- confirm real env values exist only in local/production secrets;
- confirm service role key is server-only;
- confirm client components do not import server-only secrets;
- confirm RLS policies are enabled and tested;
- confirm audit log table is ready;
- confirm high-risk approval workflow is ready;
- confirm mock rollback is tested.
