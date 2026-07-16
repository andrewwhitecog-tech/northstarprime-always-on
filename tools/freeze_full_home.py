#!/usr/bin/env python3
"""Freeze the full public NSP homepage and its referenced local static assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote


DEFAULT_SOURCE_REPO = Path(__file__).resolve().parents[2] / "NORTHSTAR_PRIME"
DEFAULT_DESTINATION = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://northstar-prime.onrender.com/"
ASSET_RE = re.compile(
    r"(?P<path>/static/[^\s'\"()<>?]+?\.(?:png|jpe?g|webp|gif|svg|ico|mp4|webm|mp3|wav|css|js|json))",
    re.IGNORECASE,
)
HREF_RE = re.compile(r"href=(?P<quote>['\"])(?P<path>/[^'\"]*)(?P=quote)", re.IGNORECASE)
MIRRORED_PREFIXES = (
    "/static/",
    "/arcade",
    "/contact",
    "/idc-programming",
    "/idr",
    "/continuity-atlas/",
    "/founders",
    "/mystery-school",
    "/services",
    "/site.webmanifest",
    "/health",
)
CANONICAL_STATIC_ROUTES = {
    "/arcade": "/arcade/",
    "/contact": "/contact/",
    "/continuity-atlas": "/continuity-atlas/",
    "/founders": "/founders/",
    "/idc-programming": "/idc-programming/",
    "/idr": "/idr/",
    "/mystery-school": "/mystery-school/",
    "/services": "/services/",
    "/site.webmanifest": "/site.webmanifest",
}


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-html", type=Path, required=True)
    parser.add_argument("--source-repo", type=Path, default=DEFAULT_SOURCE_REPO)
    parser.add_argument("--destination-repo", type=Path, default=DEFAULT_DESTINATION)
    args = parser.parse_args()

    html = args.source_html.read_text(encoding="utf-8")
    if len(html) < 50_000 or "<title>Home — NorthStar Prime</title>" not in html:
        raise SystemExit(f"Full-home guard failed (characters={len(html)})")
    if re.search(r"file://|[A-Z]:\\", html, re.IGNORECASE):
        raise SystemExit("Captured homepage contains a local filesystem reference")
    folded_html = html.casefold()
    for pillar in ("watch", "listen", "play"):
        if pillar not in folded_html:
            raise SystemExit(f"Captured homepage is missing pillar: {pillar}")
    if "/static/cards/master_hero/hero" not in html:
        raise SystemExit("Captured homepage is missing the master hero")

    rewritten_route_count = 0

    def route_target(match: re.Match[str]) -> str:
        nonlocal rewritten_route_count
        quote = match.group("quote")
        path = match.group("path")
        if path in CANONICAL_STATIC_ROUTES:
            return f"href={quote}{CANONICAL_STATIC_ROUTES[path]}{quote}"
        if path == "/" or path.startswith(MIRRORED_PREFIXES):
            return match.group(0)
        rewritten_route_count += 1
        return f"href={quote}https://app.northstarprime.net{path}{quote}"

    html = HREF_RE.sub(route_target, html)
    pulse_rewrite_count = html.count("fetch('/api/pulse')")
    if pulse_rewrite_count < 3:
        raise SystemExit("Captured homepage is missing the expected pulse consumers")
    html = html.replace(
        "fetch('/api/pulse')",
        "fetch('/services/idr_now_playing_snapshot.json')",
    )

    built = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    header = (
        f"<!-- FROZEN FULL NSP HOME | source={SOURCE_URL} | built={built} | "
        "dynamic services may gracefully fall back to app.northstarprime.net -->\n"
    )
    index_path = args.destination_repo / "index.html"
    index_path.write_text(header + html, encoding="utf-8", newline="\n")

    web_paths = sorted({unquote(match.group("path")) for match in ASSET_RE.finditer(html)})
    assets: list[dict[str, object]] = []
    for web_path in web_paths:
        relative = Path(*web_path.lstrip("/").split("/"))
        source = args.source_repo / relative
        destination = args.destination_repo / relative
        if not source.is_file():
            raise SystemExit(f"Referenced homepage asset is missing locally: {web_path}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        assets.append(
            {
                "web_path": web_path,
                "relative_path": relative.as_posix(),
                "bytes": destination.stat().st_size,
                "sha256": digest(destination),
            }
        )

    manifest = {
        "schema": "nsp.always-on-home-freeze.v1",
        "built_utc": built,
        "source_url": SOURCE_URL,
        "source_capture": args.source_html.name,
        "index": {
            "relative_path": "index.html",
            "bytes": index_path.stat().st_size,
            "sha256": digest(index_path),
        },
        "referenced_asset_count": len(assets),
        "referenced_asset_bytes": sum(int(row["bytes"]) for row in assets),
        "dynamic_route_links_rewritten": rewritten_route_count,
        "same_origin_pulse_rewrites": pulse_rewrite_count,
        "assets": assets,
        "invariants": [
            "No local filesystem paths in the frozen homepage",
            "Every referenced static media asset exists in this repository",
            "The Continuity Atlas remains on the always-on apex",
            "Arcade, IDR, services, and contact remain on the always-on apex",
            "Homepage pulse consumers use the frozen same-origin services snapshot",
            "Dynamic features are enhancements; core identity remains visible without them",
        ],
    }
    manifest_path = args.destination_repo / "HOME_FREEZE_MANIFEST.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print("OK: full homepage frozen")
    print(f"INDEX={index_path}")
    print(f"ASSETS={len(assets)}")
    print(f"ASSET_BYTES={manifest['referenced_asset_bytes']}")
    print(f"MANIFEST={manifest_path}")


if __name__ == "__main__":
    main()
