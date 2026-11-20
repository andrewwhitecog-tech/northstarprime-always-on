"""Regression tests for northstarprime-always-on 16 remaining /arcade/custom/* cabinets Rule 46 Zero-CHIP_WARN & forced-colors remediation.

Covers:
  /arcade/custom/container-yard/, /arcade/custom/future-teller-cabinet/,
  /arcade/custom/hypernova-swarm/, /arcade/custom/ladder/,
  /arcade/custom/paperclip-resistance/, /arcade/custom/signal-gallery/,
  /arcade/custom/static-house/, /arcade/custom/super-arcade-archive/,
  /arcade/custom/super-vorath-bros/, /arcade/custom/tai-chi-flow/,
  /arcade/custom/the-melting-hour/, /arcade/custom/vorath-arena/,
  /arcade/custom/vorath-cabinet-row/, /arcade/custom/vorath-pinball/,
  /arcade/custom/vorath-prism-runner/, /arcade/custom/vorath-signal-crown/
"""
from __future__ import annotations

import functools
import hashlib
import http.server
import json
import pathlib
import socketserver
import threading
import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

REMEDIATED_ROUTES = [
    "/arcade/custom/container-yard/",
    "/arcade/custom/future-teller-cabinet/",
    "/arcade/custom/hypernova-swarm/",
    "/arcade/custom/ladder/",
    "/arcade/custom/paperclip-resistance/",
    "/arcade/custom/signal-gallery/",
    "/arcade/custom/static-house/",
    "/arcade/custom/super-arcade-archive/",
    "/arcade/custom/super-vorath-bros/",
    "/arcade/custom/tai-chi-flow/",
    "/arcade/custom/the-melting-hour/",
    "/arcade/custom/vorath-arena/",
    "/arcade/custom/vorath-cabinet-row/",
    "/arcade/custom/vorath-pinball/",
    "/arcade/custom/vorath-prism-runner/",
    "/arcade/custom/vorath-signal-crown/",
]

MODIFIED_HTML_FILES = [f"{r.strip('/')}/index.html" for r in REMEDIATED_ROUTES]
STYLE_ID = "nsp-ag-arcade16-chipwarn-forcedcolors-20261119"

FORCED_COLORS_PROBE_SELECTORS: dict[str, str] = {
    "/arcade/custom/container-yard/": "#hud .chip",
    "/arcade/custom/future-teller-cabinet/": "#tokenChip",
    "/arcade/custom/hypernova-swarm/": "#bestChip",
    "/arcade/custom/ladder/": "#attempts",
    "/arcade/custom/paperclip-resistance/": "#statusBadge",
    "/arcade/custom/signal-gallery/": "#bestChip",
    "/arcade/custom/static-house/": "#bestChip",
    "/arcade/custom/super-arcade-archive/": "header.topbar .chip",
    "/arcade/custom/super-vorath-bros/": "main.cabinet section.hud .stat",
    "/arcade/custom/tai-chi-flow/": "div.shell div.hud .metric",
    "/arcade/custom/the-melting-hour/": "aside.panel .stat-grid .stat",
    "/arcade/custom/vorath-arena/": "#hWave",
    "/arcade/custom/vorath-cabinet-row/": "#machineChips .chip",
    "/arcade/custom/vorath-pinball/": "#achievement-toast .ach-ring",
    "/arcade/custom/vorath-prism-runner/": "main.cabinet section.hud .stat",
    "/arcade/custom/vorath-signal-crown/": "section.stage .hud .pill",
}


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
        assert STYLE_ID in text, f"{rel} missing {STYLE_ID}"
        assert "/warband/art/vorath_" in text, f"{rel} missing Vorath 9-slice art"
        assert "@media (forced-colors: active)" in text, f"{rel} missing forced-colors: active reset"
        assert "border-image: none" in text, f"{rel} missing border-image: none in forced-colors"


def test_manifests_match_updated_html_hashes():
    actual = {}
    for rel in MODIFIED_HTML_FILES:
        data = (ROOT / rel).read_bytes().replace(b"\r\n", b"\n")
        actual[rel] = (len(data), hashlib.sha256(data).hexdigest())

    lrm = json.loads((ROOT / "LADDER_RELEASE_MANIFEST.json").read_text(encoding="utf-8"))
    ladder_rows = [row for row in lrm["files"] if row["path"] == "arcade/custom/ladder/index.html"]
    assert len(ladder_rows) == 1
    assert (ladder_rows[0]["bytes"], ladder_rows[0]["sha256"]) == actual["arcade/custom/ladder/index.html"]

    afm = json.loads((ROOT / "ARCADE_FREEZE_MANIFEST.json").read_text(encoding="utf-8"))
    matched = 0

    def walk(obj):
        nonlocal matched
        if isinstance(obj, dict):
            rel = obj.get("output_relative")
            if rel in actual:
                assert (obj["output_bytes"], obj["output_sha256"]) == actual[rel], f"Mismatch for {rel}"
                matched += 1
            for val in obj.values():
                walk(val)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(afm)
    assert matched == 15


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
                if (
                    resp.url.startswith(site_url)
                    and not resp.url.startswith(f"{site_url}/api/")
                    and resp.status >= 400
                )
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


def test_forced_colors_active_resets_border_image(site_url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, forced_colors="active")
        page = ctx.new_page()
        try:
            for route, sel in FORCED_COLORS_PROBE_SELECTORS.items():
                resp = page.goto(f"{site_url}{route}", wait_until="domcontentloaded")
                assert resp is not None and resp.status == 200, f"{route} returned {resp}"
                page.wait_for_timeout(200)
                bi = page.evaluate(
                    """(s) => {
                        const el = document.querySelector(s);
                        if (!el) return null;
                        return getComputedStyle(el).borderImageSource;
                    }""",
                    sel,
                )
                assert bi == "none", f"{route} {sel} borderImageSource under forced-colors: {bi!r}"
        finally:
            browser.close()
