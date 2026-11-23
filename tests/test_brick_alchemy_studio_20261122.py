"""Regression tests for /brick-alchemy/ and /brick-alchemy/studio/ (28,544-set 3D Visual Calculator)."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HUB_HTML = ROOT / "brick-alchemy" / "index.html"
STUDIO_HTML = ROOT / "brick-alchemy" / "studio" / "index.html"
CAD_ENGINE_JS = ROOT / "brick-alchemy" / "studio" / "cad-engine.js"
CATALOG_JSON = ROOT / "brick-alchemy" / "studio" / "data" / "lego_universe_28544.json"
SITEMAP_XML = ROOT / "sitemap.xml"


def test_studio_catalog_integrity():
    assert CATALOG_JSON.is_file(), f"Missing catalog: {CATALOG_JSON}"
    data = json.loads(CATALOG_JSON.read_text(encoding="utf-8"))
    assert data["schema"] == "nsp-brick-alchemy-catalog-v2"
    assert len(data["sets"]) >= 28500
    assert len(data["themes"]) >= 450
    set_nums = {row[0] for row in data["sets"]}
    for required in ("8880-1", "6983-1", "6977-1", "42082-1", "10497-1"):
        assert required in set_nums, f"Expected iconic set {required} in catalog"


def test_studio_html_static_invariants():
    html = STUDIO_HTML.read_text(encoding="utf-8")
    assert 'href="https://northstarprime.net/brick-alchemy/studio/"' in html
    assert 'src="/games/three.min.js"' in html
    assert "cdnjs.cloudflare.com" not in html, "External CDN Three.js must not be used"
    assert "/api/sets" not in html and "/api/synthesize" not in html, "Dead /api/* fetches must not exist on static Pages"
    assert not re.search(r"[A-Za-z]:\\", html), "Local Windows drive paths must never appear in public HTML"
    assert "8208067319114903" not in html, "Private AliExpress order IDs must never appear in public HTML"
    assert "@media (forced-colors: active)" in html
    assert "@media (prefers-reduced-motion: reduce)" in html
    assert 'src="/brick-alchemy/studio/cad-engine.js"' in html
    assert 'onclick="addSetToTote(' not in html and 'onclick="removeSetFromTote(' not in html
    assert "cadExportLDraw()" in html and "cadExportBrickLink()" in html and "cadExportCSV()" in html
    assert "cad-step-slider" in html and "cad-builder-tray" in html
    assert "ardentilaterum_eye" in html

    assert CAD_ENGINE_JS.is_file(), f"Missing CAD engine script: {CAD_ENGINE_JS}"
    cad_js = CAD_ENGINE_JS.read_text(encoding="utf-8")
    for required_sym in (
        "startFallback2D",
        "buildStudioEnvMap",
        "getInvoluteGearGeo",
        "getTechnicLiftarmGeo",
        "OrthographicCamera",
        "generateLDrawText",
        "generateBrickLinkXML",
        "generateRebrickableCSV",
    ):
        assert required_sym in cad_js, f"CAD engine missing {required_sym}"
    assert not re.search(r"[A-Za-z]:\\", cad_js), "Local Windows drive paths must never appear in cad-engine.js"

    # Every referenced local image under /brick-alchemy/assets/ must exist on disk
    for img_path in re.findall(r'(/brick-alchemy/assets/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|mp4))', html):
        disk_path = ROOT / img_path.lstrip("/")
        assert disk_path.is_file(), f"Missing studio asset on disk: {img_path}"


def test_hub_links_studio_and_promo_video():
    html = HUB_HTML.read_text(encoding="utf-8")
    assert 'href="/brick-alchemy/studio/"' in html
    assert "/brick-alchemy/assets/brick-alchemy-promo-16x9.mp4" in html
    promo_disk = ROOT / "brick-alchemy" / "assets" / "brick-alchemy-promo-16x9.mp4"
    assert promo_disk.is_file() and promo_disk.stat().st_size > 200_000
    assert "https://andrewcog.gumroad.com/l/llkspo" in html
    assert "https://andrewcog.gumroad.com/l/fsltx" in html
    assert "https://andrewcog.gumroad.com/l/sefgfx" in html


def test_sitemap_lists_studio():
    sm = SITEMAP_XML.read_text(encoding="utf-8")
    assert "https://northstarprime.net/brick-alchemy/studio/" in sm
