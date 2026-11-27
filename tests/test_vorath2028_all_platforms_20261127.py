"""Regression tests for Uncle Vorath 2028 all-platforms storefront, media, and zine wiring (2026-11-27)."""
from __future__ import annotations

import functools
import http.server
import pathlib
import re
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTES = ["/vorath2028/", "/watch/", "/store/", "/links/"]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


@pytest.fixture(scope="module")
def static_base_url():
    srv = _Server(("127.0.0.1", 0), functools.partial(_QuietHandler, directory=str(ROOT)))
    port = srv.server_address[1]
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        srv.shutdown()
        srv.server_close()


def test_vorath2028_media_zine_and_patreon_fix():
    gum_url = "https://andrewcog.gumroad.com/l/uncle-vorath-2028-campaign-kit"
    v_html = (ROOT / "vorath2028" / "index.html").read_text(encoding="utf-8")
    assert "uv2028_campaign_spot_web_16x9.mp4" in v_html
    assert "Uncle_Vorath_2028_Campaign_Manifesto_Zine_20261121.pdf" in v_html
    assert 'href="/store/"' in v_html
    assert gum_url in v_html
    assert "Patreon (/merch/" not in v_html
    assert "patreon.com" not in v_html
    assert (ROOT / "vorath2028" / "assets" / "uv2028_campaign_spot_web_16x9.mp4").is_file()
    assert (ROOT / "vorath2028" / "assets" / "uv2028_spot_poster.webp").is_file()
    assert (ROOT / "vorath2028" / "kit" / "Uncle_Vorath_2028_Campaign_Manifesto_Zine_20261121.pdf").is_file()

    w_html = (ROOT / "watch" / "index.html").read_text(encoding="utf-8")
    assert "uv2028_campaign_spot_web_16x9.mp4" in w_html
    assert "/vorath2028/" in w_html

    s_html = (ROOT / "store" / "index.html").read_text(encoding="utf-8")
    assert gum_url in s_html
    assert "uncle-vorath-2028-campaign-kit-cover.webp" in s_html

    l_html = (ROOT / "links" / "index.html").read_text(encoding="utf-8")
    assert gum_url in l_html

    for rel in ["vorath2028/index.html", "watch/index.html", "store/index.html", "links/index.html"]:
        raw = (ROOT / rel).read_text(encoding="utf-8")
        assert not re.search(r"[\U00010000-\U0010ffff]", raw), f"Emoji in {rel}"


def test_zero_overflow_and_forced_colors_on_vorath2028_routes(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height in [(320, 568), (390, 844), (1280, 800)]:
                ctx = browser.new_context(viewport={"width": width, "height": height})
                page = ctx.new_page()
                for route in ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(80)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()

            for width, height in [(390, 844), (1280, 800)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, forced_colors="active")
                page = ctx.new_page()
                for route in ["/vorath2028/", "/watch/"]:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(80)
                    res = page.evaluate(
                        """() => {
                            const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
                            const bad = [];
                            for (const el of document.querySelectorAll('body *:not(img):not(picture):not(video):not(canvas):not(svg)')) {
                                if (el.closest('svg')) continue;
                                const cs = getComputedStyle(el);
                                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                                const r = el.getBoundingClientRect();
                                if (r.width <= 2 || r.height <= 2) continue;
                                if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                                    bad.push({tag: el.tagName, cls: String(el.className)});
                                }
                            }
                            return {sw, bad};
                        }"""
                    )
                    assert res["sw"] <= width, f"{route} fc overflow at {width}x{height}: {res['sw']}"
                    assert not res["bad"], f"{route} fc leaks: {res['bad'][:5]}"
                ctx.close()
        finally:
            browser.close()
