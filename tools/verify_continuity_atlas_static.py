#!/usr/bin/env python3
"""Verify the self-contained always-on Continuity Atlas bundle."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ATLAS = ROOT / "continuity-atlas"
LOCAL_REF_RE = re.compile(r"file://|[A-Z]:\\", re.IGNORECASE)
ASSET_REF_RE = re.compile(r"(?:href|src)=[\"'](?P<path>[^\"']+)[\"']", re.IGNORECASE)
REQUIRED_MIN_BYTES = {
    "index.html": 3_000,
    "styles.css": 5_000,
    "graph-data.js": 50_000,
    "app.js": 10_000,
}


def main() -> None:
    for filename, minimum in REQUIRED_MIN_BYTES.items():
        path = ATLAS / filename
        if not path.is_file():
            raise SystemExit(f"Missing atlas bundle file: {filename}")
        if path.stat().st_size < minimum:
            raise SystemExit(f"Atlas bundle file is unexpectedly small: {filename}")

    html = (ATLAS / "index.html").read_text(encoding="utf-8")
    graph = (ATLAS / "graph-data.js").read_text(encoding="utf-8")
    app = (ATLAS / "app.js").read_text(encoding="utf-8")
    home = (ROOT / "index.html").read_text(encoding="utf-8")

    for filename, body in (("index.html", html), ("graph-data.js", graph), ("app.js", app)):
        if LOCAL_REF_RE.search(body):
            raise SystemExit(f"Local filesystem reference in atlas {filename}")

    for match in ASSET_REF_RE.finditer(html):
        reference = match.group("path")
        if reference.startswith(("data:", "http://", "https://", "/")):
            continue
        if not (ATLAS / reference).is_file():
            raise SystemExit(f"Broken relative atlas asset reference: {reference}")

    if 'href="/continuity-atlas/"' not in home:
        raise SystemExit("Always-on home does not link to /continuity-atlas/")
    if "window.CONTINUITY_ATLAS_DATA" not in graph:
        raise SystemExit("Atlas graph snapshot does not expose its data payload")
    if '"media"' not in graph or '"jeopardy"' not in graph:
        raise SystemExit("Atlas graph snapshot is missing a public graph mode")
    if '"raw_clue_records":0' not in graph or "rights-gated" not in graph:
        raise SystemExit("Jeopardy rights gate is missing from the public snapshot")
    if "https://" not in graph or "source.url" not in app:
        raise SystemExit("Atlas source-link rendering is missing")

    print("OK: Continuity Atlas static bundle is complete")
    print("OK: home route exposes /continuity-atlas/")
    print("OK: graph contains media + Jeopardy modes with source links and rights gate")


if __name__ == "__main__":
    main()
