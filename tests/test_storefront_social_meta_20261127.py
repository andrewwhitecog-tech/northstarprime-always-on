"""Regression tests for aligned Q4 storefront/social SEO meta and JSON-LD (2026-11-27)."""
from __future__ import annotations

import html as html_lib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]


def _read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def _extract_meta(doc: str, attr: str, key: str) -> str:
    m = re.search(rf'<meta\s+{attr}=["\']{re.escape(key)}["\']\s+content=["\']([^"\']*)["\']', doc, re.I)
    assert m, f"Missing meta {attr}={key}"
    return html_lib.unescape(m.group(1))


def _extract_page_ldjson(doc: str, page_type: str) -> dict:
    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', doc, re.I | re.S):
        data = json.loads(m.group(1))
        if isinstance(data, dict) and data.get("@type") == page_type:
            return data
    raise AssertionError(f"Missing JSON-LD @type={page_type}")


def test_holidays_meta_reflects_physical_zazzle_and_winter_kits():
    doc = _read("holidays/index.html")
    for val in (
        _extract_meta(doc, "name", "description"),
        _extract_meta(doc, "property", "og:description"),
        _extract_meta(doc, "name", "twitter:description"),
        _extract_page_ldjson(doc, "WebPage")["description"],
    ):
        assert "no physical items" not in val.lower()
        assert "Zazzle" in val
        assert "Mega Sampler" in val


def test_store_meta_leads_with_winter_and_vaults_not_halloween():
    doc = _read("store/index.html")
    meta_desc = _extract_meta(doc, "name", "description")
    og_desc = _extract_meta(doc, "property", "og:description")
    tw_desc = _extract_meta(doc, "name", "twitter:description")
    ld_desc = _extract_page_ldjson(doc, "WebPage")["description"]
    for val in (meta_desc, og_desc, tw_desc, ld_desc):
        assert not val.startswith("Explore original NorthStar Prime Halloween")
        assert "Winter 2026" in val
        assert "Gumroad" in val


def test_tarot_and_sovereign_merch_meta_surface_direct_buy_paths():
    tarot_doc = _read("tarot/index.html")
    for val in (
        _extract_meta(tarot_doc, "name", "description"),
        _extract_meta(tarot_doc, "property", "og:description"),
        _extract_page_ldjson(tarot_doc, "WebPage")["description"],
    ):
        assert "Gumroad" in val
        assert "Deluxe Bundle" in val

    merch_doc = _read("sovereign-merch/index.html")
    for val in (
        _extract_meta(merch_doc, "name", "description"),
        _extract_meta(merch_doc, "property", "og:description"),
        _extract_page_ldjson(merch_doc, "CollectionPage")["description"],
    ):
        assert "5 live Zazzle" in val
