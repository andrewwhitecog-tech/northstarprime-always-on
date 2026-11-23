"""Verification tests for the /halo/ research & Mod Pack v2 hub and /links/ discovery entry."""
from __future__ import annotations

import functools
import hashlib
import http.server
import json
import pathlib
import re
import socketserver
import threading
import zipfile

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
HALO_DIR = ROOT / "halo"
DL_DIR = HALO_DIR / "downloads" / "v2_20261123"


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


def test_halo_static_html_landmarks_no_emojis_and_links_entry():
    html = (HALO_DIR / "index.html").read_text(encoding="utf-8")
    assert "<header" in html and "<nav" in html and '<main id="main"' in html and "<footer" in html
    assert 'href="#main"' in html
    assert "forced-colors:active" in html or "forced-colors: active" in html
    assert "Game Content Usage Rules" in html
    assert "app.northstarprime.net" not in html
    assert "our own compiled" not in html
    assert "recoloured from the game's own texture" in html
    assert "16 / 16 SHA-256" in html and "22 / 22" not in html and "22/22" not in html
    assert not re.search(r"[\U00010000-\U0010ffff]", html), "/halo/index.html must contain 0 emojis"

    links_html = (ROOT / "links" / "index.html").read_text(encoding="utf-8")
    assert 'href="/halo/"' in links_html
    assert not re.search(r"[\U00010000-\U0010ffff]", links_html), "/links/index.html must contain 0 emojis"

    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert "https://northstarprime.net/halo/" in sitemap


def test_halo_mod_pack_v2_downloads_and_sha256_integrity():
    zip_path = DL_DIR / "northstar_halo_mod_pack_v2_20261123.zip"
    sha_path = DL_DIR / "northstar_halo_mod_pack_v2_20261123.zip.sha256"
    assert zip_path.is_file() and sha_path.is_file()
    expected_zip_sha = sha_path.read_text(encoding="utf-8").split()[0]
    assert hashlib.sha256(zip_path.read_bytes()).hexdigest() == expected_zip_sha

    with zipfile.ZipFile(zip_path, "r") as zf:
        names = set(zf.namelist())
        zip_bytes = {n: zf.read(n) for n in names}
    # 16 release files plus SHA256SUMS.txt (six third-party-named scripts removed 2026-11-23)
    assert len(names) == 17
    assert sum(1 for n in names if n.endswith(".bitmap")) == 4
    assert sorted(n for n in names if n.endswith(".hsc")) == [
        "scenarios_hsc/nsp_digon_sanctum_arena.hsc",
        "scenarios_hsc/shrine_digon_shimmer_director.hsc",
    ]
    # No local folder paths or third-party property names anywhere in the archive
    for n, b in zip_bytes.items():
        low = b.lower()
        for needle in (b"c:\\", b"f:\\", b"northstar_os", b"steamapps", b"quidditch", b"minecraft", b"cortana"):
            assert needle not in low, f"{needle!r} found in ZIP member {n}"
    # Every SHA256SUMS.txt line matches its ZIP member, and every other member is listed
    zip_sums = dict(
        (rel, hx) for hx, rel in (ln.split("  ", 1) for ln in zip_bytes["SHA256SUMS.txt"].decode("utf-8").splitlines())
    )
    assert set(zip_sums) == names - {"SHA256SUMS.txt"}
    for rel, hx in zip_sums.items():
        assert hashlib.sha256(zip_bytes[rel]).hexdigest() == hx, rel
    # Standalone files the page offers are byte-identical to the copies inside the ZIP
    for standalone, member in (
        ("ModInfo.json", "ModInfo.json"),
        ("README.md", "README.md"),
        ("SHA256SUMS.txt", "SHA256SUMS.txt"),
        ("V2_ENGINE_VERIFICATION_RECEIPT.json", "roundtrip_proofs/V2_ENGINE_VERIFICATION_RECEIPT.json"),
        ("hsc_scripts/nsp_digon_sanctum_arena.hsc", "scenarios_hsc/nsp_digon_sanctum_arena.hsc"),
        ("hsc_scripts/shrine_digon_shimmer_director.hsc", "scenarios_hsc/shrine_digon_shimmer_director.hsc"),
    ):
        assert (DL_DIR / standalone).read_bytes() == zip_bytes[member], standalone
    assert "SHA256SUMS.txt" in names
    assert "ModInfo.json" in names
    assert "reclaimer_modes/northstar-digon-overload.json" in names
    assert "reclaimer_modes/northstar-sandtrap-shimmer.json" in names

    # Check direct downloadable mode JSONs match valid JSON and SHA256SUMS.txt entries
    sums_bytes = (DL_DIR / "SHA256SUMS.txt").read_bytes()
    assert b"\r" not in sums_bytes, "SHA256SUMS.txt must use Unix LF line endings"
    sum_map = {}
    for ln in sums_bytes.decode("utf-8").splitlines():
        if ln.strip():
            hx, rel = ln.split("  ", 1)
            sum_map[rel] = hx
    assert len(sum_map) == 16

    for mode_name in (
        "northstar-digon-overload.json",
        "northstar-sandtrap-shimmer.json",
        "northstar-pressure.json",
        "northstar-endless-tempo.json",
    ):
        p = DL_DIR / "reclaimer_modes" / mode_name
        assert p.is_file()
        data = json.loads(p.read_text(encoding="utf-8"))
        assert "name" in data
        assert hashlib.sha256(p.read_bytes()).hexdigest() == sum_map[f"reclaimer_modes/{mode_name}"]

    # Verify every /halo/ download href on the page exists on disk
    html = (HALO_DIR / "index.html").read_text(encoding="utf-8")
    for href in re.findall(r'href="(/halo/[^"]+)"', html):
        rel = href.lstrip("/")
        target = ROOT / rel
        assert target.exists(), f"Missing /halo/ link target on disk: {href}"


