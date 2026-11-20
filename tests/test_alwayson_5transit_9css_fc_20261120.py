"""Regression tests for northstarprime-always-on 5 untouched transit HTML routes + 9 untouched CSS stylesheets @media (forced-colors: active), focus-visible & Vorath upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MARKER = "nsp-ag-5transit-9css-fc-20261120"

TRANSIT_ROUTES = [
    "/arcade/playtest/",
    "/astrology/",
    "/iching/",
    "/idc/screening-room/",
    "/services/",
]

CSS_TARGETS = [
    ("static/halloween-2026.css", "/es/"),
    ("static/games/family_v07/family.css", "/family/"),
    ("static/experiences/digital_terrarium/hub-polish.css", "/digital-terrarium/"),
    ("cosmos/style.css", "/cosmos/"),
    ("idr/customer-radio.css", "/idr/"),
    ("maison-gooch/collection.css", "/maison-gooch/"),
    ("mystery-school/school.css", "/mystery-school/"),
    ("stickerforge/catalog.css", "/stickerforge/"),
    ("tarot/oracle/oracle.css", "/tarot/"),
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
    allowed_prefixes = tuple(f"{base_url}{r}" for r in TRANSIT_ROUTES)

    def handle(route):
        req = route.request
        if req.is_navigation_request() and not req.url.startswith(allowed_prefixes):
            route.fulfill(status=204, body="")
        else:
            route.continue_()

    page.route("**/*", handle)


def test_all_14_files_have_marker_and_forced_colors():
    for route in TRANSIT_ROUTES:
        rel = route.strip("/") + "/index.html"
        path = ROOT / rel
        assert path.is_file(), f"Missing {path}"
        txt = path.read_text(encoding="utf-8")
        assert MARKER in txt, f"{rel} missing {MARKER}"
        assert "@media (forced-colors: active)" in txt, f"{rel} missing @media (forced-colors: active)"
        assert '<link rel="canonical"' in txt, f"{rel} missing canonical link"
        assert 'http-equiv="refresh"' in txt, f"{rel} missing meta refresh"
        assert "location.replace(" in txt, f"{rel} missing location.replace"

    for css_rel, _ in CSS_TARGETS:
        path = ROOT / css_rel
        assert path.is_file(), f"Missing {path}"
        txt = path.read_text(encoding="utf-8")
        assert MARKER in txt, f"{css_rel} missing {MARKER}"
        assert "@media (forced-colors: active)" in txt, f"{css_rel} missing @media (forced-colors: active)"


def test_services_and_playtest_vorath_plaques_in_normal_mode(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, java_script_enabled=False)
            page = ctx.new_page()
            _install_nav_hold(page, static_base_url)

            page.goto(f"{static_base_url}/services/", wait_until="networkidle", timeout=15000)
            svc_info = page.evaluate(
                """() => {
                    const main = document.querySelector('main');
                    const btns = Array.from(document.querySelectorAll('.actions a.button'));
                    return {
                        mainBorderImg: getComputedStyle(main).borderImageSource,
                        btnCount: btns.length,
                        btnBorderImgs: btns.map(b => getComputedStyle(b).borderImageSource),
                    };
                }"""
            )
            assert "vorath_obsidian_plate_v01.webp" in svc_info["mainBorderImg"]
            assert svc_info["btnCount"] == 4
            assert "vorath_btn_primary.webp" in svc_info["btnBorderImgs"][0]
            for bi in svc_info["btnBorderImgs"][1:]:
                assert "vorath_btn_obsidian.webp" in bi

            page.goto(f"{static_base_url}/arcade/playtest/", wait_until="networkidle", timeout=15000)
            pt_info = page.evaluate(
                """() => {
                    const card = document.querySelector('.transit-card');
                    const cta = document.querySelector('a.btn-enter');
                    return {
                        cardBorderImg: getComputedStyle(card).borderImageSource,
                        ctaBorderImg: getComputedStyle(cta).borderImageSource,
                    };
                }"""
            )
            assert "vorath_obsidian_plate_v01.webp" in pt_info["cardBorderImg"]
            assert "vorath_btn_primary.webp" in pt_info["ctaBorderImg"]
            ctx.close()
        finally:
            browser.close()


def test_all_5_transit_routes_zero_horizontal_overflow_mobile_and_desktop(static_base_url):
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
                for route in TRANSIT_ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(20)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_all_5_transit_routes_forced_colors_active_zero_leaks_and_contrast(static_base_url):
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
            for route in TRANSIT_ROUTES:
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

                        const cta = document.querySelector('a.btn-enter, a.button.primary');
                        const sec = document.querySelector('a.button:not(.primary), #nsp-related a.nsp-rel-plaque:not(.nsp-rel-purple)');
                        const card = document.querySelector('.transit-card, main');

                        return {
                            leaks,
                            tfill,
                            ctaBg: cta ? getComputedStyle(cta).backgroundColor : null,
                            ctaFg: cta ? getComputedStyle(cta).color : null,
                            ctaBorder: cta ? getComputedStyle(cta).borderTopWidth : null,
                            secBg: sec ? getComputedStyle(sec).backgroundColor : null,
                            secFg: sec ? getComputedStyle(sec).color : null,
                            secBorder: sec ? getComputedStyle(sec).borderTopWidth : null,
                            cardBg: card ? getComputedStyle(card).backgroundColor : null,
                            cardBorder: card ? getComputedStyle(card).borderTopWidth : null,
                        };
                    }"""
                )
                assert audit["leaks"] == [], f"{route} forced-colors leaks: {audit['leaks']}"
                assert audit["tfill"] == [], f"{route} transparent text fill: {audit['tfill']}"
                assert audit["ctaBg"] != audit["cardBg"], f"{route} primary CTA matches card surface"
                assert audit["ctaFg"] != audit["ctaBg"], f"{route} primary CTA text matches bg"
                assert float(audit["ctaBorder"].rstrip("px")) >= 2.0, f"{route} CTA missing 2px border"
                assert float(audit["cardBorder"].rstrip("px")) >= 1.0, f"{route} missing card border"
                if audit["secBg"]:
                    assert audit["secBg"] != audit["ctaBg"], f"{route} secondary CTA matches primary CTA"
                    assert audit["secFg"] != audit["secBg"], f"{route} secondary CTA text matches bg"
                    assert float(audit["secBorder"].rstrip("px")) >= 1.0

            for focus_route in ["/services/", "/arcade/playtest/"]:
                page.goto(f"{static_base_url}{focus_route}", wait_until="domcontentloaded", timeout=15000)
                page.keyboard.press("Tab")
                focus_info = page.evaluate(
                    """() => {
                        const el = document.activeElement;
                        const cs = el ? getComputedStyle(el) : null;
                        return {
                            tag: el ? el.tagName : null,
                            outlineStyle: cs ? cs.outlineStyle : null,
                            outlineWidth: cs ? cs.outlineWidth : null,
                        };
                    }"""
                )
                assert focus_info["tag"] == "A", f"{focus_route} focus tag={focus_info}"
                assert focus_info["outlineStyle"] == "solid" and float(focus_info["outlineWidth"].rstrip("px")) >= 2.0
            ctx.close()
        finally:
            browser.close()


