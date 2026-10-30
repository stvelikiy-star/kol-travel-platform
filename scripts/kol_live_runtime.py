#!/usr/bin/env python3
"""Prepare and start only the dedicated, private KÖL persistent infrastructure.

No source connection, restore, migration, app cutover or production promotion.
"""
import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

PROJECT = "kol-live"
ASSETS = ("compose.yaml", "db/roles.sql", "db/jwt.sql")
VOLUMES = ("kol-live-db", "kol-live-db-config", "kol-live-storage")
SERVICES = {"db", "auth", "rest", "storage", "gateway"}


class Refuse(RuntimeError):
    pass


def origin(value):
    if any(ord(char) < 33 or ord(char) > 126 for char in value):
        raise Refuse("Origin contains unsupported whitespace or control characters")
    parsed = urlsplit(value)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")
            or not re.fullmatch(r"[A-Za-z0-9.-]+", parsed.hostname)):
        raise Refuse("URL must be an HTTP(S) origin without credentials, path or query")
    if parsed.scheme == "http" and parsed.hostname not in ("127.0.0.1", "localhost"):
        raise Refuse("Plain HTTP is permitted only on loopback during private preparation")
    try:
        parsed.port
    except ValueError as exc:
        raise Refuse("Invalid origin port") from exc
    return value.rstrip("/")


def jwt(secret, role, subject=None):
    def b64(value):
        return base64.urlsafe_b64encode(value).rstrip(b"=").decode()
    now = int(time.time())
    claims = {"role": role, "iss": "supabase", "iat": now, "exp": now + 31536000}
    if subject is not None:
        claims.update(sub=subject, aud="authenticated")
    data = ".".join(b64(json.dumps(part, separators=(",", ":")).encode())
                    for part in ({"alg": "HS256", "typ": "JWT"}, claims))
    return data + "." + b64(hmac.new(secret.encode(), data.encode(), hashlib.sha256).digest())


