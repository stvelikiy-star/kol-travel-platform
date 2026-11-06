import importlib.util
import json
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('kol_commercial',Path(__file__).with_name('qa-kol-commercial-readiness.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def example(**updates):
    item={'real_stays':4,'real_rooms':34,'real_rooms_under_review':34,'real_rooms_active':0,
          'published_sellable_room_dates':0,'real_tours':0,'published_sellable_tour_slots':0,
          'demo_active_stay':1,'demo_active_tour':1,'cloud_ledger':17}
    item.update(updates)
    return item

class CommercialNoGo(unittest.TestCase):
    def test_actual_cloud_state_blocks_commercial_sale(self):
        result=m.parse_snapshot(json.dumps(example()))
        self.assertEqual(result['rooms_gate'],'NO_GO')
        self.assertEqual(result['tours_gate'],'NO_GO')
        self.assertFalse(result['production_approved'])

    def test_listing_only_never_counts_as_sellable(self):
        result=m.parse_snapshot(json.dumps(example(real_rooms_under_review=0,real_rooms_active=34)))
        self.assertEqual(result['rooms_gate'],'NO_GO')

    def test_confirmed_future_inventory_still_not_production_approval(self):
        result=m.parse_snapshot(json.dumps(example(real_rooms_under_review=0,real_rooms_active=34,
                     published_sellable_room_dates=34,real_tours=1,published_sellable_tour_slots=2)))
        self.assertEqual(result['rooms_gate'],'PASS')
        self.assertEqual(result['tours_gate'],'PASS')
        self.assertFalse(result['production_approved'])

    def test_bad_counts_fail_closed(self):
        with self.assertRaises(ValueError):
            m.parse_snapshot(json.dumps(example(real_rooms_active=100)))
        with self.assertRaises(ValueError):
            m.parse_snapshot(json.dumps(example(published_sellable_room_dates='5')))

    def test_readonly_sql_excludes_demo(self):
        self.assertIn('demo_active_stay',m.READINESS_SQL)
        self.assertIn('demo_active_tour',m.READINESS_SQL)
        self.assertIn('40000000-0000-0000-0000-000000000001',m.READINESS_SQL)
        self.assertNotIn('insert into',m.READINESS_SQL.lower())
        self.assertNotIn('update public',m.READINESS_SQL.lower())

if __name__=='__main__':unittest.main()
