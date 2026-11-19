"""Regression tests for northstarprime-always-on 11 CKD, Character Roster, Fifth Circuit, Website Repair & Legacy Arcade routes Rule 46 Zero-CHIP_WARN, zero-overflow & forced-colors upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-11routes-ckd-roster-arcade-zero-warn-20261119"

CANONICAL_ROUTES = [
    "/ckd-kitchen/flavor-atlas.html",
    "/ckd-kitchen/chairside-pocket-guide.html",
    "/ckd-kitchen/clinic-flyer.html",
    "/static/character_roster.html",
    "/static/literature/loomwheel/the-fifth-circuit/reader.html",
    "/hire/website-repair/",
    "/arcade/custom/cascade-salmon-run.html",
    "/arcade/custom/cascade_salmon_run.html",
    "/arcade/custom/void-pong/",
    "/arcade/custom/vorath-blade-tribunal/",
    "/arcade/custom/vorath_blade_tribunal.html",
]

FORCED_COLORS_PROBES = {
    "/ckd-kitchen/flavor-atlas.html": ".flavors span",
    "/ckd-kitchen/chairside-pocket-guide.html": ".pocket-card h2.section-title",
    "/ckd-kitchen/clinic-flyer.html": ".flyer",
    "/static/character_roster.html": ".card .type",
    "/static/literature/loomwheel/the-fifth-circuit/reader.html": "section p code",
    "/hire/website-repair/": ".example.after .demo-cta",
    "/arcade/custom/cascade-salmon-run.html": "#northstar-arcade-hud .nshud-brand",
    "/arcade/custom/cascade_salmon_run.html": "#northstar-arcade-hud .nshud-brand",
    "/arcade/custom/void-pong/": "#northstar-arcade-hud .nshud-brand",
    "/arcade/custom/vorath-blade-tribunal/": "#northstar-arcade-hud .nshud-brand",
    "/arcade/custom/vorath_blade_tribunal.html": ".meters .meter",
}


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
    rel = route.lstrip("/")
    if not rel.endswith(".html"):
        rel = rel.rstrip("/") + "/index.html"
    return ROOT / rel


def test_canonical_files_have_style_id_and_forced_colors():
    for route in CANONICAL_ROUTES:
        p = _route_to_file(route)
        assert p.exists(), f"Missing canonical file: {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing STYLE_ID in {route}"
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors:active in {route}"


def test_mobile_desktop_zero_overflow_and_forced_colors_live(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for vp_w, vp_h, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(viewport={"width": vp_w, "height": vp_h}, device_scale_factor=dpr)
                page = ctx.new_page()
                for route in CANONICAL_ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                    assert resp is not None and resp.status == 200, f"{route} status={resp}"
                    page.wait_for_timeout(600)
                    sw = page.evaluate("() => document.documentElement.scrollWidth")
                    assert sw <= vp_w, f"{route} overflow at {vp_w}: scrollWidth={sw}"
                ctx.close()

            # Verify flavor-atlas .roles-visual span is framed in normal mode
            ctx_n = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            pg_n = ctx_n.new_page()
            pg_n.goto(f"{static_base_url}/ckd-kitchen/flavor-atlas.html", wait_until="domcontentloaded")
            pg_n.wait_for_timeout(400)
            rv_bi = pg_n.evaluate("() => getComputedStyle(document.querySelector('.roles-visual span')).borderImageSource")
            assert "vorath_stat_plaque_v01.webp" in rv_bi, f"Expected Vorath plaque on .roles-visual span: {rv_bi}"
            ctx_n.close()

            # Verify forced-colors: active strips border-image on probed controls
            ctx_fc = browser.new_context(
                viewport={"width": 1280, "height": 800},
                device_scale_factor=1,
                forced_colors="active",
            )
            pg_fc = ctx_fc.new_page()
            for route, selector in FORCED_COLORS_PROBES.items():
                pg_fc.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                pg_fc.wait_for_timeout(500)
                st = pg_fc.evaluate(
                    """(sel) => {
                        const el = document.querySelector(sel);
                        if (!el) return null;
                        const cs = getComputedStyle(el);
                        return {bi: cs.borderImageSource, bg: cs.backgroundColor};
                    }""",
                    selector,
                )
                assert st is not None, f"Missing probe selector {selector} on {route}"
                assert st["bi"] == "none", f"Expected border-image:none in forced-colors on {route} {selector}: {st}"
            ctx_fc.close()
        finally:
            browser.close()
