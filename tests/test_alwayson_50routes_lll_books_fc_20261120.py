"""Regression tests for northstarprime-always-on 50 Little Light Library book reader routes shared library.css @media (forced-colors: active) & contrast upgrade."""
from __future__ import annotations

import functools
import http.server
import json
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
CSS_PATH = ROOT / "little-light-library" / "library.css"
MANIFEST_PATH = ROOT / "little-light-library" / "edition-manifest.json"
MARKER = "nsp-ag-50routes-lll-books-librarycss-fc-20261120"


def _load_book_routes() -> list[str]:
    data = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    routes = [b["url"] for b in data["books"]]
    assert len(routes) == 50, f"Expected 50 LLL book routes, got {len(routes)}"
    return routes


ROUTES = _load_book_routes()


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


def test_library_css_marker_and_all_50_books_reference_it():
    assert CSS_PATH.is_file(), f"Missing {CSS_PATH}"
    css = CSS_PATH.read_text(encoding="utf-8")
    assert MARKER in css, f"Missing {MARKER} in library.css"
    assert "@media (forced-colors: active)" in css
    for route in ROUTES:
        html_path = ROOT / route.strip("/") / "index.html"
        assert html_path.is_file(), f"Missing {html_path}"
        txt = html_path.read_text(encoding="utf-8")
        assert "/little-light-library/library.css" in txt, f"{route} missing library.css link"


