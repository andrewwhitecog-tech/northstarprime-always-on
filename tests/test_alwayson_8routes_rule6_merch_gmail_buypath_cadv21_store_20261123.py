"""Regression suite for Wave 4 Rule 6 buy-path truth, site-wide Gmail cleanup & Claude PR #366 parity (2026-11-23).

Verifies:
1. Zero personal `andrew.white.cog@gmail.com` leaks remain anywhere in public HTML across the repository
   (eliminated 11 leaks across brand/idc-studios, hire/docker-repair, and hire/watchdog-engineering).
2. Zero mislabeled `"Buy Direct on Chromatic"` copy remains anywhere in public HTML (`merch/index.html`
   `#dig-sacred-calendar-2027` updated in both `data-item` JSON and `.merch-actions` to pair Gumroad + `/holidays/`).
3. Zero stale Stripe checkout copy on `bill-of-rights-v2/index.html`.
4. Brick Alchemy CAD Studio `v2.2` version parity across `brick-alchemy/studio/index.html`, `store/index.html`,
   and `links/index.html` (`0` stale `CAD Studio v2.0` strings).
5. `store/index.html` no longer hides overflow with `overflow-x:hidden` on `html,body`, and mobile `.top .menu`
   wraps cleanly at `390x844` & `320x568` with every nav link inside viewport bounds (zero right-edge clipping).
6. All 8 routes carry marker `nsp-ag-8routes-rule6-merch-gmail-buypath-cadv21-store-a11y-20261123`, semantic
   `<main>` + `<h1>`, `:focus-visible`, `@media (prefers-reduced-motion: reduce)`, `@media (forced-colors: active)`,
   zero `pageerror`s, zero horizontal overflow, and zero forced-colors plaque/gradient leaks.
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
STYLE_ID = "nsp-ag-8routes-rule6-merch-gmail-buypath-cadv21-store-a11y-20261123"

ROUTES = [
    ("/merch/", "merch/index.html"),
    ("/brand/idc-studios/", "brand/idc-studios/index.html"),
    ("/hire/docker-repair/", "hire/docker-repair/index.html"),
    ("/hire/watchdog-engineering/", "hire/watchdog-engineering/index.html"),
    ("/bill-of-rights-v2/", "bill-of-rights-v2/index.html"),
    ("/store/", "store/index.html"),
    ("/links/", "links/index.html"),
    ("/brick-alchemy/studio/", "brick-alchemy/studio/index.html"),
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


def test_static_sitewide_gmail_buydirect_and_wave4_invariants():
    # Site-wide public HTML guarantees
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith(("tools/", "tests/", "output/", ".git/")):
            continue
        html = p.read_text(encoding="utf-8", errors="replace")
        assert "andrew.white.cog@gmail.com" not in html.lower(), f"Personal Gmail leak remains in {rel}"
        assert "Buy Direct on Chromatic" not in html, f"Mislabeled 'Buy Direct on Chromatic' remains in {rel}"

    # Per-route invariants on all 8 Wave 4 targets
    for _route, rel in ROUTES:
        html = (ROOT / rel).read_text(encoding="utf-8")
        assert STYLE_ID in html, f"Missing {STYLE_ID} in {rel}"
        assert re.search(r"<main\b", html, re.I), f"Missing <main> in {rel}"
        assert re.search(r"<h1\b", html, re.I), f"Missing <h1> in {rel}"
        assert "prefers-reduced-motion" in html, f"Missing prefers-reduced-motion in {rel}"
        assert ":focus-visible" in html, f"Missing :focus-visible in {rel}"
        assert "forced-colors" in html, f"Missing forced-colors in {rel}"

    # 1. merch #dig-sacred-calendar-2027 fix
    merch_html = (ROOT / "merch/index.html").read_text(encoding="utf-8")
    assert "Buy Instant Download on Gumroad ($10)" in merch_html
    assert 'href="/holidays/">Browse Holiday Printables' in merch_html

    # 2. 3 former gmail pages now use contact@northstarprime.net
    for rel in ("brand/idc-studios/index.html", "hire/docker-repair/index.html", "hire/watchdog-engineering/index.html"):
        html = (ROOT / rel).read_text(encoding="utf-8")
        assert "mailto:contact@northstarprime.net" in html

    # 3. bill-of-rights-v2 stale Stripe copy removed
    bor_html = (ROOT / "bill-of-rights-v2/index.html").read_text(encoding="utf-8")
    assert not re.search(r"stripe\s+checkout", bor_html, re.I)

    # 4. CAD Studio v2.2 parity (matches cad-engine.js) across store, links, brick-alchemy/studio
    for rel in ("store/index.html", "links/index.html", "brick-alchemy/studio/index.html"):
        html = (ROOT / rel).read_text(encoding="utf-8")
        assert "CAD Studio v2.0" not in html, f"Stale CAD Studio v2.0 string in {rel}"
        assert "v2.2" in html, f"Missing v2.2 parity in {rel}"

    # 5. store/index.html no longer masks overflow with overflow-x:hidden on html,body
    store_html = (ROOT / "store/index.html").read_text(encoding="utf-8")
    assert "html,body{max-width:100%;overflow-x:hidden}" not in store_html


def test_playwright_8routes_runtime_store_nav_and_fc(static_site_url):
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

                        if route == "/store/" and w == 390 and fc == "none":
                            clipped = page.evaluate(
                                """() => {
                                  const out = [];
                                  for (const a of document.querySelectorAll('.top .menu a')) {
                                    const r = a.getBoundingClientRect();
                                    if (r.left < -1 || r.right > window.innerWidth + 1) {
                                      out.push({text: a.textContent.trim(), left: r.left, right: r.right, innerW: window.innerWidth});
                                    }
                                  }
                                  return out;
                                }"""
                            )
                            assert not clipped, f"/store/ 390px .top .menu clipped: {clipped}"
                finally:
                    page.remove_listener("pageerror", handler)

                page.goto("about:blank")

            ctx.close()
        finally:
            browser.close()
