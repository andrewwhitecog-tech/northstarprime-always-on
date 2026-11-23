"""Regression suite for Wave 5: 13 unlocked IDC, IDR, Lost, CKD-Kitchen & Codex Vol. IV routes (2026-11-23).

Verifies all 13 routes carry marker `nsp-ag-13routes-idc-idr-lost-ckd-codex-a11y-20261123`,
semantic `<main>` + `<h1>` landmarks, `:focus-visible`, `@media (prefers-reduced-motion: reduce)`,
`@media (forced-colors: active)`, zero `pageerror`s, zero horizontal overflow at `1280x800`,
`390x844`, and `320x568`, and zero forced-colors plaque/gradient leaks.
"""
from __future__ import annotations

import functools
import http.server
import pathlib
import re
import threading
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-13routes-idc-idr-lost-ckd-codex-a11y-20261123"

ROUTES = [
    ("/lost/", "lost/index.html"),
    ("/idc/flow-studio/", "idc/flow-studio/index.html"),
    ("/idc/season-2/", "idc/season-2/index.html"),
    ("/idc/season-4/", "idc/season-4/index.html"),
    ("/idc/season-4/chrono-convergence/", "idc/season-4/chrono-convergence/index.html"),
    ("/idc/season-4/jukebox/", "idc/season-4/jukebox/index.html"),
    ("/idc/season-4/the-signal-tomb/", "idc/season-4/the-signal-tomb/index.html"),
    ("/idc/season-4/the-void-engine/", "idc/season-4/the-void-engine/index.html"),
    ("/idr/single-052/", "idr/single-052/index.html"),
    ("/idr/single-054/", "idr/single-054/index.html"),
    ("/literature/the-vorath-codex-vol4/", "literature/the-vorath-codex-vol4/index.html"),
    ("/ckd-kitchen/chairside-pocket-guide.html", "ckd-kitchen/chairside-pocket-guide.html"),
    ("/ckd-kitchen/clinic-flyer.html", "ckd-kitchen/clinic-flyer.html"),
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


class _ThreadedServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 128

    def handle_error(self, request, client_address) -> None:
        pass


@pytest.fixture(scope="module")
def static_site_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    with _ThreadedServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{port}"
        finally:
            httpd.shutdown()


def test_static_13_routes_landmarks_focus_rm_fc():
    for _route, rel in ROUTES:
        path = ROOT / rel
        assert path.is_file(), f"Missing {rel}"
        html = path.read_text(encoding="utf-8")
        assert STYLE_ID in html, f"Missing {STYLE_ID} in {rel}"
        assert re.search(r"<main\b", html, re.I), f"Missing <main> in {rel}"
        assert "</main>" in html.lower(), f"Missing </main> in {rel}"
        assert re.search(r"<h1\b", html, re.I), f"Missing <h1> in {rel}"
        assert ":focus-visible" in html, f"Missing :focus-visible in {rel}"
        assert "prefers-reduced-motion" in html, f"Missing prefers-reduced-motion in {rel}"
        assert "forced-colors" in html, f"Missing forced-colors in {rel}"


def test_playwright_13_routes_runtime_overflow_and_fc(static_site_url):
    fc_leak_js = """() => {
      const leaks = [];
      const els = document.querySelectorAll('a, button, summary, [role="button"], input, select, textarea, .vorath-plaque, .vorath-btn');
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        const bi = cs.borderImageSource || 'none';
        const bg = cs.backgroundImage || 'none';
        if (bi !== 'none' || bg !== 'none') {
          leaks.push({tag: el.tagName, cls: String(el.className || ''), bi, bg});
        }
      }
      return leaks;
    }"""

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox", "--disable-webgl"])
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            ctx.route(
                "**/*",
                lambda route, _req=None, b=static_site_url: route.continue_()
                if route.request.url.startswith(b)
                or route.request.url.startswith("data:")
                or route.request.url.startswith("blob:")
                else route.abort(),
            )
            page = ctx.new_page()

            for route, _rel in ROUTES:
                url = f"{static_site_url}{route}"
                errs: list[str] = []
                handler = lambda e, sink=errs: sink.append(str(e))
                page.on("pageerror", handler)
                try:
                    page.set_viewport_size({"width": 1280, "height": 800})
                    page.emulate_media(forced_colors="none")
                    page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    page.wait_for_function(
                        "() => [...document.querySelectorAll('link[rel=\"stylesheet\"]')].every(l => !!l.sheet)",
                        timeout=30000,
                    )
                    page.wait_for_timeout(150)

                    for w, h, fc in ((1280, 800, "none"), (390, 844, "none"), (320, 568, "none"), (1280, 800, "active")):
                        page.set_viewport_size({"width": w, "height": h})
                        page.emulate_media(forced_colors=fc)
                        page.wait_for_timeout(120)

                        info = page.evaluate(
                            """() => ({
                              mains: document.querySelectorAll('main').length,
                              h1s: document.querySelectorAll('h1').length,
                              scrollW: document.documentElement.scrollWidth,
                              innerW: window.innerWidth,
                            })"""
                        )
                        assert info["mains"] >= 1, f"{route}: missing <main>"
                        assert info["h1s"] >= 1, f"{route}: missing <h1>"
                        assert info["scrollW"] <= info["innerW"] + 2, f"{route} {w}x{h} overflow: {info}"
                        assert not errs, f"{route} {w}x{h} pageerrors: {errs}"

                        if fc == "active":
                            leaks = page.evaluate(fc_leak_js)
                            assert not leaks, f"{route} forced-colors leaks: {leaks[:3]}"
                finally:
                    page.remove_listener("pageerror", handler)

                page.goto("about:blank")

            ctx.close()
        finally:
            browser.close()
