#!/usr/bin/env python3
"""Storefront verification for All-Brands Winter 2026 Holiday Merch Collection on /holidays/."""
from __future__ import annotations

import functools
import http.server
import pathlib
import re
import threading

import pytest
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets" / "holiday_allbrands_20261127"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


class _ThreadedServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


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


def test_all_22_holiday_brand_assets_and_cards():
    html = (ROOT / "holidays" / "index.html").read_text(encoding="utf-8")
    assert not re.search(r"[\U00010000-\U0010ffff]", html), "Emoji found in holidays/index.html"
    assert 'id="all-brands-holiday-2026"' in html
    assert "COOGI" not in html.split('id="holiday-printables"')[0]

    section = html.split("<!-- ALL_BRANDS_HOLIDAY_2026_START -->", 1)[1].split("<!-- ALL_BRANDS_HOLIDAY_2026_END -->", 1)[0]
    card_ids = re.findall(r'<article class="holiday-product" id="(hol26-[^"]+)">', section)
    assert len(card_ids) == 22

    imgs = re.findall(r'src="(/assets/holiday_allbrands_20261127/[^"]+\.webp)"', section)
    assert len(imgs) == 22
    for rel in imgs:
        p = ROOT / rel.lstrip("/")
        assert p.is_file(), f"Missing WebP: {p}"
        assert 10_000 < p.stat().st_size <= 220_000, f"Unexpected WebP size: {p}"
        with Image.open(p) as im:
            assert im.size == (1200, 900)

    # Brand firewall checks
    renal_m = re.search(r'<article class="holiday-product" id="hol26-22-renalshield-winter-kitchen-guide">.*?</article>', section, re.S)
    assert renal_m is not None
    renal_txt = renal_m.group(0).lower()
    for bad in ("alchemy", "grimoire", "relic", "sovereign", "vorath", "cure"):
        assert bad not in renal_txt

    realm_m = re.search(r'<article class="holiday-product" id="hol26-21-northstar-realm-winter-citadel">.*?</article>', section, re.S)
    assert realm_m is not None
    assert "<h2>minecraft" not in realm_m.group(0).lower()


def test_holidays_allbrands_playwright_desktop_mobile_320_fc(static_site_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        try:
            for width, height, dpr, is_mob, fc in [
                (1280, 800, 1, False, "none"),
                (390, 844, 2, True, "none"),
                (320, 640, 2, True, "none"),
                (1280, 800, 1, False, "active"),
            ]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                    is_mobile=is_mob,
                    has_touch=is_mob,
                    forced_colors=fc,
                )
                ctx.route(
                    "**/*",
                    lambda route, _req=None, b=static_site_url: route.continue_()
                    if route.request.url.startswith(b) or route.request.url.startswith("data:")
                    else route.abort(),
                )
                page = ctx.new_page()
                console_errs = []
                page_errs = []
                page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: page_errs.append(str(e)))
                resp = page.goto(f"{static_site_url}/holidays/", wait_until="load", timeout=60000)
                assert resp is not None and resp.status == 200

                info = page.evaluate(
                    """async () => {
                        const sec = document.getElementById('all-brands-holiday-2026');
                        if (!sec) return { found: false };
                        const imgs = Array.from(document.querySelectorAll('article[id^="hol26-"] img'));
                        for (const im of imgs) {
                            im.loading = 'eager';
                            if (!im.complete) {
                                await new Promise(res => {
                                    im.addEventListener('load', res, { once: true });
                                    im.addEventListener('error', res, { once: true });
                                    setTimeout(res, 6000);
                                });
                            }
                        }
                        const badImgs = imgs.filter(im => !im.complete || im.naturalWidth !== 1200 || im.naturalHeight !== 900).map(im => im.src);
                        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
                        return { found: true, count: imgs.length, badImgs, sw };
                    }"""
                )
                assert info["found"] and info["count"] == 22
                assert not info["badImgs"], f"Failed images at {width}x{height}: {info['badImgs']}"
                assert info["sw"] <= width, f"Overflow at {width}x{height} fc={fc}: {info['sw']}"
                assert not console_errs and not page_errs
                page.close()
                ctx.close()
        finally:
            browser.close()
