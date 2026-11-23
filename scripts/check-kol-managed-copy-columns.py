#!/usr/bin/env python3
"""Fail closed before restore when Supabase-managed COPY columns are unavailable."""
import re
import sys
from pathlib import Path

COPY = re.compile(r'^COPY "([^"]+)"\."([^"]+)" \(([^\n]+)\) FROM stdin;$')
MANAGED = {'auth', 'storage'}

def incompatibilities(dump: str, catalog: str):
    known = {}
    for line in catalog.splitlines():
        parts = line.split('\t')
        if len(parts) == 3:
            known.setdefault((parts[0], parts[1]), set()).add(parts[2])
    diffs = []
    for line in dump.splitlines():
        match = COPY.match(line)
        if not match or match[1] not in MANAGED:
            continue
        schema, table, fields = match.groups()
        required = {v.strip().strip('"') for v in fields.split(',')}
        absent = required - known.get((schema, table), set())
        if absent:
            diffs.append((schema, table, sorted(absent)))
    return diffs

def main():
    if len(sys.argv) != 3:
        raise SystemExit('usage: check-kol-managed-copy-columns.py <source-data.sql> <target-catalog.tsv>')
    dump = Path(sys.argv[1]).read_text()
    if not any((m := COPY.match(line)) and m[1] in MANAGED for line in dump.splitlines()):
        raise SystemExit('Managed Auth/Storage COPY manifest missing; refusing unverified restore')
    diffs = incompatibilities(dump, Path(sys.argv[2]).read_text())
    if diffs:
        for schema, table, cols in diffs:
            print(f'MANAGED_SCHEMA_MISMATCH {schema}.{table}: missing {", ".join(cols)}', file=sys.stderr)
        raise SystemExit(2)
    print('KOL_MANAGED_COPY_COLUMNS_COMPATIBLE_PASS')

if __name__ == '__main__':
    main()
