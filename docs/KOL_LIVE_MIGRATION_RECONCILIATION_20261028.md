# KÖL — managed staging migration reconciliation (2026-10-28)

Target: `kol-travel-platform-test` / `mphruawzozrpwcjgejhs`. This is a **read-only audit**, not authorization to run migrations.

## Baseline confirmed from connected Supabase
- 54 public tables, all 54 RLS-enabled; 10 public functions (all named and search_path pinned), 151 valid/ready public indexes.
- 17 registered Supabase migrations. 0 payment rows, 0 Storage buckets and 0 Storage objects at read time.
- 8 canonical transactional public RPCs expected after release migrations are not present.
- Authenticated direct INSERT/UPDATE/DELETE grants still exist on 11 protected transactional tables.
- Existing baseline has four extra RPCs relative to original six helpers: `admin_support_lifecycle_atomic`, `client_onboarding_complete_atomic`, `client_stay_booking_create_atomic`, `client_support_ticket_create_atomic`. They are NOT redundant until signatures, implementations and callers are reconciled.
- This known shape is classified in `supabase/staging/000_preflight_read_only.sql`. The historic exact-shape STOP gate remains intact.

## Existing migration history vs new 42-step manifest
Current recorded versions and names:

1. `20260924060622 security_hardening_phase1_20260924`
2. `20260924060745 auth_profile_rls_minimal_20260924`
3. `20260924061353 mvp_support_read_rls_20260924`
4. `20260924061357 client_support_runtime_20260924`
5. `20260924061403 admin_support_lifecycle_20260924`
6. `20260925051259 public_intake_requests_mvp_20260925`
7. `20260925051615 temporary_auth_bootstrap_token_store_20260925`
8. `20260925051647 remove_unused_auth_bootstrap_token_store_20260925`
9. `20260925052929 harden_public_intake_validation_20260925`
10. `20260925053800 restore_audited_admin_intake_lifecycle_20260925`
11. `20260928065214 client_stay_booking_atomic_v1`
12. `20261007130434 010_fk_index_baseline`
13. `20261007130525 006b_rls_initplan_scope_hardening`
14. `20261007131749 006a_audit_log_write_lockdown`
15. `20261007133920 order_booking_auth_uid_initplan_hardening`
16. `20261007190013 client_onboarding_atomic_20261008`
17. `20261007193325 support_queue_admin_read_20261008`

The 42-step `supabase/staging/migration-plan.json` includes operations with *overlapping names or behavior*, notably `005`, `006a`, `006b`, `010`, `021`, `022`, `023`, `025`, and the booking entrypoints. **These are overlap candidates, not proof of identical SQL**; do not mark a step as already applied based on its name alone or manually delete migration history. `024` intentionally follows `006` in the manifest. Storage step `009` requires private bucket preaction.

## Controlled application gates
1. Confirm a retained encrypted baseline, key custody, SHA256 validation and an executable restore/rollback procedure; CI rehearsal #40667015992 PASSED against a restored source copy, but the real apply must have its own fresh snapshot.
2. Compare SQL definitions / pg_get_functiondef, pg_policies, grants, triggers, indexes, constraints and Supabase migration ledger to determine if each overlapping step is idempotent on the CURRENT baseline. Preserve the four existing RPC entrypoints until caller compatibility is verified.
3. Run the complete unchanged 42-step ordered plan against a new disposable restore of this baseline, with every per-step VERIFY, 999 postflight and restored_role_isolation_TEST. Confirm storage contract.
4. Test two different partners, client, courier, dispatcher, admin using real Auth JWTs; verify foreign-row denial, booking/order race and idempotency, delivery and payment negative paths. Ensure no service-role secret reaches browsers.
5. Only then plan a short managed-staging apply, stop on first failure, validate postflight and execute rehearsed rollback if needed. No public domain switch until confirmed E2E and partner price/availability review.

Do not use the historic `matches_recovered_schema_shape` flag to suppress the STOP, and do not run isolated GRANT/REVOKE fragments as a substitute for reviewed migration ordering.
