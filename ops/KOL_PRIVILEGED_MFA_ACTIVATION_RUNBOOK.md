# KÖL P0 · Privileged MFA activation / recovery runbook

Status: **STAGED — NOT ACTIVE IN PRODUCTION**. Applies only to KÖL.
This is not a Production GO. Never use a green build as authorization to
change Production databases, domains, passwords, or administrative MFA factors.

## Assets and scope
- Code: `src/lib/auth/mfa-policy.ts`, `src/lib/auth/profile.ts`,
  `src/app/account/mfa/page.tsx`, `src/components/auth/MfaSetupClient.tsx`.
- Server flag: `KOL_ADMIN_MFA_ENFORCE` (unset/false by default, true only after onboarding).
- Database staged policy: `private.kol_privileged_mfa_controls_v1.enabled`,
  introduced by `20261125101500_kol_privileged_mfa_postgrest_gate_v1.sql`.
- Enforced roles: `super_admin`, `finance_admin`. Other roles retain normal
  least-privilege checks.
- Database gate piggybacks on `public.kol_active_actor_v1()`; public and
  Storage RLS policies + the ten guarded entrypoint RPCs remain active.
- QA Supabase: `mphruawzozrpwcjgejhs`; Production: `sggajelagfonzpovnsiz`.

## Preconditions — all required before GO
1. An encrypted off-target Production PostgreSQL backup was independently
   restored and current Storage bytes were independently backed up/verified.
   The historic backup that expects zero Storage objects is insufficient once
   any uploaded file exists.
2. Final release SHA has all required checks PASS; MFA E2E has real AAL1
   denial, TOTP enrollment, AAL2 acceptance, a bad-code denial, and fresh
   browser login acceptance. The temporary QA user and TOTP factor must be
   deleted after test.
3. QA schema migrations are reproducible; the staged MFA migration is tested
   with the private control disabled. Review all policy and RPC differences
   between QA and Production; never copy user data into Production.
4. Each real Production `super_admin` and `finance_admin` enrolls a TOTP
   authenticator at `/account/mfa`; verify `auth.mfa_factors.status='verified'`
   and `aal2` using the account's own active session.
5. Document a separate identity-verification and operator recovery route.
   The platform MUST NOT offer an unauthenticated MFA-bypass button.
6. Confirm authorized operator and obtain explicit Production GO.

## Activation — only after approval, in maintenance window
1. Preserve Production DB backup + restoration evidence; snapshot current
   public RLS and RPC checksums. Verify encrypted recovery artifact accessible.
2. Apply reviewed migrations in order, including blocked-JWT RLS/RPC guards
   and the staged privileged MFA gate. The table's default value MUST remain
   false until all privileged accounts have verified factors.
3. Verify before enabling:
   `SELECT enabled FROM private.kol_privileged_mfa_controls_v1 WHERE singleton;`
   Must be false. No public/anon/authenticated UPDATE/SELECT grant on table.
4. Update Production Vercel server environment:
   `KOL_ADMIN_MFA_ENFORCE=true`, deploy *one verified SHA*.
5. After server-side and browser MFA pass, and while authorized operators
   have recoverable AAL2 access, enable the DB gate in a controlled SQL change:
   `UPDATE private.kol_privileged_mfa_controls_v1 SET enabled=TRUE,
     updated_at=now() WHERE singleton;`
   This must use an authorized SQL admin connection and have an audit record.
6. Repeat from separate browser contexts: AAL1 denied on /admin, owner
   dashboard, financial admin actions and direct PostgREST; AAL2 allowed;
   client/partner/courier access unaffected; blocked JWT remains denied.
7. Audit Supabase Auth logs and Vercel error logs; assert clean test data.

## Recovery without an MFA device
- Identity verification and authorized account ownership come FIRST.
  Use the audited Supabase Auth administrative process to unenroll a lost
  factor only after owner verification; require password reset, revoke
  sessions, prompt immediate TOTP re-enrollment, verify logs.
- Do not exchange the factor secret or OTP in chat, email or GitHub logs.
- Do not remove MFA from an account merely because somebody can provide its
  email address. Require independent out-of-band authorization.
- Emergency rollback requires documented two-person approval where possible:
  1. Disable the database control via an authenticated administrative SQL
     session; record who, when, why and expected duration.
  2. Temporarily set Vercel `KOL_ADMIN_MFA_ENFORCE=false`; deploy and verify.
  3. Restore a verified factor for every affected privileged account and
     reactivate both controls. Never leave a permanent silent bypass.

## Negative acceptance cases
- A valid password and cryptographically valid JWT with `aal1` must NOT
  grant a privileged role access when *both* gates are enabled.
- Old JWTs after block/deactivation must not read protected RLS rows or invoke
  guarded RPCs, regardless of AAL.
- Unknown role, missing profile, user_metadata role spoofing, mismatched
  session and wrong TOTP must all fail closed.
- There is no Production release while the only SUPER ADMIN cannot recover.