def private_write(path, text, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    os.fchmod(fd, mode)
    with os.fdopen(fd, "w") as stream:
        stream.write(text)


def read_env(path):
    result = {}
    for line in path.read_text().splitlines():
        if not line or line.startswith("#"):
            continue
        key, value = line.split("=", 1)
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or "\n" in value:
            raise Refuse("Invalid private environment file")
        result[key] = value
    return result


def gateway_config(env):
    site = origin(env["KOL_SITE_ORIGIN"])
    anon, service = env["ANON_KEY"], env["SERVICE_ROLE_KEY"]
    if not all(re.fullmatch(r"[A-Za-z0-9_.-]+", value) for value in (anon, service)):
        raise Refuse("Invalid API key encoding")
    # Backend services validate user JWTs and RLS. Storage also validates its
    # signed/public download URLs, which deliberately need no apikey header.
    return """user nginx;
worker_processes 1;
pid /tmp/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 256; }
http {
  access_log off;
  client_body_temp_path /tmp/client-body;
  proxy_temp_path /tmp/proxy;
  fastcgi_temp_path /tmp/fastcgi;
  uwsgi_temp_path /tmp/uwsgi;
  scgi_temp_path /tmp/scgi;
  client_max_body_size 8m;
  server_tokens off;
  proxy_hide_header Access-Control-Allow-Origin;
  proxy_hide_header Access-Control-Allow-Credentials;
  proxy_hide_header Access-Control-Expose-Headers;
  map $http_apikey $kol_api_allowed {
    default 0;
    "__ANON__" 1;
    "__SERVICE__" 1;
  }
  map $http_origin $kol_cors_origin {
    default "";
    "__SITE__" "__SITE__";
  }
  server {
    listen 8080;
    add_header Access-Control-Allow-Origin $kol_cors_origin always;
    add_header Vary Origin always;
    add_header Access-Control-Allow-Credentials true always;
    add_header Access-Control-Allow-Headers "authorization, apikey, content-type, x-client-info, prefer, range, x-upsert, x-supabase-api-version" always;
    add_header Access-Control-Allow-Methods "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Expose-Headers "content-range, range, location, x-total-count" always;
    if ($request_method = OPTIONS) { return 204; }
    location = /health {
      default_type application/json;
      return 200 '{"service":"kol-live-infrastructure","status":"ok","dataRestored":false,"productionReady":false}';
    }
    location = /auth/v1/verify {
      proxy_pass http://auth:9999/verify;
      proxy_set_header Host $http_host;
    }
    location = /auth/v1/callback {
      proxy_pass http://auth:9999/callback;
      proxy_set_header Host $http_host;
    }
    location /auth/v1/ {
      if ($kol_api_allowed = 0) { return 401; }
      proxy_pass http://auth:9999/;
      proxy_set_header Host $http_host;
      proxy_set_header Authorization $http_authorization;
    }
    location /rest/v1/ {
      if ($kol_api_allowed = 0) { return 401; }
      proxy_pass http://rest:3000/;
      proxy_set_header Host $http_host;
      proxy_set_header Authorization $http_authorization;
      proxy_read_timeout 30s;
    }
    location /storage/v1/ {
      proxy_pass http://storage:5000/;
      proxy_set_header Host $http_host;
      proxy_set_header Authorization $http_authorization;
      proxy_read_timeout 60s;
    }
    location / { return 404; }
  }
}
""".replace("__ANON__", anon).replace("__SERVICE__", service).replace("__SITE__", site)


def prepare(root, assets, api_origin, site_origin):
    if root.is_symlink():
        raise Refuse("Runtime directory must not be a symbolic link")
    root, assets = root.resolve(), assets.resolve()
    if str(root) in ("/", "/home", "/tmp", str(Path.home())):
        raise Refuse("Refusing a broad runtime directory")
    if root.is_symlink() or any((root / name).is_symlink() for name in ("state.json", "private", "config")):
        raise Refuse("Runtime state/config must not be symbolic links")
    api_origin, site_origin = origin(api_origin), origin(site_origin)
    hashes = {name: hashlib.sha256((assets / name).read_bytes()).hexdigest() for name in ASSETS}
    marker = root / "state.json"
    env_file = root / "private/live.env"
    if marker.exists():
        state = json.loads(marker.read_text())
        if state.get("project") != PROJECT or state.get("asset_hashes") != hashes:
            raise Refuse("Existing runtime identity or release differs; automatic upgrade is disabled")
        if env_file.is_symlink():
            raise Refuse("Private environment must not be a symbolic link")
        env = read_env(env_file)
        if env.get("KOL_INSTANCE_ID") != state["instance_id"]:
            raise Refuse("Runtime secret/state identity mismatch")
        if (env.get("KOL_API_ORIGIN"), env.get("KOL_SITE_ORIGIN")) != (api_origin, site_origin):
            raise Refuse("Existing URL configuration differs; no settings or secrets were overwritten")
        for name, digest in state["config_hashes"].items():
            path = root / "config" / name
            if path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise Refuse("Runtime configuration was edited; preserved without overwriting")
        os.chmod(env_file, 0o600)
        return state, env
    if root.exists() and any(path.name != "releases" for path in root.iterdir()):
        raise Refuse("Runtime directory is not empty and has no known identity; preserved")
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(root, 0o700)
    instance = secrets.token_hex(16)
    secret = secrets.token_hex(32)
    env = {
        "KOL_INSTANCE_ID": instance,
        "KOL_CONFIG_DIR": str(root / "config"),
        "KOL_API_ORIGIN": api_origin,
        "KOL_SITE_ORIGIN": site_origin,
        "POSTGRES_PASSWORD": secrets.token_hex(24),
        "JWT_SECRET": secret,
        "ANON_KEY": jwt(secret, "anon"),
        "SERVICE_ROLE_KEY": jwt(secret, "service_role"),
        "S3_ACCESS_KEY": secrets.token_hex(16),
        "S3_SECRET_KEY": secrets.token_hex(32),
        "KOL_BACKUP_KEY": secrets.token_hex(32),
    }
    if "$" in str(root) or any(c in str(root) for c in "\n\r #\"'\\"):
        raise Refuse("Runtime directory contains unsupported environment-file characters")
    files = {name: (assets / name).read_text() for name in ("db/roles.sql", "db/jwt.sql")}
    files["db/identity.sql"] = """CREATE SCHEMA IF NOT EXISTS kol_ops;
REVOKE ALL ON SCHEMA kol_ops FROM PUBLIC, anon, authenticated;
CREATE TABLE kol_ops.runtime_identity (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  project text NOT NULL, instance_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO kol_ops.runtime_identity (project, instance_id) VALUES ('kol-live', '__INSTANCE__');
REVOKE ALL ON ALL TABLES IN SCHEMA kol_ops FROM PUBLIC, anon, authenticated;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
""".replace("__INSTANCE__", instance)
    files["gateway.conf"] = gateway_config(env)
    for name, content in files.items():
        private_write(root / "config" / name, content, 0o600 if name == "gateway.conf" else 0o644)
    private_write(env_file, "".join(key + "=" + value + "\n" for key, value in env.items()))
    state = {
        "project": PROJECT, "instance_id": instance, "asset_hashes": hashes,
        "config_hashes": {name: hashlib.sha256(text.encode()).hexdigest() for name, text in files.items()},
        "phase": "infrastructure-only", "data_restored": False, "production_ready": False,
    }
    private_write(marker, json.dumps(state, indent=2) + "\n")
    return state, env


def run(command, env=None, allow_failure=False):
    if command[:2] == ["docker", "compose"] and "--env-file" in command:
        private_env = read_env(Path(command[command.index("--env-file") + 1]))
        env = {**os.environ, **(env or {}), **private_env}
    result = subprocess.run(command, text=True, capture_output=True, env=env)
    if result.returncode and not allow_failure:
        # Never echo command arguments, environment, compose config or service
        # logs: database URLs and gateway keys can appear there.
        diagnostic = result.stderr
        private_env = {}
        if "--env-file" in command:
            private_env = read_env(Path(command[command.index("--env-file") + 1]))
        for key, value in private_env.items():
            if any(word in key for word in ("PASSWORD", "SECRET", "KEY")):
                diagnostic = diagnostic.replace(value, "<redacted>")
        diagnostic = re.sub(r"postgres(?:ql)?://[^\s]+", "<redacted-database-url>", diagnostic)
        diagnostic = "\n".join(diagnostic.splitlines()[-12:])
        raise Refuse("Command failed: " + command[0] + " (exit " + str(result.returncode) + "); runtime preserved\n" + diagnostic)
    return result


def docker_json(*args):
    result = run(["docker", *args], allow_failure=True)
    return json.loads(result.stdout) if result.returncode == 0 else None


def preflight(root):
    run(["docker", "info", "--format", "{{.ServerVersion}}"])
    run(["docker", "compose", "version"])
    endpoint = run(["docker", "context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]).stdout.strip()
    if not endpoint.startswith("unix://") or (os.environ.get("DOCKER_HOST") and not os.environ["DOCKER_HOST"].startswith("unix://")):
        raise Refuse("Only a local Unix-socket Docker engine is permitted")
    mem = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
    available_mib = int(mem["MemAvailable"].split()[0]) // 1024
    # Existing instances may already consume their allocation on a retry.
    marker = root / "state.json"
    if not marker.exists() and available_mib < 2300:
        raise Refuse("Insufficient available RAM for a separate KÖL stack (need 2300 MiB)")
    parent = root
    while not parent.exists():
        parent = parent.parent
    stat = os.statvfs(parent)
    if stat.f_bavail * stat.f_frsize < 12 * 1024 ** 3:
        raise Refuse("Less than 12 GiB free disk space; no services changed")
    known = marker.exists() and json.loads(marker.read_text()).get("project") == PROJECT
    for volume in VOLUMES:
        info = docker_json("volume", "inspect", volume)
        if info:
            labels = info[0].get("Labels") or {}
            if not known or labels.get("com.docker.compose.project") != PROJECT or labels.get("ai-prof.project") != PROJECT:
                raise Refuse("Existing volume cannot be adopted: " + volume)
    network = docker_json("network", "inspect", "kol-live-private")
    if network:
        labels = network[0].get("Labels") or {}
        binding = network[0].get("Options", {}).get("com.docker.network.bridge.host_binding_ipv4")
        if not known or labels.get("com.docker.compose.project") != PROJECT or binding != "127.0.0.1":
            raise Refuse("Existing network cannot be adopted or is not loopback-bound")
    ids = run(["docker", "ps", "-aq", "--filter", "label=com.docker.compose.project=kol-live"]).stdout.split()
    owned_bindings = set()
    for ident in ids:
        info = docker_json("inspect", ident)[0]
        labels = info["Config"].get("Labels", {})
        if not known or labels.get("com.docker.compose.service") not in SERVICES:
            raise Refuse("Existing project container cannot be adopted")
        for bindings in (info.get("NetworkSettings", {}).get("Ports") or {}).values():
            for binding in bindings or []:
                if binding["HostIp"] != "127.0.0.1":
                    raise Refuse("Existing KÖL container has a non-loopback published port")
                owned_bindings.add(int(binding["HostPort"]))
    for port in (54331, 54332):
        with socket.socket() as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                if port not in owned_bindings:
                    raise Refuse("Port " + str(port) + " is already occupied by another service")
    return {"available_memory_mib": available_mib, "free_disk_gib": round(stat.f_bavail * stat.f_frsize / 1024 ** 3, 1)}


def compose_command(root, assets):
    return ["docker", "compose", "--project-name", PROJECT, "--env-file", str(root / "private/live.env"),
            "--file", str(assets / "compose.yaml")]


def verify(root, assets, state, env):
    command = compose_command(root, assets)
    ident = run(command + ["exec", "-T", "db", "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c",
        "select project || ':' || instance_id from kol_ops.runtime_identity;"]).stdout.strip()
    if ident != PROJECT + ":" + state["instance_id"]:
        raise Refuse("Database instance identity does not match this KÖL runtime")
    version = run(command + ["exec", "-T", "db", "psql", "-U", "postgres", "-d", "postgres", "-X", "-Atqc", "show server_version_num;"]).stdout.strip()
    if not (170000 <= int(version) < 180000):
        raise Refuse("Persistent target must run PostgreSQL major 17")
    # CLI --wait proves individual health checks; these prove the gateway paths.
    for endpoint in ("/auth/v1/health", "/rest/v1/"):
        request = Request("http://127.0.0.1:54331" + endpoint, headers={"apikey": env["ANON_KEY"]})
        try:
            with urlopen(request, timeout=15) as response:
                if response.status != 200:
                    raise Refuse("API route is not ready: " + endpoint)
        except Exception as exc:
            raise Refuse("API route is not ready: " + endpoint) from exc
    proof = {"status": "KOL_PRIVATE_INFRASTRUCTURE_PASS", "project": PROJECT,
             "instance_id": state["instance_id"], "postgres_version_num": version,
             "data_restored": False, "production_ready": False,
             "api": "127.0.0.1:54331", "database": "127.0.0.1:54332"}
    (root / "infrastructure-proof.json").write_text(json.dumps(proof, indent=2) + "\n")
    os.chmod(root / "infrastructure-proof.json", 0o600)
    return proof


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path.home() / "kol-live")
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--api-origin", default="http://127.0.0.1:54331")
    parser.add_argument("--site-origin", default="http://127.0.0.1:3100")
    args = parser.parse_args()
    args.root, args.assets = args.root.absolute(), args.assets.resolve()
    print("KÖL: checking resources, ownership and port isolation", flush=True)
    resources = preflight(args.root)
    print(json.dumps(resources), flush=True)
    state, env = prepare(args.root, args.assets, args.api_origin, args.site_origin)
    command = compose_command(args.root, args.assets)
    run(command + ["config", "--quiet"])
    print("KÖL: pulling pinned images (existing projects are untouched)", flush=True)
    run(command + ["pull"])
    print("KÖL: starting persistent private infrastructure", flush=True)
    run(command + ["up", "-d", "--wait", "--wait-timeout", "240"])
    print(json.dumps(verify(args.root, args.assets, state, env), indent=2), flush=True)
    print("Infrastructure only. No source data imported and no application switched.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (Refuse, OSError, ValueError, KeyError) as exc:
        print("STOP: " + str(exc), file=sys.stderr)
        sys.exit(1)
