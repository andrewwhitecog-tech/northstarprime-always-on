#!/usr/bin/env python3
"""Enforce a conservative size budget for the GitHub Pages source tree."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


PUBLISHED_LIMIT_BYTES = 1_000_000_000
RELEASE_GUARD_BYTES = 900_000_000
GIT_BLOB_LIMIT_BYTES = 100_000_000
EXCLUDED_TOP_LEVEL = {".git", "output", "__pycache__"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--output", type=Path, default=Path("PAGES_CAPACITY_BUDGET.json"))
    args = parser.parse_args()
    root = args.root.resolve()

    files: list[tuple[Path, int]] = []
    by_top_level: dict[str, int] = defaultdict(int)
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if (
            relative.parts[0] in EXCLUDED_TOP_LEVEL
            or "__pycache__" in relative.parts
            or path.suffix == ".pyc"
        ):
            continue
        if relative.as_posix() == args.output.as_posix():
            continue
        size = path.stat().st_size
        files.append((relative, size))
        by_top_level[relative.parts[0]] += size

    total = sum(size for _, size in files)
    oversized = [
        {"path": path.as_posix(), "bytes": size}
        for path, size in files
        if size >= GIT_BLOB_LIMIT_BYTES
    ]
    largest = [
        {"path": path.as_posix(), "bytes": size}
        for path, size in sorted(files, key=lambda item: item[1], reverse=True)[:20]
    ]
    report = {
        "schema": "nsp-github-pages-capacity-v1",
        "published_limit_bytes": PUBLISHED_LIMIT_BYTES,
        "release_guard_bytes": RELEASE_GUARD_BYTES,
        "git_blob_limit_bytes": GIT_BLOB_LIMIT_BYTES,
        "excluded_top_level": sorted(EXCLUDED_TOP_LEVEL),
        "file_count": len(files),
        "published_bytes": total,
        "headroom_to_release_guard_bytes": RELEASE_GUARD_BYTES - total,
        "headroom_to_published_limit_bytes": PUBLISHED_LIMIT_BYTES - total,
        "within_release_guard": total < RELEASE_GUARD_BYTES,
        "within_published_limit": total < PUBLISHED_LIMIT_BYTES,
        "oversized_file_count": len(oversized),
        "oversized_files": oversized,
        "top_level_bytes": dict(sorted(by_top_level.items())),
        "largest_files": largest,
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    if total >= RELEASE_GUARD_BYTES or oversized:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
