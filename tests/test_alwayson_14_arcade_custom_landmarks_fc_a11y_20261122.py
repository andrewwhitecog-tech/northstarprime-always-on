"""Regression tests for northstarprime-always-on final 14 unlocked arcade/custom routes:
semantic landmarks (<main>, <h1>), forced-colors overlay leak fixes (0 leaks),
prefers-reduced-motion, :focus-visible, void_pong CSS selector repair, byte-identical
hyphen/underscore alias pairs, and 320px/390px/1280px zero horizontal overflow."""
from __future__ import annotations

import functools
import hashlib
import http.server
import pathlib
import re
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-14arcade-custom-a11y-20261122"

UNIQUE_ROUTES = [
    ("/arcade/custom/blazin-beaver-comic.html", "arcade/custom/blazin-beaver-comic.html"),
    ("/arcade/custom/chrono-blade-2049/", "arcade/custom/chrono-blade-2049/index.html"),
    ("/arcade/custom/logic-foundry.html", "arcade/custom/logic-foundry.html"),
    ("/arcade/custom/prism-runner-2049/", "arcade/custom/prism-runner-2049/index.html"),
    ("/arcade/custom/system1-tactical-arena.html", "arcade/custom/system1-tactical-arena.html"),
    ("/arcade/custom/void-siege/", "arcade/custom/void-siege/index.html"),
    ("/arcade/custom/void_pong_xbla_edition.html", "arcade/custom/void_pong_xbla_edition.html"),
    ("/arcade/custom/vorath-arena.html", "arcade/custom/vorath-arena.html"),
    ("/arcade/custom/vorath_blade_tribunal.html", "arcade/custom/vorath_blade_tribunal.html"),
    ("/arcade/custom/xbla_blades_dashboard_omniverse.html", "arcade/custom/xbla_blades_dashboard_omniverse.html"),
]

IDENTICAL_PAIRS = [
    ("arcade/custom/blazin-beaver-comic.html", "arcade/custom/blazin_beaver_comic.html"),
    ("arcade/custom/logic-foundry.html", "arcade/custom/logic_foundry.html"),
    ("arcade/custom/system1-tactical-arena.html", "arcade/custom/system1_tactical_arena.html"),
    ("arcade/custom/vorath-arena.html", "arcade/custom/vorath_arena.html"),
]

ALL_14_FILES = [rel for _, rel in UNIQUE_ROUTES] + [alias for _, alias in IDENTICAL_PAIRS]


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


def test_all_14_files_static_landmarks_a11y_pairs_and_css_repair():
    for rel in ALL_14_FILES:
        p = ROOT / rel
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        low = txt.lower()
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {rel}"
        assert "@media (prefers-reduced-motion: reduce)" in txt, f"Missing reduced-motion CSS in {rel}"
        assert ":focus-visible" in txt, f"Missing :focus-visible in {rel}"
        assert "user-scalable=no" not in low, f"Disallowed user-scalable=no in {rel}"
        assert "maximum-scale=1" not in low, f"Disallowed maximum-scale=1 in {rel}"
        assert "<main" in low and "</main>" in low, f"Missing balanced <main> landmark in {rel}"
        assert "<h1" in low and "</h1>" in low, f"Missing <h1> heading in {rel}"

    for primary, alias in IDENTICAL_PAIRS:
        h1 = hashlib.sha256((ROOT / primary).read_bytes()).hexdigest()
        h2 = hashlib.sha256((ROOT / alias).read_bytes()).hexdigest()
        assert h1 == h2, f"Alias pair diverged: {primary} ({h1}) != {alias} ({h2})"

    vp_txt = (ROOT / "arcade/custom/void_pong_xbla_edition.html").read_text(encoding="utf-8")
    assert not re.search(r"(?m)^\s+\{\s*$", vp_txt), "Broken empty CSS selector still present in void_pong_xbla_edition.html"


