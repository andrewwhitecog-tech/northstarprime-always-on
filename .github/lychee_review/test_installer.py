"""Real Linux installer/CLI tests. Transport failures are explicit fault injections.
Only the official asset route downloads real bytes; no test result is simulated.
"""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
INSTALLER = ROOT / ".github/scripts/install-lychee.sh"

class Installer(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="nsp-lychee-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bin = self.root / "shim"
        self.bin.mkdir()
        self.real_curl = shutil.which("curl")
        self.assertIsNotNone(self.real_curl)
        self.env = dict(os.environ, RUNNER_TEMP=str(self.root / "runner"),
                        GITHUB_PATH=str(self.root / "path.txt"),
                        GITHUB_OUTPUT=str(self.root / "output.txt"),
                        PATH=str(self.bin) + os.pathsep + os.environ["PATH"])
        Path(self.env["RUNNER_TEMP"]).mkdir()

    def shim(self, mode):
        code = """#!/usr/bin/env python3
import os,sys
args=sys.argv[1:]
api=any(a.startswith('https://api.github.com/repos/lycheeverse/lychee/releases/assets/') for a in args)
mode=MODE
if api and mode=='fallback':
 os.execv(REAL_CURL,[REAL_CURL]+args)
if api and mode=='corrupt':
 output=args[args.index('--output')+1]
 open(output,'wb').write(b'explicit checksum fault injection, not a release')
 sys.stdout.write('200')
 sys.exit(0)
sys.stdout.write('504')
sys.exit(22)
""".replace("MODE", repr(mode)).replace("REAL_CURL", repr(self.real_curl))
        file = self.bin / "curl"
        file.write_text(code, encoding="utf-8")
        file.chmod(0o755)

    def run_installer(self):
        result = subprocess.run(["bash", str(INSTALLER)], env=self.env,
                                capture_output=True, text=True, timeout=270)
        print(json.dumps({"test":self.id(),"exit":result.returncode,
                          "stdout":result.stdout,"stderr":result.stderr}), flush=True)
        return result

    def test_official_fallback_installs_actual_checker_and_retains_missing_link_exit(self):
        self.shim("fallback")
        result = self.run_installer()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("attempt 1/4 via direct: HTTP 504, curl exit 22", result.stdout)
        self.assertIn("attempt 2/4 via direct: HTTP 504, curl exit 22", result.stdout)
        self.assertIn("via official-asset-api: HTTP 200, curl exit 0", result.stdout)
        binary = Path(self.env["RUNNER_TEMP"]) / "nsp-lychee-0.24.2/bin/lychee"
        self.assertEqual(subprocess.check_output([str(binary), "--version"], text=True).strip(), "lychee 0.24.2")
        site = self.root / "site"
        site.mkdir()
        (site / "exists.html").write_text("<p>Real target</p>", encoding="utf-8")
        page = site / "index.html"
        page.write_text('<a href="exists.html">valid</a>', encoding="utf-8")
        command = [str(binary), "--offline", "--root-dir", str(site), str(page)]
        valid = subprocess.run(command, capture_output=True, text=True, timeout=20)
        self.assertEqual(valid.returncode, 0, valid.stdout + valid.stderr)
        page.write_text('<a href="missing.html">missing</a>', encoding="utf-8")
        missing = subprocess.run(command, capture_output=True, text=True, timeout=20)
        print(json.dumps({"real_checker_valid_exit":valid.returncode,
                          "real_checker_missing_exit":missing.returncode}), flush=True)
        self.assertEqual(missing.returncode, 2, missing.stdout + missing.stderr)

    def test_corrupt_200_response_fails_checksum_before_install(self):
        self.shim("corrupt")
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("FAILED", result.stdout)
        self.assertFalse((Path(self.env["RUNNER_TEMP"]) / "nsp-lychee-0.24.2/bin/lychee").exists())
        self.assertFalse(Path(self.env["GITHUB_OUTPUT"]).exists())

    def test_both_routes_unavailable_fails_without_checker_or_output(self):
        self.shim("unavailable")
        result = self.run_installer()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout.count("download attempt"), 4)
        self.assertIn("two direct and two official-asset API attempts", result.stderr)
        self.assertFalse(Path(self.env["GITHUB_OUTPUT"]).exists())

if __name__ == "__main__":
    unittest.main()
