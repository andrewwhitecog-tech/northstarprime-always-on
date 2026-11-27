"""Regression tests for northstarprime-always-on 35 untouched transit & redirect HTML routes @media (forced-colors: active) & contrast upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-35routes-transit-redirects-fc-20261120"

ROUTES = [
    "/arsenal/",
    "/brand/9i-productions/",
    "/brand/ardentilaterum/",
    "/brand/biolume/",
    "/brand/brick-moc/",
    "/brand/integral-euterria/",
    "/brand/karma-property-care/",
    "/brand/pneumalumana/",
    "/brand/renalwise/",
    "/brand/rifters/",
    "/brand/tactiboo/",
    "/calendar/",
    "/card/",
    "/cookbook/",
    "/creative/",
    "/crisis/",
    "/crypto/",
    "/harm-reduction/",
    "/hub/",
    "/idc/",
    "/idl/literature/",
    "/meditation-room/",
    "/meet-the-creator/",
    "/members/board/",
    "/members/graffiti/",
    "/menagerie/",
    "/observatory/",
    "/payments/",
    "/phosphene-chamber/",
    "/play/prismfall/",
    "/redeem/",
    "/rewards/",
    "/shop/",
    "/subscribe/mystery-school/",
    "/vip/",
]


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


def _install_nav_hold(page, base_url: str) -> None:
    allowed_prefixes = tuple(f"{base_url}{r}" for r in ROUTES)

    def handle(route):
        req = route.request
        if req.is_navigation_request() and not req.url.startswith(allowed_prefixes):
            route.fulfill(status=204, body="")
        else:
            route.continue_()

    page.route("**/*", handle)


def test_all_35_transit_routes_have_forced_colors_marker_and_preserve_redirects():
    for route in ROUTES:
        rel = route.strip("/") + "/index.html"
        path = ROOT / rel
        assert path.is_file(), f"Missing {path}"
        txt = path.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"{rel} missing {STYLE_ID}"
        assert "@media (forced-colors: active)" in txt, f"{rel} missing @media (forced-colors: active)"
        assert '<link rel="canonical"' in txt, f"{rel} missing canonical link"
        assert 'http-equiv="refresh"' in txt, f"{rel} missing meta refresh"
        assert "location.replace(" in txt, f"{rel} missing location.replace"


def test_all_35_transit_routes_zero_horizontal_overflow_mobile_and_desktop(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                    java_script_enabled=False,
                )
                page = ctx.new_page()
                _install_nav_hold(page, static_base_url)
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


def test_all_35_transit_routes_forced_colors_active_zero_leaks_and_contrast(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 800},
                forced_colors="active",
                java_script_enabled=False,
            )
            page = ctx.new_page()
            _install_nav_hold(page, static_base_url)
            for route in ROUTES:
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(20)
                audit = page.evaluate(
                    """() => {
                        const leaks = [];
                        for (const el of document.querySelectorAll('body, body *:not(img):not(picture):not(video):not(canvas):not(svg)')) {
                            if (el.closest('svg')) continue;
                            const cs = getComputedStyle(el);
                            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                            const r = el.getBoundingClientRect();
                            if (r.width <= 2 || r.height <= 2) continue;
                            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                                leaks.push({tag: el.tagName, cls: String(el.className), bi: cs.borderImageSource, bg: cs.backgroundImage});
                            }
                        }
                        const tfill = Array.from(document.querySelectorAll('h1,p,span,a,div')).filter(el => {
                            const cs = getComputedStyle(el);
                            const r = el.getBoundingClientRect();
                            if (r.width <= 2 || r.height <= 2 || cs.display === 'none' || cs.visibility === 'hidden') return false;
                            return cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent';
                        }).map(el => el.tagName + '.' + String(el.className));

                        const cta = document.querySelector('a.btn-enter');
                        const card = document.querySelector('.transit-card');
                        const plainLink = document.querySelector('a:not(.btn-enter)');

                        return {
                            leaks,
                            tfill,
                            ctaBg: cta ? getComputedStyle(cta).backgroundColor : null,
                            ctaFg: cta ? getComputedStyle(cta).color : null,
                            ctaBorder: cta ? getComputedStyle(cta).borderTopWidth : null,
                            cardBg: card ? getComputedStyle(card).backgroundColor : null,
                            cardBorder: card ? getComputedStyle(card).borderTopWidth : null,
                            plainLinkFg: plainLink ? getComputedStyle(plainLink).color : null,
                            bodyBg: getComputedStyle(document.body).backgroundColor,
                        };
                    }"""
                )
                assert audit["leaks"] == [], f"{route} forced-colors leaks: {audit['leaks']}"
                assert audit["tfill"] == [], f"{route} transparent text fill: {audit['tfill']}"
                if audit["ctaBg"] and audit["cardBg"]:
                    assert audit["ctaBg"] != audit["cardBg"], (
                        f"{route} primary CTA must differ from card surface: {audit['ctaBg']} == {audit['cardBg']}"
                    )
                    assert audit["ctaFg"] != audit["ctaBg"], f"{route} CTA text matches CTA background"
                    assert float(audit["ctaBorder"].rstrip("px")) >= 2.0, f"{route} CTA missing 2px border"
                if audit["cardBorder"]:
                    assert float(audit["cardBorder"].rstrip("px")) >= 1.0, f"{route} missing .transit-card border"
                if audit["plainLinkFg"] and audit["bodyBg"]:
                    assert audit["plainLinkFg"] != audit["bodyBg"], f"{route} plain link color collapsed"

            # Verify :focus-visible outline on /arsenal/
            page.goto(f"{static_base_url}/arsenal/", wait_until="domcontentloaded", timeout=15000)
            page.keyboard.press("Tab")
            focus_info = page.evaluate(
                """() => {
                    const el = document.activeElement;
                    const cs = el ? getComputedStyle(el) : null;
                    return {
                        tag: el ? el.tagName : null,
                        cls: el ? String(el.className) : null,
                        outlineStyle: cs ? cs.outlineStyle : null,
                        outlineWidth: cs ? cs.outlineWidth : null,
                    };
                }"""
            )
            assert focus_info["tag"] == "A", f"Expected focused link, got {focus_info}"
            assert focus_info["outlineStyle"] == "solid" and float(focus_info["outlineWidth"].rstrip("px")) >= 2.0, (
                f"Expected >= 2px solid focus outline, got {focus_info}"
            )
            ctx.close()
        finally:
            browser.close()
