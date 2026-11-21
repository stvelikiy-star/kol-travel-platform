#!/usr/bin/env python3
"""Docker CI test of a fresh private runtime; never run against source/live data."""
import importlib.util
import json
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

spec = importlib.util.spec_from_file_location("runtime", Path(__file__).with_name("kol_live_runtime.py"))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def main():
    root, assets = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    if not str(root).startswith("/tmp/kol-live-ci-"):
        raise runtime.Refuse("CI probe refuses any target outside its disposable /tmp namespace")
    state = json.loads((root / "state.json").read_text())
    env = runtime.read_env(root / "private/live.env")
    command = runtime.compose_command(root, assets)
    base = "http://127.0.0.1:54331"

    def request(path, key=None, token=None, method="GET", body=None, headers=None):
        all_headers = dict(headers or {})
        if key:
            all_headers["apikey"] = key
        if token:
            all_headers["Authorization"] = "Bearer " + token
        data = body
        if isinstance(body, dict):
            data = json.dumps(body).encode()
            all_headers["Content-Type"] = "application/json"
        req = Request(base + path, method=method, data=data, headers=all_headers)
        try:
            with urlopen(req, timeout=20) as response:
                return response.status, response.read(), dict(response.headers)
        except HTTPError as error:
            return error.code, error.read(), dict(error.headers)

    def sql(query):
        return runtime.run(command + ["exec", "-T", "db", "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c", query]).stdout.strip()

    # Assert the boot did not fabricate an application database or enable signup.
    assert sql("select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';") == "0"
    assert sql("select count(*) from auth.users;") == "0"
    assert sql("select count(*) from storage.objects;") == "0"
    assert request("/rest/v1/")[0] == 401
    assert request("/rest/v1/", "invalid-key")[0] == 401
    assert request("/pg/")[0] == 404
    assert request("/studio/")[0] == 404
    assert request("/auth/v1/health", env["ANON_KEY"])[0] == 200
    settings_code, settings_body, _ = request("/auth/v1/settings", env["ANON_KEY"])
    assert settings_code == 200
    assert json.loads(settings_body).get("disable_signup") is True
    _, _, good_cors = request("/rest/v1/", method="OPTIONS", headers={"Origin": env["KOL_SITE_ORIGIN"]})
    assert good_cors.get("Access-Control-Allow-Origin") == env["KOL_SITE_ORIGIN"]
    _, _, bad_cors = request("/rest/v1/", method="OPTIONS", headers={"Origin": "https://untrusted.example"})
    assert not bad_cors.get("Access-Control-Allow-Origin")

    owner = "10000000-0000-0000-0000-000000000001"
    other = "20000000-0000-0000-0000-000000000002"
    sql("""create table public.kol_runtime_probe (id int primary key, owner_id uuid not null, note text not null);
alter table public.kol_runtime_probe enable row level security;
grant select on public.kol_runtime_probe to anon, authenticated, service_role;
create policy owner_only on public.kol_runtime_probe for select to authenticated using ((select auth.uid()) = owner_id);
insert into public.kol_runtime_probe values (1, '10000000-0000-0000-0000-000000000001', 'persistent');
notify pgrst, 'reload schema';""")
    # Wait for PostgREST's schema-cache notification without masking failures.
    import time
    for _ in range(20):
        code, body, _ = request("/rest/v1/kol_runtime_probe?select=id", env["ANON_KEY"])
        if code == 200:
            break
        time.sleep(1)
    assert code == 200 and json.loads(body) == []
    for subject, expected in ((owner, [{"id": 1}]), (other, [])):
        token = runtime.jwt(env["JWT_SECRET"], "authenticated", subject)
        code, body, _ = request("/rest/v1/kol_runtime_probe?select=id", env["ANON_KEY"], token)
        assert code == 200 and json.loads(body) == expected
    code, body, _ = request("/rest/v1/kol_runtime_probe?select=id", env["SERVICE_ROLE_KEY"], env["SERVICE_ROLE_KEY"])
    assert code == 200 and json.loads(body) == [{"id": 1}]

    service = env["SERVICE_ROLE_KEY"]
    code, _, _ = request("/storage/v1/bucket", service, service, "POST", {"id": "runtime-probe", "name": "runtime-probe", "public": False})
    assert code in (200, 201)
    code, _, _ = request("/storage/v1/object/runtime-probe/probe.txt", service, service, "POST", b"kol-persistent-storage", {"Content-Type": "text/plain"})
    assert code in (200, 201)
    code, body, _ = request("/storage/v1/object/sign/runtime-probe/probe.txt", service, service, "POST", {"expiresIn": 300})
    assert code == 200
    signed = json.loads(body)["signedURL"]
    if signed.startswith("/object/"):
        signed = "/storage/v1" + signed
    code, body, _ = request(signed)
    assert code == 200 and body == b"kol-persistent-storage"

    before = (root / "private/live.env").read_bytes()
    runtime.run(command + ["restart", "--timeout", "30"])
    runtime.run(command + ["up", "-d", "--wait", "--wait-timeout", "240"])
    runtime.preflight(root)
    next_state, next_env = runtime.prepare(root, assets, env["KOL_API_ORIGIN"], env["KOL_SITE_ORIGIN"])
    assert next_state == state and next_env == env
    assert (root / "private/live.env").read_bytes() == before
    runtime.verify(root, assets, state, env)
    assert sql("select note from public.kol_runtime_probe where id=1;") == "persistent"
    code, body, _ = request(signed)
    assert code == 200 and body == b"kol-persistent-storage"
    print("KOL PRIVATE INFRASTRUCTURE CI PASS: JWT/RLS isolation, private Storage signed URLs, restart persistence, unchanged secrets")


if __name__ == "__main__":
    main()
