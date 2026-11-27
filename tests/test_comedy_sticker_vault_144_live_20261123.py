"""Truth-first verification suite for /stickerforge/comedy-vault/ (144 Original Comedy Stickers, Vols. 1-4)."""
from __future__ import annotations

import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VAULT_DIR = ROOT / "stickerforge" / "comedy-vault"
HTML_PATH = VAULT_DIR / "index.html"
CATALOG_PATH = VAULT_DIR / "catalog.json"
ASSETS_DIR = VAULT_DIR / "assets"


def test_comedy_vault_files_and_144_catalog_schema() -> None:
    assert HTML_PATH.is_file(), f"Missing {HTML_PATH}"
    assert CATALOG_PATH.is_file(), f"Missing {CATALOG_PATH}"
    cat = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    assert cat["total_stickers"] == 144
    assert cat["total_packs"] == 24
    stickers = cat["stickers"]
    assert len(stickers) == 144
    ids = [s["id"] for s in stickers]
    assert len(set(ids)) == 144
    assert sum(1 for s in stickers if s["kind"] == "diecut") == 120
    assert sum(1 for s in stickers if s["kind"] == "bumper") == 24
    assert {s["vol"] for s in stickers} == {1, 2, 3, 4}


def test_all_149_webp_assets_exist_and_decode_cleanly() -> None:
    cat = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    expected_assets = {
        "hero_144_bundle_showcase.webp",
        "vol1_mega_wall.webp",
        "vol2_mega_wall.webp",
        "vol3_mega_wall.webp",
        "vol4_mega_wall.webp",
    }
    for s in cat["stickers"]:
        expected_assets.add(Path(s["webp"]).name)
    assert len(expected_assets) == 149
    for fname in sorted(expected_assets):
        fp = ASSETS_DIR / fname
        assert fp.is_file(), f"Missing asset {fp}"
        assert fp.stat().st_size > 1024, f"Tiny asset {fp}"
        with Image.open(fp) as im:
            assert im.format == "WEBP"
            assert im.width >= 200 and im.height >= 120


def test_html_accessibility_seo_zero_local_paths_and_live_gumroad_links() -> None:
    text = HTML_PATH.read_text(encoding="utf-8")
    assert '<main>' in text and '<header class="site-header">' in text and '<footer>' in text
    assert '@media (forced-colors: active)' in text
    assert '@media (prefers-reduced-motion: reduce)' in text
    assert 'vorath_btn_obsidian.webp' in text and 'vorath_btn_primary.webp' in text
    assert 'vorath_stat_plaque_v01.webp' in text and 'vorath_card_frame_v01.webp' in text
    assert 'application/ld+json' in text
    assert 'https://northstarprime.net/stickerforge/comedy-vault/' in text
    assert 'about:blank' not in text
    assert not re.search(r'(?:href|src)\s*=\s*["\'](?:file://|[A-Z]:\\)', text, re.IGNORECASE)
    assert text.count('class="sticker-card') == 144
    gumroad_urls = sorted(set(re.findall(r'https://andrewcog\.gumroad\.com/l/[a-zA-Z0-9_-]+', text)))
    assert len(gumroad_urls) >= 5, f"Expected 5 live verified Gumroad checkout links, found {gumroad_urls}"
