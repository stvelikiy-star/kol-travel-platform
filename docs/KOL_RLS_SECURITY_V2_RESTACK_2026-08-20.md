# KÖL — RLS Security Baseline V2 Restack

**Date:** 2026-08-20  
**Base:** current `main` after the verified Next.js 16.3.1 security upgrade  
**Supabase project inspected:** `kol-travel-platform-test` (`mphruawzozrpwcjgejhs`)  
**Mode:** source-only / read-only live audit; no SQL applied

## Why this restack exists

The original RLS recovery PR was prepared on an older application/CI base. This v2 branch starts from current `main` and carries forward only the live-audited security SQL, verification SQL, schema manifest, and security documentation. It deliberately excludes the old CI workflow and legacy ESLint configuration.

## Fresh live baseline

Rechecked on 2026-08-20 before this restack:

- public base tables: 54
- RLS enabled: 54 / 54
- public policies: 46
- RLS-enabled tables with zero policies: 26
- public helper/trigger functions: 6
- functions without fixed `search_path`: 6
- public indexes: 99
- single-column foreign keys: 80
- missing valid leading FK indexes: 49
- `supabase_migrations.schema_migrations`: absent
- Supabase development branches: 0

The metrics match the previously captured recovery baseline; no relevant drift was detected.

## Source order in this v2 draft

1. `005_security_hardening_DRAFT_NOT_APPLIED.sql`
2. `005a_partner_policy_scope_DRAFT_NOT_APPLIED.sql`
3. `006_rls_policy_completion_DRAFT_NOT_APPLIED.sql`
4. `006a_audit_log_write_lockdown_DRAFT_NOT_APPLIED.sql`
5. `006b_rls_initplan_scope_hardening_DRAFT_NOT_APPLIED.sql`
6. `006c_transaction_entrypoint_lockdown_DRAFT_NOT_APPLIED.sql`

Associated `*_VERIFY.sql` files are read-only staging checks.

## Hard gate

Do not apply these drafts to the live project. The next database execution step requires a real logical backup/schema baseline and a dedicated staging database. The connected Supabase account currently has zero development branches; branch creation is a cost-bearing action and requires explicit cost acceptance.
