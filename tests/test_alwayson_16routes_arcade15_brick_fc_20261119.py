"""Regression tests for northstarprime-always-on 15 /arcade/custom/* cabinets + /brick-alchemy/ @media (forced-colors: active) upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-arcade15-brick-fc-20261119"

ARCADE_ROUTES = [
    "/arcade/custom/digital-terrarium-3d/",
    "/arcade/custom/digital-terrarium-v1/",
    "/arcade/custom/digital-terrarium-v2/",
    "/arcade/custom/digital-terrarium/",
    "/arcade/custom/gem-shark/",
    "/arcade/custom/precinct-404/",
    "/arcade/custom/prediction-arena/",
    "/arcade/custom/slots-biolume/",
    "/arcade/custom/subject-000999/",
    "/arcade/custom/vorath-census/",
    "/arcade/custom/vorath-circus-midnight/",
    "/arcade/custom/vorath-circus/",
    "/arcade/custom/vorath-delve/",
    "/arcade/custom/vorath-reliquary-gacha-shrine/",
    "/arcade/custom/vorathic-reef-tank/",
]

ROUTES = ARCADE_ROUTES + ["/brick-alchemy/"]


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


def test_forced_colors_active_zero_leaks_and_high_contrast(static_base_url):
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

            # Spot-check system color contrast on key controls under forced-colors
            spot_checks = {
                "/arcade/custom/digital-terrarium-3d/": [
                    "nav#nsp-related a.nsp-rel-plaque.nsp-rel-teal",
                    "nav#nsp-related a.nsp-rel-plaque.nsp-rel-purple",
                ],
                "/arcade/custom/precinct-404/": [
                    "div#titleCover",
                    "button.officer",
                    "span#shiftChip",
                    "nav#nsp-related a.nsp-rel-plaque.nsp-rel-teal",
                ],
                "/arcade/custom/slots-biolume/": [
                    "button#spin-btn",
                    "div.hud-cartouche",
                ],
                "/arcade/custom/vorath-delve/": [
                    "div#overlay",
                    "nav.nsp-return > a",
                ],
                "/brick-alchemy/": [
                    "span.pill",
                    "button.tote-btn",
                    "div.calc-panel",
                ],
            }
            for route, selectors in spot_checks.items():
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(80)
                for sel in selectors:
                    vals = page.evaluate(
                        """(s) => {
                            const el = document.querySelector(s);
                            if (!el) return null;
                            const cs = getComputedStyle(el);
                            return {
                                bg: cs.backgroundColor,
                                fg: cs.color,
                                bi: cs.borderImageSource,
                                bgi: cs.backgroundImage,
                            };
                        }""",
                        sel,
                    )
                    assert vals is not None, f"Missing {sel} on {route}"
                    assert vals["bi"] == "none", f"border-image leaked on {sel} in {route}: {vals}"
                    assert vals["bgi"] == "none", f"background-image leaked on {sel} in {route}: {vals}"
                    assert vals["bg"] != vals["fg"], f"Contrast collapsed on {sel} in {route}: {vals}"

            ctx.close()
        finally:
            browser.close()


def test_normal_mode_vorath_plaques_remain_intact(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()
            for route in [
                "/arcade/custom/digital-terrarium-3d/",
                "/arcade/custom/precinct-404/",
                "/arcade/custom/prediction-arena/",
            ]:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(80)
                teal_bi = page.evaluate(
                    "getComputedStyle(document.querySelector('nav#nsp-related a.nsp-rel-plaque.nsp-rel-teal')).borderImageSource"
                )
                assert "vorath_btn_active.webp" in teal_bi, f"Normal mode teal plaque broken on {route}: {teal_bi}"

            page.goto(f"{static_base_url}/arcade/custom/vorath-delve/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(80)
            ov_bg = page.evaluate("getComputedStyle(document.querySelector('div#overlay')).backgroundImage")
            assert "title_cover.jpg" in ov_bg, f"Normal mode title cover broken on /arcade/custom/vorath-delve/: {ov_bg}"

            page.goto(f"{static_base_url}/brick-alchemy/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(80)
            pill_bi = page.evaluate("getComputedStyle(document.querySelector('span.pill')).borderImageSource")
            assert "vorath_stat_plaque_v01.webp" in pill_bi, f"Normal mode pill broken on /brick-alchemy/: {pill_bi}"
            ctx.close()
        finally:
            browser.close()
