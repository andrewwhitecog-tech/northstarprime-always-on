"""Synthetic summary-format fixtures; not link-check or audience results."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / "scripts/lychee-summary.py"
spec = importlib.util.spec_from_file_location("lychee_summary", SOURCE)
summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summary)

class SummaryTests(unittest.TestCase):
    def run_report(self, raw):
        with tempfile.TemporaryDirectory() as temp:
            report = Path(temp) / "out.md"
            report.write_bytes(raw)
            actual = summary.summarize(report, 2)
            self.assertEqual(report.read_bytes(), raw, "full artifact must remain unchanged")
            return actual

    def test_small_report_retains_actual_nonzero_exit_and_every_finding(self):
        raw = b"# SYNTHETIC fixture\n| Errors | 7 |\n* missing target\n"
        actual = self.run_report(raw)
        self.assertIn("Checker exit code: **2**", actual)
        self.assertIn("report-only", actual)
        self.assertIn(raw.decode(), actual)
        self.assertNotIn("Preview truncated", actual)

    def test_report_over_one_megabyte_has_valid_utf8_bounded_preview(self):
        raw = ("# SYNTHETIC Unicode fixture\n" + "\U0001f441\u00e9\u6f22" * 200_000).encode("utf-8")
        self.assertGreater(len(raw), 1_048_576)
        actual = self.run_report(raw)
        self.assertLess(len(actual.encode("utf-8")), 600_000)
        self.assertEqual(actual.encode("utf-8").decode("utf-8"), actual)
        self.assertNotIn("\ufffd", actual)
        self.assertIn("Preview truncated", actual)
        self.assertIn("Checker exit code: **2**", actual)

    def test_empty_report_fails_instead_of_creating_acceptance(self):
        with self.assertRaises(ValueError):
            self.run_report(b"")

if __name__ == "__main__":
    unittest.main(verbosity=2)
