# Local KOL operations

Scope: the existing `kol-live` database and staging at `127.0.0.1:3101`. No managed cloud changes, public tunnel creation, source restore or shared-service restarts.

## Backups

`scripts/kol_local_operations.py backup` checks the exact private instance identity, creates a custom PostgreSQL archive with ACL, adds a password-free role inventory and manifest, and encrypts the tar with GnuPG AES256. The independent `KOL_BACKUP_KEY` is read from the existing mode-600 private environment, passed to GnuPG on stdin, never placed in command arguments or Git.

Every run verifies decryption and plaintext SHA256 equality before recording success. Temporary plaintext stays in a private directory and is removed on ordinary success/failure. Keep backups and the independent recovery key outside this Ubuntu host for disaster recovery; neither off-host transfer nor key escrow is configured by these scripts.

Output: `/home/agent/kol-backups/scheduled`. Only this managed directory is subject to retention: 14 successful named copies. Previous manual backups/recovery archives are retained. New backups include logical database and Storage metadata, not physical Storage objects or role passwords.

The daily timer runs at 04:10 Asia/Bishkek with up to five minutes of jitter and catches up after missed runs. Units are user services; the existing user linger must remain enabled.

## Health

`scripts/kol_local_operations.py health` checks the six owned containers, Supabase-connected staging with demo disabled, backup age (<30 hours) and checksum, 5 GiB free disk, and the absence of Storage objects lacking a physical backup stream. It writes `/home/agent/kol-live/operations/health.json` and returns nonzero on failure. The health timer runs every five minutes. Failures appear in the user journal; no email, messenger or external alert receiver is configured.

This is local monitoring. It does not prove internet reachability, DNS/HTTPS, commercial inventory or production readiness. The script does not automatically restart databases or change application data.

## Independent restore check

`PYTHONDONTWRITEBYTECODE=1 python3 scripts/qa-kol-local-backup-restore.py` decrypts the latest managed archive into a private temporary directory, restores it in a disposable same-image PostgreSQL container with no network or published ports and a 512 MiB memory cap, compares table data fingerprints, and removes the container. Managed roles are provisioned as NOLOGIN placeholders; this does not restore real passwords or prove full-stack disaster recovery. Run when source data is stable: writes after the backup can legitimately change the source comparison.

The test never imports into or drops the source database. The fresh acceptance run compared 95 tables across public/auth/storage/kol_ops/supabase_migrations and passed. Different earlier table totals used different schema scopes.

## Deployment

The four `kol-local-*` unit templates in this directory are installed in `/home/agent/.config/systemd/user/`. Review existing units before replacing them. Reload with `systemctl --user daemon-reload`; enable the two timers; start the backup and health services once to verify operation. Validate with `systemctl --user list-timers --all` and `journalctl --user -u kol-local-backup.service -u kol-local-health.service`.

The scripts require Python 3, Docker access, GnuPG and the existing KOL PostgreSQL image. The new unit tests exercise actual encryption, wrong-key/tamper rejection, unsafe archive rejection, private-key handling and stale/modified backup detection. CI invokes them without host/container mutations.
