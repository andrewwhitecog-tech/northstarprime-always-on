"""Regression tests for northstarprime-always-on final 10 unowned non-locked routes forced-colors leak elimination and 320px/390px overflow remediation."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

ROUTES = [
    "/idr/signal-refrains/volume-01/",
    "/literature/the-fifth-circuit/",
    "/literature/the-null-calendar/",
    "/literature/the-obituary-engine/",
    "/literature/the-vorath-codex-vol3/",
    "/mystery-school/circle/",
    "/mystery-school/curriculum/",
    "/mystery-school/garden/",
    "/mystery-school/high-thoughts/",
    "/mystery-school/library/",
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


def test_all_10_routes_have_forced_colors_and_responsive_markers():
    for route in ROUTES:
        p = _route_to_file(route)
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors in {route}"

    for route, needle in [
        ("/idr/signal-refrains/volume-01/", "@media (max-width:560px) { nav { flex-wrap:wrap; gap:.5rem; }"),
        ("/literature/the-fifth-circuit/", "html body span.meta-pill:not(#__fc0)"),
        ("/literature/the-null-calendar/", ".nsp-shell-v2 .nsp-nav-primary > a {"),
        ("/literature/the-obituary-engine/", ".reader p,.reader blockquote,.reader li,.reader h1,.reader h2,.reader h3{overflow-wrap:anywhere}"),
        ("/literature/the-vorath-codex-vol3/", "html:root body table.planets-table thead tr th"),
        ("/mystery-school/circle/", "minmax(min(100%, 280px), 1fr)"),
        ("/mystery-school/curriculum/", "html body .degree-badges .badge"),
        ("/mystery-school/garden/", "minmax(min(100%, 320px), 1fr)"),
        ("/mystery-school/high-thoughts/", "html body section.word-lab:not(#__fc0)"),
        ("/mystery-school/library/", "minmax(min(100%, 320px), 1fr)"),
    ]:
        txt = _route_to_file(route).read_text(encoding="utf-8")
        assert needle in txt, f"Missing expected patch marker {needle} in {route}"


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
                for route in ROUTES:
                    page = ctx.new_page()
                    console_errs = []
                    page_errs = []
                    bad_http = []
                    page.on("console", lambda m, ce=console_errs: ce.append(m.text) if m.type == "error" else None)
                    page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                    page.on(
                        "response",
                        lambda r, bh=bad_http: bh.append((r.status, r.url))
                        if r.status >= 400 and not r.url.endswith("/static/mystery_school/mote-manifest.json")
                        else None,
                    )
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(120)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                    assert not bad_http, f"{route} unexpected HTTP>=400 at {width}x{height}: {bad_http}"
                    assert not page_errs, f"{route} page errors at {width}x{height}: {page_errs}"
                    non_mote_errs = [e for e in console_errs if "status of 404" not in e]
                    assert not non_mote_errs, f"{route} console errors at {width}x{height}: {non_mote_errs}"
                    page.close()
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
                for route in ROUTES:
                    page = ctx.new_page()
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                    assert resp is not None and resp.status == 200, f"{route} status={resp.status if resp else None}"
                    page.wait_for_timeout(120)
                    metrics = page.evaluate(js_fc)
                    assert metrics["sw"] <= width, f"{route} forced-colors {width}x{height} overflow: sw={metrics['sw']}"
                    assert metrics["fcLeaks"] == 0, f"{route} forced-colors {width}x{height} leaks={metrics['fcLeaks']}"
                    page.close()
                ctx.close()
        finally:
            browser.close()
