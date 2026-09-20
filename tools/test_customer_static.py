"""Synthetic failures for customer journeys and the unchanged arcade inventory."""
import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import verify_home_static as home
import verify_hire_static as hire
import verify_arcade_static as arcade


class CustomerStaticTests(unittest.TestCase):
    def setUp(self):
        # Small synthetic files live only within this checkout for the test lifetime.
        self.scratch = tempfile.TemporaryDirectory(prefix=".static-verifier-test-", dir=Path(__file__).resolve().parent)
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name).resolve()
        self.path = self.write("index.html", '<!doctype html><title>Small &amp; clear</title><link rel="canonical" href="https://northstarprime.net/"><main id="main"><h1>Hello</h1></main>')

    def write(self, name, text):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
        return path

    def row(self, name):
        raw = home.canonical_bytes(self.root / name)
        return {"relative_path": name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}

    def test_compact_complete_page_passes_without_size_threshold(self):
        self.assertLess(self.path.stat().st_size, 500)
        home.check_identity(home.read_page(self.path), "Small & clear", home.ORIGIN + "/")

    def test_wrong_or_duplicate_canonical_fails(self):
        html = self.path.read_text(encoding="utf-8")
        for mutation in (html.replace(home.ORIGIN, "https://wrong.example"),
                         html + '<link rel="canonical" href="https://northstarprime.net/">'):
            with self.subTest(mutation=mutation), self.assertRaises(SystemExit):
                home.check_identity(home.Page(mutation), "Small & clear", home.ORIGIN + "/")

    def test_missing_route_and_fragment_fail_even_with_allowed_prefix(self):
        for link in ("/arcade/missing/", "#missing"):
            with self.subTest(link=link), self.assertRaises(SystemExit):
                home.check_local_links(self.root, self.path, home.Page(f'<a href="{link}">Go</a>'))

    def test_relative_query_and_cross_page_fragment_resolve(self):
        self.write("hire/index.html", '<section id="how">Steps</section>')
        page = home.Page('<a href="hire/?utm_source=test#how">Go</a>')
        home.check_local_links(self.root, self.path, page)

    def test_resources_include_css_imports_srcset_and_share_image(self):
        self.write("static/site.css", '@import "more.css"; body{background:url(bg.png)}')
        self.write("static/more.css", '@font-face{src:url(font.woff2)}')
        for name in ("bg.png", "font.woff2", "small.png", "large.png", "share.png"):
            self.write("static/" + name, "synthetic")
        page = home.Page('<link rel="stylesheet" href="/static/site.css"><img srcset="/static/small.png 1x, /static/large.png 2x"><meta property="og:image" content="https://northstarprime.net/static/share.png">')
        expected = {"static/" + name for name in ("site.css", "more.css", "bg.png", "font.woff2", "small.png", "large.png", "share.png")}
        self.assertEqual(home.collect_local_assets(self.root, self.path, page), expected)

    def test_missing_or_remote_resource_fails(self):
        for url in ("/static/missing.png", "https://cdn.example/image.png"):
            with self.subTest(url=url), self.assertRaises(SystemExit):
                home.collect_local_assets(self.root, self.path, home.Page(f'<img src="{url}">'))

    def test_omitted_duplicate_or_unreferenced_resource_fails(self):
        self.write("style.css", "body{}")
        row = self.row("style.css")
        for rows, refs in (([], {"style.css"}), ([row, row], {"style.css"}), ([row], set())):
            with self.subTest(rows=rows), self.assertRaises(SystemExit):
                home.check_asset_manifest(self.root, rows, refs)

    def test_same_size_resource_corruption_fails(self):
        self.write("image.png", "AAAA")
        row = self.row("image.png")
        self.write("image.png", "BBBB")
        with self.assertRaises(SystemExit):
            home.check_asset_manifest(self.root, [row], {"image.png"})

    def test_canonical_lf_hash_accepts_windows_checkout(self):
        self.write("site.css", "body{}\n")
        row = self.row("site.css")
        (self.root / "site.css").write_bytes(b"body{}\r\n")
        self.assertEqual(home.check_frozen_row(self.root, row), len(b"body{}\n"))

    def test_manifest_path_escape_fails_before_read(self):
        with self.assertRaises(SystemExit):
            home.check_frozen_row(self.root, {"relative_path": "../outside", "bytes": 0, "sha256": ""})
        with patch.object(arcade, "ROOT", self.root), self.assertRaises(SystemExit):
            arcade.check_row({"relative_path": "../outside"}, "asset")

    def test_legacy_game_hash_remains_enforced(self):
        self.write("game.html", "AAAA")
        row = self.row("game.html")
        game = {"output_relative": row["relative_path"], "output_bytes": row["bytes"], "output_sha256": row["sha256"]}
        with patch.object(arcade, "ROOT", self.root):
            arcade.check_row(game, "game")
            self.write("game.html", "BBBB")
            with self.assertRaises(SystemExit):
                arcade.check_row(game, "game")

    def test_catalog_dispositions_exactly_match_both_lanes(self):
        games = [{"slug": "one", "route": "/arcade/custom/one"}]
        delegated = [{"slug": "archive", "route": "/arcade/custom/archive"}]
        catalog = {"count": 2, "games": games + delegated}
        arcade.check_catalog_dispositions(games, delegated, catalog)
        for mutation in (
            {"count": 2, "games": games + games},
            {"count": 1, "games": games},
            {"count": 2, "games": [games[0], {"slug": "archive", "route": "/wrong"}]},
        ):
            with self.subTest(mutation=mutation), self.assertRaises(SystemExit):
                arcade.check_catalog_dispositions(games, delegated, mutation)

    def test_missing_workshop_game_and_local_delegated_stub_fail(self):
        games = [{"route": "/arcade/custom/one"}]
        delegated = [{"route": "/arcade/custom/archive", "fallback_url": "https://app.northstarprime.net/arcade/custom/archive"}]
        links = ["/arcade/custom/one/", delegated[0]["fallback_url"]]
        arcade.check_workshop_links(links, games, delegated)
        for mutation in (links[1:], links[:1], links + ["/arcade/custom/archive/"]):
            with self.subTest(mutation=mutation), self.assertRaises(SystemExit):
                arcade.check_workshop_links(mutation, games, delegated)

    def test_all_hire_offers_need_exact_campaign_and_destination(self):
        links = [f"https://app.northstarprime.net{route}?utm_source=northstarprime.net&utm_medium=owned_hire&utm_campaign=institutional_pilot&utm_content={content}" for route, content in hire.OFFER_ROUTES.items()]
        hire.check_offer_links(links)
        for mutation in (links[:-1], [s.replace("institutional_pilot", "old_campaign") for s in links],
                         [s.replace("/hire/failure-map?", "/hire/unknown?") for s in links]):
            with self.subTest(mutation=mutation), self.assertRaises(SystemExit):
                hire.check_offer_links(mutation)


if __name__ == "__main__":
    unittest.main()
