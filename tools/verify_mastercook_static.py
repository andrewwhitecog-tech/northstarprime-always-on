#!/usr/bin/env python3
"""Verify the static Digital MasterCook freeware route and assets."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
READER = ROOT / "static" / "downloads" / "Digital_MasterCook_Book_Freeware_v09.html"
PDF = ROOT / "static" / "downloads" / "Digital_MasterCook_Book_Freeware_v09.pdf"


def require(condition, message):
    if not condition:
        raise SystemExit(f"FAIL: {message}")


def main():
    landing = (ROOT / "ckd-kitchen" / "index.html").read_text(encoding="utf-8")
    alias = (ROOT / "cookbook" / "index.html").read_text(encoding="utf-8")
    home = (ROOT / "index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    require('name="q"' in landing, "landing page has no cookbook search field")
    require("Dietitian feedback" in landing and "not a formal product review" in landing,
            "landing page does not state the feedback boundary")
    require("/ckd-kitchen/" in alias, "cookbook alias does not route locally")
    require('href="/ckd-kitchen/"' in home, "homepage does not expose local cookbook route")
    require("https://northstarprime.net/ckd-kitchen/" in sitemap, "sitemap omits cookbook")
    require(READER.is_file() and READER.stat().st_size > 1_000_000, "searchable reader missing or unexpectedly small")
    require(PDF.is_file() and PDF.stat().st_size > 1_000_000, "PDF missing or unexpectedly small")
    reader = READER.read_text(encoding="utf-8")
    require('id="cookbookSearch"' in reader and "SEARCH_INDEX" in reader, "reader search implementation missing")
    require("patient-created culinary working edition" in reader.lower(), "reader medical notice missing")
    print(f"OK: MasterCook reader={READER.stat().st_size:,} bytes PDF={PDF.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
