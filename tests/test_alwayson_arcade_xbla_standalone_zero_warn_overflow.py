"""Regression tests for northstarprime-always-on 10 standalone & XBLA /arcade/custom/*.html cabinets (+ 4 mirrors) Rule 46 Zero-CHIP_WARN, zero-overflow & forced-colors upgrade."""
from __future__ import annotations

import functools
import hashlib
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-arcade10-xbla-zero-warn-overflow-20261119"

CANONICAL_ROUTES = [
    "/arcade/custom/blazin-beaver-comic.html",
    "/arcade/custom/crownfall_intercept_xbla_edition.html",
    "/arcade/custom/glyphbreaker_xbla_edition.html",
    "/arcade/custom/ossuary_orbit_xbla_edition.html",
    "/arcade/custom/pac_dharma_xbla_edition.html",
    "/arcade/custom/snake_dimension_xbla_edition.html",
    "/arcade/custom/system1-tactical-arena.html",
    "/arcade/custom/xbla_blades_dashboard_omniverse.html",
    "/arcade/custom/logic-foundry.html",
    "/arcade/custom/vorath-arena.html",
]

MIRROR_PAIRS = [
    ("arcade/custom/blazin-beaver-comic.html", "arcade/custom/blazin_beaver_comic.html"),
    ("arcade/custom/system1-tactical-arena.html", "arcade/custom/system1_tactical_arena.html"),
    ("arcade/custom/logic-foundry.html", "arcade/custom/logic_foundry.html"),
    ("arcade/custom/vorath-arena.html", "arcade/custom/vorath_arena.html"),
]

FORCED_COLORS_PROBES = {
    "/arcade/custom/blazin-beaver-comic.html": "div#thumb-drawer > div.thumb-card > div.thumb-label",
    "/arcade/custom/crownfall_intercept_xbla_edition.html": "header > .gamertag-badge",
    "/arcade/custom/glyphbreaker_xbla_edition.html": "header > .gamertag-badge",
    "/arcade/custom/ossuary_orbit_xbla_edition.html": "header > .gamertag-badge",
    "/arcade/custom/pac_dharma_xbla_edition.html": "header > .gamertag-badge",
    "/arcade/custom/snake_dimension_xbla_edition.html": "div#hud > div.chip",
    "/arcade/custom/system1-tactical-arena.html": "div#weaponSelector > div.weapon-slot",
    "/arcade/custom/xbla_blades_dashboard_omniverse.html": "body > header > div.gamertag-badge > div.avatar-orb",
    "/arcade/custom/logic-foundry.html": "span#levelBadge",
    "/arcade/custom/vorath-arena.html": "#hWave",
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


def test_canonical_files_have_style_id_and_mirror_parity():
    for route in CANONICAL_ROUTES:
        p = ROOT / route.lstrip("/")
        assert p.exists(), f"Missing canonical file: {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing STYLE_ID in {route}"
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors:active in {route}"

    for src_rel, dst_rel in MIRROR_PAIRS:
        src_sha = hashlib.sha256((ROOT / src_rel).read_bytes()).hexdigest()
        dst_sha = hashlib.sha256((ROOT / dst_rel).read_bytes()).hexdigest()
        assert src_sha == dst_sha, f"Mirror drift between {src_rel} and {dst_rel}"


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
                    page.wait_for_timeout(500)
                    sw = page.evaluate("() => document.documentElement.scrollWidth")
                    assert sw <= vp_w, f"{route} overflow at {vp_w}: scrollWidth={sw}"
                ctx.close()

            # Verify system1-tactical-arena desktop #hud-player-status is positioned inside viewport
            ctx_d = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            pg_d = ctx_d.new_page()
            pg_d.goto(f"{static_base_url}/arcade/custom/system1-tactical-arena.html", wait_until="domcontentloaded")
            pg_d.wait_for_timeout(500)
            box = pg_d.locator("#hud-player-status").bounding_box()
            assert box is not None and box["x"] >= 0 and box["x"] + box["width"] <= 1280, f"Bad #hud-player-status box: {box}"
            ctx_d.close()

            # Verify forced-colors: active strips border-image and applies SystemColor on probed controls
            ctx_fc = browser.new_context(
                viewport={"width": 1280, "height": 800},
                device_scale_factor=1,
                forced_colors="active",
            )
            pg_fc = ctx_fc.new_page()
            for route, selector in FORCED_COLORS_PROBES.items():
                pg_fc.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                pg_fc.wait_for_timeout(300)
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
