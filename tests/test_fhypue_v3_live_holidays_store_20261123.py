"""Regression tests for live fhypue v3 (Vorath x Santa — 7-Scene 4K Desktop Wallpaper Collection, $7)
wired onto /holidays/ and /store/ (2026-11-23).
"""
from __future__ import annotations

import functools
import html as html_lib
import http.server
import json
import pathlib
import re
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

CHECKOUT_URL = "https://andrewcog.gumroad.com/l/vorath-santa-4k-wallpaper-suite"
COVER_PATH = "/static/front/store/vorath-santa-7scene-4k-wallpapers-cover.webp"
EXACT_SCENES = (
    "Sleigh Over Snowy Portland & Mt. Hood",
    "Elven Clockwork FabLab & The Missing 10mm Socket",
    "Midnight Fireplace Dichroic Baubles Delivery",
    "North Pole Treaty Summit",
    "Sleigh Loomwheel Hyperdrive Upgrade",
    "Naughty, Nice & Officially Weird List",
    "Midnight Portal Over Snowy Village",
)
FORBIDDEN_CLAIMS = (
    "rudolph",
    "ultrawide",
    "ultra-wide",
    "mobile",
    "phone",
    "hand-drawn",
    "commercial",
)


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


def _extract_itemlist_ldjson(doc_html: str) -> dict:
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        doc_html,
        re.IGNORECASE | re.DOTALL,
    ):
        data = json.loads(m.group(1))
        if isinstance(data, dict) and data.get("@type") == "ItemList":
            return data
    raise AssertionError("No ItemList JSON-LD block found")


def test_fhypue_v3_static_truth_jsonld_and_cover_asset():
    cover = ROOT / COVER_PATH.lstrip("/")
    assert cover.is_file(), f"Missing cover WebP: {cover}"
    size = cover.stat().st_size
    assert 10_000 < size <= 350_000, f"Unexpected cover WebP byte size: {size}"

    checks = [
        (
            "holidays/index.html",
            r'<article[^>]+id="vorath-santa-4k-wallpapers"[^>]*>.*?</article>',
        ),
        (
            "store/index.html",
            r'<a[^>]+id="card-vorath-santa-4k-wallpapers"[^>]*>.*?</a>',
        ),
    ]
    for rel, card_re in checks:
        raw = (ROOT / rel).read_text(encoding="utf-8")
        assert not re.search(r"[\U00010000-\U0010ffff]", raw), f"Emoji found in {rel}"

        m = re.search(card_re, raw, re.DOTALL)
        assert m is not None, f"Missing Vorath x Santa card block in {rel}"
        card_html = m.group(0)
        card_text = html_lib.unescape(re.sub(r"<[^>]+>", " ", card_html))
        card_lower = card_text.lower()

        assert f'href="{CHECKOUT_URL}"' in card_html, f"{rel} card missing exact Gumroad checkout URL"
        assert COVER_PATH in card_html, f"{rel} card missing cover WebP path"
        assert "$7" in card_text, f"{rel} card missing $7 price"
        assert "17.3 MB" in card_text, f"{rel} card missing 17.3 MB ZIP fact"
        assert "4K 16:9" in card_text, f"{rel} card missing 4K 16:9 fact"
        assert "3840" in card_text and "2160" in card_text, f"{rel} card missing 3840x2160 resolution"
        assert "README" in card_text, f"{rel} card missing README disclosure"
        assert "personal use only" in card_lower, f"{rel} card missing personal-use license fact"
        assert "ai-made" in card_lower, f"{rel} card missing AI-made provenance fact"

        for scene in EXACT_SCENES:
            assert scene in card_text, f"{rel} card missing exact scene title: {scene}"
        for bad in FORBIDDEN_CLAIMS:
            assert bad not in card_lower, f"{rel} card contains forbidden claim '{bad}'"

        ld = _extract_itemlist_ldjson(raw)
        items = ld["itemListElement"]
        assert ld["numberOfItems"] == len(items), f"{rel} ItemList numberOfItems mismatch"
        matches = [
            entry["item"]
            for entry in items
            if entry.get("item", {}).get("url") == CHECKOUT_URL
        ]
        assert len(matches) == 1, f"{rel} JSON-LD expected 1 entry for {CHECKOUT_URL}, got {len(matches)}"
        prod = matches[0]
        assert prod["sku"] == "vorath-santa-4k-wallpaper-suite"
        assert prod["offers"]["price"] == 7.0
        assert prod["offers"]["priceCurrency"] == "USD"
        assert prod["offers"]["url"] == CHECKOUT_URL
        desc_lower = prod["description"].lower()
        for bad in FORBIDDEN_CLAIMS:
            assert bad not in desc_lower, f"{rel} JSON-LD contains forbidden claim '{bad}'"


