"""Regression tests for northstarprime-always-on 8 unlocked arcade/XBLA routes: accessible viewport zoom, semantic landmarks, snake_dimension 320px overflow, forced-colors, prefers-reduced-motion, and super-arcade-v3 WebGL startup fallback."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-8arcade-viewport-a11y-20261122"

ROUTES = [
    ("/arcade/custom/cascade_salmon_run.html", "arcade/custom/cascade_salmon_run.html"),
    ("/arcade/custom/crownfall_intercept_xbla_edition.html", "arcade/custom/crownfall_intercept_xbla_edition.html"),
    ("/arcade/custom/dharma_invaders_xbla_edition.html", "arcade/custom/dharma_invaders_xbla_edition.html"),
    ("/arcade/custom/glyphbreaker_xbla_edition.html", "arcade/custom/glyphbreaker_xbla_edition.html"),
    ("/arcade/custom/ossuary_orbit_xbla_edition.html", "arcade/custom/ossuary_orbit_xbla_edition.html"),
    ("/arcade/custom/pac_dharma_xbla_edition.html", "arcade/custom/pac_dharma_xbla_edition.html"),
    ("/arcade/custom/snake_dimension_xbla_edition.html", "arcade/custom/snake_dimension_xbla_edition.html"),
    ("/games/super-arcade-v3/", "games/super-arcade-v3/index.html"),
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


def test_all_8_routes_have_accessible_viewport_landmarks_and_markers():
    for route, rel in ROUTES:
        p = ROOT / rel
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {route}"
        assert "@media (prefers-reduced-motion: reduce)" in txt, f"Missing reduced-motion rule in {route}"
        assert "user-scalable=no" not in txt, f"Disallowed user-scalable=no in {route}"
        assert "maximum-scale=1" not in txt, f"Disallowed maximum-scale=1 in {route}"
        assert "user-select=no" not in txt, f"Disallowed viewport user-select=no in {route}"
        assert "<main" in txt.lower(), f"Missing <main> landmark in {route}"
        assert "<h1" in txt.lower(), f"Missing <h1> heading in {route}"


def test_mobile_desktop_zero_overflow_landmarks_and_webgl_fallback(static_base_url):
    js_check = """(vw) => {
        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const bodyHiddenOv = document.body ? (document.body.scrollWidth > document.body.clientWidth + 1) : false;
        const vp = document.querySelector('meta[name="viewport"]');
        const vpContent = vp ? (vp.getAttribute('content') || '') : '';
        return {
            sw,
            bodyHiddenOv,
            vpContent,
            hasMain: !!document.querySelector('main'),
            hasH1: !!document.querySelector('h1'),
        };
    }"""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
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
                for route, _ in ROUTES:
                    page = ctx.new_page()
                    page_errs = []
                    bad_http = []
                    page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                    page.on("response", lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None)
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(120)
                    m = page.evaluate(js_check, width)
                    assert m["sw"] <= width, f"{route} overflow at {width}x{height}: sw={m['sw']}"
                    assert not m["bodyHiddenOv"], f"{route} body hidden overflow at {width}x{height}"
                    assert "user-scalable=no" not in m["vpContent"] and "maximum-scale=1" not in m["vpContent"]
                    assert m["hasMain"] and m["hasH1"], f"{route} missing <main>/<h1>"
                    assert not page_errs, f"{route} page errors at {width}x{height}: {page_errs}"
                    assert not bad_http, f"{route} HTTP>=400 at {width}x{height}: {bad_http}"
                    page.close()
                ctx.close()

            # super-arcade-v3 renders all 12 cabinets + hall fallback & clean cabinet launch/return without WebGL
            ctx_sa = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            pg = ctx_sa.new_page()
            sa_errs = []
            pg.on("pageerror", lambda e: sa_errs.append(str(e)))
            pg.goto(f"{static_base_url}/games/super-arcade-v3/", wait_until="domcontentloaded", timeout=20000)
            pg.wait_for_timeout(180)
            assert pg.locator(".hall-3d-wrap .nsp-webgl-fallback").count() == 1
            assert pg.locator("[data-launch]").count() == 12
            pg.locator("[data-launch]").first.click()
            pg.wait_for_timeout(200)
            assert pg.locator("#stageWrap .nsp-webgl-fallback").count() == 1
            pg.locator("#stageWrap .nsp-webgl-fallback button").click()
            pg.wait_for_timeout(120)
            assert pg.locator("#hallView").is_visible()
            assert not sa_errs, f"super-arcade-v3 page errors without WebGL: {sa_errs}"
            ctx_sa.close()
        finally:
            browser.close()


def test_forced_colors_zero_leaks_and_zero_overflow(static_base_url):
    js_fc = """(vw) => {
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
        return { sw, fcLeaks };
    }"""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
        try:
            for width, height, dpr in [(1280, 800, 1), (390, 844, 2)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr, forced_colors="active")
                for route, _ in ROUTES:
                    page = ctx.new_page()
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(120)
                    m = page.evaluate(js_fc, width)
                    assert m["sw"] <= width, f"{route} forced-colors {width}x{height} overflow: sw={m['sw']}"
                    assert m["fcLeaks"] == 0, f"{route} forced-colors {width}x{height} leaks={m['fcLeaks']}"
                    page.close()
                ctx.close()
        finally:
            browser.close()
