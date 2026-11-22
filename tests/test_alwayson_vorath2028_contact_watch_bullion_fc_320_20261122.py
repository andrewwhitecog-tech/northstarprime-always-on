"""Regression tests for vorath2028, contact, watch, and bullion forced-colors and 320px narrow-mobile fixes."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ROUTES = ["/vorath2028/", "/contact/", "/watch/", "/bullion/"]


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


def test_contact_privacy_disclosure_present():
    html = (ROOT / "contact" / "index.html").read_text(encoding="utf-8")
    assert "contact@northstarprime.net" in html
    assert "private forwarding destination is never exposed" in html


def test_zero_horizontal_overflow_at_320_390_1280(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(320, 568, 2), (390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr)
                page = ctx.new_page()
                for route in ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(80)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_forced_colors_active_zero_overflow_and_zero_leaks(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height in [(390, 844), (1280, 800)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, forced_colors="active")
                page = ctx.new_page()
                for route in ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(80)
                    res = page.evaluate(
                        """() => {
                            const sw = Math.max(
                                document.documentElement.scrollWidth,
                                document.body ? document.body.scrollWidth : 0
                            );
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
                    assert res["sw"] <= width, f"{route} forced-colors overflow at {width}x{height}: sw={res['sw']}"
                    assert not res["bad"], f"{route} forced-colors gradient/border leaks: {res['bad'][:5]}"
                ctx.close()
        finally:
            browser.close()