def test_fhypue_v3_playwright_desktop_mobile_320_and_forced_colors(static_site_url):
    routes = (
        ("/holidays/", "#vorath-santa-4k-wallpapers"),
        ("/store/", "#card-vorath-santa-4k-wallpapers"),
    )
    fc_leak_js = """(cardSel) => {
        const leaks = [];
        const nodes = document.querySelectorAll('a, button, summary, [role="button"], input, select, textarea, .vorath-plaque, .vorath-btn');
        for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            const bi = cs.borderImageSource || 'none';
            const bg = cs.backgroundImage || 'none';
            if (bi !== 'none' || bg !== 'none') {
                leaks.push({tag: el.tagName, cls: String(el.className || ''), bi, bg});
            }
        }
        const card = document.querySelector(cardSel);
        if (card) {
            const ccs = getComputedStyle(card);
            if ((ccs.borderImageSource || 'none') !== 'none' || (ccs.backgroundImage || 'none') !== 'none') {
                leaks.push({tag: card.tagName, cls: String(card.className || ''), bi: ccs.borderImageSource, bg: ccs.backgroundImage});
            }
        }
        return leaks;
    }"""

    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--mute-audio", "--disable-webgl", "--disable-gpu", "--no-sandbox"],
        )
        try:
            viewports = [
                (1280, 800, 1, False, "none"),
                (390, 844, 2, True, "none"),
                (320, 568, 2, True, "none"),
                (1280, 800, 1, False, "active"),
                (390, 844, 2, True, "active"),
            ]
            for width, height, dpr, is_mob, fc in viewports:
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
                    if route.request.url.startswith(b)
                    or route.request.url.startswith("data:")
                    or route.request.url.startswith("blob:")
                    else route.abort(),
                )
                for route, card_sel in routes:
                    page = ctx.new_page()
                    console_errs: list[str] = []
                    page_errs: list[str] = []
                    page.on(
                        "console",
                        lambda m, sink=console_errs: sink.append(m.text) if m.type == "error" else None,
                    )
                    page.on("pageerror", lambda e, sink=page_errs: sink.append(str(e)))
                    resp = page.goto(f"{static_site_url}{route}", wait_until="load", timeout=60000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"

                    info = page.evaluate(
                        """async ([cardSel, checkoutUrl]) => {
                            const card = document.querySelector(cardSel);
                            if (!card) return {found: false};
                            const im = card.querySelector('img');
                            if (im) {
                                im.loading = 'eager';
                                if (!im.complete) {
                                    await new Promise(res => {
                                        im.addEventListener('load', res, {once: true});
                                        im.addEventListener('error', res, {once: true});
                                        setTimeout(res, 6000);
                                    });
                                }
                            }
                            const link = card.matches('a') ? card : card.querySelector(`a[href="${checkoutUrl}"]`);
                            const lr = link ? link.getBoundingClientRect() : null;
                            const sw = Math.max(
                                document.documentElement.scrollWidth,
                                document.body ? document.body.scrollWidth : 0
                            );
                            return {
                                found: true,
                                sw,
                                text: card.innerText || '',
                                href: link ? link.getAttribute('href') : null,
                                linkW: lr ? lr.width : 0,
                                linkH: lr ? lr.height : 0,
                                imgComplete: im ? im.complete : false,
                                imgNatW: im ? im.naturalWidth : 0,
                                imgNatH: im ? im.naturalHeight : 0,
                            };
                        }""",
                        [card_sel, CHECKOUT_URL],
                    )
                    assert info["found"], f"{route} missing {card_sel} at {width}x{height} fc={fc}"
                    assert info["sw"] <= width, f"{route} overflow at {width}x{height} fc={fc}: scrollWidth={info['sw']}"
                    assert info["href"] == CHECKOUT_URL, f"{route} wrong checkout href: {info['href']}"
                    assert info["linkW"] > 40 and info["linkH"] >= 44, (
                        f"{route} checkout link too small at {width}x{height}: {info['linkW']}x{info['linkH']}"
                    )
                    assert info["imgComplete"] and info["imgNatW"] == 1280 and info["imgNatH"] == 720, (
                        f"{route} cover WebP failed decode: {info}"
                    )

                    txt = info["text"]
                    txt_l = txt.lower()
                    assert "$7" in txt and "4K 16:9" in txt and "7" in txt and "17.3 MB" in txt, (
                        f"{route} card missing verified copy facts: {txt[:200]}"
                    )
                    for bad in FORBIDDEN_CLAIMS:
                        assert bad not in txt_l, f"{route} rendered forbidden claim '{bad}'"

                    if fc == "active":
                        leaks = page.evaluate(fc_leak_js, card_sel)
                        assert len(leaks) == 0, f"{route} forced-colors {width}x{height} leaks={leaks[:5]}"

                    assert not console_errs, f"{route} console errors at {width}x{height} fc={fc}: {console_errs}"
                    assert not page_errs, f"{route} page errors at {width}x{height} fc={fc}: {page_errs}"
                    page.close()
                ctx.close()
        finally:
            browser.close()
