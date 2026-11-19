"""Regression tests for northstarprime-always-on 12 MasterCook & Research Monograph routes Rule 46 Zero-CHIP_WARN, zero-overflow & forced-colors upgrade."""
from __future__ import annotations

import functools
import http.server
import pathlib
import socketserver
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
STYLE_ID = "nsp-ag-12routes-mastercook-papers-zero-warn-20261119"

MASTERCOOK_ROUTES = [
    "/static/downloads/Digital_MasterCook_Book_Freeware_v09.html",
    "/static/downloads/Digital_MasterCook_Deluxe_Illustrated_Edition.html",
]

PAPER_ROUTES = [
    "/research/papers/01_master_herbal_bible_monograph/",
    "/research/papers/02_master_mycelium_monograph/",
    "/research/papers/03_food_systems_doctoral_dissertation/",
    "/research/papers/04_simulation_hypothesis_monograph/",
    "/research/papers/05_neurogastronomy_sodium_reduction_preprint/",
    "/research/papers/06_invention_forge_open_hardware_compendium/",
    "/research/papers/07_renalshield_clinical_nutrition_scoping_review/",
    "/research/papers/08_comparative_religion_and_humanities_series/",
    "/research/papers/09_hyperbaric_chamber_therapy_monograph/",
    "/research/papers/10_photobiomodulation_and_pentad_therapeutics_monograph/",
]

CANONICAL_ROUTES = MASTERCOOK_ROUTES + PAPER_ROUTES


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class _Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    allow_reuse_address = True


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
    if not rel.endswith(".html"):
        rel = rel.rstrip("/") + "/index.html"
    return ROOT / rel


def test_canonical_files_have_style_id_and_forced_colors():
    for route in CANONICAL_ROUTES:
        p = _route_to_file(route)
        assert p.exists(), f"Missing canonical file: {p}"
        txt = p.read_text(encoding="utf-8")
        assert STYLE_ID in txt, f"Missing STYLE_ID in {route}"
        assert "@media (forced-colors: active)" in txt, f"Missing forced-colors:active in {route}"


def test_mobile_desktop_zero_overflow_vorath_and_forced_colors_live(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        try:
            for vp_w, vp_h, dpr in [(390, 844, 2), (1280, 800, 1)]:
                ctx = browser.new_context(viewport={"width": vp_w, "height": vp_h}, device_scale_factor=dpr)
                page = ctx.new_page()
                for route in CANONICAL_ROUTES:
                    resp = page.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                    assert resp is not None and resp.status == 200, f"{route} status={resp}"
                    page.wait_for_timeout(400)
                    sw = page.evaluate("() => document.documentElement.scrollWidth")
                    assert sw <= vp_w, f"{route} overflow at {vp_w}: scrollWidth={sw}"
                ctx.close()

            # Verify MasterCook Vorath plaques in screen mode and clean print preservation
            ctx_mc = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            pg_mc = ctx_mc.new_page()
            for route in MASTERCOOK_ROUTES:
                pg_mc.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                pg_mc.wait_for_timeout(400)
                for sel in [".toc-v2 .toc-title-bar", ".rc-col-head", ".rc-foot .renal"]:
                    bi = pg_mc.evaluate(f"() => getComputedStyle(document.querySelector({sel!r})).borderImageSource")
                    assert "vorath_stat_plaque_v01.webp" in bi, f"{route} {sel} missing Vorath plaque: {bi}"
                pg_mc.emulate_media(media="print")
                pg_mc.wait_for_timeout(150)
                for sel in [".toc-v2 .toc-title-bar", ".rc-col-head", ".rc-foot .renal"]:
                    bi_pr = pg_mc.evaluate(f"() => getComputedStyle(document.querySelector({sel!r})).borderImageSource")
                    assert bi_pr == "none", f"{route} {sel} leaked border-image into print: {bi_pr}"
                pg_mc.emulate_media(media="screen")
            ctx_mc.close()

            # Verify forced-colors: active strips border-image across all 12 routes
            ctx_fc = browser.new_context(
                viewport={"width": 1280, "height": 800},
                device_scale_factor=1,
                forced_colors="active",
            )
            pg_fc = ctx_fc.new_page()
            for route in MASTERCOOK_ROUTES:
                pg_fc.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                pg_fc.wait_for_timeout(400)
                for sel in ["button.print-btn", "input#cookbookSearch", ".toc-v2 .toc-title-bar", ".rc-col-head", ".rc-foot .renal"]:
                    bi = pg_fc.evaluate(f"() => getComputedStyle(document.querySelector({sel!r})).borderImageSource")
                    assert bi == "none", f"{route} {sel} leaked border-image in forced-colors: {bi}"
            for route in PAPER_ROUTES:
                pg_fc.goto(f"{static_base_url}{route}", wait_until="domcontentloaded")
                pg_fc.wait_for_timeout(300)
                for sel in [".breadcrumb a", ".btn", "section.card span.badge"]:
                    bi = pg_fc.evaluate(f"() => getComputedStyle(document.querySelector({sel!r})).borderImageSource")
                    assert bi == "none", f"{route} {sel} leaked border-image in forced-colors: {bi}"
            ctx_fc.close()
        finally:
            browser.close()
