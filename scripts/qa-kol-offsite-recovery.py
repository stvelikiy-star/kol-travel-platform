#!/usr/bin/env python3
"""KOL off-host encrypted backup recovery drill. No DB writes or secret logging."""
import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess
import tarfile
import tempfile

def sha256(path):
    digest=hashlib.sha256()
    with path.open('rb') as item:
        for chunk in iter(lambda:item.read(1024*1024),b''):
            digest.update(chunk)
    return digest.hexdigest()

def run(args,**kwargs):
    result=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,**kwargs)
    if result.returncode:
        raise RuntimeError('Recovery tool '+args[0]+' failed (exit '+str(result.returncode)+')')
    return result.stdout

def verify_backup_tar(archive):
    members=archive.getmembers()
    if not members or any((not m.isfile() and not m.isdir()) or m.name.startswith('/') or '..' in Path(m.name).parts for m in members):
        raise RuntimeError('Invalid or unsafe archive member')
    checksum=[m for m in members if m.isfile() and len(Path(m.name).parts)==2 and Path(m.name).name=='SHA256SUMS']
    if len(checksum)!=1:
        raise RuntimeError('Expected one top-level checksum manifest')
    manifest_text=archive.extractfile(checksum[0]).read().decode()
    folder=Path(checksum[0].name).parent
    verified=0
    for line in manifest_text.splitlines():
        match=re.fullmatch(r'([0-9a-f]{64})\s+(.+)',line)
        if not match or match[2].startswith('/') or '..' in Path(match[2]).parts:
            raise RuntimeError('Invalid checksum entry')
        filename=(folder/match[2]).as_posix()
        member=archive.getmember(filename)
        if not member.isfile() or hashlib.sha256(archive.extractfile(member).read()).hexdigest()!=match[1]:
            raise RuntimeError('Archive entry checksum mismatch')
        verified+=1
    if verified!=10:
        raise RuntimeError('Backup manifest must contain exactly 10 checksums')
    return verified

def drill(key,repo,tag,asset,expected_hash):
    if len(key)<32:
        raise ValueError('Recovery key is missing or too short')
    if not re.fullmatch(r'[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+',repo):
        raise ValueError('Invalid recovery repository')
    if not re.fullmatch(r'[a-zA-Z0-9_.-]+',tag) or not re.fullmatch(r'[a-zA-Z0-9_.-]+\.tar\.gpg',asset):
        raise ValueError('Invalid release/asset name')
    if not re.fullmatch('[0-9a-f]{64}',expected_hash):
        raise ValueError('Invalid expected checksum')
    visibility=run(['gh','repo','view',repo,'--json','visibility','--jq','.visibility'],text=True).strip()
    if visibility!='PRIVATE':
        raise RuntimeError('Recovery repository is not private')
    with tempfile.TemporaryDirectory(prefix='kol-offsite-drill-') as temp:
        base=Path(temp)
        for pattern in (asset,asset+'.sha256'):
            run(['gh','release','download',tag,'--repo',repo,'--dir',str(base),'--pattern',pattern],text=True)
        encrypted=base/asset
        checksum_lines=(base/(asset+'.sha256')).read_text().split()
        if len(checksum_lines)!=2 or checksum_lines[1]!=asset or not re.fullmatch('[0-9a-f]{64}',checksum_lines[0]):
            raise RuntimeError('Invalid remote encrypted checksum manifest')
        digest=sha256(encrypted)
        if digest!=checksum_lines[0] or digest!=expected_hash:
            raise RuntimeError('Remote encrypted archive checksum mismatch')
        plain=base/'decoded.tar'
        # GPG password is passed only via stdin; it is never logged or stored in Git.
        run(['gpg','--batch','--yes','--pinentry-mode','loopback','--passphrase-fd','0',
             '--decrypt','--output',str(plain),str(encrypted)],input=(key+'\n').encode())
        with tarfile.open(plain,'r') as archive:
            verified=verify_backup_tar(archive)
        print('KOL_OFFHOST_ENCRYPTED_ARCHIVE_RECOVERY_PASS')
        print('REMOTE_ASSET_SHA256',digest)
        print('BACKUP_FILES_VERIFIED',verified)
        print('KEY_ESCROW_INDEPENDENT_OF_UBUNTU_NOT_CONFIRMED')

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--repo',required=True)
    parser.add_argument('--tag',required=True)
    parser.add_argument('--asset',required=True)
    parser.add_argument('--expected-sha256',required=True)
    parser.add_argument('--private-key-env-file',required=True)
    args=parser.parse_args()
    secret=Path(args.private_key_env_file)
    if not secret.is_file() or secret.stat().st_mode & 0o077:
        raise SystemExit('Private key file missing or permissions too permissive')
    keys=[s.partition('=')[2] for s in secret.read_text().splitlines() if s.startswith('KOL_BACKUP_KEY=')]
    if len(keys)!=1:
        raise SystemExit('Expected exactly one private key')
    drill(keys[0],args.repo,args.tag,args.asset,args.expected_sha256)
