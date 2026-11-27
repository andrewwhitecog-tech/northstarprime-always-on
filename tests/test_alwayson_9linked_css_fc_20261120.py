"""Regression tests for northstarprime-always-on final 9 untouched actively-linked CSS stylesheets @media (forced-colors: active) & :focus-visible upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
MARKER = "nsp-ag-9linked-css-fc-20261120"

CSS_TARGETS = [
    ("arcade/custom/digital-terrarium-3d/game-shell.css", "/arcade/custom/digital-terrarium-3d/"),
    ("arcade/custom/digital-terrarium/game-shell.css", "/arcade/custom/digital-terrarium/"),
    ("arcade/custom/the-dark-below/game-shell.css", "/arcade/custom/the-dark-below/"),
    ("mystery-school/iching/iching.css", "/mystery-school/iching/"),
    ("mystery-school/mote-channel-bridge.css", "/mystery-school/caves/"),
    ("static/mystery_school/mote-channel-bridge.css", "/mystery-school/caves/"),
    ("stickerforge/bumper-stickers/bumper.css", "/stickerforge/bumper-stickers/"),
    ("stickerforge/crucifix/atelier.css", "/stickerforge/crucifix/"),
    ("stickerforge/studio/sticker-studio.css", "/stickerforge/studio/"),
]

LINKED_ROUTES = sorted({route for _, route in CSS_TARGETS}) + [
    "/stickerforge/crucifix/biker-regal/",
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


def test_all_9_css_files_have_marker_forced_colors_and_focus_visible():
    for css_rel, _ in CSS_TARGETS:
        path = ROOT / css_rel
        assert path.is_file(), f"Missing {path}"
        txt = path.read_text(encoding="utf-8")
        assert MARKER in txt, f"{css_rel} missing {MARKER}"
        assert "@media (forced-colors: active)" in txt, f"{css_rel} missing @media (forced-colors: active)"
        assert ":focus-visible" in txt, f"{css_rel} missing :focus-visible"


def test_linked_routes_zero_horizontal_overflow_mobile_and_desktop(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                )
                page = ctx.new_page()
                for route in LINKED_ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(120)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_forced_colors_clears_border_image_and_preserves_contrast(static_base_url):
    routes_to_audit = [
        "/arcade/custom/digital-terrarium-3d/",
        "/arcade/custom/digital-terrarium/",
        "/arcade/custom/the-dark-below/",
        "/mystery-school/iching/",
        "/stickerforge/bumper-stickers/",
        "/stickerforge/crucifix/",
        "/stickerforge/crucifix/biker-regal/",
        "/stickerforge/studio/",
    ]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 800},
                forced_colors="active",
                color_scheme="dark",
            )
            page = ctx.new_page()
            for route in routes_to_audit:
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(150)
                audit = page.evaluate(
                    """() => {
                        const leaks = [];
                        for (const el of document.querySelectorAll('a, button, input, select, textarea, header, nav, section, article, .sticker, .coin-chamber, .card-panel, .studio-sidebar, .mote-bridge__toggle, .mote-bridge__panel')) {
                            const r = el.getBoundingClientRect();
                            if (r.width === 0 || r.height === 0) continue;
                            const cs = getComputedStyle(el);
                            if (cs.borderImageSource && cs.borderImageSource !== 'none') {
                                leaks.push(`${el.tagName}.${el.className}:${cs.borderImageSource}`);
                            }
                        }
                        return { leaks, bodyBg: getComputedStyle(document.body).backgroundColor, bodyFg: getComputedStyle(document.body).color };
                    }"""
                )
                assert audit["leaks"] == [], f"{route} leaked border-image in forced-colors: {audit['leaks'][:5]}"
                assert audit["bodyBg"] != audit["bodyFg"], f"{route} body bg == fg in forced-colors"

            # Audit mote-channel-bridge widget (both toggle and opened panel) on /mystery-school/caves/
            resp = page.goto(f"{static_base_url}/mystery-school/caves/", wait_until="domcontentloaded", timeout=15000)
            assert resp is not None and resp.status == 200
            page.wait_for_timeout(150)
            toggle = page.locator(".mote-bridge__toggle")
            if toggle.count() > 0:
                toggle.first.click()
                page.wait_for_timeout(100)
            mote_audit = page.evaluate(
                """() => {
                    const leaks = [];
                    for (const el of document.querySelectorAll('.mote-bridge, .mote-bridge *, .mote-bridge-widget, .mote-bridge-widget *')) {
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 || r.height === 0) continue;
                        const cs = getComputedStyle(el);
                        if (cs.borderImageSource && cs.borderImageSource !== 'none') {
                            leaks.push(`${el.tagName}.${el.className}:${cs.borderImageSource}`);
                        }
                    }
                    const tg = document.querySelector('.mote-bridge__toggle');
                    return {
                        leaks,
                        hasToggle: Boolean(tg),
                        toggleBg: tg ? getComputedStyle(tg).backgroundColor : null,
                        toggleFg: tg ? getComputedStyle(tg).color : null,
                    };
                }"""
            )
            assert mote_audit["hasToggle"], "/mystery-school/caves/ missing .mote-bridge__toggle"
            assert mote_audit["leaks"] == [], f"mote-bridge leaked border-image in forced-colors: {mote_audit['leaks']}"
            assert mote_audit["toggleBg"] != mote_audit["toggleFg"]

            # Verify iching gradient-clipped span is visible (non-transparent) in forced-colors
            page.goto(f"{static_base_url}/mystery-school/iching/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(120)
            iching_span = page.evaluate(
                """() => {
                    const sp = document.querySelector('.hero-deck h2 span');
                    const toss = document.querySelector('button#btnToss');
                    const inst = document.querySelector('button#btnInstant');
                    return {
                        spanFill: sp ? getComputedStyle(sp).webkitTextFillColor : null,
                        tossBg: toss ? getComputedStyle(toss).backgroundColor : null,
                        instBg: inst ? getComputedStyle(inst).backgroundColor : null,
                    };
                }"""
            )
            assert iching_span["spanFill"] != "rgba(0, 0, 0, 0)", "iching h2 span invisible in forced-colors"
            assert iching_span["tossBg"] != iching_span["instBg"], "primary #btnToss must contrast #btnInstant"
            ctx.close()
        finally:
            browser.close()


def test_normal_mode_vorath_plaques_preserved(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()

            page.goto(f"{static_base_url}/mystery-school/iching/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(120)
            toss_bi = page.evaluate("getComputedStyle(document.querySelector('button#btnToss')).borderImageSource")
            assert "vorath_btn_primary.webp" in toss_bi

            page.goto(f"{static_base_url}/stickerforge/bumper-stickers/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(120)
            brand_bi = page.evaluate("getComputedStyle(document.querySelector('.brand')).borderImageSource")
            assert "vorath_btn_primary.webp" in brand_bi

            page.goto(f"{static_base_url}/stickerforge/studio/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(120)
            studio_bi = page.evaluate("getComputedStyle(document.querySelector('.brand-title')).borderImageSource")
            assert "vorath_btn_primary.webp" in studio_bi
            ctx.close()
        finally:
            browser.close()
