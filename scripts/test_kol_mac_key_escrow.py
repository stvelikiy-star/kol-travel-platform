import subprocess
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parent

class MacBackupEscrowGate(unittest.TestCase):
    def test_key_exporter_refuses_untrusted_local_execution(self):
        p=subprocess.run(['python3',str(ROOT/'kol-emit-recovery-key-ssh.py')],
                         capture_output=True,text=True)
        self.assertNotEqual(p.returncode,0)
        self.assertEqual(p.stdout,'')
        self.assertIn('SSH transport-only',p.stderr)
    def test_mac_script_requires_valid_shell(self):
        p=subprocess.run(['bash','-n',str(ROOT/'kol-mac-escrow-from-ubuntu.sh')],
                         capture_output=True,text=True)
        self.assertEqual(p.returncode,0,p.stderr)
    def test_keychain_uses_device_only_and_readback(self):
        swift=(ROOT/'kol-mac-recovery-keychain.swift').read_text()
        self.assertIn('kSecAttrAccessibleWhenUnlockedThisDeviceOnly',swift)
        self.assertIn('SecItemCopyMatching',swift)
        self.assertIn('stored == secretData',swift)
        self.assertIn('recovered == secretData',swift)
        self.assertNotIn('print(secret)',swift)
    def test_ssh_pipe_uses_strict_host_key_check_and_stdin(self):
        shell=(ROOT/'kol-mac-escrow-from-ubuntu.sh').read_text()
        self.assertIn('StrictHostKeyChecking=yes',shell)
        self.assertIn('BatchMode=yes',shell)
        self.assertIn('| "$TMP/kol-keychain"',shell)
        self.assertNotIn('echo "$',shell)

if __name__=='__main__':unittest.main()
