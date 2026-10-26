# KÖL — Ubuntu as the authoritative production database

Decision (2026-10-26): **production data for KÖL lives on the owner's Ubuntu host**, in a dedicated KÖL PostgreSQL instance. The currently connected Supabase project `mphruawzozrpwcjgejhs` is **a migration source / staging baseline**, not the long-term primary database. This is a plan and release gate, **not evidence that the Ubuntu database is running**.

## Critical architectural constraint

The Next.js application currently uses `@supabase/supabase-js`, `@supabase/ssr`, Supabase Auth sessions, `auth.uid()`, RLS policies, REST `/rest/v1` and PostgreSQL security-definer RPCs. **Plain PostgreSQL alone is not a compatible drop-in replacement.** Choose one of the following only after tests:

1. Preferred for minimum code churn: **dedicated, version-pinned, self-hosted Supabase-compatible stack on Ubuntu** (PostgreSQL + Auth/GoTrue + PostgREST + Storage where used + API gateway). Keep database port private; publish only HTTPS API. Validate compatibility with the source project's schema, extensions, Auth/JWT, Storage and applied RPCs before accepting traffic.
2. Alternative if full stack exceeds Ubuntu resources: PostgreSQL on Ubuntu with a separately implemented and fully E2E-tested API/Auth adapter. This **requires a reviewed application code migration** and is NOT enabled by setting `DATA_SOURCE_MODE=postgres`. Do not assert parity before tests.

KÖL must use **its own** container/project names, secrets, database, volumes, network and backups. Never reuse or mutate Marina Smart, n8n, or other projects' volumes/credentials. Do not bind PostgreSQL, Studio, or admin UIs to 0.0.0.0. Backups must be encrypted, checked and copied **off Ubuntu**; a backup on the same disk is not sufficient.

## Existing baseline — not yet ready for cutover

- Source: 54 public tables; 17 recorded migrations; 4 Auth users; 4 profiles; 2 support tickets; 1 booking; 1 order.
- Missing source public inventory RPCs: `get_public_stay_inventory` and `get_public_tour_schedules`.
- Existing deployed client booking RPC: `client_stay_booking_create_atomic`; later draft `create_stay_booking_atomic` not installed.
- No confirmed future room/tour inventory; source currently has 0 Storage buckets.
- Source security review: existing role grants and RLS require verification on restored data.
- The current `ops/ubuntu/compose.yaml` is **mock-only preview**. It must not be converted into a live DB deployment by simply adding a DB container or swapping URL variables.

## Ordered release gates (fail closed)

1. **Preflight Ubuntu host, read-only.** Record actual CPU, RAM, disk/free space, Docker versions, existing ports and volumes, HTTPS/DNS reachability, backup storage destination and capacity. Verify resource headroom; do not stop or prune other projects. Keep Ubuntu untouched until this preflight is reviewed.
2. **Source recovery proof.** Supply the existing protected `KOL_DATABASE_URL` to the existing GitHub Actions workflow `live-backup-restore-rehearsal.yml`. Require successful encrypted dump/checksums and an independent disposable Supabase-compatible restore. No existing Supabase schema mutation before PASS.
3. **Select compatible Ubuntu runtime.** Pin PostgreSQL major version and compatible Auth/PostgREST/Storage versions; check schema, roles, extensions, login tokens, token refresh, RPC execution, RLS, Storage, SMTP and external HTTPS callbacks. Keep all secrets in server-managed files with restrictive permissions, not Git.
4. **Restore to isolated KÖL target.** No overwrite of a nonempty database; explicit target identity checks. Match schema and row-count/fingerprint baselines, including `auth.users`, role grants, functions, Storage metadata and actual objects. Import data only into the isolated KÖL target; never treat a newly created empty database as migrated.
5. **Apply prepared migration plan ONLY to a restored disposable copy**, strictly in repository order including 006→024, with APPLY+VERIFY for each step. Reconcile existing `client_*_atomic` RPCs with new names; do not replace their behavior blindly. Test concurrent stay/tour bookings, insufficient inventory, idempotency and privilege isolation.
6. **Run genuine end-to-end browser tests against Ubuntu staging**: signup/email or phone verification → session refresh → profile → booking or support request → admin assignment/status → audit record → logout and cross-account denial. Confirm real prices, inventory, mobile layouts and all enabled locales. Mock results do not satisfy this gate.
7. **Promote only after acceptance**: DNS/TLS API cutover, monitored logs, off-host encrypted backup rotation, tested rollback, source writes frozen during final sync, observed integrity match, and explicit approval to enable real customer activity. Only then retire or demote the old Supabase source.

## Production separation and rollback

- HTTPS reverse proxy terminates TLS for the app and Supabase-compatible API. Database binds only to an internal Docker network / loopback; do not expose port 5432 publicly.
- Maintain **separate domains** for public site and API, with precise Auth redirect/CORS configuration and secure cookie/session behavior.
- Deployment must continue to fail closed while `PRODUCTION_RUNTIME_IMPLEMENTATION_READY=false`. Never change that constant or spoof `KOL_DEPLOYMENT_ENV` merely to bypass gates.
- Rollback means restoring the previously verified app/API endpoint and preserved data snapshot; after writes are enabled, rollback also requires transaction reconciliation to avoid losing real reservations. Do not point browsers back to a stale writeable copy.
- All work on the existing `release/kol-approved-ui-rc1-20261022` branch. The approved winter animated design stays unchanged.

## Unresolved requirements before host changes

- Actual Ubuntu host capacity, approved hostname(s), available private API port/network, remote encrypted-backup destination.
- Confirmed self-hosted Supabase-compatible release set, PostgreSQL major version, existing source extension set, key rotation/session strategy.
- Final validated Source Backup + Restore `PASS`, migrations rehearsal `PASS`, and authenticated role E2E `PASS`.

**No live Ubuntu database has been created or migrated by this document.**
