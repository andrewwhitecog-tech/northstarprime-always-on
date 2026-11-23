"""Regression suite for 11 unlocked northstarprime-always-on routes (2026-11-23).

Note: `manga/index.html` is hash-locked in `tools/pages_art_quality.py`
(`SOURCE_OVERRIDES`) and is intentionally untouched.

Verifies:
1. unc-v/index.html: PR #362 `.spec-list a` uses Vorath stat plaque in normal mode
   and clears border-image/background-image in forced-colors mode.
2. maison-gooch/index.html: all 32 preorder `mailto:` links use RFC 6068 `%20` and
   `%0D%0A` encoding (0 literal `+` or bare `%0A` in query strings).
3. arcade/custom/dharma_invaders_xbla_edition.html: zero empty CSS selectors (`{`)
   remain inside `<style>` blocks (repaired L275/L295 forced-colors rules).
4. chromatic/index.html: `a.btn-enter` routes to `/store/` instead of self-looping
   to `/chromatic/`, while preserving `div.transit-card` and semantic `<main>`.
5. All 11 routes carry marker `nsp-ag-11routes-flagship-a11y-mailto-css-20261123`,
   semantic `<main>` + `<h1>`, `@media (prefers-reduced-motion: reduce)`,
   `:focus-visible`, `@media (forced-colors: active)`, zero `pageerror`s, zero
   horizontal overflow at `1280x800`/`320x568`, and zero forced-colors plaque/gradient
   leaks.
"""
from __future__ import annotations

import functools
import http.server
import pathlib
import re
import socketserver
import threading
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-11routes-flagship-a11y-mailto-css-20261123"

