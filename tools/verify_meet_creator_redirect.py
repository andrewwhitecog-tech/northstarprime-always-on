#!/usr/bin/env python3
"""Verify the always-on creator route and its social-preview asset."""

from __future__ import annotations

import argparse
import hashlib
import re
import urllib.error
import urllib.request
from pathlib import Path


APEX_ROUTE = "https://northstarprime.net/meet-the-creator/"
APEX_CANONICAL = "https://northstarprime.net/meet-the-creator"
APP_ROUTE = "https://app.northstarprime.net/meet-the-creator"
APEX_OG_IMAGE = "https://northstarprime.net/static/creator/meet-the-creator-og.jpg"
APP_OG_SOURCE = "https://app.northstarprime.net/static/creator/meet-the-creator-og.jpg"
OG_SHA256 = "359d633d503b83d4c98a2e3c1d29c5c266668d026308bd7221c3c75b06418d67"
OG_BYTES = 157_127


def fail(message: str) -> None:
    raise SystemExit(message)


def fetch(url: str) -> tuple[int, str, bytes]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "northstarprime-always-on-verifier/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.status, response.headers.get_content_type(), response.read()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument(
        "--network",
        action="store_true",
        help="also verify the delegated page metadata and authoritative OG source",
    )
    args = parser.parse_args()
    root = args.root.resolve()

    route_path = root / "meet-the-creator" / "index.html"
    if not route_path.is_file():
        fail("Missing meet-the-creator/index.html")
    html = route_path.read_text(encoding="utf-8")

    required = (
        f'<meta http-equiv="refresh" content="0; url={APP_ROUTE}">',
        f'<link rel="canonical" href="{APP_ROUTE}">',
        f'<a href="{APP_ROUTE}">',
        f'location.replace("{APP_ROUTE}"+location.search+location.hash);',
    )
    missing = [value for value in required if value not in html]
    if missing:
        fail(f"Creator redirect contract is incomplete: {missing}")
    if re.search(r"(?:file:/{2,3}|(?:^|[\"'\s(])[A-Za-z]:[\\/])", html):
        fail("Creator redirect leaks a local filesystem reference")

    og_path = root / "static" / "creator" / "meet-the-creator-og.jpg"
    if not og_path.is_file():
        fail("Missing static/creator/meet-the-creator-og.jpg")
    og_data = og_path.read_bytes()
    og_hash = hashlib.sha256(og_data).hexdigest()
    if len(og_data) != OG_BYTES or og_hash != OG_SHA256:
        fail(f"Creator OG asset drift: bytes={len(og_data)} sha256={og_hash}")
    if not (og_data.startswith(b"\xff\xd8") and og_data.endswith(b"\xff\xd9")):
        fail("Creator OG asset is not a complete JPEG")

    sitemap = (root / "sitemap.xml").read_text(encoding="utf-8")
    if f"<loc>{APEX_ROUTE}</loc>" not in sitemap:
        fail("Sitemap does not expose the apex creator route")

    holidays = (root / "holidays" / "index.html").read_text(encoding="utf-8")
    if 'href="/meet-the-creator"' not in holidays:
        fail("The existing creator navigation link is missing")

    if args.network:
        try:
            status, content_type, app_page = fetch(APP_ROUTE)
            if status != 200 or content_type != "text/html":
                fail(f"Delegated app route returned HTTP {status} as {content_type}")
            app_html = app_page.decode("utf-8")
            metadata = (
                f'<link rel="canonical" href="{APEX_CANONICAL}">',
                f'<meta property="og:url" content="{APEX_CANONICAL}">',
                f'<meta property="og:image" content="{APEX_OG_IMAGE}">',
                '<meta property="og:image:width" content="1200">',
                '<meta property="og:image:height" content="630">',
            )
            missing_metadata = [value for value in metadata if value not in app_html]
            if missing_metadata:
                fail(f"Delegated creator metadata drift: {missing_metadata}")

            status, content_type, source_data = fetch(APP_OG_SOURCE)
            source_hash = hashlib.sha256(source_data).hexdigest()
            if status != 200 or content_type != "image/jpeg":
                fail(f"Authoritative OG source returned HTTP {status} as {content_type}")
            if len(source_data) != OG_BYTES or source_hash != OG_SHA256:
                fail(
                    "Authoritative OG source drift: "
                    f"bytes={len(source_data)} sha256={source_hash}"
                )
        except urllib.error.URLError as exc:
            fail(f"Creator network verification failed: {exc}")

    print("OK: apex creator shim targets the live app route")
    print("OK: query strings and fragments are preserved by location.replace")
    print("OK: sitemap and existing creator navigation resolve to the shim")
    print(f"OK: local OG image is the authoritative {OG_BYTES}-byte JPEG ({OG_SHA256})")
    if args.network:
        print("OK: delegated app creator route returned HTTP 200 with unchanged apex metadata")
        print("OK: authoritative app OG source returned HTTP 200 and matches local bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
