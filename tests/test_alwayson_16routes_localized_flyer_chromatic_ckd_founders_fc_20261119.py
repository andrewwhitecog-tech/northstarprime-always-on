"""Regression tests for northstarprime-always-on 16 localized home/hire, realm flyer, chromatic, ckd-kitchen & founders routes @media (forced-colors: active) upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

from playwright.sync_api import sync_playwright
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-16routes-localized-flyer-chromatic-ckd-founders-fc-20261119"

ROUTES = [
    "/realm/flyer/",
    "/chromatic/",
    "/ckd-kitchen/",
    "/founders/",
    "/cs/",
    "/cs/hire/",
    "/es/",
    "/es/hire/",
    "/ja/",
    "/ja/hire/",
    "/ko/",
    "/ko/hire/",
    "/ru/",
    "/ru/hire/",
    "/zh/",
    "/zh/hire/",
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
                "/realm/flyer/": [
                    "article.sheet",
                    "article.sheet ul li a",
                ],
                "/chromatic/": [
                    "div.transit-card",
                    "a.btn-enter",
                    "a.profile-link",
                    ".gumroad-list a",
                ],
                "/ckd-kitchen/": [
                    "header.top",
                    "section.panel",
                    "input[type='search']",
                    "form.search-box button[type='submit']",
                    "a.button",
                ],
                "/founders/": [
                    "figure.plate",
                    "main a.cta",
                    "main a.back",
                ],
                "/cs/": [
                    "header.top",
                    "a.button.primary",
                    "a.button:not(.primary)",
                    "a.card",
                ],
                "/cs/hire/": [
                    "article.offer",
                    "a.button.primary",
                    "a.button:not(.primary)",
                ],
                "/ja/": [
                    "a.button.primary",
                    "a.card",
                ],
                "/zh/hire/": [
                    "article.offer",
                    "a.button.primary",
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

            # Verify primary CTAs contrast distinctly from secondary buttons in forced-colors
            for route, pri_sel, sec_sel in [
                ("/chromatic/", "a.btn-enter", "a.profile-link"),
                ("/ckd-kitchen/", "form.search-box button[type='submit']", "a.button.alt"),
                ("/founders/", "main a.cta", "main a.back"),
                ("/cs/", "a.button.primary", "a.button:not(.primary)"),
                ("/cs/hire/", "a.button.primary", "a.button:not(.primary)"),
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

            page.goto(f"{static_base_url}/chromatic/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            btn_bi = page.evaluate("getComputedStyle(document.querySelector('a.btn-enter')).borderImageSource")
            assert "vorath_btn_primary.webp" in btn_bi, f"Normal mode chromatic btn broken: {btn_bi}"

            page.goto(f"{static_base_url}/ckd-kitchen/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            ckd_pri_bi = page.evaluate("getComputedStyle(document.querySelector('a.button:not(.alt)')).borderImageSource")
            assert "vorath_btn_primary.webp" in ckd_pri_bi, f"Normal mode ckd-kitchen primary button broken: {ckd_pri_bi}"
            ckd_alt_bi = page.evaluate("getComputedStyle(document.querySelector('a.button.alt')).borderImageSource")
            assert "vorath_btn_obsidian.webp" in ckd_alt_bi, f"Normal mode ckd-kitchen alt button broken: {ckd_alt_bi}"

            page.goto(f"{static_base_url}/founders/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            f_bi = page.evaluate("getComputedStyle(document.querySelector('main a.cta')).borderImageSource")
            assert "vorath_btn_primary.webp" in f_bi, f"Normal mode founders CTA broken: {f_bi}"

            page.goto(f"{static_base_url}/cs/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            cs_bi = page.evaluate("getComputedStyle(document.querySelector('a.button.primary')).borderImageSource")
            assert "vorath_btn_primary.webp" in cs_bi, f"Normal mode cs primary CTA broken: {cs_bi}"

            page.goto(f"{static_base_url}/cs/hire/", wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(50)
            hire_bi = page.evaluate("getComputedStyle(document.querySelector('article.offer a.button.primary')).borderImageSource")
            assert "vorath_btn_primary.webp" in hire_bi, f"Normal mode cs/hire primary CTA broken: {hire_bi}"

            ctx.close()
        finally:
            browser.close()
