"""Regression tests for northstarprime-always-on 16 literature, cosmos, merch, imprint & family routes @media (forced-colors: active) & zero-occlusion upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-lit-cosmos-merch-family-fc-20261119"

ROUTES = [
    "/literature/the-null-calendar/",
    "/portfolio/",
    "/cosmos/",
    "/acid-voxel-halloween/",
    "/little-light-library/",
    "/minecraft-commissions/",
    "/pnw-lost-tables-2020/",
    "/raven-and-rose-1883/",
    "/sovereign-merch/",
    "/stream-overlays/",
    "/voiceover/",
    "/vorath-x-icp-dark-carnival/",
    "/vorath-x-kpop-demon-hunters/",
    "/family/01-ash-and-the-bell-that-needed-two-paws/",
    "/family/21-the-kite-with-room-for-a-knot/",
    "/family/25-the-quiet-seat-on-the-carousel/",
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


def test_null_calendar_closed_nav_menu_collapsed_and_unoccluded(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            page = ctx.new_page()
            resp = page.goto(
                f"{static_base_url}/literature/the-null-calendar/",
                wait_until="domcontentloaded",
                timeout=15000,
            )
            assert resp is not None and resp.status == 200
            page.wait_for_timeout(80)
            info = page.evaluate(
                """() => {
                    const details = document.querySelector('details.nsp-nav-more');
                    const menu = document.querySelector('.nsp-nav-menu');
                    const stats = Array.from(document.querySelectorAll('span.null-stat'));
                    const hits = stats.map(el => {
                        el.scrollIntoView({block: 'center', behavior: 'instant'});
                        const r = el.getBoundingClientRect();
                        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                        return {
                            text: el.textContent.trim(),
                            ok: hit === el || el.contains(hit),
                            hitTag: hit ? hit.tagName + '.' + hit.className : null,
                        };
                    });
                    return {
                        detailsOpen: details ? details.open : null,
                        menuDisplay: menu ? getComputedStyle(menu).display : null,
                        hits,
                    };
                }"""
            )
            assert info["detailsOpen"] is False
            assert info["menuDisplay"] == "none"
            assert len(info["hits"]) == 4
            assert all(h["ok"] for h in info["hits"]), f"Occluded .null-stat: {info['hits']}"
            ctx.close()
        finally:
            browser.close()


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
                    page.wait_for_timeout(60)
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
                page.wait_for_timeout(60)
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

            spot_checks = {
                "/literature/the-null-calendar/": [
                    "nav.nsp-site-nav",
                    "main.null-book",
                    "a.null-btn.primary",
                    "span.null-stat",
                ],
                "/portfolio/": [
                    "section.cta",
                    "section.cta a.button",
                    "section#work > a.case",
                ],
                "/cosmos/": [
                    "div#title.overlay",
                    "button#btn-enter",
                    "button#btn-newrealm",
                ],
                "/acid-voxel-halloween/": [
                    "button.filter-btn.active",
                    "button.filter-btn:not(.active)",
                    "div.table-wrap",
                ],
                "/little-light-library/": [
                    "input#find-book",
                    "select#book-range",
                    "article.card > a",
                ],
                "/family/01-ash-and-the-bell-that-needed-two-paws/": [
                    "button#smaller",
                    "input#text-only",
                    "section.book-end",
                ],
            }
            for route, selectors in spot_checks.items():
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(60)
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

            # Verify active filter button contrasts distinctly from inactive filter button
            page.goto(f"{static_base_url}/acid-voxel-halloween/", wait_until="domcontentloaded", timeout=15000)
            pair = page.evaluate(
                """() => {
                    const a = document.querySelector('button.filter-btn.active');
                    const b = document.querySelector('button.filter-btn:not(.active)');
                    return {
                        abg: getComputedStyle(a).backgroundColor,
                        bbg: getComputedStyle(b).backgroundColor,
                    };
                }"""
            )
            assert pair["abg"] != pair["bbg"], f"Active vs inactive filter button indistinguishable: {pair}"
            ctx.close()
        finally:
            browser.close()


def test_normal_mode_vorath_plaques_remain_intact(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            page = ctx.new_page()

            page.goto(f"{static_base_url}/literature/the-null-calendar/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(60)
            btn_bi = page.evaluate("getComputedStyle(document.querySelector('a.null-btn.primary')).borderImageSource")
            assert "vorath_btn_primary.webp" in btn_bi, f"Normal mode primary button broken: {btn_bi}"

            page.goto(f"{static_base_url}/portfolio/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(60)
            cta_bi = page.evaluate("getComputedStyle(document.querySelector('section.cta a.button')).borderImageSource")
            assert "vorath_btn_primary.webp" in cta_bi, f"Normal mode portfolio CTA broken: {cta_bi}"

            page.goto(f"{static_base_url}/sovereign-merch/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(60)
            ask_bi = page.evaluate("getComputedStyle(document.querySelector('a.ask')).borderImageSource")
            assert "vorath_btn_obsidian.webp" in ask_bi, f"Normal mode sovereign-merch ask broken: {ask_bi}"

            page.goto(f"{static_base_url}/little-light-library/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(60)
            card_bi = page.evaluate("getComputedStyle(document.querySelector('article.card > a')).borderImageSource")
            assert "vorath_card_frame_v01.webp" in card_bi, f"Normal mode library card broken: {card_bi}"

            ctx.close()
        finally:
            browser.close()
