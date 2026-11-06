#!/usr/bin/env python3
"""Read-only inventory confirmation worksheet for real KOL partners. Never publishes availability."""
import argparse
import csv
from datetime import date, datetime, timedelta, timezone
import io
import math
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

DEMO_STAY='41000000-0000-0000-0000-000000000001'
DEMO_TOUR='40000000-0000-0000-0000-000000000001'
PROJECT='mphruawzozrpwcjgejhs'
ROOM_HEADERS=['room_id','stay_id','partner','stay','room','room_status','listed_price_kgs_unverified','price_review_required','date','available_count','confirmed_price_kgs','partner_confirmed_by','partner_confirmed_at']
TOUR_HEADERS=['tour_id','partner','tour','date','time','capacity','confirmed_price_kgs','partner_confirmed_by','partner_confirmed_at']
ROOM_SQL="""select r.id::text as room_id,s.id::text as stay_id,p.title as partner,s.title as stay,r.title as room,r.status as room_status,r.price_per_night::text as listed_price_kgs_unverified
from public.rooms r join public.stays s on s.id=r.stay_id join public.partners p on p.id=r.business_id and p.id=s.business_id
where s.id <> '41000000-0000-0000-0000-000000000001'::uuid and r.status in ('active','under_review')
and s.status='active' and p.status='approved' and p.business_status='online'
order by p.title,s.title,r.title,r.id;"""
TOUR_SQL="""select t.id::text as tour_id,p.title as partner,t.title as tour
from public.tours t join public.partners p on p.id=t.business_id
where t.id <> '40000000-0000-0000-0000-000000000001'::uuid
and t.status='active' and p.status='approved' and p.business_status='online'
order by p.title,t.title,t.id;"""

def cloud_connection(file):
    p=Path(file)
    if not p.is_file() or p.stat().st_mode & 0o077:
        raise ValueError('Source credentials absent or permissions too broad')
    values=[line.partition('=')[2].strip().strip('"').strip("'") for line in p.read_text().splitlines() if line.startswith('KOL_DATABASE_URL=')]
    if len(values)!=1:
        raise ValueError('Missing unique KOL_DATABASE_URL')
    target=urlsplit(values[0])
    if PROJECT not in ((target.hostname or '')+(target.username or '')):
        raise ValueError('Source project differs from verified KOL cloud')
    return values[0]

def read_csv_query(connection, query):
    env={**os.environ,'PGOPTIONS':'-c default_transaction_read_only=on','PGCONNECT_TIMEOUT':'15'}
    p=subprocess.run(['psql',connection,'-X','-q','--csv','-v','ON_ERROR_STOP=1','-c',query],env=env,capture_output=True,text=True)
    if p.returncode:
        raise RuntimeError('Cloud read-only query failed; source not modified')
    return list(csv.DictReader(io.StringIO(p.stdout)))

def write_sheet(path,headers,rows):
    if path.exists():
        raise ValueError('Refusing to overwrite existing inventory sheet')
    with path.open('x',newline='',encoding='utf-8') as f:
        os.chmod(path,0o600)
        writer=csv.DictWriter(f,fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)

def create(connection,outdir):
    root=Path(outdir)
    if root.exists():
        raise ValueError('Target worksheet directory already exists')
    rooms=read_csv_query(connection,ROOM_SQL)
    tours=read_csv_query(connection,TOUR_SQL)
    if len(rooms)!=34 or tours:
        raise ValueError('Unexpected business inventory: source drift; human review required')
    if len({r['room_id'] for r in rooms})!=len(rooms) or any(not r['partner'] or not r['room_id'] for r in rooms):
        raise ValueError('Corrupt source inventory identifiers')
    root.mkdir(mode=0o700,parents=True)
    for row in rooms:
        row['price_review_required']='YES' if float(row['listed_price_kgs_unverified'])<=0 else 'NO'
        for key in ROOM_HEADERS[8:]:
            row[key]=''
    write_sheet(root/'rooms_partner_confirmation.csv',ROOM_HEADERS,rooms)
    write_sheet(root/'tours_partner_confirmation.csv',TOUR_HEADERS,[])
    print('KOL_PARTNER_WORKSHEET_PASS rooms=34 real_tours=0')
    print('CONFIRMED_DATES=0; nothing has been published')

def validate_rooms(path):
    with Path(path).open(newline='',encoding='utf-8') as f:
        reader=csv.DictReader(f)
        if reader.fieldnames!=ROOM_HEADERS:
            raise ValueError('Unexpected room confirmation CSV columns')
        rows=list(reader)
    if not rows:
        raise ValueError('No room inventory submitted')
    seen=set()
    now=date.today()
    confirmed=0
    for row in rows:
        fields=['date','available_count','partner_confirmed_by','partner_confirmed_at']
        nonempty=[bool(row[key].strip()) for key in fields]
        if any(nonempty) and not all(nonempty):
            raise ValueError('Partial partner confirmation')
        if not any(nonempty):
            continue
        chosen=date.fromisoformat(row['date'])
        if chosen < now or chosen > now + timedelta(days=365):
            raise ValueError('Date outside valid future window')
        count=int(row['available_count'])
        if count<=0 or count>1000:
            raise ValueError('Invalid confirmed room capacity')
        confirmed_at=datetime.fromisoformat(row['partner_confirmed_at'])
        if confirmed_at.tzinfo is None or confirmed_at.astimezone(timezone.utc)>datetime.now(timezone.utc):
            raise ValueError('Confirmation timestamp missing timezone or in future')
        source_price=float(row['listed_price_kgs_unverified'])
        if not math.isfinite(source_price):
            raise ValueError('Invalid source price')
        expected_flag='YES' if source_price<=0 else 'NO'
        if row['price_review_required']!=expected_flag:
            raise ValueError('Source price review flag was altered')
        if expected_flag=='YES' and not row['confirmed_price_kgs'].strip():
            raise ValueError('Confirmed price is required for invalid source price')
        if row['confirmed_price_kgs'].strip():
            price=float(row['confirmed_price_kgs'])
            if not math.isfinite(price) or price<=0:
                raise ValueError('Invalid confirmed room price')
        key=(row['room_id'],row['date'])
        if key in seen:
            raise ValueError('Duplicate room/date')
        seen.add(key)
        confirmed+=1
    if confirmed==0:
        raise ValueError('No partner-confirmed dates; publication forbidden')
    print('ROOM_CONFIRMATIONS_STRUCTURALLY_VALID',confirmed)
    print('STRUCTURE_ONLY: owner authentication and business confirmation still required')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source-env')
    parser.add_argument('--output-dir')
    parser.add_argument('--validate-rooms')
    args=parser.parse_args()
    if args.validate_rooms:
        validate_rooms(args.validate_rooms)
    elif args.source_env and args.output_dir:
        create(cloud_connection(args.source_env),args.output_dir)
    else:
        parser.error('Provide --source-env with --output-dir, or --validate-rooms')

if __name__=='__main__':
    main()
