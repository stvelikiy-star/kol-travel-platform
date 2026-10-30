# KOL managed baseline reconciliation — 2026-10-28

Target inspected read-only: `mphruawzozrpwcjgejhs` (existing test project).
Managed ledger: 17 entries. Do not replace, renumber, or synthesize this history.

| Version | Applied name |
| --- | --- |
| 20260924060622 | security_hardening_phase1_20260924 |
| 20260924060745 | auth_profile_rls_minimal_20260924 |
| 20260924061353 | mvp_support_read_rls_20260924 |
| 20260924061357 | client_support_runtime_20260924 |
| 20260924061403 | admin_support_lifecycle_20260924 |
| 20260925051259 | public_intake_requests_mvp_20260925 |
| 20260925051615 | temporary_auth_bootstrap_token_store_20260925 |
| 20260925051647 | remove_unused_auth_bootstrap_token_store_20260925 |
| 20260925052929 | harden_public_intake_validation_20260925 |
| 20260925053800 | restore_audited_admin_intake_lifecycle_20260925 |
| 20260928065214 | client_stay_booking_atomic_v1 |
| 20261007130434 | 010_fk_index_baseline |
| 20261007130525 | 006b_rls_initplan_scope_hardening |
| 20261007131749 | 006a_audit_log_write_lockdown |
| 20261007133920 | order_booking_auth_uid_initplan_hardening |
| 20261007190013 | client_onboarding_atomic_20261008 |
| 20261007193325 | support_queue_admin_read_20261008 |

## Reconciliation decisions

- `006a`, `006b`, and `010` already have explicit ledger entries. Live read-only
  checks found zero protected audit DML grants and zero uncovered single-column
  foreign keys. They must not be represented as newly applied live changes.
- Existing support, onboarding, booking and intake implementations predate the
  staged package. Similar names do not prove identical SQL or authorization.
  Do not skip a reviewed package step merely because a similarly named RPC exists.
- Preserve the intake and historical bootstrap/removal records. Do not replay the
  temporary bootstrap migration or recreate its removed token store.
- The reviewed package order remains `supabase/staging/migration-plan.json`,
  including `006` immediately followed by `024` before later support changes.
  Its successful replay on the actual restored source proves compatibility for
  that snapshot, not permission to apply it automatically to the managed source.

## Evidence and rollback boundary

Run https://github.com/stvelikiy-star/kol-travel-platform/actions/runs/40634509229
at commit `7b85f9fdef141f9eded57b1b0cce89028be4e5bf` passed source backup,
restoration, package apply/VERIFY/postflight and recovery to the source baseline
after the migrated disposable stack was discarded. Schema fingerprints and
critical application/Auth/Storage metadata counts matched on both restores.

This is full-copy recovery, not an inverse SQL migration and not zero-data-loss
recovery while production writes continue. Managed application remains unchanged.
Before managed apply: refresh the source backup, freeze writes for the maintenance
window, verify role behavior on that restored snapshot, record exact package/source
fingerprints and the intended ledger update, then run the reviewed package and
postflight. Never mark the managed package applied based on a local rehearsal.

Storage currently has no buckets. Object bytes require a separate backup stream
when uploads are introduced. Live mail/login acceptance remains deferred by owner.
