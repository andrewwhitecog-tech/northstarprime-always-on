"""Regression check ensuring /ckd-kitchen/ has no broken renalshield.com links."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CKD_INDEX = ROOT / "ckd-kitchen" / "index.html"


def test_ckd_kitchen_has_no_dead_renalshield_domain_links():
    html = CKD_INDEX.read_text(encoding="utf-8")
    assert "renalshield.com" not in html.lower(), "Dead renalshield.com link still present in ckd-kitchen/index.html"
    assert "Automatic label OCR is live." not in html
    for expected in (
        'href="/renalshield/"',
        'href="/ckd-kitchen/chairside-pocket-guide.html"',
        'href="/ckd-kitchen/flavor-atlas.html"',
        'href="/static/downloads/Digital_MasterCook_Book_Freeware_v09.html"',
        "Digital_MasterCook_Deluxe_Illustrated_Edition.html",
        'name="q"',
        "Dietitian feedback",
        "not a formal product review",
    ):
        assert expected in html, f"Expected static route/marker missing: {expected}"