def test_desktop_mobile_and_forced_colors_zero_overflow_zero_leaks(static_base_url):
    js_check = """() => {
        const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const bodyHiddenOv = document.body ? (document.body.scrollWidth > document.body.clientWidth + 1) : false;
        let fcLeaks = 0;
        const fcSample = [];
        for (const el of document.querySelectorAll('body *:not(img):not(picture):not(video):not(canvas):not(svg)')) {
            if (el.closest('svg')) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 2 || r.height <= 2) continue;
            if (cs.borderImageSource !== 'none' || cs.backgroundImage !== 'none') {
                fcLeaks++;
                if (fcSample.length < 5) fcSample.push(el.tagName + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : ''));
            }
        }
        return {
            sw,
            bodyHiddenOv,
            fcLeaks,
            fcSample,
            hasMain: !!document.querySelector('main'),
            hasH1: !!document.querySelector('h1'),
        };
    }"""

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
        try:
            # Desktop 1280x800 normal + forced-colors
            ctx_d = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            for route, _ in UNIQUE_ROUTES:
                page = ctx_d.new_page()
                page_errs = []
                bad_http = []
                page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                page.on("response", lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None)
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                assert resp is not None and resp.status == 200, f"{route} returned {resp.status if resp else None}"
                page.wait_for_timeout(120)

                m = page.evaluate(js_check)
                assert m["sw"] <= 1280, f"{route} desktop 1280 overflow: sw={m['sw']}"
                assert not m["bodyHiddenOv"], f"{route} desktop 1280 body hidden overflow"
                assert m["hasMain"] and m["hasH1"], f"{route} missing <main>/<h1>"
                assert not page_errs, f"{route} page errors: {page_errs}"
                assert not bad_http, f"{route} HTTP>=400: {bad_http}"

                page.emulate_media(forced_colors="active")
                page.wait_for_timeout(80)
                mf = page.evaluate(js_check)
                assert mf["sw"] <= 1280, f"{route} forced-colors 1280 overflow: sw={mf['sw']}"
                assert mf["fcLeaks"] == 0, f"{route} forced-colors 1280 leaks={mf['fcLeaks']} {mf['fcSample']}"
                page.close()
            ctx_d.close()

            # Mobile DPR=2: 390x844 normal + 320x568 normal + 390x844 forced-colors
            ctx_m = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
            )
            for route, _ in UNIQUE_ROUTES:
                page = ctx_m.new_page()
                page_errs = []
                bad_http = []
                page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                page.on("response", lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None)
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=20000)
                assert resp is not None and resp.status == 200
                page.wait_for_timeout(120)

                m390 = page.evaluate(js_check)
                assert m390["sw"] <= 390, f"{route} mobile 390 overflow: sw={m390['sw']}"
                assert not m390["bodyHiddenOv"], f"{route} mobile 390 body hidden overflow"

                page.set_viewport_size({"width": 320, "height": 568})
                page.wait_for_timeout(80)
                m320 = page.evaluate(js_check)
                assert m320["sw"] <= 320, f"{route} mobile 320 overflow: sw={m320['sw']}"
                assert not m320["bodyHiddenOv"], f"{route} mobile 320 body hidden overflow"
                if route == "/arcade/custom/prism-runner-2049/":
                    btn_box = page.locator("#startBtn").bounding_box()
                    assert btn_box is not None and btn_box["y"] >= 0 and (btn_box["y"] + btn_box["height"]) <= 568, (
                        f"prism-runner #startBtn clipped at 320x568: {btn_box}"
                    )

                page.set_viewport_size({"width": 390, "height": 844})
                page.emulate_media(forced_colors="active")
                page.wait_for_timeout(80)
                mfc = page.evaluate(js_check)
                assert mfc["sw"] <= 390, f"{route} forced-colors 390 overflow: sw={mfc['sw']}"
                assert mfc["fcLeaks"] == 0, f"{route} forced-colors 390 leaks={mfc['fcLeaks']} {mfc['fcSample']}"
                assert not page_errs, f"{route} mobile page errors: {page_errs}"
                assert not bad_http, f"{route} mobile HTTP>=400: {bad_http}"
                page.close()
            ctx_m.close()
        finally:
            browser.close()
