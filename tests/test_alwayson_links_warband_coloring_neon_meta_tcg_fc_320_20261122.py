"""Regression tests for northstarprime-always-on 6 routes forced-colors leak elimination and 320px/390px overflow remediation."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-links-warband-coloring-neon-meta-tcg-fc-20261122"

ROUTES = [
    "/links/",
    "/warband/",
    "/coloring-studio/",
    "/neon-district/",
    "/meta/",
    "/tcg/",
]


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


def _route_to_file(route: str) -> pathlib.Path:
    return ROOT / route.strip("/") / "index.html"


def test_all_6_files_have_forced_colors_coverage():
    for route in ROUTES:
        p = _route_to_file(route)
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors in {route}"
    for route in ["/links/", "/warband/", "/coloring-studio/", "/neon-district/"]:
        txt = _route_to_file(route).read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {route}"


def test_zero_horizontal_overflow_across_320_390_1280(static_base_url):
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
                page = ctx.new_page()
                for route in ROUTES:
                    console_errs = []
                    page_errs = []
                    page.on("console", lambda m, ce=console_errs: ce.append(m.text) if m.type == "error" else None)
                    page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(80)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                    assert not console_errs, f"{route} console errors at {width}x{height}: {console_errs}"
                    assert not page_errs, f"{route} page errors at {width}x{height}: {page_errs}"
                ctx.close()
        finally:
            browser.close()


def test_forced_colors_zero_leaks_and_zero_overflow(static_base_url):
    js_fc = """() => {
        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        let fcLeaks = 0;
        for (const el of document.querySelectorAll('body *:not(img):not(picture):not(video):not(canvas):not(svg)')) {
            if (el.closest('svg')) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 2 || r.height <= 2) continue;
            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') fcLeaks++;
        }
        return {sw, fcLeaks};
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
                for route in ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                    assert resp is not None and resp.status == 200, f"{route} status={resp.status if resp else None}"
                    page.wait_for_timeout(80)
                    metrics = page.evaluate(js_fc)
                    assert metrics["sw"] <= width, f"{route} forced-colors {width}x{height} overflow: sw={metrics['sw']}"
                    assert metrics["fcLeaks"] == 0, f"{route} forced-colors {width}x{height} leaks={metrics['fcLeaks']}"
                ctx.close()
        finally:
            browser.close()
