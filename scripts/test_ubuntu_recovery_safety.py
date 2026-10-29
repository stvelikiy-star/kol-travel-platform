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
RELEASE_REF=release/test; RELEASE_COMMIT="$4"
prepare_repo''', "test", str(SCRIPT), str(self.ops), str(self.source),
             expected or self.verified],
            text=True, capture_output=True, timeout=15,
        )

    def test_checks_out_verified_commit_instead_of_branch_tip(self):
        result = self.prepare()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git(self.checkout, "rev-parse", "HEAD"), self.verified)
        self.assertFalse((self.checkout / "README.md").exists())

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
