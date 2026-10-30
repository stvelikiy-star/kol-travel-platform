#!/usr/bin/env python3
"""Deterministic delivery bundle of the existing, reviewed migration package."""
import hashlib
import json
from pathlib import Path
import re
import zlib

root = Path(__file__).resolve().parent.parent
plan = json.loads((root/'supabase/staging/migration-plan.json').read_text())
paths = {plan['preflight'],plan['postflight'],'supabase/staging/restored_role_isolation_TEST.sql'}
for step in plan['migrations']:
    paths.add(step['apply']);paths.update(step['verify'])
rehearsal=(root/'scripts/run-live-backup-restore-rehearsal-ci.sh').read_text()
backup=(root/'scripts/backup-live-supabase.sh').read_text()
package={
 'source_commit':'4b4926c07342bad91fa7ef74e2e8ae6a38897cc2',
 'plan':plan,
 'files':{name:(root/name).read_text() for name in sorted(paths)},
 'managed_gate':re.search(r'DO \$kol_gate\$.*?\$kol_gate\$;',rehearsal,re.S)[0],
 'preserve_sql':re.search(r'PRESERVE_SQL="(.*?)"\n',rehearsal,re.S)[1]+';\n',
 'security_gate':re.search(r'DO \$\$.*?\$\$;',rehearsal.split('# Machine gate for')[1],re.S)[0],
 'baseline_sql':backup.split("<<'SQL'\n",1)[1].split('\nSQL\n',1)[0]+'\n',
}
assert len(plan['migrations'])==43
assert sum(len(x['verify']) for x in plan['migrations'])==72
raw=json.dumps(package,sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
data=zlib.compress(raw,9)
path=root/'ops/ubuntu/live/migration-bundle.json.zlib';path.write_bytes(data)
print(hashlib.sha256(data).hexdigest())
