"""Regression tests for northstarprime-always-on 16 Mystery School & Vault routes @media (forced-colors: active) upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-mystery-vault-fc-20261119"

ROUTES = [
    "/mystery-school/astrology/",
    "/mystery-school/caves/",
    "/mystery-school/circle/",
    "/mystery-school/dark-night/",
    "/mystery-school/garden/",
    "/mystery-school/library/",
    "/mystery-school/reading-room/",
    "/mystery-school/stare-into-the-void/",
    "/mystery-school/workshop/",
    "/mystery-school/vault/",
    "/mystery-school/vault/alchemy/",
    "/mystery-school/vault/beast/",
    "/mystery-school/vault/call/",
    "/mystery-school/vault/chain/",
    "/mystery-school/vault/compost/",
    "/mystery-school/vault/dawn/",
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True


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


def _route_to_file(route: str) -> pathlib.Path:
    rel = route.strip("/")
    return ROOT / rel / "index.html"


def test_all_16_files_have_style_id_and_forced_colors():
    for route in ROUTES:
        p = _route_to_file(route)
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {route}"
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors in {route}"


def test_zero_horizontal_overflow_mobile_and_desktop(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr)
                page = ctx.new_page()
                for route in ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(80)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_forced_colors_active_resets_plaque_and_gradient_leaks(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, forced_colors="active")
            page = ctx.new_page()
            for route in ROUTES:
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(80)
                leaks = page.evaluate(
                    """() => {
                        const els = Array.from(document.querySelectorAll(
                            'body *:not(img):not(picture):not(video):not(canvas):not(svg)'
                        ));
                        const bad = [];
                        for (const el of els) {
                            if (el.closest('svg')) continue;
                            const cs = getComputedStyle(el);
                            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                            const r = el.getBoundingClientRect();
                            if (r.width <= 2 || r.height <= 2) continue;
                            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                                bad.push({
                                    tag: el.tagName,
                                    cls: String(el.className),
                                    bi: cs.borderImageSource,
                                    bg: cs.backgroundImage,
                                });
                            }
                        }
                        return bad;
                    }"""
                )
                assert not leaks, f"forced-colors art leaks on {route}: {leaks[:5]}"

            # Check active toggles & text-fill visibility under forced-colors
            for route, sel in [
                ("/mystery-school/dark-night/", "button.quiet-toggle-btn.active"),
                ("/mystery-school/library/", "button.sym-btn.active"),
                ("/mystery-school/vault/", "button.octave-btn.active"),
            ]:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(80)
                res = page.evaluate(
                    """(sel) => {
                        const btn = document.querySelector(sel);
                        return btn ? {
                            bg: getComputedStyle(btn).backgroundColor,
                            fg: getComputedStyle(btn).color,
                        } : null;
                    }""",
                    sel,
                )
                assert res is not None, f"Missing {sel} on {route}"
                assert res["bg"] != res["fg"], f"Active toggle contrast collapsed on {route}: {res}"

            # Check aperture-core & mote-bridge__eye text-fill resets
            page.goto(f"{static_base_url}/mystery-school/stare-into-the-void/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(80)
            void_check = page.evaluate(
                """() => {
                    const eye = document.querySelector('.mote-bridge__eye');
                    const glyph = document.querySelector('.aperture-core .aperture-glyph');
                    return {
                        eyeFill: eye ? getComputedStyle(eye).webkitTextFillColor : null,
                        glyphFill: glyph ? getComputedStyle(glyph).webkitTextFillColor : null,
                    };
                }"""
            )
            assert void_check["eyeFill"] != "rgba(0, 0, 0, 0)"
            assert void_check["glyphFill"] != "rgba(0, 0, 0, 0)"

            ctx.close()
        finally:
            browser.close()
