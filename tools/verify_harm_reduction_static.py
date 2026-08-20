#!/usr/bin/env python3
"""Verify the owner-authorized always-on V08 harm-reduction release."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTE = ROOT / "harm-reduction"
FREEZE = ROOT / "HARM_REDUCTION_FREEZE_MANIFEST.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest().lower()


def main() -> None:
    index = ROUTE / "index.html"
    manifest_path = ROUTE / "manifest.json"
    receipt_path = ROUTE / "PUBLIC_RELEASE_APPROVAL_RECEIPT.json"
    quality_path = ROUTE / "QUALITY_GATE_REPORT.json"
    for path in (index, manifest_path, receipt_path, quality_path, FREEZE):
        if not path.is_file():
            raise SystemExit(f"Missing release file: {path.relative_to(ROOT)}")

    html = index.read_text(encoding="utf-8")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    freeze = json.loads(FREEZE.read_text(encoding="utf-8"))
    if manifest.get("public_release_authorized") is not True:
        raise SystemExit("Public manifest is not authorized")
    if receipt.get("approval_text") != "PLEASE PROCEED":
        raise SystemExit("Public-release approval text mismatch")
    if freeze.get("source_commit") != "71592981f5b9bf508a4703110c9d0c5c3748eae4":
        raise SystemExit("Freeze source commit mismatch")
    if freeze.get("card_count") != 22 or freeze.get("side_count") != 44:
        raise SystemExit("Freeze card inventory mismatch")
    if html.count("Front · open full-dimension preview") != 22:
        raise SystemExit("Front link count mismatch")
    if html.count("Information back · open full-dimension preview") != 22:
        raise SystemExit("Back link count mismatch")
    if "does not authorize V08 stickers" not in html:
        raise SystemExit("Sticker exclusion boundary is missing")
    if "These cards are education—not emergency care or medical advice" not in html:
        raise SystemExit("Emergency education boundary is missing")
    if re.search(r"file://|[A-Z]:\\", html, re.IGNORECASE):
        raise SystemExit("Public HTML contains a local filesystem reference")
    for required in (
        "https://www.cdc.gov/stop-overdose/caring/naloxone.html",
        "https://www.cdc.gov/overdose-prevention/situation-summary/medetomidine.html",
        "https://www.fda.gov/news-events/public-health-focus/hiding-plain-sight-7-oh-products",
        "https://www.poison.org/help-and-faq",
    ):
        if required not in html:
            raise SystemExit(f"Official source link missing: {required}")

    cards = manifest.get("cards")
    if not isinstance(cards, list) or len(cards) != 22:
        raise SystemExit("Public manifest does not contain 22 cards")
    expected_assets: set[str] = {"contact_sheet.webp"}
    for expected_number, card in enumerate(cards, 1):
        if card.get("number") != expected_number:
            raise SystemExit("Public manifest card order mismatch")
        for side in ("front", "back"):
            source_name = Path(card[f"{side}_path"]).name
            expected_assets.add(source_name)
            path = ROUTE / "assets" / source_name
            if not path.is_file():
                raise SystemExit(f"Missing card asset: {source_name}")
            if sha256(path) != card[f"{side}_sha256"]:
                raise SystemExit(f"Card asset hash mismatch: {source_name}")

    actual_assets = {path.name for path in (ROUTE / "assets").iterdir() if path.is_file()}
    if actual_assets != expected_assets:
        raise SystemExit("Published asset set is incomplete or contains an unexpected file")

    frozen = freeze.get("files")
    if not isinstance(frozen, list) or len(frozen) != 49:
        raise SystemExit("Freeze file inventory mismatch")
    for item in frozen:
        path = ROOT / item["path"]
        if not path.is_file() or path.stat().st_size != item["bytes"] or sha256(path) != item["sha256"]:
            raise SystemExit(f"Freeze hash mismatch: {item['path']}")

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if 'href="/harm-reduction/"' not in home:
        raise SystemExit("Homepage does not expose the harm-reduction route")
    if "https://northstarprime.net/harm-reduction/" not in sitemap:
        raise SystemExit("Sitemap does not expose the harm-reduction route")
    print("OK: 22 owner-authorized cards / 44 verified web previews")
    print("OK: public receipt, source links, emergency boundary, homepage, and sitemap")


if __name__ == "__main__":
    main()
