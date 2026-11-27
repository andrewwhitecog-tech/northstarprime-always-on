"""Regression tests for northstarprime-always-on 16 untouched portals, cookbook fantasy table, kidney/herbal guides & studio utilities @media (forced-colors: active) & Rule 46 upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-portals-cookbook-guides-fc-20261120"

ROUTES = [
    "/IDR_YOUTUBE_TASTE_MINER_WEB.html",
    "/family/",
    "/harbor/",
    "/herbal/",
    "/quant/",
    "/renalshield/",
    "/sigil-forge/tarot.html",
    "/static/cookbook_v10/fantasy_table/wave096.html",
    "/static/cookbook_v10/fantasy_table/wave097.html",
    "/static/cookbook_v10/fantasy_table/wave098.html",
    "/static/experiences/digital_terrarium/",
    "/static/guides/andrews_esrd_cookbook.html",
    "/static/guides/ckd_hot_sauces.html",
    "/static/guides/ckd_world_cookbook.html",
    "/tools/withheld_manga_page.html",
    "/xmr/",
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

            spot_checks = {
                "/IDR_YOUTUBE_TASTE_MINER_WEB.html": [
                    "div.card",
                    "div.drop-zone",
                    "textarea#url-input",
                    "button.btn-action",
                    "div.nav-links a.nav-btn",
                ],
                "/family/": [
                    "section.shelf article",
                    "section.parents",
                    "section.shelf article a.button",
                    "header.topbar a.brand",
                ],
                "/harbor/": [
                    "section.fleet",
                    "div.cta a.btn-primary",
                    "div.cta a.btn-secondary",
                ],
                "/herbal/": [
                    "section.hero",
                    "section.about-library",
                    "div.actions a.button",
                    "header.topbar a.brand",
                    "section.about-library a",
                ],
                "/quant/": [
                    "section.lab",
                    "input#probability",
                    "select#outcome",
                    "button.primary[type=submit]",
                    "button.secondary#example",
                ],
                "/renalshield/": [
                    "div.banner",
                    "section.card",
                    "div.actions a.button:not(.alt)",
                    "div.actions a.button.alt",
                    "div.top a.home",
                    "nav.related a.card",
                ],
                "/sigil-forge/tarot.html": [
                    "main",
                    "main a",
                ],
                "/static/cookbook_v10/fantasy_table/wave096.html": [
                    "aside.notice",
                    "nav#recipes",
                    "article.recipe",
                    "main > a",
                    "nav#recipes li > a",
                ],
                "/static/experiences/digital_terrarium/": [
                    "div.actions a.button.primary",
                    "div.actions a.button:not(.primary)",
                    "nav.chamber-map a",
                    "header.site-header a.wordmark",
                ],
                "/static/guides/andrews_esrd_cookbook.html": [
                    "main",
                    "a.chapter",
                    "a.quiet",
                ],
                "/tools/withheld_manga_page.html": [
                    "main",
                    'main > a[href="/comics/"]',
                    'main > a:not([href="/comics/"])',
                ],
                "/xmr/": [
                    "article.card",
                    "div.address",
                    "section.hero h1",
                    "article.card a.button",
                    "nav.nav a.brand",
                ],
            }
            for route, selectors in spot_checks.items():
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(50)
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
                ("/IDR_YOUTUBE_TASTE_MINER_WEB.html", "button.btn-action", "div.nav-links a.nav-btn"),
                ("/family/", "section.shelf article a.button", "header.topbar a.brand"),
                ("/harbor/", "div.cta a.btn-primary", "div.cta a.btn-secondary"),
                ("/herbal/", "div.actions a.button", "header.topbar a.brand"),
                ("/quant/", "button.primary[type=submit]", "button.secondary#example"),
                ("/renalshield/", "div.actions a.button:not(.alt)", "div.actions a.button.alt"),
                ("/static/cookbook_v10/fantasy_table/wave096.html", "main > a", "nav#recipes li > a"),
                ("/static/experiences/digital_terrarium/", "div.actions a.button.primary", "div.actions a.button:not(.primary)"),
                ("/static/guides/andrews_esrd_cookbook.html", "a.chapter", "a.quiet"),
                ("/tools/withheld_manga_page.html", 'main > a[href="/comics/"]', 'main > a:not([href="/comics/"])'),
                ("/xmr/", "article.card a.button", "nav.nav a.brand"),
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
                ("/IDR_YOUTUBE_TASTE_MINER_WEB.html", "button.btn-action", "vorath_btn_primary.webp"),
                ("/family/", "section.shelf article a.button", "vorath_stat_plaque_v01.webp"),
                ("/harbor/", "div.cta a.btn-primary", "vorath_btn_primary.webp"),
                ("/herbal/", "div.actions a.button", "vorath_btn_primary.webp"),
                ("/quant/", "button.primary[type=submit]", "vorath_btn_primary.webp"),
                ("/renalshield/", "div.actions a.button:not(.alt)", "vorath_btn_primary.webp"),
                ("/sigil-forge/tarot.html", "main a", "vorath_btn_primary.webp"),
                ("/static/cookbook_v10/fantasy_table/wave096.html", "main > a", "vorath_cartouche_9slice.webp"),
                ("/static/experiences/digital_terrarium/", "div.actions a.button.primary", "vorath_btn_primary.webp"),
                ("/static/guides/andrews_esrd_cookbook.html", "a.chapter", "vorath_btn_primary.webp"),
                ("/tools/withheld_manga_page.html", 'main > a[href="/comics/"]', "vorath_btn_primary.webp"),
                ("/xmr/", "article.card a.button", "vorath_btn_primary.webp"),
            ]
            for route, sel, asset in checks:
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(50)
                bi = page.evaluate(f"getComputedStyle(document.querySelector({sel!r})).borderImageSource")
                assert asset in bi, f"Normal-mode Vorath plaque {asset} missing on {route} ({sel}): {bi}"
            ctx.close()
        finally:
            browser.close()
