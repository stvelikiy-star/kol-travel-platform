# KÖL — Database / Release Dependency Order V2

Prepared: 2026-08-20

This is the authoritative source ordering for the current stabilization drafts. It does not authorize a live database apply.

## Source state

The current `main` contains source-only drafts for security, indexes, booking, order, Storage, payment and delivery. SQL filenames still carry `DRAFT_NOT_APPLIED` intentionally. No Supabase migration history is fabricated.

## Staging database apply order

Only after fresh logical backup/export + accepted schema baseline:

1. `005_security_hardening_DRAFT_NOT_APPLIED.sql`
2. `005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql`
3. `006_rls_policy_completion_DRAFT_NOT_APPLIED.sql`
4. `006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql`
5. `006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql`
6. `006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql`
7. `010_fk_index_baseline_DRAFT_NOT_APPLIED.sql`
8. `007_booking_transaction_core_DRAFT_NOT_APPLIED.sql`
9. `007a_booking_direct_write_lockdown_DRAFT_NOT_APPLIED.sql`
10. `007b_booking_idempotency_serialization_DRAFT_NOT_APPLIED.sql`
11. `008_order_transaction_core_DRAFT_NOT_APPLIED.sql`
12. `008a_order_idempotency_payload_hardening_DRAFT_NOT_APPLIED.sql`
13. Provision/check private `catalog-media` bucket through the Storage API on staging
14. `009_catalog_media_storage_DRAFT_NOT_APPLIED.sql`
15. `011_payment_integrity_DRAFT_NOT_APPLIED.sql`
16. `011a_payment_event_replay_conflict_guard_DRAFT_NOT_APPLIED.sql`
17. `011b_payment_projection_hardening_DRAFT_NOT_APPLIED.sql`
18. `012_delivery_lifecycle_DRAFT_NOT_APPLIED.sql`
19. `012a_delivery_assignment_consistency_DRAFT_NOT_APPLIED.sql`
20. `012b_delivery_role_consistency_hardening_DRAFT_NOT_APPLIED.sql`

Every apply is followed immediately by its read-only VERIFY script(s), relevant role tests and concurrency/invariant tests before continuing.

## Important ordering reasons

- 005–006c establish security/RLS entrypoint boundaries before transactional RPCs are trusted.
- 010 is additive performance protection for current FKs.
- 007/007a/007b establish booking atomicity, direct-write lockdown and serialized idempotency.
- 008/008a establish DB-authoritative Food/Shop pricing/stock and strict retry payload semantics.
- Storage bucket provisioning is an API operation; 009 then verifies the expected private bucket contract and installs application metadata/RLS policies.
- 011/011a/011b establish provider-neutral payment integrity/replay/projection rules, but do not activate a provider or automatic refund.
- 012/012a/012b establish delivery state transitions, repair the recovered normalized-assignment gap and enforce role/assignment/profile consistency.

## Stop conditions

Stop the staged rollout immediately on:
- any cross-user/cross-partner access
- recursion or unexpected RLS bypass
- missing/extra schema object versus expected VERIFY output
- overbooking or negative stock
- idempotency key conflict being accepted silently
- payment amount/reference/event replay inconsistency
- delivery assignment/status inconsistency
- unexpected mutation of payment truth by delivery flows
- Storage access outside intended business/owner path

## Production promotion

Do not convert the drafts into a production migration sequence until staging proof is complete and the real migration baseline has been accepted. Production approval is a separate owner gate.
