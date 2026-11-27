from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def test_holidays_winter_lead_and_lookbook():
    html = (ROOT / "holidays" / "index.html").read_text(encoding="utf-8")
    assert "Sun Nov 29" in html
    assert "Fri Dec 4" in html
    assert "Wed Dec 9" in html
    assert "Thu Dec 10" in html
    assert 'id="winter-knit-lookbook"' in html
    assert 'id="holiday-tarot-relic-gifts"' in html
    assert "/assets/holiday_coogi_20261127/H01_Yule_Dynasty_Wave_Knit_Pullover.webp" in html
    assert "H04_Cranberry_Evergreen_COOGI_Atelier_Crewneck.webp" not in html
    assert "/assets/merch_gallery/optb_ornament_snowy_owl.webp" in html
    assert "/static/front/store/vorath-tarot-deluxe-bundle-cover.webp" in html
    assert "256163556991245466" in html
    assert 'id="vorath-santa-4k-wallpapers"' in html
    assert 'id="collector-calendar-2027"' in html
    assert 'id="free-mega-sampler-2026"' in html
    assert html.index('id="winter-printables"') < html.index('id="autumn-archive"')


def test_tarot_has_direct_gumroad_buy_paths():
    html = (ROOT / "tarot" / "index.html").read_text(encoding="utf-8")
    assert "https://andrewcog.gumroad.com/l/pshjy" in html
    assert "https://andrewcog.gumroad.com/l/fztoe" in html
    assert 'href="/store/"' in html
    assert 'href="/holidays/"' in html


def test_sovereign_merch_wires_live_zazzle_stickers():
    html = (ROOT / "sovereign-merch" / "index.html").read_text(encoding="utf-8")
    for pid in [
        "256382979866524099",
        "256715822946345533",
        "256328958674452531",
        "256053877081718128",
        "256071205304566135",
    ]:
        assert pid in html


def test_brand_displays_3_imprint_architecture():
    html = (ROOT / "brand" / "index.html").read_text(encoding="utf-8")
    assert "NorthStar Underground" in html
    assert "Infinite Drift Library" in html
    assert "Sovereign Guild" in html
    assert 'href="/holidays/"' in html
    assert 'href="/merch/"' in html
    assert 'href="/store/"' in html


def test_merch_catalog_count_and_jsonld_match():
    html = (ROOT / "merch" / "index.html").read_text(encoding="utf-8")
    card_count = len(re.findall(r'<article class="merch-card"', html))
    assert card_count == 58
    assert f"All Archive Pieces ({card_count})" in html
    assert f"Showing {card_count} of {card_count} pieces" in html
    assert 'id="zazzle-holiday-cards-6"' in html
    assert 'id="coogi-holiday-atelier-line"' not in html
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    assert m
    ld = json.loads(m.group(1))
    assert ld["mainEntity"]["numberOfItems"] == card_count
    assert len(ld["mainEntity"]["itemListElement"]) == card_count
