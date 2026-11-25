"""Regression & Playwright verification tests for the RICH YN Storefront Upgrade (2026-11-25)."""
from __future__ import annotations

import functools
import http.server
import json
import pathlib
import re
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
RICHYN_HTML = ROOT / "rich-yn" / "index.html"
MOCKUP_DIR = ROOT / "assets" / "rich_yn_mockups_20261125"

EXPECTED_WEBPS = [
    "01_ryn_v4_hoa_menace_tee_slate.webp",
    "02_ryn_v4_trust_fund_tennis_frame_credenza.webp",
    "03_ryn_v4_cul_de_sac_slap_laptop_desk.webp",
    "04_ryn_v4_gatecode_24k_poster_brick_hall.webp",
    "05_ryn_v3_benji_100_tee_marble_studio.webp",
    "06_ryn_v3_versailles_chandelier_gallery_trio.webp",
    "07_ryn_v3_silk_twill_scarf_brass_table.webp",
    "08_ryn_collector_lookbook_coffee_table.webp",
    "09_ryn_bad_manners_palace_y2k_atelier.webp",
    "10_ryn_gta6_vice_reality_penthouse.webp",
    "11_bad_manners_street_skate_lineup.webp",
]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None:
        pass


class _ThreadedServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


@pytest.fixture(scope="module")
def static_site_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    with _ThreadedServer(("127.0.0.1", 0), handler) as httpd:
        port = httpd.server_address[1]
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        try:
            yield f"http://127.0.0.1:{port}"
        finally:
            httpd.shutdown()


def test_rich_yn_mockup_webps_exist_and_are_compact():
    assert MOCKUP_DIR.is_dir(), f"Missing {MOCKUP_DIR}"
    total = 0
    for fn in EXPECTED_WEBPS:
        fp = MOCKUP_DIR / fn
        assert fp.is_file(), f"Missing RICH YN WebP: {fp}"
        raw = fp.read_bytes()
        assert raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"
        assert 10_000 < len(raw) <= 260_000, f"Unexpected WebP size {fn}: {len(raw)}"
        total += len(raw)
    assert total <= 2_800_000


def test_rich_yn_wires_vault_checkouts_badmanners_palace_and_vice_mockups():
    html = RICHYN_HTML.read_text(encoding="utf-8")
    assert not re.search(r"[\U00010000-\U0010ffff]", html), "No emojis allowed"
    for fn in EXPECTED_WEBPS:
        assert f"/assets/rich_yn_mockups_20261125/{fn}" in html, f"Missing mockup ref {fn}"
    # Newly published Wave 7 $24 Combined Vault + individual live packs
    for url in (
        "https://andrewcog.gumroad.com/l/northstar-7icon-parody-vault",
        "https://andrewcog.gumroad.com/l/rich-yn-swamp-dynasty-pack",
        "https://andrewcog.gumroad.com/l/crimson-haze-worldwide-pack",
        "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack",
    ):
        assert url in html, f"Missing live Gumroad checkout URL: {url}"
    assert "$24.00" in html or "$24" in html
    assert "Palace Edition" in html and "Bad Manners" in html and "Vice Reality VI" in html
    assert "Printful NorthStar POD" in html
    assert "forced-colors: active" in html


def test_rich_yn_playwright_desktop_mobile_and_forced_colors(static_site_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--mute-audio", "--disable-webgl", "--disable-gpu", "--no-sandbox"],
        )
        try:
            for width, height, is_mob, fc in [
                (1280, 800, False, "none"),
                (390, 844, True, "active"),
            ]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=2 if is_mob else 1,
                    is_mobile=is_mob,
                    has_touch=is_mob,
                    forced_colors=fc,
                )
                ctx.route(
                    re.compile(r"^https?://(?!127\.0\.0\.1)"),
                    lambda route, _req=None: route.abort(),
                )
                page = ctx.new_page()
                errs = []
                page.on("pageerror", lambda e: errs.append(str(e)))
                resp = page.goto(f"{static_site_url}/rich-yn/", wait_until="domcontentloaded", timeout=60000)
                assert resp is not None and resp.status == 200
                st = page.evaluate("""async (expectedWebps) => {
                    for (const im of document.querySelectorAll('img')) {
                        im.loading = 'eager';
                        im.scrollIntoView({behavior: 'instant', block: 'center'});
                        if (!im.complete) {
                            await new Promise(res => {
                                im.addEventListener('load', res, {once: true});
                                im.addEventListener('error', res, {once: true});
                                setTimeout(res, 15000);
                            });
                        }
                    }
                    const broken = [...document.querySelectorAll('img')].filter(im => !im.complete || im.naturalWidth === 0).map(im => im.src);
                    const loadedMockups = expectedWebps.filter(fn => [...document.querySelectorAll('img')].some(im => im.src.includes(fn) && im.naturalWidth > 0));
                    const vaultBtn = document.querySelector('a[href="https://andrewcog.gumroad.com/l/northstar-7icon-parody-vault"]');
                    const vr = vaultBtn ? vaultBtn.getBoundingClientRect() : {width: 0, height: 0};
                    const sw = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
                    return { sw, broken, loadedCount: loadedMockups.length, vrW: vr.width, vrH: vr.height };
                }""", EXPECTED_WEBPS)
                assert st["sw"] <= width, f"Overflow {st['sw']} > {width}"
                assert not st["broken"], f"Broken images: {st['broken']}"
                assert st["loadedCount"] == 11, f"Expected 11 decoded WebPs, got {st['loadedCount']}"
                assert st["vrW"] > 60 and st["vrH"] >= 36
                assert not errs
                page.close()
                ctx.close()
        finally:
            browser.close()
