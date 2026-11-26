"""Regression & Playwright visual/a11y tests for /community/ and storefront free-sampler funnel (2026-11-25)."""
from __future__ import annotations

import functools
import http.server
import os
import pathlib
import re
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTES = ["/community/", "/play/", "/store/", "/links/"]
FREE_SAMPLER_URL = "https://andrewcog.gumroad.com/l/northstar-2026-free-mega-sampler"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


class _ThreadedServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128

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


def test_community_funnel_markup_and_links():
    for rel in ("community/index.html", "play/index.html", "store/index.html", "links/index.html"):
        raw = (ROOT / rel).read_text(encoding="utf-8")
        assert not re.search(r"[\U00010000-\U0010ffff]", raw), f"Emoji found in {rel}"
        assert "patreon.com" not in raw.lower(), f"Retired Patreon link in {rel}"
        assert "redbubble.com" not in raw.lower(), f"Retired Redbubble link in {rel}"
        assert "/community/" in raw, f"Missing /community/ route in {rel}"

    comm = (ROOT / "community" / "index.html").read_text(encoding="utf-8")
    assert FREE_SAMPLER_URL in comm
    assert "play.northstarprime.net" in comm
    assert "mc.northstarprime.net" in comm
    assert "/trigger feast_hall" in comm
    assert "/trigger turkey_hunt" in comm
    assert "direct links in your messages" not in comm.lower()
    assert "daily" not in comm.lower()
    assert "lossless" not in comm.lower()
    assert "email lock" not in comm.lower()

    store_html = (ROOT / "store" / "index.html").read_text(encoding="utf-8")
    assert FREE_SAMPLER_URL in store_html

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert "https://northstarprime.net/community/" in sitemap


def test_community_interactive_portal_and_responsive_a11y(static_site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--mute-audio", "--disable-webgl", "--disable-gpu", "--no-sandbox"],
        )
        try:
            for width, height in ((1280, 800), (390, 844), (320, 568)):
                ctx = browser.new_context(viewport={"width": width, "height": height})
                ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda route, _req=None: route.abort())
                page = ctx.new_page()
                page_errors = []
                page.on("pageerror", lambda exc: page_errors.append(str(exc)))
                for route in ROUTES:
                    page.goto(f"{static_site_url}{route}", wait_until="load", timeout=60000)
                    page.evaluate("document.fonts && document.fonts.ready")
                    shot_dir_env = os.environ.get("COMMUNITY_SHOT_DIR", "").strip()
                    if shot_dir_env and (width, height) in ((1280, 800), (390, 844)) and route in ("/community/", "/play/", "/store/"):
                        sd = pathlib.Path(shot_dir_env)
                        sd.mkdir(parents=True, exist_ok=True)
                        slug = route.strip("/") or "home"
                        page.screenshot(path=str(sd / f"{slug}_{width}x{height}.png"), full_page=False)
                    overflow = page.evaluate("document.documentElement.scrollWidth > window.innerWidth")
                    assert not overflow, f"Horizontal overflow on {route} at {width}x{height}"
                    broken_imgs = page.evaluate(
                        """() => Array.from(document.querySelectorAll('img')).filter(
                            img => img.complete && img.naturalWidth === 0
                        ).map(img => img.getAttribute('src'))"""
                    )
                    assert not broken_imgs, f"Broken images on {route}: {broken_imgs}"
                assert not page_errors, f"Page errors at {width}x{height}: {page_errors}"
                ctx.close()

            # Interactive portal switching & copy invite on /community/
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda route, _req=None: route.abort())
            page = ctx.new_page()
            page.goto(f"{static_site_url}/community/", wait_until="load", timeout=60000)
            expected_titles = {
                "free": "NorthStar Prime 2026 FREE Mega Sampler Bundle",
                "minecraft": "Join NorthStar Minecraft World & Thanksgiving Quests",
                "games": "Play 60+ Browser Games & 3D Worlds or Grab Offline Packs",
                "vaults": "Unlock $7-$10 Collector Vaults & 144 Comedy Stickers",
                "services": "Hire NorthStar Digital ($350-$750 Fixed Sprints)",
            }
            for key, title in expected_titles.items():
                page.locator(f'.filter-btn[data-portal="{key}"]').click()
                assert page.locator("#portal-title").inner_text().strip() == title
            page.locator("#copy-community-invite").click()
            status_txt = page.locator("#invite-status").inner_text().strip()
            assert "Invite" in status_txt
            ctx.close()

            # Forced-colors check on /community/ and /play/
            ctx_fc = browser.new_context(viewport={"width": 390, "height": 844}, forced_colors="active")
            ctx_fc.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda route, _req=None: route.abort())
            page_fc = ctx_fc.new_page()
            for route in ("/community/", "/play/"):
                page_fc.goto(f"{static_site_url}{route}", wait_until="load", timeout=60000)
                page_fc.evaluate("document.fonts && document.fonts.ready")
                overflow = page_fc.evaluate("document.documentElement.scrollWidth > window.innerWidth")
                assert not overflow, f"Forced-colors overflow on {route}"
            ctx_fc.close()
        finally:
            browser.close()
