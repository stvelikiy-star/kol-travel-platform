# Persistent KÖL infrastructure — private acceptance stage

This is the next step after the successful source recovery/migration/rollback
rehearsal. It creates only the dedicated KÖL infrastructure. It does not restore
source data, alter the existing mock web, change MARINA/n8n, or enable production.

## Components and ownership

- Compose project: `kol-live`; network: `kol-live-private`.
- Named volumes: `kol-live-db`, `kol-live-db-config`, `kol-live-storage`.
- PostgreSQL `17.11.0.006`, Auth `v2.197.0`, PostgREST `v16.5`, Storage
  `v1.84.19`: the versions used in the successful Ubuntu CLI 2.122 rehearsal.
- HTTP gateway: `nginx:1.30.6-alpine` (the current upstream stable Docker line).
- Private API: **127.0.0.1:54331**. Private PostgreSQL: **127.0.0.1:54332**.
- No Studio, pgMeta, Realtime, analytics, pooler, or public DB binding.
- `restart: unless-stopped`, explicit per-service memory/CPU/PID limits and
  rotating logs. Infrastructure memory limits total 1856 MiB; the existing web
  and other projects are additional. Availability is checked before first start.

The gateway checks the API key for Auth/REST; services validate user JWTs and
RLS. Storage validates its own JWTs and signed/public object links, including
downloads without an apikey header. CORS allows only the configured site origin.
This is a private staging gateway; public HTTPS/reverse-proxy hardening is a
separate acceptance step before exposing it to clients.

## Safe first start

Use `scripts/ubuntu-kol-live-bootstrap.sh` with a reviewed full
`KOL_RUNTIME_RELEASE_SHA`. It downloads only the four required files from that
commit and verifies embedded SHA256 checksums before running the Python tool.
It needs existing Docker Engine/Compose, Python 3, curl and sha256sum; no sudo,
NVM, npm, source password, host-wide changes or package installation.

The server directory is `~/kol-live`; static release files are kept in
`releases/<sha>/`. Generated configuration and secrets are outside Git:

- `private/live.env` — mode 600, server-generated database/JWT/API/Storage keys
  and a separate future backup encryption key.
- `config/gateway.conf` — mode 600, contains API keys; never paste this file.
- `state.json` — project/instance identity and configuration hashes.
- `infrastructure-proof.json` — nonsecret result, explicitly not production.

Unknown volumes, existing ports, unknown directories, modified configurations,
different release assets, and inconsistent state/secrets cause a stop. Existing
data and keys are not reset. A failed health check leaves the new KÖL runtime in
place for investigation; no other services are stopped, and no volumes are
deleted. Re-running the exact same release preserves keys and instance identity.
Automatic upgrades and secret rotation are intentionally absent.

Default URLs are loopback acceptance URLs. New signups are disabled, email
auto-confirm is disabled, and no SMTP credentials are fabricated. Real Auth
flows require the later verified SMTP/domain configuration. An existing user's
session is not presumed to remain valid after the source key changes.

Expected result: `KOL_PRIVATE_INFRASTRUCTURE_PASS`. This proves startup, instance
identity, PostgreSQL 17 and Auth/REST gateway reachability. It does **not** claim
that KÖL business data was imported, bookings work, or production is ready.

## Evidence required before app cutover

1. Record this runtime's identity, versions, extension/managed-role compatibility
   and actual Docker port bindings; retain the original recovery evidence.
2. Restore the reviewed source backup into this empty, specifically identified
   target with all baseline/checksum guards. Do not feed permanent data into a
   disposable helper that stops/deletes its target on exit.
3. Apply the reconciled package with per-step VERIFY, preserve fingerprints,
   verify roles and prohibit direct transaction/inventory writes.
4. Only then configure the app's Supabase URL/key/server credentials. Its
   browser URL and server reachability need separate verification when inside
   Docker. Keep the existing mock web available until the new data path passes.
5. Verify login, refresh/logout, signup email, role isolation, partner-confirmed
   availability, transactions and audit end to end.
6. Before public access: HTTPS, final redirect/CORS settings, nonempty Storage
   recovery, off-host encrypted backup, restart/load tests, monitoring and a
   cutover/rollback procedure that preserves new writes.

The production readiness constant in application code stays closed. An empty
booted database is not a migrated platform.

## Validation

Local: `python3 -m unittest discover -s scripts -p test_kol_live_runtime.py -v`.

