"""Local safety tests; Docker integration runs in its dedicated CI workflow."""
import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("kol_live_runtime.py")
spec = importlib.util.spec_from_file_location("kol_live_runtime", SCRIPT)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
ASSETS = SCRIPT.parent.parent / "ops/ubuntu/live"


class KolLiveRuntimeSafety(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / "kol-live"

    def prepare(self):
        return runtime.prepare(self.root, ASSETS, "http://127.0.0.1:54331", "http://127.0.0.1:3100")

    def test_generated_secrets_are_private_unique_and_not_dev_defaults(self):
        state, env = self.prepare()
        other = Path(self.temp.name) / "other"
        _, other_env = runtime.prepare(other, ASSETS, env["KOL_API_ORIGIN"], env["KOL_SITE_ORIGIN"])
        self.assertNotEqual(env["POSTGRES_PASSWORD"], other_env["POSTGRES_PASSWORD"])
        self.assertNotEqual(env["JWT_SECRET"], other_env["JWT_SECRET"])
        self.assertGreaterEqual(len(env["POSTGRES_PASSWORD"]), 48)
        self.assertEqual(os.stat(self.root / "private/live.env").st_mode & 0o777, 0o600)
        self.assertEqual(os.stat(self.root / "config/gateway.conf").st_mode & 0o777, 0o600)
        # Init SQL must be readable by the postgres user through a file mount.
        self.assertEqual(os.stat(self.root / "config/db/identity.sql").st_mode & 0o777, 0o644)
        for key, role in (("ANON_KEY", "anon"), ("SERVICE_ROLE_KEY", "service_role")):
            token = env[key]
            data, signature = token.rsplit(".", 1)
            expected = base64.urlsafe_b64encode(hmac.new(env["JWT_SECRET"].encode(), data.encode(), hashlib.sha256).digest()).rstrip(b"=").decode()
            self.assertEqual(signature, expected)
            claims = json.loads(base64.urlsafe_b64decode(token.split(".")[1] + "=="))
            self.assertEqual(claims["role"], role)
        self.assertFalse(state["data_restored"])
        self.assertFalse(state["production_ready"])

    def test_retry_preserves_identity_secrets_and_config(self):
        state, env = self.prepare()
        before = {p.relative_to(self.root): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        next_state, next_env = self.prepare()
        self.assertEqual((state, env), (next_state, next_env))
        self.assertEqual(before, {p.relative_to(self.root): p.read_bytes() for p in self.root.rglob("*") if p.is_file()})

    def test_unknown_directory_is_not_overwritten(self):
        self.root.mkdir()
        notes = self.root / "owner-notes.txt"
        notes.write_text("keep")
        with self.assertRaises(runtime.Refuse):
            self.prepare()
        self.assertEqual(notes.read_text(), "keep")
        self.assertFalse((self.root / "private").exists())

    def test_edited_configuration_is_preserved_and_blocks_retry(self):
        self.prepare()
        path = self.root / "config/gateway.conf"
        path.write_text("owner change")
        with self.assertRaises(runtime.Refuse):
            self.prepare()
        self.assertEqual(path.read_text(), "owner change")

    def test_url_changes_do_not_rotate_keys(self):
        self.prepare()
        path = self.root / "private/live.env"
        before = path.read_bytes()
        with self.assertRaises(runtime.Refuse):
            runtime.prepare(self.root, ASSETS, "https://api.kol.example", "https://kol.example")
        self.assertEqual(path.read_bytes(), before)

    def test_url_injection_plain_remote_http_and_credentials_are_rejected(self):
        for url in ("http://public.example", "https://user:secret@example.com", "https://example.com/a", "https://example.com?q=x", "https://example.com;bad", "https://example.com\ninvalid"):
            with self.subTest(url=url), self.assertRaises(runtime.Refuse):
                runtime.origin(url)

    def test_state_secret_identity_mismatch_blocks_retry(self):
        self.prepare()
        path = self.root / "state.json"
        state = json.loads(path.read_text())
        state["instance_id"] = "unexpected"
        path.write_text(json.dumps(state))
        with self.assertRaises(runtime.Refuse):
            self.prepare()

    def test_unknown_docker_volume_blocks_without_mutation(self):
        def fake_docker(*args):
            return [{"Labels": {"ai-prof.project": "marina"}}] if args[:2] == ("volume", "inspect") else None
        with patch.object(runtime, "run"), patch.object(runtime, "docker_json", side_effect=fake_docker):
            with self.assertRaisesRegex(runtime.Refuse, "cannot be adopted"):
                runtime.preflight(self.root)
        self.assertFalse(self.root.exists())

    def test_command_failures_redact_secrets_and_database_urls(self):
        _, env = self.prepare()
        import subprocess
        error = "image failed " + env["SERVICE_ROLE_KEY"] + " postgres://user:" + env["POSTGRES_PASSWORD"] + "@db/db"
        completed = subprocess.CompletedProcess([], 1, "", error)
        with patch.object(runtime.subprocess, "run", return_value=completed):
            with self.assertRaises(runtime.Refuse) as raised:
                runtime.run(runtime.compose_command(self.root, ASSETS) + ["pull"])
        message = str(raised.exception)
        self.assertNotIn(env["SERVICE_ROLE_KEY"], message)
        self.assertNotIn(env["POSTGRES_PASSWORD"], message)
        self.assertNotIn("postgres://", message)
        self.assertIn("image failed", message)

    def test_installer_checksums_match_all_downloaded_files(self):
        installer = SCRIPT.with_name("ubuntu-kol-live-bootstrap.sh").read_text()
        manifest = installer.split("<<'KOL_FILES'\n", 1)[1].split("\nKOL_FILES", 1)[0]
        for line in manifest.splitlines():
            digest, name = line.split()
            path = SCRIPT.parent.parent / name
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), digest, name)

    def test_gateway_exposes_no_admin_route_and_keeps_signed_storage_paths(self):
        _, env = self.prepare()
        config = runtime.gateway_config(env)
        self.assertNotIn("/pg/", config)
        self.assertNotIn("studio", config)
        storage = config.split("location /storage/v1/", 1)[1].split("location /", 1)[0]
        self.assertNotIn("kol_api_allowed", storage)
        self.assertIn('location / { return 404; }', config)
        self.assertIn('"' + env["KOL_SITE_ORIGIN"] + '"', config)


if __name__ == "__main__":
    unittest.main()