def test_halo_route_responsive_zero_overflow_zero_broken_images_and_shimmer_js(static_base_url):
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, args=["--mute-audio", "--no-sandbox"])
        try:
            for width, height, dpr, is_mob in [
                (320, 568, 2, True),
                (390, 844, 2, True),
                (1280, 800, 1, False),
            ]:
                ctx = browser.new_context(
                    viewport={"width": width, "height": height},
                    device_scale_factor=dpr,
                    is_mobile=is_mob,
                    has_touch=is_mob,
                )
                page = ctx.new_page()
                console_errs: list[str] = []
                page_errs: list[str] = []
                page.on("console", lambda m, ce=console_errs: ce.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e, pe=page_errs: pe.append(str(e)))
                resp = page.goto(f"{static_base_url}/halo/", wait_until="load", timeout=60000)
                assert resp is not None and resp.status == 200
                broken = page.evaluate(
                    """async () => {
                        const imgs = [...document.querySelectorAll('img')];
                        for (const im of imgs) {
                            im.loading = 'eager';
                            if (!im.complete) {
                                await new Promise(res => {
                                    im.addEventListener('load', res, {once: true});
                                    im.addEventListener('error', res, {once: true});
                                    setTimeout(res, 6000);
                                });
                            }
                        }
                        return imgs.filter(im => !im.complete || im.naturalWidth === 0).map(im => im.getAttribute('src'));
                    }"""
                )
                assert broken == [], f"Broken images at {width}x{height}: {broken}"
                sw = page.evaluate(
                    "Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0)"
                )
                assert sw <= width, f"/halo/ overflow at {width}x{height}: scrollWidth={sw}"
                assert console_errs == [], f"Console errors at {width}x{height}: {console_errs}"
                assert page_errs == [], f"Page errors at {width}x{height}: {page_errs}"

                # Verify interactive 300s shimmer explorer updates at t=250s and shows no mode stage
                if width == 1280:
                    page.locator("#shimmer-slider").fill("250")
                    page.locator("#shimmer-slider").dispatch_event("input")
                    assert "250 s / 300 s" in page.locator("#sh-t").inner_text()
                    assert page.locator("#sh-stage").count() == 0
                ctx.close()
        finally:
            browser.close()
