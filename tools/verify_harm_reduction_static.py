#!/usr/bin/env python3
"""Verify the fail-closed always-on harm-reduction bridge."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ROUTE = ROOT / "harm-reduction"
FREEZE = ROOT / "HARM_REDUCTION_FREEZE_MANIFEST.json"
CANONICAL = "https://app.northstarprime.net/harm-reduction"


def main() -> None:
    index = ROUTE / "index.html"
    for path in (index, FREEZE):
        if not path.is_file():
            raise SystemExit(f"Missing fail-closed file: {path.relative_to(ROOT)}")

    html = index.read_text(encoding="utf-8")
    freeze = json.loads(FREEZE.read_text(encoding="utf-8"))
    for prohibited in (
        ROUTE / "assets",
        ROUTE / "manifest.json",
        ROUTE / "PUBLIC_RELEASE_APPROVAL_RECEIPT.json",
        ROUTE / "QUALITY_GATE_REPORT.json",
    ):
        if prohibited.exists():
            raise SystemExit(f"Unapproved public artifact remains: {prohibited.relative_to(ROOT)}")

    if freeze.get("status") != "inactive":
        raise SystemExit("Freeze tombstone is not inactive")
    for field in ("active", "approved", "public_release_authorized", "public_assets_present"):
        if freeze.get(field) is not False:
            raise SystemExit(f"Freeze tombstone must set {field}=false")
    if freeze.get("card_count") != 0 or freeze.get("side_count") != 0:
        raise SystemExit("Freeze tombstone exposes a nonzero public deck inventory")
    if freeze.get("canonical_route") != CANONICAL:
        raise SystemExit("Freeze tombstone canonical route mismatch")

    for required in (
        f'<link rel="canonical" href="{CANONICAL}">',
        f'content="0;url={CANONICAL}"',
        "reviewed safety guide",
        "illustrated draft remains offline pending clinical review",
        "location.search+location.hash",
    ):
        if required not in html:
            raise SystemExit(f"Fail-closed bridge marker missing: {required}")
    if re.search(r"file://|[A-Z]:\\", html, re.IGNORECASE):
        raise SystemExit("Public HTML contains a local filesystem reference")
    if re.search(r"owner-authorized|public release|approved V08", html, re.IGNORECASE):
        raise SystemExit("Public bridge contains stale V08 authorization language")

    home = (ROOT / "index.html").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if 'href="/harm-reduction/"' not in home:
        raise SystemExit("Homepage does not expose the harm-reduction route")
    if "https://northstarprime.net/harm-reduction/" not in sitemap:
        raise SystemExit("Sitemap does not expose the harm-reduction route")
    print("OK: illustrated V08 draft and public authorization artifacts are absent")
    print("OK: inactive tombstone and reviewed application bridge are fail-closed")


if __name__ == "__main__":
    main()
