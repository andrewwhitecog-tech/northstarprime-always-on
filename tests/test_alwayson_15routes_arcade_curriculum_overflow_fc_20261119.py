"""Regression tests for northstarprime-always-on 15 untouched Arcade, Mature Games, Mystery School Curriculum & Dream Court routes mobile overflow, unclipped #nsp-related & forced-colors upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-15routes-arcade-curriculum-overflow-fc-20261119"

ROUTES = [
    "/arcade/custom/vorath-dominion/",
    "/arcade/custom/prism-masonry/",
    "/arcade/custom/tetris-plus/",
    "/arcade/custom/vorath-incursion/",
    "/arcade/custom/asteroids-void/",
    "/arcade/custom/blackjack-noir/",
    "/arcade/custom/breakout-wall/",
    "/arcade/custom/good-news-drive/",
    "/mature/games/afterglow-poker-lite/",
    "/mature/games/strip-signal/",
    "/mystery-school/curriculum/",
    "/dream-court/",
    "/dream-court/case-002/",
    "/dream-court/case-003/",
    "/dream-court/case-004/",
]

UNCLIPPED_RELATED_ROUTES = [
    "/arcade/custom/vorath-dominion/",
    "/arcade/custom/prism-masonry/",
    "/arcade/custom/tetris-plus/",
    "/arcade/custom/vorath-incursion/",
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


def test_all_15_files_have_style_id_and_forced_colors():
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
                    page.wait_for_timeout(120)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_unclipped_nsp_related_visible_inside_viewport(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr)
                page = ctx.new_page()
                for route in UNCLIPPED_RELATED_ROUTES:
                    page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    page.wait_for_timeout(120)
                    rect = page.evaluate(
                        """() => {
                            const el = document.querySelector('#nsp-related');
                            if (!el) return null;
                            const r = el.getBoundingClientRect();
                            return {top: r.top, bottom: r.bottom, height: r.height, winH: window.innerHeight};
                        }"""
                    )
                    assert rect is not None, f"Missing #nsp-related on {route}"
                    assert rect["height"] > 10, f"Collapsed #nsp-related on {route}: {rect}"
                    assert rect["top"] >= 0 and rect["bottom"] <= rect["winH"] + 2, (
                        f"#nsp-related clipped outside viewport on {route} at {width}x{height}: {rect}"
                    )
                ctx.close()
        finally:
            browser.close()


def test_forced_colors_active_resets_plaque_art(static_base_url):
    checks = [
        ("/arcade/custom/vorath-dominion/", "nav#nsp-related a.nsp-rel-plaque"),
        ("/arcade/custom/blackjack-noir/", ".vorath-plaque"),
        ("/arcade/custom/asteroids-void/", ".vorath-plaque"),
        ("/mature/games/afterglow-poker-lite/", "button#enterBtn"),
        ("/mystery-school/curriculum/", ".action-btn"),
        ("/dream-court/", "a.button.primary"),
    ]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(
                viewport={"width": 1280, "height": 800},
                forced_colors="active",
            )
            page = ctx.new_page()
            for route, selector in checks:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(120)
                styles = page.evaluate(
                    """(sel) => {
                        const el = document.querySelector(sel);
                        if (!el) return null;
                        const cs = getComputedStyle(el);
                        return {borderImageSource: cs.borderImageSource, backgroundImage: cs.backgroundImage};
                    }""",
                    selector,
                )
                assert styles is not None, f"Selector {selector} missing on {route}"
                assert styles["borderImageSource"] == "none", f"{route} {selector} kept borderImageSource={styles['borderImageSource']}"
                if route == "/arcade/custom/blackjack-noir/":
                    assert styles["backgroundImage"] == "none", f"{route} kept backgroundImage={styles['backgroundImage']}"
            ctx.close()
        finally:
            browser.close()
