"""Regression checks for Merch Mockups Step 2 real-surface mockup wiring (2026-11-23)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = ROOT / "assets" / "merch_mockups_20261123"

EXPECTED_WEBPS = [
    "01_comedy_vault_laptop_walnut_desk.webp",
    "02_comedy_vault_insulated_bottle_slate.webp",
    "03_comedy_vault_toolbox_bumpers_garage.webp",
    "04_comedy_vault_skateboard_deck_brick.webp",
    "05_vorath_print_canon_gallery_trio_wall.webp",
    "06_vorath_chromatic_eye_18x12_framed_credenza.webp",
    "07_vorath_mandala_gold_foil_card_tabletop.webp",
    "08_zazzle_1103_chrono_defender_black_tee_draped.webp",
    "09_zazzle_1103_signal_door_tee_and_framed_print.webp",
    "10_zazzle_1104_sovereign_and_idg_stickers_laptop.webp",
    "11_printful_holiday_ornaments_pine_tree.webp",
    "12_printful_2027_sacred_calendar_wall.webp",
]

# Verified GONE (301/404) or REFUSED (403) Zazzle listings that must NEVER be wired onto public storefront pages
FORBIDDEN_ZAZZLE_IDS = [
    "256344956592764312",  # H1 hidden
    "256923616500066215",  # H2 hidden
    "256147192719010681",  # H3 hidden
    "256498063764832911",  # I3-A gone 301
    "256824833421429468",  # I4-A gone 301
    "256147239641054219",  # I5-A gone 301
    "256357315909645849",  # World flag 403 signed out
    "256846683466042602",  # World flag tee 403 signed out
]


def test_all_12_webp_mockups_exist_and_are_compact():
    assert ASSET_DIR.is_dir(), f"Missing {ASSET_DIR}"
    total = 0
    for fn in EXPECTED_WEBPS:
        fp = ASSET_DIR / fn
        assert fp.is_file(), f"Missing WebP mockup: {fp}"
        data = fp.read_bytes()
        assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", f"Invalid WebP header: {fn}"
        assert 10_000 < len(data) < 250_000, f"Unexpected WebP size for {fn}: {len(data)}"
        total += len(data)
    assert total < 2_500_000, f"Total WebP bundle too large: {total}"


def test_comedy_vault_wires_all_4_surface_previews_with_truthful_digital_copy():
    txt = (ROOT / "stickerforge" / "comedy-vault" / "index.html").read_text(encoding="utf-8")
    assert 'id="surface-previews"' in txt
    for fn in EXPECTED_WEBPS[:4]:
        assert f"/assets/merch_mockups_20261123/{fn}" in txt
    # Buyer truth: digital 300-DPI files buyer prints/cuts (never implies shipped physical stickers)
    assert "digital 300-DPI PNG files you print and cut at home" in txt
    assert ".preview-card" in txt
    assert "forced-colors: active" in txt


def test_merch_wires_real_surface_mockups_and_only_verified_live_zazzle_urls():
    txt = (ROOT / "merch" / "index.html").read_text(encoding="utf-8")
    expected_on_merch = [
        "01_comedy_vault_laptop_walnut_desk.webp",
        "05_vorath_print_canon_gallery_trio_wall.webp",
        "06_vorath_chromatic_eye_18x12_framed_credenza.webp",
        "07_vorath_mandala_gold_foil_card_tabletop.webp",
        "08_zazzle_1103_chrono_defender_black_tee_draped.webp",
        "09_zazzle_1103_signal_door_tee_and_framed_print.webp",
        "10_zazzle_1104_sovereign_and_idg_stickers_laptop.webp",
        "11_printful_holiday_ornaments_pine_tree.webp",
        "12_printful_2027_sacred_calendar_wall.webp",
    ]
    for fn in expected_on_merch:
        assert f"/assets/merch_mockups_20261123/{fn}" in txt, f"Missing on /merch/: {fn}"

    # Verify live Zazzle product URLs are present
    for url in [
        "https://www.zazzle.com/northstar_chrono_defender_portal_arch_black_tee-256008179431180177",
        "https://www.zazzle.com/signal_under_the_door_keyhole_arch_black_tee-256229347355723885",
        "https://www.zazzle.com/signal_under_the_door_fern_cathedral_keyhole_print-256574364435473202",
        "https://www.zazzle.com/vorath_chromatic_eye_round_sticker-256386216224146495",
        "https://www.zazzle.com/vorath_chromatic_eye_art_print-256017845782558629",
        "https://www.zazzle.com/vorath_sacred_geometry_mandala_gold_foil_card-256390820282213594",
    ]:
        assert url in txt, f"Missing verified live Zazzle link: {url}"

    for bad_id in FORBIDDEN_ZAZZLE_IDS:
        assert bad_id not in txt, f"Forbidden gone/403 Zazzle ID leaked onto /merch/: {bad_id}"

    # Card tally, button label, and JSON-LD numberOfItems + itemListElement stay 100% synced
    card_count = len(re.findall(r'<article class="merch-card"', txt))
    assert f"All Archive Pieces ({card_count})" in txt
    assert f"Showing {card_count} of {card_count} pieces" in txt
    m = re.search(r'<script type="application/ld\+json">(\{.*?\})</script>', txt)
    assert m
    ld = json.loads(m.group(1))
    items = ld["mainEntity"]["itemListElement"]
    assert ld["mainEntity"]["numberOfItems"] == card_count
    assert len(items) == card_count, f"JSON-LD itemListElement length {len(items)} != card_count {card_count}"
    assert [el["position"] for el in items] == list(range(1, card_count + 1))

    # Buyer-truth copy precision checks (Finding 3 / N2, N4, N5)
    assert "144 designs (120 die-cuts, 24 bumpers) plus 24 ready-to-press 12x18 gang sheets" in txt
    assert "Priced individually ($16 each; studio photo shows Star of Bethlehem alongside the Snowy Owl ornament)." in txt
    assert "Weather-resistant physical vinyl stickers shipped directly by Zazzle" not in txt
    assert "Standard Semi-Gloss" in txt
    assert "Shipped Directly by Zazzle Worldwide" not in txt


def test_chromatic_wires_print_canon_and_foil_previews():
    txt = (ROOT / "chromatic" / "index.html").read_text(encoding="utf-8")
    assert 'class="studio-showcase"' in txt
    for fn in [
        "05_vorath_print_canon_gallery_trio_wall.webp",
        "06_vorath_chromatic_eye_18x12_framed_credenza.webp",
        "07_vorath_mandala_gold_foil_card_tabletop.webp",
    ]:
        assert f"/assets/merch_mockups_20261123/{fn}" in txt
    assert "https://www.zazzle.com/vorath_chromatic_eye_art_print-256017845782558629" in txt
    assert "https://www.zazzle.com/vorath_sacred_geometry_mandala_gold_foil_card-256390820282213594" in txt
    assert "https://andrewcog.gumroad.com/l/vorath-colorized-print-canon-proof-pack" in txt
    assert "plus the Mandala 5x7 card in real stamped metallic gold foil" in txt
    assert "Standard Semi-Gloss" in txt
    assert "showcase-card" in txt and "forced-colors: active" in txt


def test_cycles_mockups_preserve_black_point_and_color_saturation():
    """Guard against AgX/specular glare washout on re-rendered Cycles mockups (01, 02, 05, 06, 10)."""
    from PIL import Image

    def crop_tone_stats(webp_name: str, box: tuple[float, float, float, float]) -> tuple[float, float]:
        im = Image.open(ASSET_DIR / webp_name).convert("RGB")
        w, h = im.size
        cr = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
        raw = cr.tobytes()
        n = len(raw) // 3
        lums = sorted((0.2126 * raw[i] + 0.7152 * raw[i + 1] + 0.0722 * raw[i + 2]) / 255.0 for i in range(0, len(raw), 3))
        p5l = lums[max(0, int(0.05 * n))]
        s_sum = 0.0
        for i in range(0, len(raw), 3):
            r, g, b = raw[i], raw[i + 1], raw[i + 2]
            mx = max(r, g, b)
            mn = min(r, g, b)
            s_sum += (mx - mn) / mx if mx > 0 else 0.0
        return p5l, s_sum / n

    # Checked against source masters (p5L ceiling prevents black-lift washout; saturation floor prevents pastel drain)
    checks = [
        ("01_comedy_vault_laptop_walnut_desk.webp", (0.11, 0.26, 0.26, 0.45), 0.10, 0.28),
        ("02_comedy_vault_insulated_bottle_slate.webp", (0.58, 0.39, 0.69, 0.56), 0.12, 0.35),
        ("05_vorath_print_canon_gallery_trio_wall.webp", (0.40, 0.39, 0.60, 0.57), 0.12, 0.30),
        ("06_vorath_chromatic_eye_18x12_framed_credenza.webp", (0.33, 0.27, 0.67, 0.57), 0.13, 0.32),
        ("10_zazzle_1104_sovereign_and_idg_stickers_laptop.webp", (0.27, 0.26, 0.44, 0.48), 0.13, 0.50),
    ]
    for fn, box, max_p5l, min_sat in checks:
        p5l, mean_s = crop_tone_stats(fn, box)
        assert p5l <= max_p5l, f"Washout black-lift on {fn}: p5L={p5l:.3f} > {max_p5l:.3f}"
        assert mean_s >= min_sat, f"Desaturated artwork on {fn}: S={mean_s:.3f} < {min_sat:.3f}"
