"""Regression tests for northstarprime-always-on 16 localized contact/portfolio & hire specialist routes @media (forced-colors: active) & Rule 46 upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-localized-contact-portfolio-hire-fc-20261120"

ROUTES = [
    "/cs/contact/",
    "/cs/portfolio/",
    "/es/contact/",
    "/es/portfolio/",
    "/ja/contact/",
    "/ja/portfolio/",
    "/ko/contact/",
    "/ko/portfolio/",
    "/ru/contact/",
    "/ru/portfolio/",
    "/zh/contact/",
    "/zh/portfolio/",
    "/hire/docker-repair/",
    "/hire/local-business-website/",
    "/hire/onboarding/",
    "/hire/watchdog-engineering/",
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
                "/cs/contact/": [
                    "section.card",
                    "div.note",
                    "a#draft-link",
                    "button#copy-email-btn",
                    "button.chip",
                    "header nav a:not(.active)",
                ],
                "/zh/contact/": [
                    "div.receipt-note",
                    "a#draft-link",
                    "button#copy-draft-btn",
                ],
                "/cs/portfolio/": [
                    "section.work a.case",
                    "section.cta",
                    "section.cta a.button",
                    "header nav a",
                ],
                "/hire/onboarding/": [
                    "div.card",
                    "div.badge-deposit",
                    "input#clientName",
                    "select#accessPref",
                    "textarea#issues",
                    "button#submitBtn",
                    "a#quickBrowserContact",
                ],
                "/hire/docker-repair/": [
                    "div.demo",
                    "div.offer",
                    "a.button:not(.secondary)",
                    "a.button.secondary",
                    "header div a",
                ],
                "/hire/local-business-website/": [
                    "aside.proof-card",
                    "article.tier",
                    "input#biz-name",
                    "select#biz-category",
                    "textarea#biz-goal",
                    "a.button.mint",
                    "a.button.secondary",
                ],
                "/hire/watchdog-engineering/": [
                    "div.demo",
                    "div.offer",
                    "a.button:not(.secondary)",
                    "a.button.secondary",
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
                ("/cs/contact/", "a#draft-link", "button#copy-email-btn"),
                ("/cs/portfolio/", "section.cta a.button", "header nav a"),
                ("/hire/onboarding/", "button#submitBtn", "a#quickBrowserContact"),
                ("/hire/docker-repair/", "a.button:not(.secondary)", "a.button.secondary"),
                ("/hire/local-business-website/", "a.button:not(.secondary)", "a.button.secondary"),
                ("/hire/watchdog-engineering/", "a.button:not(.secondary)", "a.button.secondary"),
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

            page.goto(f"{static_base_url}/cs/contact/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            assert "vorath_btn_primary.webp" in page.evaluate("getComputedStyle(document.querySelector('a#draft-link')).borderImageSource")

            page.goto(f"{static_base_url}/zh/contact/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            assert "vorath_stat_plaque_v01.webp" in page.evaluate("getComputedStyle(document.querySelector('div.receipt-note')).borderImageSource")

            page.goto(f"{static_base_url}/cs/portfolio/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            assert "vorath_btn_primary.webp" in page.evaluate("getComputedStyle(document.querySelector('section.cta a.button')).borderImageSource")
            assert "vorath_card_frame_v01.webp" in page.evaluate("getComputedStyle(document.querySelector('section#work > a.case')).borderImageSource")

            page.goto(f"{static_base_url}/hire/onboarding/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            assert "vorath_btn_primary.webp" in page.evaluate("getComputedStyle(document.querySelector('button#submitBtn')).borderImageSource")

            for route in ("/hire/docker-repair/", "/hire/local-business-website/", "/hire/watchdog-engineering/"):
                page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(50)
                assert "vorath_btn_primary.webp" in page.evaluate("getComputedStyle(document.querySelector('a.button:not(.secondary)')).borderImageSource")
                assert "vorath_btn_obsidian.webp" in page.evaluate("getComputedStyle(document.querySelector('a.button.secondary')).borderImageSource")

            mob_ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2)
            mob_page = mob_ctx.new_page()
            for route in ("/hire/docker-repair/", "/hire/watchdog-engineering/"):
                mob_page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=15000)
                mob_page.wait_for_timeout(50)
                bh = mob_page.evaluate("document.querySelector('header a.brand').getBoundingClientRect().height")
                assert bh <= 80, f"{route} mobile header brand stretched vertically: height={bh}"
            mob_ctx.close()

            ctx.close()
        finally:
            browser.close()