def test_all_50_books_zero_horizontal_overflow_mobile_and_desktop(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr)
                page = ctx.new_page()
                for route in ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(20)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_all_50_books_forced_colors_active_zero_leaks_and_distinct_hierarchy(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, forced_colors="active")
            page = ctx.new_page()
            for route in ROUTES:
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(20)
                audit = page.evaluate(
                    """() => {
                        const leaks = [];
                        for (const el of document.querySelectorAll('body *:not(img):not(picture):not(video):not(canvas):not(svg)')) {
                            if (el.closest('svg')) continue;
                            const cs = getComputedStyle(el);
                            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                            const r = el.getBoundingClientRect();
                            if (r.width <= 2 || r.height <= 2) continue;
                            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                                leaks.push({tag: el.tagName, cls: String(el.className), bi: cs.borderImageSource, bg: cs.backgroundImage});
                            }
                        }
                        const tfill = Array.from(document.querySelectorAll('h1,h2,h3,p,span,a')).filter(el => {
                            const cs = getComputedStyle(el);
                            const r = el.getBoundingClientRect();
                            if (r.width <= 2 || r.height <= 2 || cs.display === 'none' || cs.visibility === 'hidden') return false;
                            return cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent';
                        }).map(el => el.tagName + '.' + String(el.className));

                        const pri = document.querySelector('header.book-header a:not(.button)');
                        const sec = document.querySelector('a.button.secondary') || document.querySelector('a.series-home');
                        const brand = document.querySelector('header.topbar a.brand');
                        const navLink = document.querySelector('nav.book-nav a');
                        const cb = document.querySelector('input#text-only');
                        const tools = document.querySelector('.reader-tools');

                        return {
                            leaks: leaks.slice(0, 5),
                            tfill: tfill.slice(0, 5),
                            priBg: pri ? getComputedStyle(pri).backgroundColor : null,
                            priFg: pri ? getComputedStyle(pri).color : null,
                            secBg: sec ? getComputedStyle(sec).backgroundColor : null,
                            secFg: sec ? getComputedStyle(sec).color : null,
                            brandBg: brand ? getComputedStyle(brand).backgroundColor : null,
                            navBg: navLink ? getComputedStyle(navLink).backgroundColor : null,
                            navFg: navLink ? getComputedStyle(navLink).color : null,
                            cbApp: cb ? getComputedStyle(cb).appearance : null,
                            cbBorder: cb ? getComputedStyle(cb).borderTopWidth : null,
                            toolsBg: tools ? getComputedStyle(tools).backgroundColor : null,
                        };
                    }"""
                )
                assert not audit["leaks"], f"forced-colors art leaks on {route}: {audit['leaks']}"
                assert not audit["tfill"], f"Transparent -webkit-text-fill-color on {route}: {audit['tfill']}"
                assert audit["priBg"] and audit["priBg"] != audit["priFg"], f"Primary CTA collapsed on {route}: {audit}"
                assert audit["secBg"] and audit["secBg"] != audit["secFg"], f"Secondary CTA collapsed on {route}: {audit}"
                assert audit["priBg"] != audit["secBg"], f"Primary vs secondary indistinguishable on {route}: {audit}"
                assert audit["brandBg"] == audit["priBg"], f"Brand CTA should match primary Highlight on {route}: {audit}"
                if audit["navBg"] is not None:
                    assert audit["navBg"] != audit["navFg"], f"Book nav link collapsed on {route}: {audit}"
                assert audit["cbApp"] != "none", f"Checkbox appearance not restored on {route}: {audit}"
                assert audit["cbBorder"] == "0px", f"Checkbox border not cleared on {route}: {audit}"

            # Interactive reader controls check under forced-colors: active on representative books
            for rep in [
                "/little-light-library/01-ash-and-the-bell-that-needed-two-paws/",
                "/little-light-library/07-the-pocket-at-the-edge-of-maybe/",
                "/little-light-library/50-the-little-light-at-the-end-of-the-shelf/",
            ]:
                page.goto(f"{static_base_url}{rep}", wait_until="domcontentloaded", timeout=15000)
                page.click("button#smaller")
                disabled_state = page.evaluate(
                    """() => {
                        const b = document.querySelector('button#smaller');
                        const cs = getComputedStyle(b);
                        return {disabled: b.disabled, opacity: cs.opacity, color: cs.color, bg: cs.backgroundColor};
                    }"""
                )
                assert disabled_state["disabled"] is True
                assert disabled_state["opacity"] == "1"
                assert disabled_state["color"] != disabled_state["bg"]

                page.click("input#text-only")
                toggled = page.evaluate(
                    """() => {
                        const img = document.querySelector('.scene-image');
                        const cb = document.querySelector('input#text-only');
                        const after = getComputedStyle(cb, '::after').content;
                        return {
                            checked: cb.checked,
                            imgDisplay: img ? getComputedStyle(img).display : null,
                            afterContent: after,
                        };
                    }"""
                )
                assert toggled["checked"] is True
                assert toggled["imgDisplay"] == "none"
                assert toggled["afterContent"] in ("none", '""')
            ctx.close()
        finally:
            browser.close()


def test_normal_mode_vorath_plaques_remain_intact(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            for route in [
                "/little-light-library/01-ash-and-the-bell-that-needed-two-paws/",
                "/little-light-library/07-the-pocket-at-the-edge-of-maybe/",
                "/little-light-library/25-the-quiet-seat-on-the-carousel/",
                "/little-light-library/50-the-little-light-at-the-end-of-the-shelf/",
            ]:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(30)
                checks = page.evaluate(
                    """() => ({
                        brand: getComputedStyle(document.querySelector('header.topbar a.brand')).borderImageSource,
                        series: getComputedStyle(document.querySelector('a.series-home')).borderImageSource,
                        begin: getComputedStyle(document.querySelector('header.book-header a:not(.button)')).borderImageSource,
                        dl: getComputedStyle(document.querySelector('a.button.secondary')).borderImageSource,
                        cb: getComputedStyle(document.querySelector('input#text-only')).backgroundImage,
                    })"""
                )
                assert "vorath_btn_primary.webp" in checks["brand"], checks
                assert "vorath_btn_obsidian.webp" in checks["series"], checks
                assert "vorath_btn_active.webp" in checks["begin"], checks
                assert "vorath_btn_obsidian.webp" in checks["dl"], checks
                assert "vorath_btn_obsidian.webp" in checks["cb"], checks
            ctx.close()
        finally:
            browser.close()
