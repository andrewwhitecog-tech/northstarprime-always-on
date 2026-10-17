#!/usr/bin/env python3
"""Verify the static Digital MasterCook freeware and deluxe illustrated routes and assets."""
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
READER = ROOT / "static" / "downloads" / "Digital_MasterCook_Book_Freeware_v09.html"
PDF = ROOT / "static" / "downloads" / "Digital_MasterCook_Book_Freeware_v09.pdf"

DELUXE_READER = ROOT / "static" / "downloads" / "Digital_MasterCook_Deluxe_Illustrated_Edition.html"
DELUXE_PDF = ROOT / "static" / "downloads" / "Digital_MasterCook_Deluxe_Illustrated_Edition.pdf"
DELUXE_MANIFEST = ROOT / "static" / "downloads" / "deluxe_illustrated_cookbook_manifest.json"
DELUXE_MEDIA = ROOT / "static" / "cookbook_deluxe_media"


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

    # Classic Reference Edition verification
    require(READER.is_file() and READER.stat().st_size > 1_000_000, "searchable reader missing or unexpectedly small")
    require(PDF.is_file() and PDF.stat().st_size > 1_000_000, "classic PDF missing or unexpectedly small")
    reader = READER.read_text(encoding="utf-8")
    require('id="cookbookSearch"' in reader and "SEARCH_INDEX" in reader, "reader search implementation missing")
    require("patient-created culinary working edition" in reader.lower(), "reader medical notice missing")

    # Deluxe Illustrated Edition verification
    require(DELUXE_READER.is_file() and DELUXE_READER.stat().st_size > 1_000_000, "deluxe reader missing or unexpectedly small")
    require(DELUXE_MANIFEST.is_file() and DELUXE_MANIFEST.stat().st_size > 10_000, "deluxe manifest missing or unexpectedly small")
    require(DELUXE_MEDIA.is_dir(), "deluxe media directory missing")

    deluxe_html = DELUXE_READER.read_text(encoding="utf-8")
    require('<figure class="deluxe-plate-figure">' in deluxe_html, "deluxe reader missing photographic plate figures")
    require("Illustrated Deluxe Edition" in deluxe_html, "deluxe reader missing edition badge")

    # Media assets check
    media_files = list(DELUXE_MEDIA.glob("*.webp"))
    require(len(media_files) >= 400, f"insufficient deluxe media assets: found {len(media_files)}")

    # Manifest verification
    manifest_data = json.loads(DELUXE_MANIFEST.read_text(encoding="utf-8"))
    require(manifest_data.get("total_plates_injected", 0) >= 400, "deluxe manifest plate count below 400")

    # Zero emoji compliance on both readers
    for name, text in [("classic", reader), ("deluxe", deluxe_html)]:
        emojis = re.findall(r"[\U00010000-\U0010ffff]", text)
        require(len(emojis) == 0, f"zero-emoji violation in {name} reader: found {len(emojis)}")

    # Landing page dual links
    require("Digital_MasterCook_Deluxe_Illustrated_Edition.html" in landing, "landing page missing deluxe reader link")
    require("Digital_MasterCook_Book_Freeware_v09.html" in landing, "landing page missing classic reader link")

    print(f"OK: Classic reader={READER.stat().st_size:,} bytes PDF={PDF.stat().st_size:,} bytes")
    print(f"OK: Deluxe reader={DELUXE_READER.stat().st_size:,} bytes ({len(media_files)} WebP assets staged, {manifest_data['total_plates_injected']} plates bound)")
    if DELUXE_PDF.is_file():
        print(f"OK: Deluxe PDF={DELUXE_PDF.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
