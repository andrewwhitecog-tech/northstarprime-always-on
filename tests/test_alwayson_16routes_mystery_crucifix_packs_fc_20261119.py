"""Regression tests for northstarprime-always-on 16 untouched Mystery School, I Ching, Crucifix Atelier & StickerForge Pack routes @media (forced-colors: active) upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-mystery-crucifix-packs-fc-20261119"

ROUTES = [
    "/mystery-school/",
    "/mystery-school/iching/",
    "/stickerforge/bumper-stickers/",
    "/stickerforge/crucifix/",
    "/stickerforge/crucifix/biker-regal/",
    "/stickerforge/crucifix/biker-regal-v02/",
    "/stickerforge/crucifix/holiday-pride/",
    "/stickerforge/crucifix/neon-blacklight/",
    "/stickerforge/crucifix/precious-materials/",
    "/stickerforge/crucifix/robot-ai/",
    "/stickerforge/crucifix/shrimp-messiah/",
    "/stickerforge/crucifix/stained-glass-student-faith/",
    "/stickerforge/crucifix/visionary-symbols/",
    "/stickerforge/packs/cosmic-cabinet-20261008/",
    "/stickerforge/packs/aurora-menagerie/",
    "/stickerforge/packs/goldlight-almanac/",
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
                    resp = page.goto(f"{static_base_url}{route}", wait_until="load", timeout=15000)
                    assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                    page.wait_for_timeout(80)
                    sw = page.evaluate(
                        "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                    )
                    assert sw <= width, f"{route} overflow at {width}x{height}: scrollWidth={sw}"
                ctx.close()
        finally:
            browser.close()


def test_forced_colors_active_resets_plaque_and_badge_art(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800}, forced_colors="active")
            page = ctx.new_page()
            for route in ROUTES:
                resp = page.goto(f"{static_base_url}{route}", wait_until="load", timeout=15000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(80)
                leaks = page.evaluate(
                    """() => {
                        const els = Array.from(document.querySelectorAll(
                            'a, button, summary, [role="button"], input, select, textarea, label.choice, .collection-tag, .vorath-plaque, .vorath-btn, .clip-btn, .card-btn, .chamber-pill, .brand-badge, .notes-badge, .card-badge, .lyric-badge'
                        ));
                        const bad = [];
                        for (const el of els) {
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

            # Verify active pressed state and visible sticker artwork on cosmic-cabinet-20261008
            page.goto(f"{static_base_url}/stickerforge/packs/cosmic-cabinet-20261008/", wait_until="load", timeout=15000)
            page.wait_for_timeout(80)
            pressed_check = page.evaluate(
                """() => {
                    const activeBtn = document.querySelector('button[aria-pressed="true"]');
                    const firstImg = document.querySelector('button.art img');
                    return {
                        hasActive: !!activeBtn,
                        fca: activeBtn ? getComputedStyle(activeBtn).forcedColorAdjust : null,
                        imgOk: !!(firstImg && firstImg.complete && firstImg.naturalWidth > 0),
                    };
                }"""
            )
            assert pressed_check["hasActive"] and pressed_check["fca"] == "none"
            assert pressed_check["imgOk"]
            ctx.close()
        finally:
            browser.close()
