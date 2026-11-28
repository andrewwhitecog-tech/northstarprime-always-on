"""Regression & Playwright visual/a11y tests for Wave 7 live Gumroad vaults wired on northstarprime.net (2026-11-25)."""
from __future__ import annotations

import functools
import html as hlib
import http.server
import json
import pathlib
import re
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

LIVE_GUMROAD_VAULTS = [
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-7icon-parody-vault",
        "price_str": "$24",
        "price_num": 24.0,
        "cover": "/parody-drop/assets/cover_vault_pack.webp",
        "routes": ["/parody-drop/", "/merch/", "/store/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-12pack-watertight-stl-vault",
        "price_str": "$29",
        "price_num": 29.0,
        "cover": "/static/front/store/northstar-12pack-watertight-stl-vault-cover.webp",
        "routes": ["/3d-prints/", "/merch/", "/store/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-idg-5game-html5-webgl-arcade-pack",
        "price_str": "$9",
        "price_num": 9.0,
        "cover": "/static/front/store/northstar-idg-5game-html5-arcade-cover.webp",
        "routes": ["/games/", "/store/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-godot4-6game-core-bundle",
        "price_str": "$12",
        "price_num": 12.0,
        "cover": "/static/front/store/northstar-godot4-6game-core-bundle-cover.webp",
        "routes": ["/games/", "/store/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-godot4-9game-clean-vault",
        "price_str": "$15",
        "price_num": 15.0,
        "cover": "/static/front/store/northstar-godot4-9game-clean-vault-cover.webp",
        "routes": ["/games/", "/store/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/anodized-empires-and-anomalies-collector-vault",
        "price_str": "$19",
        "price_num": 19.0,
        "cover": "/static/front/store/anodized-empires-collector-vault-cover.webp",
        "routes": ["/chromatic/", "/merch/", "/store/"],
    },
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


def _extract_itemlist_ldjson(doc_html: str) -> dict:
    for m in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        doc_html,
        re.IGNORECASE | re.DOTALL,
    ):
        data = json.loads(m.group(1))
        if isinstance(data, dict) and data.get("@type") == "ItemList":
            return data
        if isinstance(data, dict) and isinstance(data.get("mainEntity"), dict) and data["mainEntity"].get("@type") == "ItemList":
            return data["mainEntity"]
    raise AssertionError("No ItemList JSON-LD block found")


def test_wave7_gumroad_vaults_covers_copy_and_jsonld():
    for v in LIVE_GUMROAD_VAULTS:
        cover = ROOT / v["cover"].lstrip("/")
        assert cover.is_file(), f"Missing cover WebP: {cover}"
        assert cover.read_bytes()[:4] == b"RIFF" and cover.read_bytes()[8:12] == b"WEBP"
        assert 10_000 < cover.stat().st_size <= 350_000, f"Unexpected cover size: {cover}"
        for r in v["routes"]:
            rel = r.strip("/") + "/index.html"
            raw = (ROOT / rel).read_text(encoding="utf-8")
            assert not re.search(r"[\U00010000-\U0010ffff]", raw), f"Emoji in {rel}"
            assert v["url"] in raw, f"{rel} missing {v['url']}"
            assert v["price_str"] in raw, f"{rel} missing {v['price_str']}"

    # Parody drop stale placeholder removed
    pd = (ROOT / "parody-drop" / "index.html").read_text(encoding="utf-8")
    assert "not yet on sale" not in pd.lower()
    assert "after daily quota reset" not in pd.lower()

    # Honest disclosures on 3D prints STL vault
    p3d = (ROOT / "3d-prints" / "index.html").read_text(encoding="utf-8")
    assert "not yet physically resin-test-printed" in p3d
    assert "lost-wax metal casting" in p3d

    # JSON-LD ItemList sync across routes
    minimum_counts = {
        "3d-prints/index.html": 17,
        "chromatic/index.html": 19,
        "merch/index.html": 57,
        "store/index.html": 42,
    }
    for rel, minimum in minimum_counts.items():
        raw = (ROOT / rel).read_text(encoding="utf-8")
        ld = _extract_itemlist_ldjson(raw)
        items = ld["itemListElement"]
        assert ld["numberOfItems"] == len(items) >= minimum, rel
        assert [el["position"] for el in items] == list(range(1, len(items) + 1))

        urls = []
        for entry in items:
            product = entry.get("item", entry)
            urls.append(product.get("offers", {}).get("url") or product.get("url"))
        route = "/" + rel.removesuffix("index.html")
        for vault in LIVE_GUMROAD_VAULTS:
            if route in vault["routes"]:
                assert urls.count(vault["url"]) == 1, f"{route}: {vault['url']}"


def test_wave7_all_7_routes_playwright_desktop_mobile_and_forced_colors(static_site_url):
    route_vaults = {
        "/parody-drop/": ["/parody-drop/assets/cover_vault_pack.webp"],
        "/3d-prints/": ["/static/front/store/northstar-12pack-watertight-stl-vault-cover.webp"],
        "/games/": [
            "/static/front/store/northstar-idg-5game-html5-arcade-cover.webp",
            "/static/front/store/northstar-godot4-6game-core-bundle-cover.webp",
            "/static/front/store/northstar-godot4-9game-clean-vault-cover.webp",
        ],
        "/chromatic/": [],
        "/merch/": [
            "/parody-drop/assets/cover_vault_pack.webp",
            "/static/front/store/northstar-12pack-watertight-stl-vault-cover.webp",
            "/static/front/store/anodized-empires-collector-vault-cover.webp",
        ],
        "/store/": [
            "/parody-drop/assets/cover_vault_pack.webp",
            "/static/front/store/northstar-12pack-watertight-stl-vault-cover.webp",
            "/static/front/store/northstar-idg-5game-html5-arcade-cover.webp",
            "/static/front/store/northstar-godot4-6game-core-bundle-cover.webp",
            "/static/front/store/northstar-godot4-9game-clean-vault-cover.webp",
            "/static/front/store/anodized-empires-collector-vault-cover.webp",
        ],
    }
    route_links = {
        "/parody-drop/": ["https://andrewcog.gumroad.com/l/northstar-7icon-parody-vault"],
        "/3d-prints/": ["https://andrewcog.gumroad.com/l/northstar-12pack-watertight-stl-vault"],
        "/games/": [
            "https://andrewcog.gumroad.com/l/northstar-idg-5game-html5-webgl-arcade-pack",
            "https://andrewcog.gumroad.com/l/northstar-godot4-6game-core-bundle",
            "https://andrewcog.gumroad.com/l/northstar-godot4-9game-clean-vault",
        ],
        "/chromatic/": ["https://andrewcog.gumroad.com/l/anodized-empires-and-anomalies-collector-vault"],
        "/merch/": [
            "https://andrewcog.gumroad.com/l/northstar-7icon-parody-vault",
            "https://andrewcog.gumroad.com/l/northstar-12pack-watertight-stl-vault",
            "https://andrewcog.gumroad.com/l/anodized-empires-and-anomalies-collector-vault",
        ],
        "/store/": [v["url"] for v in LIVE_GUMROAD_VAULTS],
    }
    routes = list(route_vaults.keys())
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
                for r in routes:
                    page = ctx.new_page()
                    console_errs: list[str] = []
                    page_errs: list[str] = []
                    page.on("console", lambda m, sink=console_errs: sink.append(m.text) if m.type == "error" else None)
                    page.on("pageerror", lambda e, sink=page_errs: sink.append(str(e)))
                    resp = page.goto(f"{static_site_url}{r}", wait_until="domcontentloaded", timeout=60000)
                    assert resp is not None and resp.status == 200
                    st = page.evaluate(
                        """async ([expectedCovers, expectedLinks]) => {
                            const waitImg = async (im) => {
                                im.loading = 'eager';
                                im.scrollIntoView({behavior: 'instant', block: 'center'});
                                if (!im.complete) {
                                    await new Promise((res) => {
                                        im.addEventListener('load', res, {once: true});
                                        im.addEventListener('error', res, {once: true});
                                        setTimeout(res, 15000);
                                    });
                                }
                                if (im.decode) { try { await im.decode(); } catch (_) {} }
                            };
                            const coverImgs = [];
                            for (const cov of expectedCovers) {
                                const els = [...document.querySelectorAll(`img[src="${cov}"]`)];
                                if (els.length) {
                                    for (const im of els) {
                                        await waitImg(im);
                                    }
                                    const im = els[0];
                                    coverImgs.push({src: cov, complete: im.complete, natW: im.naturalWidth, natH: im.naturalHeight});
                                } else {
                                    coverImgs.push({src: cov, missing: true});
                                }
                            }
                            const linkChecks = [];
                            for (const href of expectedLinks) {
                                const a = document.querySelector(`a[href="${href}"]`);
                                if (!a) {
                                    linkChecks.push({href, missing: true});
                                } else {
                                    const r = a.getBoundingClientRect();
                                    linkChecks.push({href, w: r.width, h: r.height});
                                }
                            }
                            window.scrollTo({top: 0, behavior: 'instant'});
                            const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
                            const brokenImgs = [...document.querySelectorAll('img')].filter(im => im.complete && im.naturalWidth === 0).map(im => im.getAttribute('src'));
                            return { sw, brokenImgs, coverImgs, linkChecks };
                        }""",
                        [route_vaults[r], route_links[r]],
                    )
                    assert st["sw"] <= width, f"{r} horizontal overflow at {width}x{height} fc={fc}: sw={st['sw']}"
                    assert not st["brokenImgs"], f"{r} broken images: {st['brokenImgs']}"
                    for ci in st["coverImgs"]:
                        assert not ci.get("missing") and ci.get("complete") and ci.get("natW", 0) > 0, f"{r} cover decode failed: {ci}"
                    for lc in st["linkChecks"]:
                        assert not lc.get("missing") and lc.get("w", 0) > 40 and lc.get("h", 0) >= 36, f"{r} link check failed: {lc}"
                    assert not console_errs, f"{r} console errors: {console_errs}"
                    assert not page_errs, f"{r} page errors: {page_errs}"
                    page.close()
                ctx.close()
        finally:
            browser.close()