`KOL Persistent Infrastructure` CI starts real containers on a disposable runner,
checks anonymous/owner/other-user/service access, private Storage upload and
signed download, CORS and rejection of invalid keys/admin paths, then restarts
the stack and verifies DB/files/secret persistence. Only that CI runner's project
is deleted in workflow cleanup. The installer never runs `down -v`.

## Upstream references

The JWT init SQL and role configuration are based on Supabase upstream
commit `632989957b27b357d7c29aa57693b4923e1e3db4`, paths
`docker/volumes/db/roles.sql` and `docker/volumes/db/jwt.sql` (Apache-2.0).
The role init only configures the three enabled database clients; optional
Functions/Pooler role changes are omitted and password statement logging is disabled.
The configuration follows the official self-hosting environment contract, with
the smaller previously rehearsed version set and project-specific isolation.

- https://supabase.com/docs/guides/self-hosting/docker
- https://github.com/supabase/supabase/tree/632989957b27b357d7c29aa57693b4923e1e3db4/docker
- https://github.com/nginx/docker-nginx/blob/master/stable/alpine/Dockerfile

## Guarded permanent baseline import

`scripts/kol_persistent_restore.py` is a separate phase, not the disposable
rehearsal helper. It uses the already proven encrypted archive and saved
source-URL decryption passphrase without connecting to the source. Its mandatory
`--instance` must match both the runtime state and database identity. It accepts
only an empty application/Auth/Storage target and a fully checksummed archive
with successful restore-and-rollback evidence. The archive extractor rejects
links, traversal, unreviewed files, duplicate entries and missing checksums.

The command uses PostgreSQL inside the dedicated container, keeps target role
passwords, restores schema/ledger/data in one transaction and compares the
original baseline afterward. It stops only KÖL gateway/Auth/REST/Storage before
import, and leaves them stopped on success or failure. This deliberately avoids
exposing source permissions before the agreed security migration package has
been applied. The existing mock web is unchanged. No source cutover, production
promotion, Storage-byte recovery or automatic migration is claimed.

Successful output is `KOL_PERSISTENT_BASELINE_RESTORED`, with
`migrations_applied=false`, `api_stopped=true`, `production_ready=false`.
A proof is saved separately as `baseline-restore-proof.json`. Infrastructure
state/keys/assets are unchanged. Repeated import into a populated target is
refused; no volumes are deleted. Partial failures retain private diagnostics.
The decrypted temporary archive is removed after the command; the original
encrypted archive is preserved.

The infrastructure workflow has two independent disposable runners: the original
API/Storage/restart checks, and a synthetic baseline/Auth restore that checks
wrong-identity rejection, nonempty-target rejection, preserved keys and a closed
API. This synthetic test complements the completed real-source rehearsal; only
actual Ubuntu output can prove import of that archive into the permanent host.

## Persistent migration acceptance

After a successful actual import, `kol_persistent_migrate.py` accepts only the
exact runtime instance and baseline checksum from `baseline-restore-proof.json`.
It verifies the current database baseline before any migration. Only the owned
database may be running. It reuses the same 43 APPLY and 72 VERIFY operations,
managed-baseline gate, record-preservation fingerprints, rollback-only role test
and final security gate as the completed source rehearsal.

`migration-bundle.json.zlib` is a deterministic delivery snapshot generated by
`build-kol-migration-bundle.py` from existing canonical SQL and the rehearsal
contract, not a new migration plan. Its SHA256 is pinned in the runner. The
bundle is downloaded from an explicit release SHA and verified before use.
Unit tests compare its SQL and migration order to repository originals.

Before step 009, only private REST/Storage containers start. The exact private
8 MiB image bucket is provisioned through Storage API inside its container;
the public gateway/Auth remain stopped. Internal services stop again afterward.
All APIs remain stopped until the app connection phase. The runner does not
connect to the source, replay role passwords or modify infrastructure secrets.

Every step and original-record hash check has private evidence. An attempt marker
prevents automatic retry/resume after any migration attempt. On failure, keep the
API closed and inspect the failed step before choosing recovery. No target data,
backup or volume is automatically deleted. The accepted original encrypted
backup remains the proven pre-migration rollback baseline.

`KOL Persistent Migration Proof` runs the full procedure on a fresh disposable
instance using a new source backup with source connections forced read-only.
It uploads only the nonsecret proof. It runs on manual dispatch or an explicitly
marked release commit, never with source secrets on a pull request.
