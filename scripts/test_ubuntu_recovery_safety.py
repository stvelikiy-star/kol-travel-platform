"""Exercise Ubuntu recovery guards without Docker, secrets or network access."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().with_name("ubuntu-kol-backup-restore.sh")


class UbuntuRecoverySafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "source"
        self.source.mkdir()
        self.git(self.source, "init", "-b", "release/test")
        self.git(self.source, "config", "user.name", "Recovery Test")
        self.git(self.source, "config", "user.email", "test@example.invalid")
        (self.source / "package.json").write_text('{}\n')
        self.git(self.source, "add", ".")
        self.git(self.source, "commit", "-m", "verified baseline")
        self.verified = self.git(self.source, "rev-parse", "HEAD")
        (self.source / "README.md").write_text("unverified branch tip\n")
        self.git(self.source, "add", ".")
        self.git(self.source, "commit", "-m", "later change")
        self.ops = self.root / "ops"
        self.checkout = self.ops / "kol-travel-platform"

    def git(self, root, *args):
        return subprocess.check_output(
            ["git", "-C", str(root), *args], text=True, stderr=subprocess.DEVNULL
        ).strip()

    def prepare(self, expected=None):
        return subprocess.run(
            ["bash", "-c", '''source "$1"
OPS_ROOT="$2"; REPO_DIR="$2/kol-travel-platform"; REPO_URL="$3"
RELEASE_REF=release/test; RELEASE_COMMIT="$4"; BACKUP_ROOT="$2/backups"
prepare_repo''', "test", str(SCRIPT), str(self.ops), str(self.source),
             expected or self.verified],
            text=True, capture_output=True, timeout=15,
        )

    def storage_ledger(self, source, target, source_max="73", target_max="74"):
        return subprocess.run(
            ["bash", "-c", 'source "$1"; storage_ledgers_compatible "$2" "$3" "$4" "$5"',
             "test", str(SCRIPT), source, target, source_max, target_max],
            capture_output=True, text=True, timeout=5,
        ).returncode

    def test_reviewed_storage_74_preserves_all_source_hashes(self):
        source = "72\tprevious\thash72\n73\trevoke-grants\thash73"
        target = source + "\n74\tunlock-object-versioning\tdacb58ecb37678de855505b3e1c5aec0d5df7894"
        self.assertEqual(self.storage_ledger(source, target), 0)
        self.assertNotEqual(self.storage_ledger(source, target.replace("hash73", "changed")), 0)
        self.assertNotEqual(self.storage_ledger(source, target + "\n75\tunknown\thash75", target_max="75"), 0)
        self.assertNotEqual(self.storage_ledger(source, target.split("\n", 1)[1]), 0)
        self.assertNotEqual(self.storage_ledger(source, target + "\n74\tduplicate\thash74"), 0)

    def test_observed_storage_historical_hash_changes_are_narrowly_reviewed(self):
        source = "2\tstorage-schema\tf6a1fa2c93cbcd16d4e487b362e45fca157a8dbd\n62\tobject-versioning-core\t0b855f00ff3be0bfca91efee02a9858912491a9a\n73\trevoke-grants-to-unused-operations\tba9244051be09f22f714fc0170a2539f8b5f0e68"
        target = source.replace("f6a1fa2c93cbcd16d4e487b362e45fca157a8dbd", "cdc19a79b298ce37cc730487821a1a7b06b98105").replace("0b855f00ff3be0bfca91efee02a9858912491a9a", "c6567e688f8c4a76887e7c1b117b2d58f4feccba") + "\n74\tunlock-object-versioning\tdacb58ecb37678de855505b3e1c5aec0d5df7894"
        self.assertEqual(self.storage_ledger(source, target), 0)
        for known_hash in ["cdc19a79b298ce37cc730487821a1a7b06b98105", "c6567e688f8c4a76887e7c1b117b2d58f4feccba", "ba9244051be09f22f714fc0170a2539f8b5f0e68", "dacb58ecb37678de855505b3e1c5aec0d5df7894"]:
            with self.subTest(known_hash=known_hash):
                self.assertNotEqual(self.storage_ledger(source, target.replace(known_hash, "unreviewed")), 0)

    def test_storage_74_exception_requires_empty_storage_and_reviewed_image(self):
        code = r'''source "$1"
KOL_DATABASE_URL=source; LOCAL_DB_URL=target
psql() {
  case "$*" in
    *"max(id)"*) [[ "$1" == source ]] && echo 73 || echo 74 ;;
    *"storage.buckets"*) [[ "$1" == source ]] && echo "$SOURCE_OBJECTS" || echo "$TARGET_OBJECTS" ;;
    *"information_schema.columns"*) echo 4 ;;
    *) printf '73\trevoke-grants\thash73\n'
       [[ "$1" == source ]] || printf '74\tunlock-object-versioning\tdacb58ecb37678de855505b3e1c5aec0d5df7894\n' ;;
  esac
  return 0
}
docker() { echo "$TEST_STORAGE_IMAGE"; }
verify_storage_schema_compatibility
'''
        for image, source, target, success in [
            ("public.ecr.aws/supabase/storage-api:v1.84.19", "0,0", "0,0", True),
            ("unreviewed:latest", "0,0", "0,0", False),
            ("public.ecr.aws/supabase/storage-api:v1.84.19", "1,0", "0,0", False),
            ("public.ecr.aws/supabase/storage-api:v1.84.19", "0,0", "0,1", False),
        ]:
            with self.subTest(image=image, source=source, target=target):
                result = subprocess.run(
                    ["bash", "-c", code, "test", str(SCRIPT)],
                    env={**os.environ, "TEST_STORAGE_IMAGE": image,
                         "SOURCE_OBJECTS": source, "TARGET_OBJECTS": target},
                    text=True, capture_output=True, timeout=5,
                )
                self.assertEqual(result.returncode == 0, success, result.stderr)

    def test_locked_dependencies_are_installed_in_dedicated_checkout(self):
        self.assertEqual(self.prepare().returncode, 0)
        result = subprocess.run(
            ["bash", "-c", r'''source "$1"
REPO_DIR="$2"
TEST_NPM_EXIT="$3"
npm() { printf 'NPM_CWD=%s\nNPM_ARGS=%s\n' "$PWD" "$*"; return "$TEST_NPM_EXIT"; }
install_recovery_dependencies
''', "test", str(SCRIPT), str(self.checkout), "0"],
            capture_output=True, text=True, timeout=5,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("NPM_CWD=" + str(self.checkout), result.stdout)
        self.assertIn("NPM_ARGS=ci --no-audit --no-fund", result.stdout)
        script = SCRIPT.read_text()
        main = script[script.index("main() {"):]
        self.assertLess(main.index("install_recovery_dependencies"), main.index("STARTED_LOCAL=1"))

    def test_checks_out_verified_commit_instead_of_branch_tip(self):
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git(self.checkout, "rev-parse", "HEAD"), self.verified)
        self.assertFalse((self.checkout / "README.md").exists())

    def test_empty_generated_seed_is_archived_before_retry(self):
        self.assertEqual(self.prepare().returncode, 0)
        seed = self.checkout / "supabase" / "seed.sql"
        seed.parent.mkdir()
        seed.touch()
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        saved = list((self.ops / "backups").glob("ops-state.*/seed.sql"))
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0].read_bytes(), b"")
        self.assertFalse(seed.exists())

    def test_previous_encrypted_recovery_is_preserved_before_retry(self):
        self.assertEqual(self.prepare().returncode, 0)
        artifacts = self.checkout / ".kol-ci-artifacts"
        artifacts.mkdir()
        (artifacts / "baseline.tar.gz.enc").write_bytes(b"encrypted previous backup")
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        saved = list((self.ops / "backups").glob("previous-recovery.*/artifacts/baseline.tar.gz.enc"))
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0].read_bytes(), b"encrypted previous backup")
        self.assertFalse(artifacts.exists())

    def test_nonempty_seed_remains_protected(self):
        self.assertEqual(self.prepare().returncode, 0)
        seed = self.checkout / "supabase" / "seed.sql"
        seed.parent.mkdir()
        seed.write_text("select 42;\n")
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("local changes", result.stderr)
        self.assertEqual(seed.read_text(), "select 42;\n")

    def test_ubuntu_cli_matches_live_recovery_ci(self):
        workflow = SCRIPT.parent.parent / ".github/workflows/live-backup-restore-rehearsal.yml"
        import re
        ubuntu_version = re.search(r'SUPABASE_CLI_VERSION="([0-9.]+)"', SCRIPT.read_text()).group(1)
        ci_version = re.search(r'SUPABASE_CLI_VERSION="([0-9.]+)"', workflow.read_text()).group(1)
        self.assertEqual(ubuntu_version, ci_version)

    def test_preserves_tracked_and_untracked_local_changes(self):
        self.assertEqual(self.prepare().returncode, 0)
        tracked = self.checkout / "package.json"
        tracked.write_text('{"local":"keep"}\n')
        untracked = self.checkout / "owner-notes.txt"
        untracked.write_text("keep these notes\n")
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("local changes", result.stderr)
        self.assertEqual(tracked.read_text(), '{"local":"keep"}\n')
        self.assertEqual(untracked.read_text(), "keep these notes\n")

    def test_rejects_wrong_origin_before_checkout(self):
        self.assertEqual(self.prepare().returncode, 0)
        self.git(self.checkout, "remote", "set-url", "origin", str(self.root / "other"))
        result = self.prepare()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("origin does not match", result.stderr)
        self.assertEqual(self.git(self.checkout, "rev-parse", "HEAD"), self.verified)

    def test_rejects_unknown_release_without_changing_checkout(self):
        self.assertEqual(self.prepare().returncode, 0)
        result = self.prepare("f" * 40)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git(self.checkout, "rev-parse", "HEAD"), self.verified)

    def test_occupied_port_does_not_stop_containers(self):
        commands = self.root / "commands"
        commands.mkdir()
        log = self.root / "docker.log"
        (commands / "docker").write_text('#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_TEST_LOG"\n')
        (commands / "ss").write_text('#!/bin/sh\ncase "$*" in *:54322) echo LISTEN;; esac\n')
        for path in commands.iterdir():
            path.chmod(0o755)
        result = subprocess.run(
            ["bash", "-c", 'source "$1"; ensure_disposable_target_available', "test", str(SCRIPT)],
            env={**os.environ, "PATH": str(commands) + ":" + os.environ["PATH"],
                 "DOCKER_TEST_LOG": str(log)},
            text=True, capture_output=True, timeout=5,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("54322 is already in use", result.stderr)
        self.assertTrue(all(line.startswith(("ps ", "volume ls ")) for line in log.read_text().splitlines()))

    def test_existing_volume_is_preserved_before_any_startup(self):
        commands = self.root / "commands"
        commands.mkdir()
        log = self.root / "docker.log"
        (commands / "docker").write_text(
            '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DOCKER_TEST_LOG"\n'
            'case "$*" in "volume ls "*) echo supabase_db_kol-travel-platform;; esac\n'
        )
        (commands / "docker").chmod(0o755)
        result = subprocess.run(
            ["bash", "-c", 'source "$1"; ensure_disposable_target_available', "test", str(SCRIPT)],
            env={**os.environ, "PATH": str(commands) + ":" + os.environ["PATH"],
                 "DOCKER_TEST_LOG": str(log)},
            text=True, capture_output=True, timeout=5,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("volumes found", result.stderr)
        self.assertTrue(all(line.startswith(("ps ", "volume ls ")) for line in log.read_text().splitlines()))

    def network_start(self, binding):
        commands = self.root / "commands"
        commands.mkdir()
        log = self.root / "supabase.log"
        (commands / "docker").write_text(
            '#!/bin/sh\ncase "$*" in *--format*) printf "%s\\n" "$TEST_BINDING";; esac\n'
        )
        (commands / "supabase").write_text(
            '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_CLI_LOG"\n'
        )
        for path in commands.iterdir():
            path.chmod(0o755)
        result = subprocess.run(
            ["bash", "-c", 'source "$1"; bash -c "supabase start -x studio"', "test", str(SCRIPT)],
            env={**os.environ, "PATH": str(commands) + ":" + os.environ["PATH"],
                 "TEST_BINDING": binding, "TEST_CLI_LOG": str(log)},
            text=True, capture_output=True, timeout=5,
        )
        return result, log

    def test_child_recovery_process_keeps_loopback_network(self):
        result, log = self.network_start("127.0.0.1")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(log.read_text().strip(), "start -x studio --network-id kol-recovery-loopback")

    def test_non_private_network_blocks_cli_start(self):
        result, log = self.network_start("0.0.0.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not loopback-only", result.stderr)
        self.assertFalse(log.exists())


if __name__ == "__main__":
    unittest.main()
