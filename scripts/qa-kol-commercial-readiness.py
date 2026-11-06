#!/usr/bin/env python3
"""KOL read-only commercial catalog readiness snapshot; not a production promotion command."""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
import os
from pathlib import Path
import subprocess

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('partner_inventory',HERE/'prepare-kol-partner-inventory.py')
inventory=importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)

READINESS_SQL="""
select json_build_object(
 'real_stays',(select count(*) from public.stays where id <> '41000000-0000-0000-0000-000000000001'::uuid),
 'real_rooms',(select count(*) from public.rooms where stay_id <> '41000000-0000-0000-0000-000000000001'::uuid),
 'real_rooms_under_review',(select count(*) from public.rooms where stay_id <> '41000000-0000-0000-0000-000000000001'::uuid and status='under_review'),
 'real_rooms_active',(select count(*) from public.rooms where stay_id <> '41000000-0000-0000-0000-000000000001'::uuid and status='active'),
 'published_sellable_room_dates',(select count(*) from public.room_availability a join public.rooms r on r.id=a.room_id where r.stay_id <> '41000000-0000-0000-0000-000000000001'::uuid and r.status='active' and a.status='available' and a.available_count>0 and a.date>=current_date),
 'real_tours',(select count(*) from public.tours where id <> '40000000-0000-0000-0000-000000000001'::uuid),
 'published_sellable_tour_slots',(select count(*) from public.tour_schedules ts join public.tours t on t.id=ts.tour_id where t.id <> '40000000-0000-0000-0000-000000000001'::uuid and t.status='active' and ts.status='available' and ts.capacity>ts.booked_count and ts.date>=current_date),
 'demo_active_stay',(select count(*) from public.stays where id='41000000-0000-0000-0000-000000000001'::uuid and status='active'),
 'demo_active_tour',(select count(*) from public.tours where id='40000000-0000-0000-0000-000000000001'::uuid and status='active'),
 'cloud_ledger',(select count(*) from supabase_migrations.schema_migrations)
);
"""

def parse_snapshot(value):
    result=json.loads(value)
    fields=['real_stays','real_rooms','real_rooms_under_review','real_rooms_active','published_sellable_room_dates',
            'real_tours','published_sellable_tour_slots','demo_active_stay','demo_active_tour','cloud_ledger']
    if not isinstance(result,dict) or any(type(result.get(field)) is not int or result[field]<0 for field in fields):
        raise ValueError('Invalid commercial snapshot')
    if result['real_rooms_active']+result['real_rooms_under_review']>result['real_rooms']:
        raise ValueError('Inconsistent room status counts')
    result['rooms_gate']='PASS' if result['real_rooms_active']>0 and result['published_sellable_room_dates']>0 and result['real_rooms_under_review']==0 else 'NO_GO'
    result['tours_gate']='PASS' if result['real_tours']>0 and result['published_sellable_tour_slots']>0 else 'NO_GO'
    result['production_approved']=False
    return result

def snapshot(connection):
    env={**os.environ,'PGOPTIONS':'-c default_transaction_read_only=on','PGCONNECT_TIMEOUT':'15'}
    p=subprocess.run(['psql',connection,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-c',READINESS_SQL],env=env,capture_output=True,text=True)
    if p.returncode:
        raise RuntimeError('Commercial snapshot query failed; no cloud write attempted')
    return parse_snapshot(p.stdout.strip())

def main():
    a=argparse.ArgumentParser()
    a.add_argument('--source-env',required=True)
    a.add_argument('--output-json',required=True)
    args=a.parse_args()
    result=snapshot(inventory.cloud_connection(args.source_env))
    result['checked_at']=datetime.now(timezone.utc).isoformat()
    dest=Path(args.output_json)
    if dest.exists() or not dest.parent.is_dir():
        raise ValueError('Refusing overwrite or invalid report directory')
    dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    dest.chmod(0o600)
    print('KOL_COMMERCIAL_ROOM_GATE',result['rooms_gate'])
    print('KOL_COMMERCIAL_TOUR_GATE',result['tours_gate'])
    print('REAL_STAYS',result['real_stays'],'ROOMS',result['real_rooms'],'UNDER_REVIEW',result['real_rooms_under_review'])
    print('PUBLISHED_FUTURE_ROOM_DATES',result['published_sellable_room_dates'])
    print('REAL_TOURS',result['real_tours'],'PUBLISHED_FUTURE_TOUR_SLOTS',result['published_sellable_tour_slots'])
    print('CLOUD_DATABASE_UNCHANGED')

if __name__=='__main__':main()
