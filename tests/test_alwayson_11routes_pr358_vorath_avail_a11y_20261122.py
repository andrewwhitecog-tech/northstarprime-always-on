"""Regression tests for:
1. Public availability MP4 raw-GitHub octet-stream + ISO-BMFF ftyp verification.
2. 11 PR #358 static routes (rich-yn, unc-v, 5 hire/*, 4 minecraft/*):
   Vorath 9-slice art plaques, zero unescaped '&' in mailto: subjects,
   semantic <main>/<h1> landmarks, prefers-reduced-motion, 320/390/1280 zero overflow,
   zero broken images, and forced-colors zero leaks."""
from __future__ import annotations

import functools
import http.server
import pathlib
import re
import socketserver
import sys
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-11routes-pr358-vorath-a11y-20261122"

ROUTES = [
    ("/rich-yn/", "rich-yn/index.html"),
    ("/unc-v/", "unc-v/index.html"),
    ("/hire/ai-incident-readiness/", "hire/ai-incident-readiness/index.html"),
    ("/hire/ai-incident-workshop/", "hire/ai-incident-workshop/index.html"),
    ("/hire/commerce-activation/", "hire/commerce-activation/index.html"),
    ("/hire/failure-map/", "hire/failure-map/index.html"),
    ("/hire/release-confidence-audit/", "hire/release-confidence-audit/index.html"),
    ("/minecraft/privacy/", "minecraft/privacy/index.html"),
    ("/minecraft/rules/", "minecraft/rules/index.html"),
    ("/minecraft/safety/", "minecraft/safety/index.html"),
    ("/minecraft/status/", "minecraft/status/index.html"),
]


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


def test_public_availability_mp4_ftyp_magic_bytes():
    tools_dir = str(ROOT / "tools")
    if tools_dir not in sys.path:
        sys.path.insert(0, tools_dir)
    import check_public_availability as monitor

    assert monitor._has_valid_video_bytes(b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00")
    assert monitor._has_valid_video_bytes(b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81")
    assert not monitor._has_valid_video_bytes(b"version https://git-lfs.github.com/spec/v1\n")
    assert not monitor._has_valid_video_bytes(b"<html><body>Not Found</body></html>")
    assert not monitor._has_valid_video_bytes(b"")


def test_all_11_routes_static_vorath_mailto_and_a11y_markers():
    for route, rel in ROUTES:
        p = ROOT / rel
        assert p.is_file(), f"Missing {p}"
        txt = p.read_text(encoding="utf-8")
        low = txt.lower()
        assert STYLE_ID in txt, f"Missing {STYLE_ID} in {route}"
        assert "@media (prefers-reduced-motion: reduce)" in txt, f"Missing reduced-motion CSS in {route}"
        assert "vorath_btn_primary.webp" in txt, f"Missing Vorath primary plaque in {route}"
        assert "vorath_cartouche_9slice.webp" in txt, f"Missing Vorath cartouche in {route}"
        assert "vorath_stat_plaque_v01.webp" in txt, f"Missing Vorath stat plaque in {route}"
        assert "<main" in low and "</main>" in low, f"Missing <main> in {route}"
        assert "<h1" in low and "</h1>" in low, f"Missing <h1> in {route}"
        for href in re.findall(r'href="(mailto:[^"]+)"', txt):
            # Ensure no unescaped '&' truncates mailto query params
            assert "&" not in href.split("?", 1)[-1], f"Unescaped '&' in mailto href on {route}: {href}"


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
        const brokenImgs = Array.from(document.querySelectorAll('img')).filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src'));
        return { sw, bodyHiddenOv, fcLeaks, fcSample, brokenImgs, hasMain: !!document.querySelector('main'), hasH1: !!document.querySelector('h1') };
    }"""

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
        try:
            ctx_d = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            for route, _ in ROUTES:
                page = ctx_d.new_page()
                page_errs = []
                bad_http = []
                page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                page.on("response", lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None)
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=45000)
                assert resp is not None and resp.status == 200
                page.evaluate("() => Promise.all(Array.from(document.querySelectorAll('img')).map(i => { i.loading = 'eager'; return i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; }); }))")
                page.wait_for_timeout(80)

                md = page.evaluate(js_check)
                assert md["sw"] <= 1280, f"{route} desktop overflow: sw={md['sw']}"
                assert not md["bodyHiddenOv"], f"{route} desktop bodyHiddenOv"
                assert not md["brokenImgs"], f"{route} broken images: {md['brokenImgs']}"
                assert md["hasMain"] and md["hasH1"], f"{route} missing <main>/<h1>"
                assert not page_errs, f"{route} page errors: {page_errs}"
                assert not bad_http, f"{route} HTTP>=400: {bad_http}"

                page.emulate_media(forced_colors="active")
                page.wait_for_timeout(60)
                mfd = page.evaluate(js_check)
                assert mfd["sw"] <= 1280, f"{route} fc1280 overflow: sw={mfd['sw']}"
                assert mfd["fcLeaks"] == 0, f"{route} fc1280 leaks={mfd['fcLeaks']} {mfd['fcSample']}"
                page.close()
            ctx_d.close()

            ctx_m = browser.new_context(
                viewport={"width": 390, "height": 844},
                device_scale_factor=2,
                is_mobile=True,
                has_touch=True,
            )
            for route, _ in ROUTES:
                page = ctx_m.new_page()
                page_errs = []
                bad_http = []
                page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                page.on("response", lambda r, bh=bad_http: bh.append((r.status, r.url)) if r.status >= 400 else None)
                resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded", timeout=45000)
                assert resp is not None and resp.status == 200
                page.evaluate("() => Promise.all(Array.from(document.querySelectorAll('img')).map(i => { i.loading = 'eager'; return i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; }); }))")
                page.wait_for_timeout(80)

                m390 = page.evaluate(js_check)
                assert m390["sw"] <= 390, f"{route} mobile 390 overflow: sw={m390['sw']}"
                assert not m390["bodyHiddenOv"]

                page.set_viewport_size({"width": 320, "height": 568})
                page.wait_for_timeout(60)
                m320 = page.evaluate(js_check)
                assert m320["sw"] <= 320, f"{route} mobile 320 overflow: sw={m320['sw']}"
                assert not m320["bodyHiddenOv"]

                page.set_viewport_size({"width": 390, "height": 844})
                page.emulate_media(forced_colors="active")
                page.wait_for_timeout(60)
                mfc = page.evaluate(js_check)
                assert mfc["sw"] <= 390, f"{route} fc390 overflow: sw={mfc['sw']}"
                assert mfc["fcLeaks"] == 0, f"{route} fc390 leaks={mfc['fcLeaks']} {mfc['fcSample']}"
                assert not page_errs and not bad_http
                page.close()
            ctx_m.close()
        finally:
            browser.close()
