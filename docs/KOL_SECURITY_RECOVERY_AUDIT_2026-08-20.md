# KÖL — Live Security Recovery Audit

**Date:** 2026-08-20  
**Repository:** `stvelikiy-star/kol-travel-platform`  
**Supabase project:** `kol-travel-platform-test` (`mphruawzozrpwcjgejhs`)  
**Mode:** read-only live audit; no database mutation; no deployment

## Executive result

The application source has a usable Git recovery baseline, but the live Supabase project still carries the same database-security debt identified during recovery. This document records current live facts so later migration work is based on the database that actually exists, not on historical drafts.

## Current live inventory

- public base tables: **54**
- public tables with RLS enabled: **54 / 54**
- public RLS policies: **46**
- RLS-enabled public tables with zero policies: **26**
- public helper/trigger functions: **6**
- public indexes: **99**
- Auth users: **4**
- payments rows: **0**
- Storage buckets: **0**
- Storage objects: **0**
- `supabase_migrations.schema_migrations`: **absent**
- Stage 21 additive catalog fields checked in live DB: **not applied**

## Confirmed RLS recursion

The live function and policy definitions confirm this exact loop:

```text
user_roles SELECT policy
  -> is_admin()
     -> has_role()
        -> SELECT public.user_roles
           -> user_roles SELECT policy
              -> is_admin()
                 -> ...
```

The live policy is named `admins read roles` and its predicate is `is_admin()`.

A second self-recursion risk is present on `partner_staff`:

```text
partner_staff SELECT policy
  -> is_partner_for(business_id)
     -> SELECT public.partner_staff
        -> partner_staff SELECT policy
           -> is_partner_for(...)
              -> ...
```

The prepared migration candidate `supabase/schema/005_security_hardening_DRAFT_NOT_APPLIED.sql` removes both recursive base-policy dependencies while preserving fail-closed behavior.

## Current Security Advisor findings

### RLS enabled but no policy

The live advisor reports these 26 public tables with RLS enabled and no policies:

1. `admin_profiles`
2. `ai_alerts`
3. `ai_decision_logs`
4. `booking_guests`
5. `booking_status_history`
6. `commissions`
7. `compliance_reviews`
8. `courier_locations`
9. `courier_shifts`
10. `delivery_status_history`
11. `favorites`
12. `loyalty_accounts`
13. `loyalty_transactions`
14. `media_files`
15. `notifications`
16. `order_delivery`
17. `order_payments`
18. `partner_profiles`
19. `promo_codes`
20. `promo_usage`
21. `restaurants`
22. `reviews`
23. `shops`
24. `support_tickets`
25. `ticket_messages`
26. `transactions`

This is fail-closed for normal Data API roles, but it means intended authenticated features for these tables cannot be considered complete.

### Mutable function search path

The live advisor reports mutable `search_path` on all six public functions:

- `set_updated_at`
- `has_role`
- `is_admin`
- `is_finance_admin`
- `is_partner_for`
- `is_assigned_courier`

The draft patch sets `search_path = ''` and schema-qualifies referenced objects/functions where needed.

### Auth password protection

Leaked-password protection is currently disabled in Supabase Auth. This requires an Auth configuration action, not a SQL migration.

## Current Performance Advisor findings relevant to security/core

The live advisor still reports:

- repeated `auth.uid()` evaluation in RLS policies (`auth_rls_initplan`);
- many foreign keys without covering indexes;
- multiple permissive SELECT policies on public catalog tables;
- unused-index notices that are not actionable yet because the restored database has almost no real runtime traffic.

The security draft fixes init-plan usage only for functions/policies touched by the recursion/public-catalog scope. A separate additive index migration should be prepared after the security baseline is accepted.

## Data API grant drift

Live grant inspection confirms `authenticated` and `service_role` table privileges exist broadly, but `anon` SELECT grants are absent on the currently implemented public catalog tables inspected (`partners`, `categories`, `tours`, `stays`, `menu_items`, `products`).

This matters because SQL grants and RLS are independent. An RLS policy that says a row is public does not make the table reachable through the Data API without the table-level grant.

The security draft therefore grants **SELECT only** to `anon` for the existing public catalog contour. It does not grant anonymous writes.

## Migration integrity

The live project has no tracked `supabase_migrations.schema_migrations` relation. Existing schema files under `supabase/schema/` are therefore historical/manual setup artifacts, not a trustworthy migration ledger.

Rules until the baseline is reconstructed:

- do not rename old manual files as if they were applied migrations;
- do not pretend historical migration timestamps exist;
- do not apply Stage 21;
- do not apply the new security draft directly to the live project;
- first capture a logical backup and an authoritative live-schema baseline.

## Required staged verification for the security patch

Before any live apply, staging must prove:

1. client can resolve only the client's own active role rows;
2. admin role predicates resolve without recursive RLS;
3. partner ownership resolves from the caller's own active `partner_staff` row;
4. partner A cannot read/write partner B private rows;
5. courier assignment helper resolves without policy recursion;
6. anonymous public catalog reads work only for approved/active rows;
7. anonymous users cannot write catalog rows;
8. inactive/unapproved rows remain hidden from anonymous users;
9. no payment, booking, refund, delivery or alcohol state changes as a side effect;
10. Security Advisor is rerun after apply.

## Next security work after this PR

### P0

- obtain logical DB backup / schema dump;
- establish tracked live-schema baseline;
- validate this draft in staging;
- run role-by-role RLS regression.

### P1

- create policies for the 26 currently fail-closed tables according to real product ownership rules;
- convert remaining RLS policies to explicit `TO anon` / `TO authenticated` scopes;
- convert remaining hot `auth.uid()` predicates to init-plan-friendly form;
- enable leaked-password protection in Auth;
- add covering indexes for verified hot foreign keys.

### P2

- booking/tour concurrency and locking;
- order/inventory transaction integrity;
- payment provider/webhook/refund/reconciliation;
- Storage policies and upload validation.

## Safety state

No production/live DB mutation was performed during this audit. No deployment was performed. No secret values are stored in this document.
