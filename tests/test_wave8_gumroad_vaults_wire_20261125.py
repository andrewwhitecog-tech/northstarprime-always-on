"""Regression & Playwright visual/a11y tests for Wave 8 live Gumroad vaults wired on northstarprime.net (2026-11-25)."""
from __future__ import annotations

import functools
import http.server
import json
import os
import pathlib
import re
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]

WAVE8_GUMROAD_VAULTS = [
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-2027-collector-wall-calendar-pdf",
        "price_str": "$10",
        "cover": "/static/front/store/northstar-2027-collector-calendar-cover.webp",
        "routes": ["/store/", "/holidays/", "/links/", "/rich-yn/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/northstar-2026-free-mega-sampler",
        "price_str": "$0+",
        "cover": "/static/front/store/northstar-2026-free-mega-sampler-cover.webp",
        "routes": ["/store/", "/holidays/", "/links/", "/rich-yn/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/vorath-codex-collector-compendium",
        "price_str": "$9",
        "cover": "/static/front/store/vorath-codex-collector-compendium-cover.webp",
        "routes": ["/store/", "/links/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/uncle-vorath-blazin-beaver-issue-01",
        "price_str": "$7",
        "cover": "/static/front/store/vorath-beaver-issue01-cover.webp",
        "routes": ["/store/", "/comics/", "/links/"],
    },
    {
        "url": "https://andrewcog.gumroad.com/l/rich-yn-vol3-vol4-300dpi-vault",
        "price_str": "$19",
        "cover": "/static/front/store/rich-yn-vol3-vol4-300dpi-vault-cover.webp",
        "routes": ["/store/", "/links/", "/rich-yn/"],
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


def test_wave8_gumroad_vaults_covers_copy_and_jsonld():
    # Pre-existing Sacred Calendar 2027 (hyaeu) remains intact alongside Wave 8 Collector Calendar
    store_html = (ROOT / "store" / "index.html").read_text(encoding="utf-8")
    assert "https://andrewcog.gumroad.com/l/northstar-calendar-2027" in store_html
    hol_html = (ROOT / "holidays" / "index.html").read_text(encoding="utf-8")
    assert "https://andrewcog.gumroad.com/l/northstar-calendar-2027" in hol_html

    for v in WAVE8_GUMROAD_VAULTS:
        cover = ROOT / v["cover"].lstrip("/")
        assert cover.is_file(), f"Missing cover WebP: {cover}"
        hdr = cover.read_bytes()
        assert hdr[:4] == b"RIFF" and hdr[8:12] == b"WEBP"
        assert 10_000 < cover.stat().st_size <= 350_000, f"Unexpected cover size: {cover} ({cover.stat().st_size})"
        for r in v["routes"]:
            rel = r.strip("/") + "/index.html"
            raw = (ROOT / rel).read_text(encoding="utf-8")
            assert not re.search(r"[\U00010000-\U0010ffff]", raw), f"Emoji in {rel}"
            assert v["url"] in raw, f"{rel} missing {v['url']}"
            assert v["price_str"] in raw, f"{rel} missing {v['price_str']}"

    # Rank #5 RICH YN Vol 3/4 is now live and wired on /store/, /links/, and /rich-yn/
    rich_html = (ROOT / "rich-yn" / "index.html").read_text(encoding="utf-8")
    assert "https://andrewcog.gumroad.com/l/rich-yn-vol3-vol4-300dpi-vault" in rich_html

    # Mature 18+ & AI-assisted provenance assertions scoped per Wave 8 card and JSON-LD item
    card_checks = [
        (store_html, 'id="card-wave8-collector-calendar-2027"', ["$10", "18+", "AI-assisted art"]),
        (store_html, 'id="card-wave8-free-mega-sampler"', ["$0+", "AI-assisted art"]),
        (store_html, 'id="card-wave8-vorath-codex-compendium"', ["$9", "AI-assisted art"]),
        (store_html, 'id="card-wave8-vorath-beaver-issue01"', ["$7", "18+", "AI-assisted comic art + Suno AI soundtrack"]),
        (store_html, 'id="card-wave8-rich-yn-vol3-vol4-vault"', ["$19", "AI-assisted digital illustration"]),
        (rich_html, 'id="bridge-wave8-rich-yn-vol3-vol4-vault"', ["$19.00", "AI-assisted digital illustration"]),
        (hol_html, 'id="collector-calendar-2027"', ["$10", "18+", "AI-assisted art"]),
        (hol_html, 'id="free-mega-sampler-2026"', ["$0+", "AI-assisted art"]),
    ]
    for doc, marker, needles in card_checks:
        start = doc.index(marker)
        end = doc.find("</a>", start) if "card-wave8-" in marker else doc.find("</article>", start)
        snippet = doc[start:end]
        for needle in needles:
            assert needle in snippet, f"Missing {needle!r} inside {marker}"

    comics_html = (ROOT / "comics" / "index.html").read_text(encoding="utf-8")
    c_start = comics_html.index('id="vorath-beaver-issue-01"')
    c_end = comics_html.index("</main>", c_start)
    c_snippet = comics_html[c_start:c_end]
    for needle in ("$7", "18+", "AI-assisted comic art + Suno AI soundtrack"):
        assert needle in c_snippet, f"Missing {needle!r} inside comics Issue #01 card"
    assert "All Arcs (8)" in comics_html

    # JSON-LD ItemList sync + AI-assisted provenance on every Wave 8 ListItem
    expected_counts = {
        "store/index.html": (47, {43: ("18+", "AI-assisted art"), 44: ("AI-assisted art",), 45: ("AI-assisted art",), 46: ("18+", "AI-assisted comic art + Suno AI soundtrack"), 47: ("AI-assisted digital illustration",)}),
        "holidays/index.html": (18, {17: ("18+", "AI-assisted art"), 18: ("AI-assisted art",)}),
    }
    for rel, (exp_n, pos_checks) in expected_counts.items():
        raw = (ROOT / rel).read_text(encoding="utf-8")
        ld = _extract_itemlist_ldjson(raw)
        items = ld["itemListElement"]
        assert ld["numberOfItems"] == len(items) == exp_n, f"{rel}: {ld['numberOfItems']} / {len(items)} != {exp_n}"
        assert [el["position"] for el in items] == list(range(1, exp_n + 1))
        for pos, needles in pos_checks.items():
            desc = items[pos - 1]["item"]["description"]
            for needle in needles:
                assert needle in desc, f"{rel} JSON-LD pos {pos} missing {needle!r}"


def test_wave8_5_routes_playwright_desktop_mobile_and_forced_colors(static_site_url):
    route_vaults = {
        "/store/": [v["cover"] for v in WAVE8_GUMROAD_VAULTS],
        "/holidays/": [
            "/static/front/store/northstar-2027-collector-calendar-cover.webp",
            "/static/front/store/northstar-2026-free-mega-sampler-cover.webp",
        ],
        "/comics/": ["/static/front/store/vorath-beaver-issue01-cover.webp"],
        "/links/": [],
        "/rich-yn/": [],
    }
    route_links = {
        "/store/": [v["url"] for v in WAVE8_GUMROAD_VAULTS],
        "/holidays/": [
            "https://andrewcog.gumroad.com/l/northstar-2027-collector-wall-calendar-pdf",
            "https://andrewcog.gumroad.com/l/northstar-2026-free-mega-sampler",
        ],
        "/comics/": ["https://andrewcog.gumroad.com/l/uncle-vorath-blazin-beaver-issue-01"],
        "/links/": [v["url"] for v in WAVE8_GUMROAD_VAULTS],
        "/rich-yn/": [
            "https://andrewcog.gumroad.com/l/rich-yn-vol3-vol4-300dpi-vault",
            "https://andrewcog.gumroad.com/l/northstar-2027-collector-wall-calendar-pdf",
            "https://andrewcog.gumroad.com/l/northstar-2026-free-mega-sampler",
        ],
    }
    shot_dir_env = os.environ.get("WAVE8_SHOT_DIR", "").strip()
    shot_dir = pathlib.Path(shot_dir_env) if shot_dir_env else None
    if shot_dir:
        shot_dir.mkdir(parents=True, exist_ok=True)

    routes = list(route_vaults.keys())
    with sync_playwright() as pw:
        browser = pw.chromium.launch(
            headless=True,
            args=["--mute-audio", "--disable-webgl", "--disable-gpu", "--no-sandbox"],
        )
        try:
            for width, height, is_mob, fc, label in [
                (1280, 800, False, "none", "desktop"),
                (390, 844, True, "active", "mobile_fc"),
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
                            let firstLinkEl = null;
                            for (const href of expectedLinks) {
                                const a = document.querySelector(`a[href="${href}"]`);
                                if (!a) {
                                    linkChecks.push({href, missing: true});
                                } else {
                                    if (!firstLinkEl) firstLinkEl = a;
                                    const r = a.getBoundingClientRect();
                                    const cs = getComputedStyle(a);
                                    const vis = cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity || '1') > 0;
                                    linkChecks.push({href, w: r.width, h: r.height, vis});
                                }
                            }
                            if (firstLinkEl) {
                                firstLinkEl.scrollIntoView({behavior: 'instant', block: 'center'});
                            } else {
                                window.scrollTo({top: 0, behavior: 'instant'});
                            }
                            const sw = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
                            const brokenImgs = [...document.querySelectorAll('img')].filter(im => im.complete && im.naturalWidth === 0).map(im => im.getAttribute('src'));
                            return { sw, brokenImgs, coverImgs, linkChecks };
                        }""",
                        [route_vaults[r], route_links[r]],
                    )
                    if shot_dir:
                        slug = r.strip("/") or "home"
                        page.screenshot(path=str(shot_dir / f"{slug}_{label}.png"), full_page=False)
                    assert st["sw"] <= width, f"{r} horizontal overflow at {width}x{height} fc={fc}: sw={st['sw']}"
                    assert not st["brokenImgs"], f"{r} broken images: {st['brokenImgs']}"
                    for ci in st["coverImgs"]:
                        assert not ci.get("missing") and ci.get("complete") and ci.get("natW", 0) > 0, f"{r} cover decode failed: {ci}"
                    for lc in st["linkChecks"]:
                        assert not lc.get("missing") and lc.get("vis") and lc.get("w", 0) > 40 and lc.get("h", 0) >= 36, f"{r} link check failed: {lc}"
                    assert not console_errs, f"{r} console errors: {console_errs}"
                    assert not page_errs, f"{r} page errors: {page_errs}"
                    page.close()
                ctx.close()
        finally:
            browser.close()
