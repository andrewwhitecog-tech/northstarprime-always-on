#!/usr/bin/env python3
"""Verify the frozen always-on NSP homepage and its asset manifest."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "HOME_FREEZE_MANIFEST.json"
LOCAL_REF_RE = re.compile(r"file://|[A-Z]:\\", re.IGNORECASE)
HREF_RE = re.compile(r"href=['\"](?P<path>/[^'\"]*)['\"]", re.IGNORECASE)
ALLOWED_LOCAL = (
    "/static/",
    "/idc-programming",
    "/continuity-atlas/",
    "/founders",
    "/mystery-school",
    "/health",
)


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def main() -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if payload.get("schema") != "nsp.always-on-home-freeze.v1":
        raise SystemExit("Unexpected or missing home-freeze schema")

    index = ROOT / str(payload["index"]["relative_path"])
    html = index.read_text(encoding="utf-8")
    if digest(index) != payload["index"]["sha256"]:
        raise SystemExit("Homepage hash does not match manifest")
    if len(html) < 50_000 or "<title>Home — NorthStar Prime</title>" not in html:
        raise SystemExit("Homepage is not the full frozen NSP home")
    if LOCAL_REF_RE.search(html):
        raise SystemExit("Homepage contains a local filesystem reference")
    if 'href="/continuity-atlas/"' not in html:
        raise SystemExit("Homepage does not expose the always-on Continuity Atlas")

    bad_routes = []
    for match in HREF_RE.finditer(html):
        path = match.group("path")
        if path != "/" and not path.startswith(ALLOWED_LOCAL):
            bad_routes.append(path)
    if bad_routes:
        raise SystemExit(f"Unmirrored local route links remain: {sorted(set(bad_routes))[:10]}")

    assets = payload.get("assets", [])
    if len(assets) != payload.get("referenced_asset_count"):
        raise SystemExit("Asset count does not match manifest")
    total = 0
    for row in assets:
        path = ROOT / str(row["relative_path"])
        if not path.is_file():
            raise SystemExit(f"Missing homepage asset: {row['relative_path']}")
        if path.stat().st_size != row["bytes"]:
            raise SystemExit(f"Asset size mismatch: {row['relative_path']}")
        if digest(path) != row["sha256"]:
            raise SystemExit(f"Asset hash mismatch: {row['relative_path']}")
        total += path.stat().st_size
    if total != payload.get("referenced_asset_bytes"):
        raise SystemExit("Total homepage asset bytes do not match manifest")

    print(f"OK: full frozen homepage ({len(html)} characters)")
    print(f"OK: {len(assets)} referenced assets / {total} bytes")
    print(f"OK: {payload.get('dynamic_route_links_rewritten', 0)} dynamic links routed to app.northstarprime.net")
    print("OK: no local filesystem references or dangling local route links")


if __name__ == "__main__":
    main()
