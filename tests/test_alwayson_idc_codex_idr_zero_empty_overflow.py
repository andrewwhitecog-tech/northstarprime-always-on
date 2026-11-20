"""Regression tests for northstarprime-always-on IDC, Vorath Codex & IDR routes.

Covers:
  /idc/season-1/, /idc/season-2/, /idc/season-3/ (styles.css CSP), /idc/season-4/,
  /idc/flow-studio/, /idc/season-4/chrono-convergence/, /idc/season-4/jukebox/,
  /idc/season-4/the-signal-tomb/, /idc/season-4/the-void-engine/,
  /literature/the-vorath-codex-vol2/, /literature/the-vorath-codex-vol3/,
  /literature/the-vorath-codex-vol4/, /idr/single-052/, /idr/single-054/
"""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

ROUTES = [
    "/idc/season-1/",
    "/idc/season-2/",
    "/idc/season-3/",
    "/idc/season-4/",
    "/idc/flow-studio/",
    "/idc/season-4/chrono-convergence/",
    "/idc/season-4/jukebox/",
    "/idc/season-4/the-signal-tomb/",
    "/idc/season-4/the-void-engine/",
    "/literature/the-vorath-codex-vol2/",
    "/literature/the-vorath-codex-vol3/",
    "/literature/the-vorath-codex-vol4/",
    "/idr/single-052/",
    "/idr/single-054/",
]

MODIFIED_FILES = [
    "idc/season-1/index.html",
    "idc/season-2/index.html",
    "idc/season-3/styles.css",
    "idc/season-4/index.html",
    "idc/flow-studio/index.html",
    "idc/season-4/chrono-convergence/index.html",
    "idc/season-4/jukebox/index.html",
    "idc/season-4/the-signal-tomb/index.html",
    "idc/season-4/the-void-engine/index.html",
    "literature/the-vorath-codex-vol2/index.html",
    "literature/the-vorath-codex-vol3/index.html",
    "literature/the-vorath-codex-vol4/index.html",
    "idr/single-052/index.html",
    "idr/single-054/index.html",
]

STYLE_ID = "nsp-ag-idc-codex-idr-zero-empty-overflow-20261119"

FORCED_COLORS_PROBE_SELECTORS: dict[str, str] = {
    "/idc/season-1/": ".season-nav-bar a.season-link",
    "/idc/season-2/": ".season-nav-bar a.season-link",
    "/idc/season-3/": ".filters button.chip",
    "/idc/season-4/": "nav a",
    "/idc/flow-studio/": "button.filter-btn",
    "/idc/season-4/chrono-convergence/": "header a.brand",
    "/idc/season-4/jukebox/": "nav a",
    "/idc/season-4/the-signal-tomb/": "header .nav-links a",
    "/idc/season-4/the-void-engine/": "header .nav-links a",
    "/literature/the-vorath-codex-vol2/": ".reader-controls button.btn",
    "/literature/the-vorath-codex-vol3/": ".header-controls button.control-btn",
    "/literature/the-vorath-codex-vol4/": ".theme-buttons button.btn",
    "/idr/single-052/": "header a.brand",
    "/idr/single-054/": "header .nav-links a",
}


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


@pytest.fixture(scope="module")
def site_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler) as httpd:
        httpd.daemon_threads = True
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{port}"
        finally:
            httpd.shutdown()


def test_modified_files_have_vorath_and_forced_colors():
    for rel in MODIFIED_FILES:
        path = ROOT / rel
        assert path.is_file(), f"Missing {rel}"
        text = path.read_text(encoding="utf-8")
        assert STYLE_ID in text, f"{rel} missing {STYLE_ID}"
        assert "/warband/art/vorath_" in text, f"{rel} missing Vorath 9-slice art"
        assert "@media (forced-colors: active)" in text, f"{rel} missing forced-colors: active reset"
        assert "border-image: none" in text, f"{rel} missing border-image: none in forced-colors"


def _goto_ready(page, url: str):
    resp = page.goto(url, wait_until="load", timeout=30000)
    page.evaluate("() => document.fonts ? document.fonts.ready : Promise.resolve()")
    page.wait_for_timeout(300)
    return resp


def test_mobile_390_zero_overflow_and_zero_page_errors(site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--mute-audio"])
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        page = ctx.new_page()
        for route in ROUTES:
            errors = []
            page.on("pageerror", lambda err, e=errors: e.append(str(err)))
            resp = _goto_ready(page, f"{site_url}{route}")
            assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
            sw = page.evaluate("() => document.documentElement.scrollWidth")
            assert sw <= 390, f"{route} mobile scrollWidth={sw} > 390"
            assert not errors, f"{route} page errors: {errors}"
        browser.close()


def test_forced_colors_active_resets_border_image(site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--mute-audio"])
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 800},
            forced_colors="active",
        )
        page = ctx.new_page()
        for route, sel in FORCED_COLORS_PROBE_SELECTORS.items():
            _goto_ready(page, f"{site_url}{route}")
            bis = page.locator(sel).first.evaluate("el => getComputedStyle(el).borderImageSource")
            assert bis == "none", f"{route} {sel} kept border-image-source={bis} under forced-colors"
        browser.close()


def test_interactive_filters_and_codex_themes(site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--mute-audio"])
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()

        # Season 1 filter & search
        _goto_ready(page, f"{site_url}/idc/season-1/")
        total = page.locator("#episodesGrid .episode-card").count()
        assert total >= 30, f"Expected >=30 Season 1 episodes, got {total}"
        page.locator(".pill-btn[data-series]").nth(1).click()
        filtered = page.locator("#episodesGrid .episode-card").count()
        assert 0 < filtered < total, f"Season 1 series filter did not narrow cards ({filtered}/{total})"

        # Flow Studio filter
        _goto_ready(page, f"{site_url}/idc/flow-studio/")
        assert page.locator("#shots-grid article.card").count() == 20
        page.locator(".filter-btn[data-filter='deeper-state']").click()
        vis = page.locator("#shots-grid article.card:visible").count()
        assert 0 < vis < 20, f"Flow Studio filter did not narrow visible cards ({vis})"

        # Codex Vol 3 theme switch + border-bottom none check on .toc-sidebar h3
        _goto_ready(page, f"{site_url}/literature/the-vorath-codex-vol3/")
        bb = page.locator("aside.toc-sidebar h3").evaluate("el => getComputedStyle(el).borderBottomWidth")
        assert bb == "0px", f"Expected 0px border-bottom on .toc-sidebar h3, got {bb}"
        page.click("#btn-theme-dark")
        assert "theme-dark" in (page.locator("body").get_attribute("class") or "")

        browser.close()
