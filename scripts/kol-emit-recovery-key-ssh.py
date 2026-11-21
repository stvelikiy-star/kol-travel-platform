#!/usr/bin/env python3
"""Private on-Ubuntu SSH endpoint for one-time Mac Keychain escrow. NEVER run in chat."""
import os
from pathlib import Path
import sys

if os.environ.get('KOL_KEY_TRANSPORT_ONLY')!='1' or not os.environ.get('SSH_CONNECTION'):
    raise SystemExit('SSH transport-only operation: local execution refused')
private=Path('/home/agent/kol-live/private/live.env')
if not private.is_file() or private.is_symlink():
    raise SystemExit('Private KOL key configuration missing')
info=private.stat()
if info.st_uid != os.getuid() or info.st_mode & 0o077:
    raise SystemExit('KOL key file ownership/permissions invalid')
values=[line.partition('=')[2].strip().strip('"').strip("'") for line in private.read_text().splitlines() if line.startswith('KOL_BACKUP_KEY=')]
if len(values)!=1 or len(values[0])<32 or '\n' in values[0]:
    raise SystemExit('KOL backup key unavailable')
# Raw key transits encrypted SSH stdout directly to macOS Keychain stdin.
# No logs, files, command-line arguments or HTTP involved.
sys.stdout.buffer.write(values[0].encode('utf-8')+b'\n')
