import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('checker', Path(__file__).with_name('check-kol-managed-copy-columns.py'))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

class ManagedCopyCompatibility(unittest.TestCase):
    def test_matching_managed_columns(self):
        source = 'COPY "auth"."users" ("id", "email") FROM stdin;\n\\.\n'
        catalog = 'auth\tusers\tid\nauth\tusers\temail\n'
        self.assertEqual(checker.incompatibilities(source, catalog), [])

    def test_missing_auth_column_is_detected(self):
        source = 'COPY "auth"."audit_log_entries" ("id", "ip_address") FROM stdin;'
        catalog = 'auth\taudit_log_entries\tid\n'
        self.assertEqual(checker.incompatibilities(source,catalog), [('auth','audit_log_entries',['ip_address'])])

    def test_missing_storage_table_is_detected(self):
        source = 'COPY "storage"."objects" ("id") FROM stdin;'
        self.assertEqual(checker.incompatibilities(source,''), [('storage','objects',['id'])])

    def test_public_tables_are_restored_by_schema_sql(self):
        source = 'COPY "public"."bookings" ("id") FROM stdin;'
        self.assertEqual(checker.incompatibilities(source,''), [])

if __name__ == '__main__':
    unittest.main()
