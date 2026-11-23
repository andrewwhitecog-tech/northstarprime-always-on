"""Regression tests for Nov 22 live flagships on /store/ & /links/ and Rule 6 buy-path truth fixes."""
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

FLAGSHIP_HREFS = (
    "/brick-alchemy/",
    "/brick-alchemy/studio/",
    "/rich-yn/",
    "/unc-v/",
    "/arcade/",
    "/games/flagship-3d-suite/",
)


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        pass


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


def test_store_and_links_surface_all_nov22_live_flagships():
    for rel in ("store/index.html", "links/index.html"):
        html = (ROOT / rel).read_text(encoding="utf-8")
        for href in FLAGSHIP_HREFS:
            assert f'href="{href}"' in html, f"{rel} missing flagship link {href}"
            target_dir = ROOT / href.strip("/")
            assert (target_dir / "index.html").is_file(), f"Target route missing on disk: {href}"
        assert "app.northstarprime.net" not in html, f"{rel} must not contain legacy Render links"
        assert not re.search(r"[\U00010000-\U0010ffff]", html), f"{rel} must contain 0 emojis"
    store_html = (ROOT / "store" / "index.html").read_text(encoding="utf-8")
    assert 'id="nov22-live-flagships"' in store_html
    assert "Brick Alchemy CAD Studio v2.1" in store_html
    assert "RICH YN" in store_html
    assert "Unc V (Uncle Vorath)" in store_html
    assert "Custom Games &amp; 3D Showcase" in store_html


def test_rule6_buy_path_and_contact_alias_truth():
    for rel in ("store/index.html", "links/index.html", "hire/index.html", "merch/index.html"):
        html = (ROOT / rel).read_text(encoding="utf-8")
        assert not re.search(r"stripe", html, re.IGNORECASE), f"{rel} still contains stale Stripe copy"
    repair_html = (ROOT / "hire" / "website-repair" / "index.html").read_text(encoding="utf-8")
    assert "andrew.white.cog@gmail.com" not in repair_html
    assert "mailto:contact@northstarprime.net" in repair_html


def test_store_and_links_zero_overflow_zero_broken_images_zero_errors(static_base_url):
    routes = ("/store/", "/links/")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr, is_mob in [
                (320, 568, 2, True),
                (390, 844, 2, True),
                (1280, 800, 1, False),
            ]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                    is_mobile=is_mob,
                    has_touch=is_mob,
                )
                for route in routes:
                    page = ctx.new_page()
                    console_errs: list[str] = []
                    page_errs: list[str] = []
                    page.on("console", lambda m, ce=console_errs: ce.append(m.text) if m.type == "error" else None)
                    page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                    resp = page.goto(f"{static_base_url}{route}", wait_until="load", timeout=60000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    # Force lazy images in the new flagship shelf to load & decode cleanly
                    broken = page.evaluate("""async () => {
                        const imgs = [...document.querySelectorAll('img')];
                        for (const im of imgs) {
                            im.loading = 'eager';
                            if (!im.complete) {
                                await new Promise(res => {
                                    im.addEventListener('load', res, {once: true});
                                    im.addEventListener('error', res, {once: true});
                                    setTimeout(res, 6000);
                                });
                            }
                        }
                        return imgs.filter(im => !im.complete || im.naturalWidth === 0).map(im => im.getAttribute('src'));
                    }""")
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                    assert not broken, f"{route} broken images at {width}x{height}: {broken}"
                    assert not console_errs, f"{route} console errors at {width}x{height}: {console_errs}"
                    assert not page_errs, f"{route} page errors at {width}x{height}: {page_errs}"
                    page.close()
                ctx.close()
        finally:
            browser.close()


def test_store_and_links_forced_colors_zero_leaks(static_base_url):
    js_fc = """() => {
        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const leaks = [];
        for (const el of document.querySelectorAll('body *:not(img):not(picture):not(video):not(canvas):not(svg)')) {
            if (el.closest('svg')) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 2 || r.height <= 2) continue;
            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                leaks.push({tag: el.tagName, cls: el.className, bis: cs.borderImageSource, bgi: cs.backgroundImage});
            }
        }
        return {sw, leaks};
    }"""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(1280, 800, 1), (390, 844, 2)]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                    forced_colors="active",
                )
                page = ctx.new_page()
                for route in ("/store/", "/links/"):
                    resp = page.goto(f"{static_base_url}{route}", wait_until="load", timeout=60000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(100)
                    metrics = page.evaluate(js_fc)
                    assert metrics["sw"] <= width, f"{route} forced-colors {width}x{height} overflow: sw={metrics['sw']}"
                    assert len(metrics["leaks"]) == 0, f"{route} forced-colors {width}x{height} leaks={metrics['leaks'][:5]}"
                ctx.close()
        finally:
            browser.close()
