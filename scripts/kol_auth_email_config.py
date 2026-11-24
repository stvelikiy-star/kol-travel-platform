#!/usr/bin/env python3
"""Apply branded KÖL Supabase Auth emails with encrypted recovery and verification."""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

PROJECT = "sggajelagfonzpovnsiz"
API = f"https://api.supabase.com/v1/projects/{PROJECT}/config/auth"
ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / "email-templates" / "kol"
MAIL = {
    "confirmation": ("KÖL — Email тастыктоо / Подтверждение / Confirm", "confirm.html"),
    "magic_link": ("KÖL — Кирүү / Вход / Sign in", "magic-link.html"),
    "recovery": ("KÖL — Сырсөз / Пароль / Reset", "recovery.html"),
    "invite": ("KÖL — Чакыруу / Приглашение / Invitation", "invite.html"),
    "email_change": ("KÖL — Жаңы email / Новый email / Email change", "email-change.html"),
    "reauthentication": ("KÖL — Тастыктоо коду / Код / Code", "reauthentication.html"),
}
REQUIRED = {k: "{{ .Token }}" if k == "reauthentication" else "{{ .ConfirmationURL }}" for k in MAIL}
REDIRECTS = ("https://kol.on.kg/auth/callback**", "https://kol.on.kg/auth/invite**")

def request(method, token, body=None):
    payload = json.dumps(body,ensure_ascii=False).encode() if body is not None else None
    req = urllib.request.Request(API, data=payload, method=method,
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req,timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        # No body or credential details: API errors may contain sensitive configuration.
        raise RuntimeError(f"Supabase Management API {method} returned HTTP {error.code}") from None

def desired(current):
    data = {"site_url": "https://kol.on.kg"}
    existing = current.get("uri_allow_list") or ""
    prior = [x.strip() for x in existing.split(",") if x.strip()]
    for redirect in REDIRECTS:
        if redirect not in prior:
            prior.append(redirect)
    data["uri_allow_list"] = ",".join(prior)
    for kind, (subject,filename) in MAIL.items():
        html = (TEMPLATES/filename).read_text(encoding="utf-8")
        if REQUIRED[kind] not in html:
            raise ValueError(f"Missing required Supabase variable: {kind}")
        if "localhost" in html.lower() or "http://" in html.lower():
            raise ValueError(f"Nonsecure origin in template: {kind}")
        data["mailer_subjects_"+kind] = subject
        data["mailer_templates_"+kind+"_content"] = html
    return data

def encrypt_backup(current, path, passphrase):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w",encoding="utf8",prefix="kol-auth-",suffix=".json",delete=False) as f:
        temp=f.name
        os.chmod(temp,0o600)
        json.dump(current,f,ensure_ascii=False)
    try:
        env=os.environ.copy()
        env["KOL_BACKUP_PASSPHRASE"]=passphrase
        subprocess.run(["openssl","enc","-aes-256-cbc","-pbkdf2","-salt",
                        "-in",temp,"-out",str(path),"-pass","env:KOL_BACKUP_PASSPHRASE"],
                       env=env,check=True,stdout=subprocess.DEVNULL)
        os.chmod(path,0o600)
    finally:
        os.unlink(temp)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--backup-dir",default="/tmp/kol-auth-backup")
    a=ap.parse_args()
    token=os.getenv("KOL_SUPABASE_MANAGEMENT_TOKEN","")
    if not token: sys.exit("Missing management token")
    original=request("GET",token)
    if not isinstance(original,dict) or "site_url" not in original:
        sys.exit("Unexpected Supabase config response: abort")
    expected=desired(original)
    differences={k:v for k,v in expected.items() if original.get(k)!=v}
    print("Project: KÖL Production; mode:", "apply" if a.apply else "dry-run")
    print("Current site_url:",original.get("site_url","[unset]"))
    print("Target site_url: https://kol.on.kg")
    print("Changed configuration fields:",len(differences))
    if not a.apply:
        print("DRY_RUN_OK")
        return
    if not os.getenv("KOL_BACKUP_PASSPHRASE"):
        sys.exit("Missing protected backup passphrase")
    backup=Path(a.backup_dir)/"production-auth-config.json.enc"
    encrypt_backup(original,backup,os.environ["KOL_BACKUP_PASSPHRASE"])
    print("Encrypted pre-change backup saved")
    if differences:
        request("PATCH",token,differences)
    updated=request("GET",token)
    mismatch=[k for k,v in expected.items() if updated.get(k)!=v]
    if mismatch:
        # Rollback only fields changed by this script, preserve unrelated settings.
        restore={k:original.get(k) for k in differences}
        try:
            request("PATCH",token,restore)
            print("ROLLED_BACK_AFTER_VERIFICATION_FAILURE")
        except Exception:
            print("ROLLBACK_FAILED_USE_ENCRYPTED_BACKUP")
        sys.exit("VERIFICATION_FAILED: "+",".join(mismatch))
    print("VERIFIED: six KÖL templates + subjects, site URL, redirect allow list")
    print("Magic link template SHA256:",hashlib.sha256(updated["mailer_templates_magic_link_content"].encode()).hexdigest()[:16])
    print("NO_ROLES_USERS_OR_DATABASE_CHANGED")

if __name__=="__main__":
    main()
