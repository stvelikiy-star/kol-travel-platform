# KÖL — Stabilization / Release Dependency Order

Prepared: 2026-08-20

This document separates source merge order from database staged-apply order. No production action is authorized by this file.

## Current draft PR stack

- #13 — P0 Supabase RLS/security baseline
- #14 — production data-source fail-closed guard
- #15 — atomic Stay/Tour booking transaction core
- #18 — atomic Food/Shop order transaction core
- #19 — private catalog media Storage
- #20 — staging readiness / environment gate
- #21 — additive FK index baseline
- #22 — provider-neutral payment integrity + conflicting replay guard
- #23 — atomic delivery lifecycle + recovered assignment consistency
- #24 — request correlation, source release gate, rollback runbook
- #25 — minimal CI bootstrap directly against `main`

## Source merge order

### CI bootstrap

1. #25 CI bootstrap against `main`

This is deliberately isolated because GitHub cannot provide normal PR checks until the workflow exists in the default branch. It must be reviewed/merged explicitly; no automatic merge is authorized.

### Deployment-safety chain

1. #14 production fail-closed guard
2. #20 staging readiness/environment contract
3. #24 observability/rollback follow-up

### Database/security chain

1. #13 security baseline
2. #21 FK index baseline
3. #15 booking core
4. #18 order core (stacked on booking source branch)
5. #19 media/Storage
6. #22 payment integrity
7. #23 delivery lifecycle

Before merging any stacked branch, rebase/retarget onto the already accepted base and verify that no earlier security change is dropped.

## Staging database apply order

1. `005_security_hardening_DRAFT_NOT_APPLIED.sql`
2. `005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql`
3. `006_rls_policy_completion_DRAFT_NOT_APPLIED.sql`
4. `006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql`
5. `006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql`
6. `006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql`
7. `010_fk_index_baseline_DRAFT_NOT_APPLIED.sql`
8. `007_booking_transaction_core_DRAFT_NOT_APPLIED.sql`
9. `008_order_transaction_core_DRAFT_NOT_APPLIED.sql`
10. `009_catalog_media_storage_DRAFT_NOT_APPLIED.sql`
11. `011_payment_integrity_DRAFT_NOT_APPLIED.sql`
12. `011a_payment_event_replay_conflict_guard_DRAFT_NOT_APPLIED.sql`
13. `012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql`
14. `012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql`

Every staged apply must be followed by its corresponding read-only VERIFY/consistency checks and the relevant role/concurrency test before the next transactional layer is accepted.

## Preconditions before staged DB apply

- fresh logical backup/export;
- accepted schema fingerprint and row counts;
- migration baseline established instead of fabricated history;
- test users for client/partner/courier/admin roles;
- no production traffic on the target staging DB;
- rollback target identified;
- secrets remain outside Git.

## Current infrastructure facts

- connected Vercel team `ai prof kg` has no KÖL project yet;
- no KÖL Vercel deployment/env/domain exists yet;
- KÖL should get a preview/staging project before any production environment;
- GitHub CI workflow is not on `main` yet; #25 is the isolated bootstrap candidate;
- current execution container cannot resolve `github.com`, so local clone-based full build is unavailable in this session.

## Production promotion gate

Production remains blocked until all of the following are true:

- CI bootstrap exists on default branch and exact release commit receives a green source check;
- `npm run check:release-source` passes on the exact release commit;
- preview/staging deployment health is green;
- role isolation and cross-tenant tests pass;
- booking/order concurrency tests pass;
- Storage policies and signed-media flow pass;
- payment provider, signature verifier and financial rules are owner-approved and tested;
- payment replay conflict/idempotency tests pass;
- delivery state-machine and recovered assignment consistency tests pass;
- Security/Performance advisor regressions are reviewed;
- rollback drill has been completed on staging;
- owner explicitly accepts production pilot.
