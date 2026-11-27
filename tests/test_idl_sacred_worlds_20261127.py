"""Verification suite for /sacred-worlds/ V45 showcase and /literature/ update (2026-11-27)."""
from __future__ import annotations

import functools
import http.server
import pathlib
import re
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

EXPECTED_SLUGS = [
    "tree_beyond_use",
    "neighbor_on_the_road",
    "banyan_deer",
    "merchant_of_seri",
    "coat_of_many_horizons",
    "question_not_bought",
    "handful_of_rice",
    "road_beside_you",
    "foot_held_high",
    "teacher_asked_everything",
    "second_climb",
    "straight_channel",
    "two_lamps_vaisakhi",
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


class _ThreadedServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 64

    def handle_error(self, request, client_address) -> None:
        pass


@pytest.fixture(scope="module")
def static_site_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    with _ThreadedServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{port}"
        finally:
            httpd.shutdown()


def test_sacred_worlds_static_assets_and_imprint_boundaries():
    page = ROOT / "sacred-worlds" / "index.html"
    lit = ROOT / "literature" / "index.html"
    sitemap = ROOT / "sitemap.xml"
    assert page.is_file()
    assert lit.is_file()
    assert sitemap.is_file()

    html = page.read_text(encoding="utf-8")
    lit_html = lit.read_text(encoding="utf-8")
    sm_xml = sitemap.read_text(encoding="utf-8")

    assert not re.findall(r"[\U00010000-\U0010ffff]", html), "SMP emoji found on /sacred-worlds/"
    assert not re.findall(r"[\U00010000-\U0010ffff]", lit_html), "SMP emoji found on /literature/"
    assert "/mature/" not in html and "/tactiboo/" not in html
    assert "/sacred-worlds/" in lit_html
    assert "https://northstarprime.net/sacred-worlds/" in sm_xml
    assert "<main" in html and "<h1>" in html
    assert ":focus-visible" in html and "prefers-reduced-motion" in html and "forced-colors" in html

    for slug in EXPECTED_SLUGS:
        cov = ROOT / "sacred-worlds" / "covers" / f"{slug}.webp"
        assert cov.is_file() and cov.stat().st_size > 10_000, f"Missing cover: {cov}"
        assert slug in html


def test_sacred_worlds_and_literature_playwright(static_site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            ctx.route(
                "**/*",
                lambda route, _req=None, b=static_site_url: route.continue_()
                if route.request.url.startswith(b)
                or route.request.url.startswith("data:")
                or route.request.url.startswith("blob:")
                else route.abort(),
            )
            page = ctx.new_page()
            for route in ("/sacred-worlds/", "/literature/"):
                errors: list[str] = []
                page.on("pageerror", lambda e, sink=errors: sink.append(str(e)))
                page.set_viewport_size({"width": 1280, "height": 800})
                page.emulate_media(forced_colors="none")
                page.goto(f"{static_site_url}{route}", wait_until="domcontentloaded", timeout=60000)
                page.wait_for_function(
                    "() => [...document.querySelectorAll('link[rel=\"stylesheet\"]')].every(l => !!l.sheet)",
                    timeout=30000,
                )
                page.wait_for_timeout(200)

                for vw, vh in ((1280, 800), (390, 844), (320, 568)):
                    page.set_viewport_size({"width": vw, "height": vh})
                    page.wait_for_timeout(120)
                    overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
                    assert not overflow, f"Horizontal overflow on {route} at {vw}x{vh}"

                if route == "/sacred-worlds/":
                    page.set_viewport_size({"width": 1280, "height": 800})
                    assert page.locator("#storyGrid article.card").count() == 13
                    page.locator(".preview-btn[data-slug='straight_channel']").click()
                    assert page.locator("#previewGrid .pane[dir='rtl']").count() == 1
                    page.locator(".fbtn[data-region='Near East']").click()
                    assert page.locator("#storyGrid article.card").count() == 3
                    page.locator(".fbtn[data-region='All 13 Editions']").click()

                    page.emulate_media(forced_colors="active")
                    page.wait_for_timeout(120)
                    leaks = page.evaluate("""() => {
                      const bad = [];
                      for (const el of document.querySelectorAll('.wordmark, .nav-btn, .btn-primary, .fbtn, .card, .sample-box, .notice, .notice a, .foot-links a')) {
                        const cs = getComputedStyle(el);
                        if (cs.borderImageSource !== 'none') bad.push(el.className + ':' + cs.borderImageSource);
                      }
                      return bad;
                    }""")
                    assert not leaks, f"Forced-colors border-image leaks: {leaks}"
                assert not errors, f"Page errors on {route}: {errors}"
        finally:
            browser.close()
