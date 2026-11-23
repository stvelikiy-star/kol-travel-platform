"""KOL room lifecycle contract checks. No database connection."""
import json
from pathlib import Path
import re
import subprocess
import unittest

ROOT=Path(__file__).resolve().parents[1]
SQL=(ROOT/'supabase/schema/045_admin_room_lifecycle_DRAFT_NOT_APPLIED.sql').read_text()
VERIFY=(ROOT/'supabase/schema/045_admin_room_lifecycle_VERIFY.sql').read_text()
ACTION=(ROOT/'src/app/actions/admin/adminRoomLifecycle.ts').read_text()
UI=(ROOT/'src/app/admin/catalog/rooms/page.tsx').read_text()
PLAN=json.loads((ROOT/'supabase/staging/migration-plan.json').read_text())

class RoomLifecycleContract(unittest.TestCase):
    def test_staging_only_addendum_not_implicitly_applied(self):
        self.assertIn('NOT APPLIED',SQL)
        self.assertEqual(len(PLAN['migrations']),44)
        self.assertNotIn('045',[x['id'] for x in PLAN['migrations']])
    def test_explicit_privileged_actor_and_audit(self):
        self.assertIn("ur.role='super_admin'",SQL)
        self.assertIn('insert into public.audit_logs',SQL.lower())
        self.assertIn('pg_advisory_xact_lock',SQL)
        self.assertIn('room_idempotency_payload_conflict',SQL)
    def test_price_and_parent_status_gates(self):
        self.assertIn('v_room.price_per_night <= 0',SQL)
        self.assertIn("'NaN'",SQL)
        self.assertIn("v_partner.business_status <> 'online'",SQL)
        self.assertIn('v_stay.business_id is distinct from v_room.business_id',SQL)
        self.assertIn('demo_room_not_commercial',SQL)
    def test_no_transaction_or_inventory_mutations(self):
        for text in ('update public.bookings','update public.room_availability','update public.payments',
                     'delete from public.bookings','insert into public.room_availability'):
            self.assertNotIn(text,SQL.lower())
    def test_read_scope_and_direct_write_denial(self):
        self.assertIn("public.has_role('super_admin')",SQL)
        self.assertIn('revoke insert, update, delete on table public.rooms',SQL)
        self.assertIn('direct room DML must remain denied',VERIFY)
        self.assertIn('SECURITY INVOKER',VERIFY)
    def test_room_uuid_validator_accepts_postgres_uuid_and_rejects_malformed(self):
        # Execute the regex directly from the TypeScript server action in Node,
        # rather than duplicating validation logic in this Python test.
        match=re.search(r"(?m)^const uuid = (/.+/i);$",ACTION)
        self.assertIsNotNone(match,"room lifecycle must expose explicit UUID validator")
        script=(
            "const source=process.argv[1]; const slash=source.lastIndexOf('/'); "
            "const regex=new RegExp(source.slice(1,slash),source.slice(slash+1)); "
            "const good=["
            "'550e8400-e29b-41d4-a716-446655440000',"
            "'01948f4e-8f70-7f10-8c18-0e3c9a12df76',"
            "'550E8400-E29B-41D4-A716-446655440000']; "
            "const bad=["
            "'550e8400-e29b-41d4-446655440000',"
            "'550e8400-e29b-41d4-a716-44665544000',"
            "'550e8400-e29b-41d4-a716-446655440000x',"
            "'550e8400-e29b-41d4-a716-446655440000/../']; "
            "if(!good.every(x=>regex.test(x)) || bad.some(x=>regex.test(x))) "
            "process.exit(1);"
        )
        run=subprocess.run(["node","-e",script,match.group(1)],
                           cwd=ROOT,capture_output=True,text=True,timeout=10)
        self.assertEqual(run.returncode,0,run.stderr)

    def test_ui_server_action_stays_scoped(self):
        self.assertIn('await requireSuperAdmin()',ACTION)
        self.assertIn('supabase.rpc("admin_room_lifecycle_atomic"',ACTION)
        self.assertIn('reason_required',ACTION)
        self.assertIn('adminRoomLifecycleFormAction',UI)
        self.assertIn('price > 0',UI)
        self.assertIn('demoStay',UI)
        self.assertIn('Массовое одобрение исключено',UI)

if __name__=='__main__':
    unittest.main()
