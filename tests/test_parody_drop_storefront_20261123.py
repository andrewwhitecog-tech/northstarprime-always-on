"""Permanent regression tests for NorthStar Prime /parody-drop/ storefront route (2026-11-23)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "parody-drop" / "index.html"

FORBIDDEN_TOKENS = [
    "shrek", "dreamworks", "carmen sandiego", "broderbund", "netflix",
    "icarly", "nickelodeon", "hannah montana", "miley cyrus", "disney channel",
    "girl meets world", "lizzie mcguire", "hilary duff", "britney spears",
    "bratz", "lisa frank", "andrew.white.cog@gmail.com",
]


def test_parody_drop_html_structure_a11y_and_ip_hygiene() -> None:
    assert PAGE.is_file(), f"Missing route HTML: {PAGE}"
    html = PAGE.read_text(encoding="utf-8")
    low = html.lower()

    assert 'data-nsp-route="parody-drop-7icon-storefront-20261123"' in html
    assert "original parody streetwear art concept" in low
    assert "overflow-x:hidden" not in low.replace(" ", "")
    assert "prefers-reduced-motion" in low
    assert "forced-colors:active" in low
    assert "vorath_btn_primary.webp" in html
    assert "vorath_cartouche_9slice.webp" in html
    assert "https://andrewcog.gumroad.com/l/rich-yn-swamp-dynasty-pack" in html
    assert "https://andrewcog.gumroad.com/l/crimson-haze-worldwide-pack" in html
    assert "https://andrewcog.gumroad.com/l/rich-yn-y2k-primetime-pack" in html

    for tok in FORBIDDEN_TOKENS:
        assert tok not in low, f"Forbidden token leaked into parody-drop/index.html: {tok!r}"


def test_parody_drop_local_assets_exist_and_within_budget() -> None:
    html = PAGE.read_text(encoding="utf-8")
    refs = sorted(set(re.findall(r"/parody-drop/assets/([a-zA-Z0-9_.-]+\.webp)", html)))
    assert len(refs) >= 25, f"Expected >=25 WebP storefront assets, found {len(refs)}"
    total_bytes = 0
    for name in refs:
        p = ROOT / "parody-drop" / "assets" / name
        assert p.is_file(), f"Missing referenced WebP asset: {p}"
        sz = p.stat().st_size
        assert sz > 5_000, f"Suspiciously small WebP asset: {p} ({sz} B)"
        total_bytes += sz
    assert total_bytes < 8_000_000, f"Parody drop WebP payload exceeded 8 MB budget: {total_bytes}"
