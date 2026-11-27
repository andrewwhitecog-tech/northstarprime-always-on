"""Regression tests for northstarprime-always-on 19 arcade/custom routes + /oracle/ Rule 46 Zero-Flat & Mobile Overflow remediation.

Covers:
  /oracle/,
  /arcade/custom/vorath-souls/, /arcade/custom/dharma-invaders/,
  /arcade/custom/northstar-chrono-defender/, /arcade/custom/prism-drift/,
  /arcade/custom/signal-cartographer-prime/, /arcade/custom/side-street/,
  /arcade/custom/idr-tracker-cabinet/, /arcade/custom/logic-foundry/,
  /arcade/custom/precinct-404-signal/, /arcade/custom/flappy-dharma/,
  /arcade/custom/galaga-interdimensional/, /arcade/custom/missile-command/,
  /arcade/custom/pac-dharma/, /arcade/custom/prism-runner-2049/,
  /arcade/custom/rose-window/, /arcade/custom/snake-dimension/,
  /arcade/custom/system1-arena/, /arcade/custom/tetris-void/,
  /arcade/custom/void-siege/
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
    "/oracle/",
    "/arcade/custom/vorath-souls/",
    "/arcade/custom/dharma-invaders/",
    "/arcade/custom/northstar-chrono-defender/",
    "/arcade/custom/prism-drift/",
    "/arcade/custom/signal-cartographer-prime/",
    "/arcade/custom/side-street/",
    "/arcade/custom/idr-tracker-cabinet/",
    "/arcade/custom/logic-foundry/",
    "/arcade/custom/precinct-404-signal/",
    "/arcade/custom/flappy-dharma/",
    "/arcade/custom/galaga-interdimensional/",
    "/arcade/custom/missile-command/",
    "/arcade/custom/pac-dharma/",
    "/arcade/custom/prism-runner-2049/",
    "/arcade/custom/rose-window/",
    "/arcade/custom/snake-dimension/",
    "/arcade/custom/system1-arena/",
    "/arcade/custom/tetris-void/",
    "/arcade/custom/void-siege/",
]

MODIFIED_HTML_FILES = [f"{r.strip('/')}/index.html" for r in REMEDIATED_ROUTES]


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
        assert "/warband/art/vorath_" in text or "/blackjack-noir/art/vorath_" in text, f"{rel} missing Vorath 9-slice art"
        assert "@media (forced-colors: active)" in text, f"{rel} missing forced-colors: active reset"
        assert "border-image: none" in text or "border-image:none" in text, f"{rel} missing border-image: none in forced-colors"


@pytest.mark.parametrize("viewport", [(390, 844), (1280, 800)])
def test_routes_render_zero_overflow_zero_broken_local_assets(site_url, viewport):
    vw, vh = viewport
    dpr = 2 if vw == 390 else 1
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=dpr)
        page = ctx.new_page()
        page_errors = []
        bad_local = []
        page.on("pageerror", lambda err: page_errors.append(str(err)))
        page.on(
            "response",
            lambda resp: (
                bad_local.append((resp.status, resp.url))
                if resp.url.startswith(site_url) and resp.status >= 400
                else None
            ),
        )
        try:
            for route in REMEDIATED_ROUTES:
                page_errors.clear()
                bad_local.clear()
                resp = page.goto(f"{site_url}{route}", wait_until="domcontentloaded")
                assert resp is not None and resp.status == 200, f"{route} returned {resp}"
                page.wait_for_timeout(350)
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