ROUTES = [
    ("/unc-v/", "unc-v/index.html"),
    ("/maison-gooch/", "maison-gooch/index.html"),
    ("/arcade/custom/dharma_invaders_xbla_edition.html", "arcade/custom/dharma_invaders_xbla_edition.html"),
    ("/404.html", "404.html"),
    ("/bullion/", "bullion/index.html"),
    ("/channels/", "channels/index.html"),
    ("/chromatic/", "chromatic/index.html"),
    ("/cosmos/", "cosmos/index.html"),
    ("/dharma/", "dharma/index.html"),
    ("/holidays/", "holidays/index.html"),
    ("/stickerforge/studio/", "stickerforge/studio/index.html"),
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


def test_static_11_routes_markers_landmarks_mailto_css():
    for _route, rel in ROUTES:
        path = ROOT / rel
        assert path.is_file(), f"Missing {rel}"
        html = path.read_text(encoding="utf-8")
        assert STYLE_ID in html, f"Missing {STYLE_ID} in {rel}"
        assert re.search(r"<main\b", html, re.I), f"Missing <main> in {rel}"
        assert "</main>" in html.lower(), f"Missing </main> in {rel}"
        assert re.search(r"<h1\b", html, re.I), f"Missing <h1> in {rel}"
        assert "</h1>" in html.lower(), f"Missing </h1> in {rel}"
        assert "prefers-reduced-motion" in html, f"Missing prefers-reduced-motion in {rel}"
        assert ":focus-visible" in html, f"Missing :focus-visible in {rel}"
        assert "forced-colors" in html, f"Missing forced-colors in {rel}"

    # 1. unc-v .spec-list a Vorath plaque + forced-colors
    unc_html = (ROOT / "unc-v/index.html").read_text(encoding="utf-8")
    assert ".spec-list a" in unc_html
    assert "vorath_stat_plaque_v01.webp" in unc_html

    # 2. maison-gooch 32 RFC 6068 mailto links
    mg_html = (ROOT / "maison-gooch/index.html").read_text(encoding="utf-8")
    mailtos = re.findall(r'href="(mailto:[^"]+)"', mg_html)
    assert len(mailtos) == 32, f"Expected 32 mailto links in maison-gooch, got {len(mailtos)}"
    for m in mailtos:
        assert "+" not in m, f"Found literal '+' in maison-gooch mailto: {m[:120]}"
        assert "%20" in m, f"Missing %20 encoding in maison-gooch mailto: {m[:120]}"
        assert not re.search(r"(?i)(?<!%0d)%0a", m), f"Found bare %0A without %0D in {m[:120]}"

    # 3. dharma_invaders_xbla_edition.html zero empty CSS selectors
    di_html = (ROOT / "arcade/custom/dharma_invaders_xbla_edition.html").read_text(encoding="utf-8")
    for sm in re.finditer(r"<style[^>]*>(.*?)</style>", di_html, re.S | re.I):
        assert not re.search(r"^\s*\{\s*$", sm.group(1), re.M), "Empty CSS selector remains in dharma_invaders"

    # 4. chromatic self-redirect loop fixed and div.transit-card preserved
    ch_html = (ROOT / "chromatic/index.html").read_text(encoding="utf-8")
    assert '<a class="btn-enter" href="/store/">' in ch_html
    assert '<a class="btn-enter" href="/chromatic/">' not in ch_html
    assert '<div class="transit-card">' in ch_html

    # 5. 404.html semantic <main> without redundant role="main"
    err_html = (ROOT / "404.html").read_text(encoding="utf-8")
    assert '<main class="error-container" id="main">' in err_html
    assert 'role="main"' not in err_html


def test_playwright_11_routes_runtime_a11y_overflow_and_fc(static_site_url):
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
          leaks.push({tag: el.tagName, cls: el.className, bi, bg});
        }
      }
      return leaks;
    }"""

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--mute-audio", "--no-sandbox"],
        )
        try:
            ctx = browser.new_context(viewport={"width": 1280, "height": 800})
            ctx.route(
                "**/*",
                lambda route, _req=None, b=static_site_url: route.continue_() if route.request.url.startswith(b) or route.request.url.startswith("data:") or route.request.url.startswith("blob:") else route.abort(),
            )
            page = ctx.new_page()

            for route, _rel in ROUTES:
                url = f"{static_site_url}{route}"

                # Desktop normal + forced-colors
                d_errors: list[str] = []
                d_handler = lambda err, sink=d_errors: sink.append(str(err))
                page.on("pageerror", d_handler)
                try:
                    page.set_viewport_size({"width": 1280, "height": 800})
                    page.emulate_media(forced_colors="none")
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(250)

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
                    assert info["scrollW"] <= info["innerW"] + 2, f"{route} desktop overflow: {info}"
                    assert not d_errors, f"{route} desktop pageerrors: {d_errors}"

                    if route == "/unc-v/":
                        spec_bi = page.evaluate(
                            "getComputedStyle(document.querySelector('.spec-list a')).borderImageSource"
                        )
                        assert "vorath_stat_plaque_v01.webp" in spec_bi, f"/unc-v/ .spec-list a not plated: {spec_bi}"
                    if route == "/chromatic/":
                        href = page.evaluate("document.querySelector('a.btn-enter').getAttribute('href')")
                        assert href == "/store/", f"/chromatic/ btn-enter href wrong: {href}"

                    # Desktop forced-colors
                    page.emulate_media(forced_colors="active")
                    page.wait_for_timeout(150)
                    fc_leaks = page.evaluate(fc_leak_js)
                    assert not fc_leaks, f"{route} forced-colors leaks: {fc_leaks[:3]}"
                finally:
                    page.remove_listener("pageerror", d_handler)

                # Mobile 320x568 normal
                m_errors: list[str] = []
                m_handler = lambda err, sink=m_errors: sink.append(str(err))
                page.on("pageerror", m_handler)
                try:
                    page.set_viewport_size({"width": 320, "height": 568})
                    page.emulate_media(forced_colors="none")
                    page.goto(url, wait_until="domcontentloaded", timeout=45000)
                    page.wait_for_timeout(250)
                    m_info = page.evaluate(
                        "() => ({scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth})"
                    )
                    assert m_info["scrollW"] <= m_info["innerW"] + 2, f"{route} 320px overflow: {m_info}"
                    if route == "/cosmos/":
                        h1_box = page.evaluate(
                            """() => {
                              const r = document.querySelector('#title h1').getBoundingClientRect();
                              return {left: r.left, right: r.right, width: r.width, innerW: window.innerWidth};
                            }"""
                        )
                        assert h1_box["left"] >= 0 and h1_box["right"] <= h1_box["innerW"], (
                            f"/cosmos/ h1 clipped at 320px: {h1_box}"
                        )
                    assert not m_errors, f"{route} 320px pageerrors: {m_errors}"
                finally:
                    page.remove_listener("pageerror", m_handler)

                page.goto("about:blank")

            ctx.close()
        finally:
            browser.close()