def test_all_9_css_stylesheets_serve_cleanly_and_forced_colors_contrast(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 800},
                forced_colors="active",
                java_script_enabled=False,
            )
            page = ctx.new_page()
            for css_rel, host_route in CSS_TARGETS:
                css_resp = page.request.get(f"{static_base_url}/{css_rel}")
                assert css_resp.status == 200, f"CSS {css_rel} returned {css_resp.status}"
                assert "@media (forced-colors: active)" in css_resp.text()
                resp = page.goto(f"{static_base_url}{host_route}", wait_until="domcontentloaded", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(20)
                body_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
                body_fg = page.evaluate("getComputedStyle(document.body).color")
                assert body_bg != body_fg, f"{host_route} body bg == fg in forced-colors"

            # Verify primary vs secondary control separation on CSS host pages
            page.goto(f"{static_base_url}/cosmos/", wait_until="domcontentloaded", timeout=15000)
            cosmos_check = page.evaluate(
                """() => {
                    const p = document.querySelector('.gold-btn:not(.ghost)');
                    const g = document.querySelector('.gold-btn.ghost');
                    return {
                        pBg: p ? getComputedStyle(p).backgroundColor : null,
                        gBg: g ? getComputedStyle(g).backgroundColor : null,
                        overlayBgImg: getComputedStyle(document.querySelector('.overlay')).backgroundImage,
                    };
                }"""
            )
            assert cosmos_check["overlayBgImg"] == "none"
            if cosmos_check["pBg"] and cosmos_check["gBg"]:
                assert cosmos_check["pBg"] != cosmos_check["gBg"]

            page.goto(f"{static_base_url}/idr/", wait_until="domcontentloaded", timeout=15000)
            idr_check = page.evaluate(
                """() => {
                    const pri = document.querySelector('button#idr-onair-btn, .primary');
                    const sec = document.querySelector('button.idr-track-play:not([aria-pressed="true"])');
                    return {
                        priBg: pri ? getComputedStyle(pri).backgroundColor : null,
                        priBi: pri ? getComputedStyle(pri).borderImageSource : null,
                        secBg: sec ? getComputedStyle(sec).backgroundColor : null,
                        secBi: sec ? getComputedStyle(sec).borderImageSource : null,
                    };
                }"""
            )
            assert idr_check["priBi"] == "none" and idr_check["secBi"] == "none"
            if idr_check["priBg"] and idr_check["secBg"]:
                assert idr_check["priBg"] != idr_check["secBg"]

            ctx.close()
        finally:
            browser.close()
