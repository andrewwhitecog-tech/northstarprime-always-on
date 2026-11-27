"""Regression tests for northstarprime-always-on 7 standalone 3D game routes: mobile 320px/390px HUD layout, accessible viewport, forced-colors, and WebGL startup fallback."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-7games-3d-fc-320-webgl-20261122"

ROUTES = [
    "/games/flagship-3d-suite/",
    "/games/exotic-relic-armorer-3d/",
    "/games/precision-armory-3d/",
    "/games/pro-skate-3d/",
    "/games/quantum-pinball-3d/",
    "/games/vorath-loomgate-3d/",
    "/games/vorath-wargame-3d/",
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


def test_all_7_games_have_markers_and_accessible_viewport():
    for route in ROUTES:
        p = ROOT / route.strip("/") / "index.html"
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {route}"
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors:active in {route}"
        assert "__nspShowWebGLFallback" in txt, f"Missing WebGL fallback helper in {route}"
        assert "user-scalable=no" not in txt, f"Disallowed user-scalable=no still in {route}"
        assert "maximum-scale=1.0" not in txt, f"Disallowed maximum-scale=1.0 still in {route}"


def test_mobile_desktop_zero_overflow_and_hud_bounds_with_webgl_fallback(static_base_url):
    js_layout = """(vw) => {
        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const offscreen = [];
        for (const el of document.querySelectorAll('header, aside, main, nav, #ui-shell, .hud-grid, .hud-shell, .fx-hud, .hud-layer, #suite-ui, #hud-overlay, #tool-dock, #bottom-bar, #bottom-controls, #bottom-command, .top-bar, .nsp-hub-return-bar')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            if (r.right > vw + 2) offscreen.push({id: el.id || el.className, right: Math.round(r.right)});
        }
        const fb = document.querySelector('.nsp-webgl-fallback');
        return { sw, offscreen, fbText: fb ? fb.textContent : '', fbLink: !!document.querySelector('.nsp-webgl-fallback a[href="/games/"]') };
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
                for route in ROUTES:
                    page = ctx.new_page()
                    page_errs = []
                    bad_http = []
                    page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                    page.on("response", lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None)
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(120)
                    m = page.evaluate(js_layout, width)
                    assert m["sw"] <= width, f"{route} overflow at {width}x{height}: sw={m['sw']}"
                    assert not m["offscreen"], f"{route} HUD exceeds viewport at {width}x{height}: {m['offscreen']}"
                    assert "3D graphics could not start" in m["fbText"], f"{route} missing fallback banner"
                    assert m["fbLink"], f"{route} missing /games/ fallback link"
                    assert not page_errs, f"{route} page errors at {width}x{height}: {page_errs}"
                    assert not bad_http, f"{route} HTTP>=400 at {width}x{height}: {bad_http}"
                    page.close()
                ctx.close()

            # Flagship suite cards still render & open/close embedded runner when WebGL is unavailable
            ctx_fs = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            pg = ctx_fs.new_page()
            pg.goto(f"{static_base_url}/games/flagship-3d-suite/", wait_until="domcontentloaded", timeout=20000)
            pg.wait_for_timeout(120)
            assert pg.locator("#cards-dock .game-card").count() == 4
            for index in range(4):
                card = pg.locator("#cards-dock .game-card").nth(index)
                expected_url = card.locator("a").get_attribute("href")
                card.get_by_role("button").click(timeout=5000)
                assert pg.locator("#cabinet-runner").is_visible()
                assert pg.locator("#cabinet-iframe").get_attribute("src") == expected_url
                pg.keyboard.press("Escape")
                assert not pg.locator("#cabinet-runner").is_visible()
            ctx_fs.close()
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
        const off = [];
        for (const el of document.querySelectorAll('header, aside, main, nav, #ui-shell, .hud-grid, .hud-shell, .fx-hud, .hud-layer, #suite-ui, #hud-overlay, #tool-dock, #bottom-bar, #bottom-controls, #bottom-command, .top-bar')) {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > vw + 2) off.push(el.id || el.className);
        }
        return { sw, fcLeaks, off };
    }"""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
        try:
            for width, height, dpr in [(1280, 800, 1), (390, 844, 2)]:
                ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=dpr, forced_colors="active")
                for route in ROUTES:
                    page = ctx.new_page()
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200
                    page.wait_for_timeout(120)
                    m = page.evaluate(js_fc, width)
                    assert m["sw"] <= width, f"{route} forced-colors {width}x{height} overflow: sw={m['sw']}"
                    assert not m["off"], f"{route} forced-colors {width}x{height} HUD offscreen: {m['off']}"
                    assert m["fcLeaks"] == 0, f"{route} forced-colors {width}x{height} leaks={m['fcLeaks']}"
                    page.close()
                ctx.close()
        finally:
            browser.close()
