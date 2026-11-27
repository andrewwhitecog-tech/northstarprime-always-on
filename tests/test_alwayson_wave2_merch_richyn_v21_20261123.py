"""Regression tests for Wave 2 Live Site Polish: /rich-yn/ Gumroad checkout bridge & /stickerforge/ Comedy Sticker Mega Vault Vols. 1-3."""
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

VERIFIED_RICHYN_GUMROAD_URLS = (
    "https://andrewcog.gumroad.com/l/vorath-chromatic-print-canon-sampler12",
    "https://andrewcog.gumroad.com/l/acid-voxel-halloween-45-pack",
    "https://andrewcog.gumroad.com/l/northstar-calendar-2027",
)

COMEDY_VAULT_ORDER_HREF = (
    "/contact/?subject=Comedy%20Sticker%20Mega%20Vault%20Vols%201-4%20Custom%20Print%20Order"
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


def test_richyn_has_verified_gumroad_checkout_bridge_and_zero_forbidden_refs():
    html = (ROOT / "rich-yn" / "index.html").read_text(encoding="utf-8")
    store_html = (ROOT / "store" / "index.html").read_text(encoding="utf-8")
    assert 'id="digital-checkout-bridge"' in html
    assert 'href="/store/"' in html
    assert 'href="/merch/"' in html
    for url in VERIFIED_RICHYN_GUMROAD_URLS:
        assert f'href="{url}"' in html, f"/rich-yn/ missing verified Gumroad URL {url}"
        assert url in store_html, f"URL {url} must match verified live /store/ catalog"
    gumroad_links = re.findall(r'https://andrewcog\.gumroad\.com/l/[a-zA-Z0-9_-]+', html)
    assert len(gumroad_links) >= 4, f"Expected >=4 Gumroad links on /rich-yn/, found {len(gumroad_links)}"
    assert "220 MB ZIP" not in html, "Acid-Voxel card must match live Gumroad 62-page printable PDF, not stale 220 MB ZIP copy"
    assert "62-page printable PDF" in html
    assert "app.northstarprime.net" not in html
    assert "onrender.com" not in html.lower()
    assert not re.search(r"\bstripe\b", html, re.IGNORECASE)
    assert not re.search(r"[\U00010000-\U0010ffff]", html)


def test_stickerforge_surfaces_comedy_mega_vault_vols1_to_3_and_preserves_477_cards():
    html = (ROOT / "stickerforge" / "index.html").read_text(encoding="utf-8")
    assert 'id="comedy-sticker-mega-vault"' in html
    assert "144 Original 300-DPI Designs" in html
    assert 'href="/stickerforge/comedy-vault/"' in html
    assert f'href="{COMEDY_VAULT_ORDER_HREF}"' in html
    assert 'href="/store/"' in html
    assert "app.northstarprime.net" not in html
    assert "onrender.com" not in html.lower()
    assert not re.search(r"[\U00010000-\U0010ffff]", html)
    # Preserve exact 477 catalog cards expected by verify_stickerforge_catalog.py and catalog.js
    card_count = len(re.findall(r'<article\s+class="card"[\s>]', html))
    assert card_count == 477, f"Expected 477 catalog cards, found {card_count}"


def test_wave2_routes_viewports_overflow_images_and_errors(static_base_url):
    routes = ("/rich-yn/", "/stickerforge/")
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
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=60000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(350)

                    # Verify all local visible images decode cleanly (avoid external CDN flakiness)
                    broken = page.evaluate("""async () => {
                        const imgs = [...document.querySelectorAll('img')].filter(im => {
                            if (im.closest('[hidden]')) return false;
                            const cs = getComputedStyle(im);
                            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
                            const src = im.getAttribute('src') || '';
                            return src.startsWith('/') || src.startsWith('./') || src.startsWith('../');
                        });
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
                    assert not broken, f"{route} broken local images at {width}x{height}: {broken}"
                    assert not console_errs, f"{route} console errors at {width}x{height}: {console_errs}"
                    assert not page_errs, f"{route} page errors at {width}x{height}: {page_errs}"

                    if route == "/rich-yn/":
                        assert page.locator("#digital-checkout-bridge").is_visible()
                    elif route == "/stickerforge/":
                        assert page.locator("#comedy-sticker-mega-vault").is_visible()
                        results_txt = page.locator("#results").inner_text()
                        assert "477" in results_txt, f"Unexpected StickerForge results counter: {results_txt}"
                    page.close()
                ctx.close()
        finally:
            browser.close()


def test_wave2_routes_forced_colors_zero_leaks(static_base_url):
    js_fc = """() => {
        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const leaks = [];
        for (const el of document.querySelectorAll('body *:not(img):not(picture):not(video):not(canvas):not(svg):not(iframe)')) {
            if (el.closest('svg') || el.closest('[hidden]')) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 2 || r.height <= 2) continue;
            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                leaks.push({tag: el.tagName, cls: String(el.className || ''), bis: cs.borderImageSource, bgi: cs.backgroundImage});
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
                for route in ("/rich-yn/", "/stickerforge/"):
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=60000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(200)
                    metrics = page.evaluate(js_fc)
                    assert metrics["sw"] <= width, f"{route} forced-colors overflow at {width}x{height}: {metrics['sw']}"
                    assert not metrics["leaks"], f"{route} forced-colors leaks at {width}x{height}: {metrics['leaks'][:5]}"
                ctx.close()
        finally:
            browser.close()
