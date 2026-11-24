"""Regression tests for PR #385: /parody-drop/ 14 tee cards truth fix + /halo/ L140 + /merch/ #art-bor-v2."""
from __future__ import annotations

import html as hlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

POSTER_IN_PACK_TEES = {
    "tee_01_swamp_estate.webp": "https://andrewcog.gumroad.com/l/rich-yn-swamp-dynasty-pack",
    "tee_02_crimson_rig.webp": "https://andrewcog.gumroad.com/l/crimson-haze-worldwide-pack",
    "tee_03_doublelife.webp": "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack",
    "tee_04_poproyalty.webp": "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack",
    "tee_07_swamp_vip.webp": "https://andrewcog.gumroad.com/l/rich-yn-swamp-dynasty-pack",
    "tee_08_dablab.webp": "https://andrewcog.gumroad.com/l/crimson-haze-worldwide-pack",
    "tee_10_kushatlas.webp": "https://andrewcog.gumroad.com/l/crimson-haze-worldwide-pack",
    "tee_11_webcast.webp": "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack",
    "tee_12_besties.webp": "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack",
    "tee_14_alterego.webp": "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack",
}

CONCEPT_ONLY_TEES = [
    "tee_05_swamp_graffiti.webp",
    "tee_06_swamp_buggy.webp",
    "tee_09_skyline.webp",
    "tee_13_brownstone.webp",
]


def _extract_card_for_asset(page_html: str, asset_name: str) -> str:
    cards = re.findall(r'<article class="card"[^>]*>.*?</article>', page_html, re.DOTALL)
    matches = [c for c in cards if asset_name in c]
    assert len(matches) == 1, f"Expected 1 mockup card for {asset_name}, found {len(matches)}"
    return matches[0]


def test_parody_drop_14_tee_cards_match_verified_gumroad_zips() -> None:
    txt = (ROOT / "parody-drop" / "index.html").read_text(encoding="utf-8")

    # Zero stale 15x18 DTG tee file promises on /parody-drop/
    assert "15×18 DTG Vintage Washed" not in txt
    assert "15x18 DTG Vintage Washed" not in txt
    assert not re.search(r"[\U00010000-\U0010ffff]", txt), "/parody-drop/index.html must contain 0 emojis"

    # Total mockup card count remains 40 (4 hoodies + 14 tees + 10 posters + 7 cases + 5 hardware)
    grid_m = re.search(r'<div class="grid-mockups" id="mockup-grid">(.*?)</div>\s*</section>', txt, re.DOTALL)
    assert grid_m is not None
    cards = re.findall(r'<article class="card"', grid_m.group(1))
    assert len(cards) == 40, f"Expected 40 mockup cards, found {len(cards)}"

    # 10 tee cards whose art exists ONLY as an 18x24 300-DPI poster JPG in the linked Gumroad pack
    for asset, expected_url in POSTER_IN_PACK_TEES.items():
        card = _extract_card_for_asset(txt, asset)
        assert 'data-tee-delivery="poster-18x24"' in card
        assert "18×24" in card and "300-DPI" in card and "poster" in card.lower()
        assert "No 15×18 DTG tee file in pack" in card
        assert f'href="{expected_url}"' in card
        assert "Get Print Files" not in card

    # 4 tee cards whose art is NOT in any live Gumroad ZIP — clearly Lookbook Concept with zero buy link
    for asset in CONCEPT_ONLY_TEES:
        card = _extract_card_for_asset(txt, asset)
        assert 'data-tee-delivery="lookbook-concept"' in card
        assert "Lookbook Concept" in card
        assert "Not Included in Current Packs" in card
        assert "not included in any current live Gumroad pack" in card
        assert "gumroad.com" not in card, f"Concept-only card {asset} must not contain a Gumroad buy link"
        assert "<a " not in card, f"Concept-only card {asset} must not contain misleading CTA links"


def test_halo_hero_caption_notes_recoloured_game_plate() -> None:
    txt = (ROOT / "halo" / "index.html").read_text(encoding="utf-8")
    assert "our compiled H3EK mod textures" not in txt
    assert "recoloured from the game's own texture" in txt
    cap_m = re.search(r'<figcaption class="art-cap"><strong>Sandtrap Decoded.*?</figcaption>', txt, re.DOTALL)
    assert cap_m is not None
    cap = cap_m.group(0)
    assert "recoloured from the game's own texture" in cap
    assert "our compiled" not in cap


def test_merch_bill_of_rights_card_routes_folio_inquiries_to_contact() -> None:
    txt = (ROOT / "merch" / "index.html").read_text(encoding="utf-8")
    assert "Collector Folio (Chromatic)" not in txt
    card_m = re.search(r'<article class="merch-card" id="art-bor-v2".*?</article>', txt, re.DOTALL)
    assert card_m is not None
    card = card_m.group(0)
    assert 'href="/chromatic/"' not in card
    assert 'href="/contact/"' in card
    assert "Ask About Print Folio" in card

    di_m = re.search(r'data-item="([^"]+)"', card)
    assert di_m is not None
    data = json.loads(hlib.unescape(di_m.group(1)))
    assert data["cta2_url"] == "/contact/"
    assert "Chromatic" not in data["cta2_label"]


def test_merch_five_windows_18x12_zazzle_prints_card() -> None:
    txt = (ROOT / "merch" / "index.html").read_text(encoding="utf-8")
    webp = ROOT / "assets" / "merch_mockups_20261123" / "zaz_five_windows_18x12_prints.webp"
    assert webp.is_file()
    raw = webp.read_bytes()
    assert raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"

    card_m = re.search(r'<article class="merch-card" id="zaz-five-windows-18x12-prints".*?</article>', txt, re.DOTALL)
    assert card_m is not None
    card = card_m.group(0)
    assert "unframed print by default" in card.lower()
    assert "each sold individually" in card.lower()
    assert "Standard Semi-Gloss default" in card
    assert "frame included" not in card.lower()

    for url in [
        "https://www.zazzle.com/the_black_glass_chapel_twilight_solarium_print-256724785918631522",
        "https://www.zazzle.com/signal_under_the_door_fern_cathedral_keyhole_print-256574364435473202",
        "https://www.zazzle.com/northstar_chrono_defender_solar_rift_titan_print-256857735461059294",
        "https://www.zazzle.com/vorath_delve_deep_sanctum_threshold_art_print-256897680699780264",
        "https://www.zazzle.com/vorath_sampler_plate_i_celestial_sanctuary_print-256783840315444847",
    ]:
        assert url in card, f"Missing live Zazzle 18x12 print URL: {url}"

    # Verify card count and JSON-LD stay 100% synced
    card_count = len(re.findall(r'<article class="merch-card"', txt))
    assert f"All Archive Pieces ({card_count})" in txt
    assert f"Showing {card_count} of {card_count} pieces" in txt
    m = re.search(r'<script type="application/ld\+json">(\{.*?\})</script>', txt)
    assert m is not None
    ld = json.loads(m.group(1))
    items = ld["mainEntity"]["itemListElement"]
    assert ld["mainEntity"]["numberOfItems"] == len(items) == card_count
    assert [el["position"] for el in items] == list(range(1, card_count + 1))
