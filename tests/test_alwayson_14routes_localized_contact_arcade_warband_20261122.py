"""Regression tests for northstarprime-always-on 14 unlocked routes:
localized contact JS/mailto fix ({cs,es,ja,ko,ru,zh}/contact/) and
320px/390px overflow + forced-colors fixes across super-arcade-v3,
chrono-blade-2049, void-siege, cascade-salmon-run, vorath-arena, and warband.
"""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

LOCALIZED_CONTACT_ROUTES = [
    "/cs/contact/",
    "/es/contact/",
    "/ja/contact/",
    "/ko/contact/",
    "/ru/contact/",
    "/zh/contact/",
]

ARCADE_AND_WARBAND_ROUTES = [
    "/games/super-arcade-v3/",
    "/arcade/custom/chrono-blade-2049/",
    "/arcade/custom/void-siege/",
    "/arcade/custom/cascade_salmon_run.html",
    "/arcade/custom/vorath-arena.html",
    "/arcade/custom/vorath_arena.html",
    "/warband/",
]

ALL_ROUTES = LOCALIZED_CONTACT_ROUTES + ARCADE_AND_WARBAND_ROUTES


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


def _route_to_file(route: str) -> pathlib.Path:
    rel = route.lstrip("/")
    if rel.endswith("/"):
        rel += "index.html"
    return ROOT / rel


def test_static_invariants_across_all_14_files():
    for route in ALL_ROUTES:
        p = _route_to_file(route)
        assert p.is_file(), f"Missing {p}"
    for route in LOCALIZED_CONTACT_ROUTES:
        txt = _route_to_file(route).read_text(encoding="utf-8")
        assert "event.target" not in txt, f"Legacy event.target bug still present in {route}"
        assert 'data-preset="regalia"' in txt, f"Missing data-preset attributes in {route}"
        assert "encodeURIComponent(subject)" in txt, f"Missing encodeURIComponent mailto encoding in {route}"


def test_zero_overflow_zero_errors_and_zero_forced_colors_leaks(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--mute-audio", "--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
        )
        try:
            configs = [
                ("desktop_1280", {"viewport": {"width": 1280, "height": 800}, "device_scale_factor": 1}),
                ("mobile_320", {"viewport": {"width": 320, "height": 568}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}),
                ("mobile_390", {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "is_mobile": True, "has_touch": True}),
                ("forced_1280", {"viewport": {"width": 1280, "height": 800}, "device_scale_factor": 1, "forced_colors": "active"}),
                ("forced_390", {"viewport": {"width": 390, "height": 844}, "device_scale_factor": 2, "forced_colors": "active"}),
            ]
            for cname, ctx_kw in configs:
                ctx = browser.new_context(**ctx_kw)
                max_w = ctx_kw["viewport"]["width"]
                is_fc = ctx_kw.get("forced_colors") == "active"
                try:
                    for route in ALL_ROUTES:
                        page = ctx.new_page()
                        page_errs = []
                        bad_http = []
                        page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                        page.on(
                            "response",
                            lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None,
                        )
                        resp = page.goto(static_base_url + route, wait_until="domcontentloaded", timeout=20000)
                        page.wait_for_timeout(120)
                        assert resp is not None and resp.status == 200, f"{cname} {route} status={resp}"
                        metrics = page.evaluate("""() => {
                            const sw = Math.max(
                                document.documentElement.scrollWidth,
                                document.body ? document.body.scrollWidth : 0
                            );
                            const broken = [];
                            for (const img of document.querySelectorAll('img')) {
                                if (img.getAttribute('src') && img.complete && img.naturalWidth === 0) {
                                    broken.push(img.getAttribute('src'));
                                }
                            }
                            let fcLeaks = 0;
                            const leakSamples = [];
                            for (const el of document.querySelectorAll('*')) {
                                const cs = getComputedStyle(el);
                                if (cs.display === 'none' || cs.visibility === 'hidden') continue;
                                const r = el.getBoundingClientRect();
                                if (r.width < 4 || r.height < 4) continue;
                                if ((cs.backgroundImage && cs.backgroundImage.includes('url(')) ||
                                    (cs.borderImageSource && cs.borderImageSource.includes('url('))) {
                                    fcLeaks++;
                                    if (leakSamples.length < 4) leakSamples.push(el.tagName + '.' + (el.className || ''));
                                }
                            }
                            return { sw, broken, fcLeaks, leakSamples };
                        }""")
                        page.close()
                        assert not page_errs, f"{cname} {route} pageerror: {page_errs}"
                        assert not bad_http, f"{cname} {route} bad_http: {bad_http}"
                        assert not metrics["broken"], f"{cname} {route} broken imgs: {metrics['broken']}"
                        assert metrics["sw"] <= max_w, f"{cname} {route} scrollWidth={metrics['sw']} > {max_w}"
                        if is_fc:
                            assert metrics["fcLeaks"] == 0, f"{cname} {route} fcLeaks={metrics['fcLeaks']} {metrics['leakSamples']}"
                finally:
                    ctx.close()
        finally:
            browser.close()


def test_localized_contact_presets_and_mailto_encoding(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
        try:
            for route in LOCALIZED_CONTACT_ROUTES:
                page = ctx.new_page()
                page_errs = []
                page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                page.goto(static_base_url + route, wait_until="domcontentloaded", timeout=15000)
                page.wait_for_timeout(80)
                assert not page_errs, f"{route} pageerror on default load: {page_errs}"
                assert page.locator('[data-preset="regalia"]').get_attribute("aria-pressed") == "true"
                href0 = page.locator("#draft-link").get_attribute("href") or ""
                assert "+" not in href0 and "%20" in href0 and "%0D%0A" in href0, f"{route} mailto encoding: {href0}"

                page.locator('[data-preset="repair"]').click()
                assert page.locator('[data-preset="repair"]').get_attribute("aria-pressed") == "true"
                assert page.locator('[data-preset="regalia"]').get_attribute("aria-pressed") == "false"
                assert "[Sprint]" in (page.locator("#subject-preview").text_content() or "")

                page.goto(
                    static_base_url + route + "?subject=Minecraft%20build%20quote&body=Line%20one%0ALine%20two",
                    wait_until="domcontentloaded",
                    timeout=15000,
                )
                page.wait_for_timeout(80)
                assert not page_errs, f"{route} pageerror with query: {page_errs}"
                assert page.locator('[data-preset="regalia"]').get_attribute("aria-pressed") == "false"
                assert page.locator("#subject-preview").text_content().strip() == "Minecraft build quote"
                href_q = page.locator("#draft-link").get_attribute("href") or ""
                assert "Minecraft%20build%20quote" in href_q and "Line%20one%0D%0ALine%20two" in href_q
                page.close()
        finally:
            ctx.close()
            browser.close()
