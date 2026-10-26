"""Unit and integration tests for customer static journeys and the Interactive VORATH Oracle (/oracle/)."""
from __future__ import annotations

from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT / "tools") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "tools"))

import verify_home_static as home


def test_oracle_page_identity_and_local_integrity():
    oracle_path = REPO_ROOT / "oracle" / "index.html"
    assert oracle_path.is_file(), "oracle/index.html is missing"
    page = home.read_page(oracle_path)
    home.check_identity(
        page,
        "VORATH Interactive Oracle — Free 3-Card Tarot Reading & Custom Relic Generator — NorthStar Prime",
        "https://northstarprime.net/oracle/",
    )
    home.check_local_links(REPO_ROOT, oracle_path, page)
    assets = home.collect_local_assets(REPO_ROOT, oracle_path, page)
    assert "static/front-door.css" in assets
    assert "tarot/oracle/cards/card-back-eye.webp" in assets
    assert "static/front/store/vorath-tarot-deluxe-bundle-cover.webp" in assets


def test_oracle_22_major_arcana_and_6_relics_verified_assets():
    oracle_path = REPO_ROOT / "oracle" / "index.html"
    html = oracle_path.read_text(encoding="utf-8")
    expected_arcana = [
        "00_the_fool", "01_the_magician", "02_the_high_priestess", "03_the_empress",
        "04_the_emperor", "05_the_hierophant", "06_the_lovers", "07_the_chariot",
        "08_strength", "09_the_hermit", "10_wheel_of_fortune", "11_justice",
        "12_the_hanged_man", "13_death", "14_temperance", "15_the_devil",
        "16_the_tower", "17_the_star", "18_the_moon", "19_the_sun",
        "20_judgement", "21_the_world",
    ]
    for card_id in expected_arcana:
        rel_path = f"tarot/oracle/cards/{card_id}.webp"
        assert f"/{rel_path}" in html, f"Missing Major Arcana {card_id} in oracle/index.html"
        assert (REPO_ROOT / rel_path).is_file(), f"Missing card artwork on disk: {rel_path}"

    for relic_id in (
        "relic_01_voxel_eye",
        "relic_02_solar_archon",
        "relic_03_carnival_eye",
        "relic_04_riddle_box",
        "relic_05_wheel_of_light",
        "relic_06_ardentilaterum",
    ):
        assert relic_id in html, f"Missing Vorath Relic {relic_id}"


def test_oracle_lenses_synthesis_and_storefront_conversion_funnel():
    html = (REPO_ROOT / "oracle" / "index.html").read_text(encoding="utf-8")
    for lens in (
        "Creative Forge &amp; Mastery",
        "Shadow &amp; Transmutation",
        "Horizon &amp; Sovereign Path",
        "Dark Carnival &amp; Voxel Alchemy",
    ):
        assert lens in html

    for position in (
        "Position I · The Anchor",
        "Position II · The Crucible",
        "Position III · The Horizon",
    ):
        assert position in html

    for product_url in (
        "https://app.northstarprime.net/chromatic/products/vorath-tarot-v2-pdf-deck",
        "https://app.northstarprime.net/chromatic/products/acid-voxel-halloween-45-pack",
        "https://andrewcog.gumroad.com/l/vdquzp",
        "/acid-voxel-halloween/downloads/NorthStar_Acid_Voxel_Halloween_Free_Sticker_Sheet.pdf",
        "/vorath-x-icp-dark-carnival/downloads/NorthStar_Vorath_x_ICP_Dark_Carnival_Free_Sticker_Sheet.pdf",
        "/store/",
    ):
        assert product_url in html

    # Strict zero-emoji check on oracle/index.html
    for line_num, line in enumerate(html.splitlines(), start=1):
        for char in line:
            code = ord(char)
            assert not (0x1F300 <= code <= 0x1FAFF or 0x1F600 <= code <= 0x1F64F), (
                f"Forbidden emoji '{char}' (U+{code:04X}) in oracle/index.html line {line_num}"
            )


def test_oracle_discoverability_in_store_links_and_sitemap():
    store_html = (REPO_ROOT / "store" / "index.html").read_text(encoding="utf-8")
    links_html = (REPO_ROOT / "links" / "index.html").read_text(encoding="utf-8")
    sitemap_xml = (REPO_ROOT / "sitemap.xml").read_text(encoding="utf-8")

    assert 'href="/oracle/"' in store_html
    assert 'href="/oracle/"' in links_html
    assert "<loc>https://northstarprime.net/oracle/</loc>" in sitemap_xml
