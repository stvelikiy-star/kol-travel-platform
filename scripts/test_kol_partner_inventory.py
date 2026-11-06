import csv
from datetime import datetime, timedelta, timezone
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('kol_inventory',Path(__file__).with_name('prepare-kol-partner-inventory.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class InventoryReadiness(unittest.TestCase):
    def fixture_rows(self):
        return [
            {'room_id':f'r{i}','stay_id':'s1','partner':'Example','stay':'Example hotel',
             'room':f'Room {i}','room_status':'under_review','listed_price_kgs_unverified':'5000',
             'date':'','available_count':'','confirmed_price_kgs':'',
             'partner_confirmed_by':'','partner_confirmed_at':''}
            for i in range(34)
        ]
    def write_rows(self,path,rows):
        with path.open('w',newline='',encoding='utf-8') as f:
            w=csv.DictWriter(f,fieldnames=m.ROOM_HEADERS)
            w.writeheader()
            w.writerows(rows)
    def test_no_fake_confirmations(self):
        with TemporaryDirectory() as t:
            f=Path(t)/'rooms.csv'
            self.write_rows(f,self.fixture_rows())
            with self.assertRaisesRegex(ValueError,'No partner-confirmed'):
                m.validate_rooms(f)
    def test_duplicate_dates_refused(self):
        with TemporaryDirectory() as t:
            f=Path(t)/'rooms.csv'
            rows=self.fixture_rows()
            d=(datetime.now(timezone.utc)+timedelta(days=2)).date().isoformat()
            for row in rows[:2]:
                row.update({'room_id':'same-room','date':d,'available_count':'1','partner_confirmed_by':'partner','partner_confirmed_at':datetime.now(timezone.utc).isoformat()})
            self.write_rows(f,rows)
            with self.assertRaisesRegex(ValueError,'Duplicate'):
                m.validate_rooms(f)
    def test_partial_partner_confirmation_refused(self):
        with TemporaryDirectory() as t:
            f=Path(t)/'rooms.csv'
            rows=self.fixture_rows()
            rows[0]['date']=(datetime.now(timezone.utc)+timedelta(days=2)).date().isoformat()
            self.write_rows(f,rows)
            with self.assertRaisesRegex(ValueError,'Partial'):
                m.validate_rooms(f)
    def test_verified_structure_does_not_publish(self):
        with TemporaryDirectory() as t:
            f=Path(t)/'rooms.csv'
            rows=self.fixture_rows()
            rows[0].update({
                'date':(datetime.now(timezone.utc)+timedelta(days=2)).date().isoformat(),
                'available_count':'1','partner_confirmed_by':'partner',
                'partner_confirmed_at':datetime.now(timezone.utc).isoformat()})
            self.write_rows(f,rows)
            m.validate_rooms(f)
    def test_read_only_live_sql_excludes_demo(self):
        self.assertIn(m.DEMO_STAY,m.ROOM_SQL)
        self.assertIn(m.DEMO_TOUR,m.TOUR_SQL)
        self.assertIn('under_review',m.ROOM_SQL)
        self.assertNotIn('INSERT',m.ROOM_SQL.upper())
        self.assertNotIn('UPDATE',m.ROOM_SQL.upper())

if __name__=='__main__':unittest.main()
