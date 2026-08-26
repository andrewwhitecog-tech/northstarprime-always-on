#!/usr/bin/env python3
"""Verify the always-on Interdimensional Literature publication package."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "literature" / "index.html"
BOOK_ROOT = ROOT / "literature" / "the-obituary-engine"
BOOK = BOOK_ROOT / "index.html"
MANIFEST = BOOK_ROOT / "publication_manifest.json"
MEDIA = ROOT / "static" / "literature_pages" / "obituary_engine" / "media"
PDF = ROOT / "static" / "downloads" / "idl" / "the_obituary_engine" / "THE_OBITUARY_ENGINE_PUBLIC_EDITION_V01.pdf"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def main() -> int:
    required = [CATALOG, BOOK, MANIFEST, PDF, MEDIA / "cover.webp", *(MEDIA / f"{index:02d}.webp" for index in range(1, 9))]
    missing = [path.relative_to(ROOT).as_posix() for path in required if not path.is_file()]
    if missing:
        raise SystemExit(f"Missing IDL publication files: {missing}")

    catalog = CATALOG.read_text(encoding="utf-8")
    book = BOOK.read_text(encoding="utf-8")
    for token in ("The Obituary Engine", "/literature/the-obituary-engine/", "loomwheel_sequence_v01.jpg"):
        if token not in catalog:
            raise SystemExit(f"Catalog missing required token: {token}")
    for token in ("Chapter Thirty — Unsigned", "The concept collection", "THE_OBITUARY_ENGINE_PUBLIC_EDITION_V01.pdf"):
        if token not in book:
            raise SystemExit(f"Book page missing required token: {token}")
    for forbidden in ("PRIVATE REVIEW EDITION", "Private development manuscript. Not published."):
        if forbidden.casefold() in book.casefold():
            raise SystemExit(f"Public book page contains review-only language: {forbidden}")

    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if payload.get("status") != "public_package_ready":
        raise SystemExit("IDL publication manifest is not public_package_ready")
    if any(payload.get("boundaries", {}).values()):
        raise SystemExit("Publication manifest accidentally enables a store/pricing/ISBN boundary")
    pdf_row = next(row for row in payload["artifacts"] if row["path"].endswith("THE_OBITUARY_ENGINE_PUBLIC_EDITION_V01.pdf"))
    if PDF.stat().st_size != pdf_row["bytes"] or sha256(PDF) != pdf_row["sha256"]:
        raise SystemExit("Public PDF does not match the publication manifest")
    if PDF.stat().st_size >= 100_000_000:
        raise SystemExit("Public PDF exceeds the GitHub blob limit")

    print("OK: IDL catalog and complete browser reader")
    print("OK: cover plus 8 concept mockups")
    print(f"OK: public PDF {PDF.stat().st_size} bytes SHA256 {sha256(PDF)}")
    print("OK: no private-review language or commerce claims")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
