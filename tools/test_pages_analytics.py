#!/usr/bin/env python3
"""Exercise analytics on real transformed HTML; optionally check a built artifact."""

import argparse
import hashlib
import sys
import unittest
from pathlib import Path

import build_pages_artifact as builder

ROOT = Path(__file__).resolve().parents[1]
BEACON = "static.cloudflareinsights.com/beacon.min.js"
PRIVACY_PAGES = (
    "mature/games/strip-signal/index.html",
    "mature/games/afterglow-poker-lite/index.html",
    "idr/signal-refrains/volume-01/index.html",
    "idr/signal-refrains/the-distance-learns-my-name/index.html",
)
EXISTING_EXCLUSIONS = (
    "chronosphere/index.html",
    "idc/season-3/index.html",
    "arcade/custom/side-street/index.html",
    "arcade/custom/logic-foundry/index.html",
    "arcade/custom/ladder/index.html",
    "manga/index.html",
)
ARTIFACT = None


class AnalyticsPrivacy(unittest.TestCase):
    def assert_private(self, html, name):
        self.assertIn("no analytics", html.lower(), name)
        self.assertNotIn(BEACON, html, name)
        self.assertNotIn("data-cf-beacon", html, name)
        if name == "mature/games/afterglow-poker-lite/index.html":
            self.assertIn("no prizes, ads, outside connections", html.lower())

    def test_real_privacy_pages_remain_unchanged_after_injection(self):
        for name in PRIVACY_PAGES:
            with self.subTest(page=name):
                path = ROOT / name
                before = path.read_bytes()
                source = path.read_text(encoding="utf-8")
                self.assertRegex(source, builder._HEAD_CLOSE)
                self.assert_private(source, name)
                transformed = builder.inject_cf_web_analytics(source, Path(name))
                self.assert_private(transformed, name)
                self.assertEqual(transformed, source)
                self.assertEqual(hashlib.sha256(path.read_bytes()).digest(),
                                 hashlib.sha256(before).digest())
                if ARTIFACT is not None:
                    self.assert_private((ARTIFACT / name).read_text(encoding="utf-8"), name)

    def test_eligible_real_page_receives_exactly_one_beacon(self):
        name = Path("index.html")
        source = (ROOT / name).read_text(encoding="utf-8")
        self.assertNotIn(BEACON, source)
        transformed = builder.inject_cf_web_analytics(source, name)
        self.assertEqual(transformed.count(BEACON), 1)
        self.assertIn(builder.CF_WEB_ANALYTICS_BEACON, transformed)
        self.assertLess(transformed.index(BEACON),
                        builder._HEAD_CLOSE.search(transformed).start())
        self.assertEqual(builder.inject_cf_web_analytics(transformed, name), transformed)
        if ARTIFACT is not None:
            self.assertEqual((ARTIFACT / name).read_text(encoding="utf-8").count(BEACON), 1)

    def test_existing_exclusions_stay_unchanged(self):
        source = "<html><head></head><body>Frozen release</body></html>"
        for name in EXISTING_EXCLUSIONS:
            with self.subTest(page=name):
                self.assertEqual(builder.inject_cf_web_analytics(source, Path(name)), source)

    def test_nonexcluded_neighbor_still_gets_analytics(self):
        source = "<html><head></head><body></body></html>"
        for name in ("mature/games/other/index.html", "idr/signal-refrains/index.html"):
            with self.subTest(page=name):
                self.assertEqual(builder.inject_cf_web_analytics(source, Path(name)).count(BEACON), 1)

    def test_non_html_tools_and_missing_head_are_unchanged(self):
        for name, source in (("page.js", "</head>"), ("tools/page.html", "</head>"),
                             ("page.html", "<body>No head</body>")):
            with self.subTest(page=name):
                self.assertEqual(builder.inject_cf_web_analytics(source, Path(name)), source)

    def test_page_level_opt_out_markers_and_promises_stay_unchanged(self):
        cases = (
            ("idr/signal-refrains/volume-02/index.html",
             '<html><head><meta name="nsp-analytics" content="off"></head><body>Chapter</body></html>'),
            ("idr/signal-refrains/volume-03/index.html",
             '<html data-no-analytics><head></head><body>Chapter</body></html>'),
            ("idr/signal-refrains/new-single/index.html",
             "<html><head></head><body><footer>No analytics or tracking on this page.</footer></body></html>"),
        )
        for name, source in cases:
            with self.subTest(page=name):
                self.assertEqual(builder.inject_cf_web_analytics(source, Path(name)), source)
                self.assertNotIn(BEACON, builder.inject_cf_web_analytics(source, Path(name)))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--artifact", type=Path)
    args, remaining = parser.parse_known_args()
    ARTIFACT = args.artifact
    unittest.main(argv=[sys.argv[0], *remaining])
