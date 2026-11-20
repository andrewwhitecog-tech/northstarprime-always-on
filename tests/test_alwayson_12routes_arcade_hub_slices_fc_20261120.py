"""Regression tests for northstarprime-always-on 12 Arcade Pavilion hub slice routes @media (forced-colors: active) & contrast upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-12routes-arcade-hub-slices-fc-20261120"
ROUTES = [f"/arcade/hub.p{i}.html" for i in range(12)]


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


def test_all_12_hub_slices_have_forced_colors_marker_and_preserve_wave3i():
    for i in range(12):
        path = ROOT / f"arcade/hub.p{i}.html"
        assert path.is_file(), f"Missing {path}"
        txt = path.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"{path.name} missing {STYLE_ID}"
        assert 'data-nsp-vorath="wave3i"' in txt, f"{path.name} missing wave3i Vorath block"
        assert "@media (forced-colors: active)" in txt, f"{path.name} missing @media (forced-colors: active)"


def test_all_12_hub_slices_zero_horizontal_overflow_mobile_and_desktop(static_base_url):
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


def test_all_12_hub_slices_forced_colors_active_zero_leaks_and_hierarchy(static_base_url):
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
                        const tfill = Array.from(document.querySelectorAll('h1,h2,h3,p,span,a,button')).filter(el => {
                            const cs = getComputedStyle(el);
                            const r = el.getBoundingClientRect();
                            if (r.width <= 2 || r.height <= 2 || cs.display === 'none' || cs.visibility === 'hidden') return false;
                            return cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent';
                        }).map(el => el.tagName + '.' + String(el.className));

                        const pri = document.querySelector('a.play-btn') || document.querySelector('a[aria-current="page"]');
                        const sec = document.querySelector('button.pill:not(.active)') || document.querySelector('nav > a:not([aria-current="page"])') || document.querySelector('div.lab-footer-callout > a');
                        const card = document.querySelector('article.game-card') || document.querySelector('div.lab-footer-callout');
                        const tag = document.querySelector('span.game-tag');
                        const search = document.querySelector('input#game-search');
                        const footerLink = document.querySelector('footer li > a:not([aria-current="page"])');

                        return {
                            leaks,
                            tfill,
                            priBg: pri ? getComputedStyle(pri).backgroundColor : null,
                            priFg: pri ? getComputedStyle(pri).color : null,
                            secBg: sec ? getComputedStyle(sec).backgroundColor : null,
                            secFg: sec ? getComputedStyle(sec).color : null,
                            cardBg: card ? getComputedStyle(card).backgroundColor : null,
                            cardBorder: card ? getComputedStyle(card).borderTopWidth : null,
                            tagBorder: tag ? getComputedStyle(tag).borderTopWidth : null,
                            searchApp: search ? getComputedStyle(search).appearance : null,
                            searchBg: search ? getComputedStyle(search).backgroundColor : null,
                            footerLinkFg: footerLink ? getComputedStyle(footerLink).color : null,
                        };
                    }"""
                )
                assert audit["leaks"] == [], f"{route} forced-colors leaks: {audit['leaks']}"
                assert audit["tfill"] == [], f"{route} transparent text fill: {audit['tfill']}"
                if audit["priBg"] and audit["secBg"]:
                    assert audit["priBg"] != audit["secBg"], (
                        f"{route} primary CTA must differ from secondary control: {audit['priBg']} == {audit['secBg']}"
                    )
                if audit["priBg"] and audit["cardBg"]:
                    assert audit["priBg"] != audit["cardBg"], (
                        f"{route} primary CTA must differ from card surface: {audit['priBg']} == {audit['cardBg']}"
                    )
                if audit["cardBorder"]:
                    assert float(audit["cardBorder"].rstrip("px")) >= 1.0, f"{route} missing card border"
                if audit["tagBorder"]:
                    assert float(audit["tagBorder"].rstrip("px")) >= 1.0, f"{route} missing tag border"
                if audit["searchApp"] is not None:
                    assert audit["searchApp"] != "none", f"{route} search input appearance must be native"
                if audit["footerLinkFg"] and audit["secFg"]:
                    assert audit["footerLinkFg"] != audit["priBg"], f"{route} footer link color collapsed"

            # Check :focus-visible outline on hub.p0.html
            page.goto(f"{static_base_url}/arcade/hub.p0.html", wait_until="domcontentloaded", timeout=15000)
            page.keyboard.press("Tab")
            page.keyboard.press("Tab")
            focus_info = page.evaluate(
                """() => {
                    const el = document.activeElement;
                    const cs = el ? getComputedStyle(el) : null;
                    return el ? {tag: el.tagName, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth} : null;
                }"""
            )
            assert focus_info and focus_info["outlineStyle"] != "none", f"Missing focus-visible outline: {focus_info}"
            ctx.close()
        finally:
            browser.close()


def test_all_12_hub_slices_preserve_normal_mode_vorath_plaques(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, forced_colors="none")
            page = ctx.new_page()
            for route in ROUTES:
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(20)
                vorath_count = page.evaluate(
                    """() => {
                        let count = 0;
                        for (const el of document.querySelectorAll('a.wordmark, a.play-btn, button.pill, nav > a, article.game-card, span.game-tag, div.lab-footer-callout > a')) {
                            const bi = getComputedStyle(el).borderImageSource;
                            if (bi && bi.includes('vorath_')) count++;
                        }
                        return count;
                    }"""
                )
                assert vorath_count > 0, f"{route} lost Vorath plaques in normal mode"
            ctx.close()
        finally:
            browser.close()
