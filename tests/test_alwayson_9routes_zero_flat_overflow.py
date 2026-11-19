"""Regression tests for northstarprime-always-on 9 remaining routes Rule 46 Zero-Flat & Mobile Overflow remediation.

Covers:
  /manga/, /tcg/, /research/, /continuity-atlas/, /press/,
  /software/, /fictional-brands/, /channels/, /lost/
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

REMEDIATED_ROUTES = [
    "/manga/",
    "/tcg/",
    "/research/",
    "/continuity-atlas/",
    "/press/",
    "/software/",
    "/fictional-brands/",
    "/channels/",
    "/lost/",
]

MODIFIED_HTML_FILES = [
    "manga/index.html",
    "tcg/index.html",
    "research/index.html",
    "continuity-atlas/index.html",
    "press/index.html",
    "software/index.html",
    "fictional-brands/index.html",
    "channels/index.html",
    "lost/index.html",
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


@pytest.fixture(scope="module")
def site_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{port}"
        finally:
            httpd.shutdown()


def test_modified_files_have_vorath_and_forced_colors():
    for rel in MODIFIED_HTML_FILES:
        path = ROOT / rel
        assert path.is_file(), f"Missing {rel}"
        text = path.read_text(encoding="utf-8")
        assert "/warband/art/vorath_" in text, f"{rel} missing Vorath 9-slice art"
        assert "@media (forced-colors: active)" in text, f"{rel} missing forced-colors: active reset"
        assert "border-image: none" in text or "border-image:none" in text, f"{rel} missing border-image: none in forced-colors"


def test_no_blocking_alert_in_channels_header():
    text = (ROOT / "channels/index.html").read_text(encoding="utf-8")
    assert 'onclick="alert(' not in text, "channels/index.html still contains blocking alert()"


@pytest.mark.parametrize("viewport", [(390, 844), (1280, 800)])
def test_routes_render_zero_overflow_zero_broken_local_assets(site_url, viewport):
    vw, vh = viewport
    dpr = 2 if vw == 390 else 1
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dpr)
        page = ctx.new_page()
        try:
            for route in REMEDIATED_ROUTES:
                page_errors = []
                bad_local = []
                page.on("pageerror", lambda err, e=page_errors: e.append(str(err)))
                page.on(
                    "response",
                    lambda resp, b=bad_local: (
                        b.append((resp.status, resp.url))
                        if resp.url.startswith(site_url) and resp.status >= 400
                        else None
                    ),
                )
                resp = page.goto(f"{site_url}{route}", wait_until="domcontentloaded")
                assert resp is not None and resp.status == 200, f"{route} returned {resp}"
                page.wait_for_timeout(450)
                metrics = page.evaluate(
                    """() => {
                        const sw = document.documentElement.scrollWidth;
                        const iw = window.innerWidth;
                        const brokenImgs = [...document.querySelectorAll('img')]
                            .filter(img => img.complete && img.naturalWidth === 0 && img.offsetParent !== null)
                            .map(img => img.getAttribute('src'));
                        return {sw, iw, brokenImgs};
                    }"""
                )
                assert not page_errors, f"{route} ({vw}x{vh}) page errors: {page_errors}"
                assert not bad_local, f"{route} ({vw}x{vh}) HTTP >= 400 local responses: {bad_local}"
                assert metrics["sw"] <= metrics["iw"], (
                    f"{route} ({vw}x{vh}) horizontal overflow: scrollWidth={metrics['sw']} > innerWidth={metrics['iw']}"
                )
                assert not metrics["brokenImgs"], f"{route} ({vw}x{vh}) broken visible images: {metrics['brokenImgs']}"
        finally:
            browser.close()


def test_forced_colors_active_strips_border_image(site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        page.emulate_media(forced_colors="active")
        try:
            for route, sel in [
                ("/manga/", ".btn, .page-indicator"),
                ("/tcg/", ".nav-btn, .counter-badge"),
                ("/research/", ".btn, .btn-gold"),
                ("/continuity-atlas/", "nav.masthead-nav a, span.grade"),
                ("/press/", ".hero-badges span.badge"),
                ("/software/", "nav a, kbd"),
                ("/fictional-brands/", "span.badge-category"),
                ("/channels/", ".btn-action, .telemetry-badges .badge"),
                ("/lost/", ".legend .chip"),
            ]:
                page.goto(f"{site_url}{route}", wait_until="domcontentloaded")
                page.wait_for_timeout(200)
                bad = page.evaluate(
                    """(selector) => {
                        return [...document.querySelectorAll(selector)]
                            .filter(el => {
                                const bi = getComputedStyle(el).borderImageSource;
                                return bi && bi !== 'none';
                            })
                            .map(el => el.outerHTML.slice(0, 80));
                    }""",
                    sel,
                )
                assert not bad, f"{route} forced-colors:active kept border-image on {bad}"
        finally:
            browser.close()


def test_channels_stations_button_non_blocking(site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        dialogs = []
        page.on("dialog", lambda d: (dialogs.append(d.message), d.dismiss()))
        try:
            page.goto(f"{site_url}/channels/", wait_until="domcontentloaded")
            page.click("#stationsStatusBtn")
            txt = page.locator("#stationsStatusBtn").inner_text()
            assert "12/12 STATIONS LIVE" in txt
            assert not dialogs, f"Unexpected blocking dialog: {dialogs}"
        finally:
            browser.close()
