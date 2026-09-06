import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
import check_public_availability as monitor


class Response(io.BytesIO):
    status = 200
    headers = {"Content-Type": "text/html"}

    def geturl(self):
        return "https://northstarprime.net/"


class AvailabilityTests(unittest.TestCase):
    def test_502_is_recorded_without_body_disclosure(self):
        error = HTTPError("https://northstarprime.net/", 502, "Bad Gateway", {}, io.BytesIO(b"error body"))
        with patch.object(monitor.urllib.request, "urlopen", side_effect=error):
            result = monitor.probe(monitor.CHECKS[0])
        self.assertFalse(result["ok"])
        self.assertEqual(result["status"], 502)
        self.assertNotIn("error body", json.dumps(result))

    def test_html_200_redirect_stub_is_not_healthy_static_content(self):
        raw = b'<html>NorthStar<meta http-equiv="refresh" content="0;url=https://app.northstarprime.net/"></html>'
        with patch.object(monitor.urllib.request, "urlopen", return_value=Response(raw)):
            self.assertFalse(monitor.probe(monitor.CHECKS[0])["ok"])

    def test_media_200_error_html_is_failure(self):
        with patch.object(monitor.urllib.request, "urlopen", return_value=Response(b"<html>error</html>")):
            self.assertFalse(monitor.probe(("video", "https://northstarprime.net/", "video"))["ok"])

    def test_healthy_request_is_anonymous_get_with_bounded_timeout(self):
        with patch.object(monitor.urllib.request, "urlopen", return_value=Response(b"<html>NorthStar</html>")) as request:
            self.assertTrue(monitor.probe(monitor.CHECKS[0])["ok"])
        args, kwargs = request.call_args
        self.assertEqual(args[0].get_method(), "GET")
        self.assertNotIn("Authorization", args[0].headers)
        self.assertEqual(kwargs["timeout"], 8)

    def test_failure_recovery_history_preserves_sampling_uncertainty(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def sample(stamp, ok):
                return {"checked": stamp, "checks": [{"name": "home", "ok": ok}]}
            monitor.record(root, sample("2026-09-06T01:00:00+00:00", True))
            failure = monitor.record(root, sample("2026-09-06T01:01:00+00:00", False))
            self.assertEqual(len(failure), 1)
            self.assertEqual(monitor.record(root, sample("2026-09-06T01:02:00+00:00", False)), [])
            recovery = monitor.record(root, sample("2026-09-06T01:03:00+00:00", True))
            self.assertEqual(recovery[0]["first_failed_sample"], "2026-09-06T01:01:00+00:00")
            self.assertNotIn("downtime_seconds", recovery[0])
            self.assertEqual(len((root / "incidents.jsonl").read_text().splitlines()), 2)
            self.assertEqual(json.loads((root / "incidents.json").read_text())["active"], {})


if __name__ == "__main__":
    unittest.main()
