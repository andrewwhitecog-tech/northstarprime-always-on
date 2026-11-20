"""Regression tests for northstarprime-always-on 11 remaining untouched core content, player, XBLA, comics, contact, literature, minecraft & realm routes @media (forced-colors: active) & Rule 46 upgrade."""
from __future__ import annotations

import functools
import hashlib
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-11routes-core-player-xbla-realm-fc-20261120"

ROUTES = [
    "/404.html",
    "/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE12.html",
    "/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE13.html",
    "/arcade/custom/dharma_invaders_xbla_edition.html",
    "/arcade/custom/void_pong_xbla_edition.html",
    "/comics/",
    "/contact/",
    "/literature/",
    "/minecraft/",
    "/minecraft/voice/",
    "/realm/",
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True
    daemon_threads = True


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
    if rel.endswith(".html"):
        return ROOT / rel
    return ROOT / rel / "index.html"


def test_all_11_files_have_style_id_and_minecraft_realm_mirror():
    for route in ROUTES:
        p = _route_to_file(route)
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {route}"
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors in {route}"

    mc_sha = hashlib.sha256((ROOT / "minecraft" / "index.html").read_bytes()).hexdigest()
    realm_sha = hashlib.sha256((ROOT / "realm" / "index.html").read_bytes()).hexdigest()
    assert mc_sha == realm_sha, "minecraft/index.html and realm/index.html must stay byte-identical"


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
                    page.wait_for_timeout(50)
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
                page.wait_for_timeout(50)
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

                tfill = page.evaluate(
                    """() => Array.from(document.querySelectorAll('h1,h2,h3,p,span,a')).filter(el => {
                        const cs = getComputedStyle(el);
                        const r = el.getBoundingClientRect();
                        if (r.width <= 2 || r.height <= 2 || cs.display === 'none' || cs.visibility === 'hidden') return false;
                        return cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)' || cs.webkitTextFillColor === 'transparent';
                    }).map(el => el.tagName + '.' + String(el.className))"""
                )
                assert not tfill, f"Transparent -webkit-text-fill-color on {route}: {tfill[:5]}"

            spot_checks = {
                "/404.html": ["div.error-card", "a.btn-home", "a.recovery-link"],
                "/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE12.html": [
                    "div.deck-card",
                    "button#btn-toggle-play",
                    "button.btn-tab.active",
                    "button.btn-tab:not(.active)",
                ],
                "/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE13.html": [
                    "div.deck-card",
                    "a.nav-btn.active",
                    "button#btnPreviewLoop",
                    "button#btnStopSynth",
                ],
                "/arcade/custom/dharma_invaders_xbla_edition.html": ["header#mast", "button#crtToggleBtn"],
                "/arcade/custom/void_pong_xbla_edition.html": ["div.panel", "button#begin", "button#crtToggleBtn"],
                "/comics/": [
                    "div.comic-card",
                    "button.filter-btn.active",
                    "a.btn-action.btn-primary",
                    "a.btn-action.btn-secondary",
                ],
                "/contact/": ["section.card", "a#draft-link.button", "button#copy-email-btn.button.secondary"],
                "/literature/": ["a.book-card", "a.shelf-pill.active", "a.btn-gold", "a.shelf-pill:not(.active)"],
                "/minecraft/": ["section.rule", "button#copy-invite", "nav a"],
                "/minecraft/voice/": ["main#main", "main#main p.action-links a:first-child", "header a.brand"],
                "/realm/": ["section.rule", "button#copy-invite", "nav a"],
            }
            for route, selectors in spot_checks.items():
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(40)
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

            for route, pri_sel, sec_sel in [
                ("/404.html", "a.btn-home", "a.recovery-link"),
                ("/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE12.html", "button#btn-toggle-play", "button.btn-tab:not(.active)"),
                ("/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE13.html", "button#btnPreviewLoop", "button#btnStopSynth"),
                ("/arcade/custom/dharma_invaders_xbla_edition.html", "button#start", "button#crtToggleBtn"),
                ("/arcade/custom/void_pong_xbla_edition.html", "button#begin", "button#crtToggleBtn"),
                ("/comics/", "button.filter-btn.active", "a.btn-action.btn-secondary"),
                ("/contact/", "a#draft-link.button", "button#copy-email-btn.button.secondary"),
                ("/literature/", "a.btn-gold", "a.shelf-pill:not(.active)"),
                ("/minecraft/", "button#copy-invite", "nav a"),
                ("/minecraft/voice/", "main#main p.action-links a:first-child", "header a.brand"),
                ("/realm/", "button#copy-invite", "nav a"),
            ]:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                pair = page.evaluate(
                    """([p, s]) => {
                        const a = document.querySelector(p);
                        const b = document.querySelector(s);
                        return {
                            abg: getComputedStyle(a).backgroundColor,
                            bbg: getComputedStyle(b).backgroundColor,
                        };
                    }""",
                    [pri_sel, sec_sel],
                )
                assert pair["abg"] != pair["bbg"], f"Primary vs secondary indistinguishable on {route}: {pair}"
            ctx.close()
        finally:
            browser.close()


def test_normal_mode_vorath_plaques_remain_intact(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()

            checks = [
                ("/404.html", "a.btn-home", "vorath_btn_primary.webp"),
                ("/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE12.html", "button#btn-toggle-play", "vorath_btn_primary.webp"),
                ("/NORTHSTAR_IDR_SUNO_MASTER_PLAYER_WAVE13.html", "button#btnPreviewLoop", "vorath_btn_primary.webp"),
                ("/arcade/custom/dharma_invaders_xbla_edition.html", "button#start", "vorath_card_frame_v01.webp"),
                ("/arcade/custom/void_pong_xbla_edition.html", "button#begin", "vorath_btn_primary.webp"),
                ("/comics/", "button.filter-btn.active", "vorath_btn_primary.webp"),
                ("/contact/", "a#draft-link.button", "vorath_btn_primary.webp"),
                ("/literature/", "a.shelf-pill.active", "vorath_btn_active.webp"),
                ("/minecraft/", "button#copy-invite", "vorath_btn_primary.webp"),
                ("/minecraft/voice/", "main#main p.action-links a:first-child", "vorath_stat_plaque_v01.webp"),
                ("/realm/", "button#copy-invite", "vorath_btn_primary.webp"),
            ]
            for route, sel, asset in checks:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(50)
                bi = page.evaluate(f"getComputedStyle(document.querySelector({sel!r})).borderImageSource")
                assert asset in bi, f"Normal-mode Vorath plaque {asset} missing on {route} ({sel}): {bi}"
            ctx.close()
        finally:
            browser.close()
