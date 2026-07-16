#!/usr/bin/env python3
"""Verify every intended GitHub Pages file through an HTTP origin."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_TOP_LEVEL = {".git", "output", "__pycache__"}


def public_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if relative.parts[0] in EXCLUDED_TOP_LEVEL or path.suffix == ".pyc":
            continue
        files.append(relative)
    return sorted(files, key=lambda item: item.as_posix())


def probe(base_url: str, root: Path, relative: Path, check_size: bool) -> dict[str, object]:
    encoded = urllib.parse.quote(relative.as_posix(), safe="/")
    url = urllib.parse.urljoin(base_url.rstrip("/") + "/", encoded)
    request = urllib.request.Request(
        url,
        method="HEAD",
        headers={"User-Agent": "NorthStarPrimeHttpMirrorVerifier/1.0"},
    )
    expected_size = (root / relative).stat().st_size
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            status = int(response.status)
            content_length = response.headers.get("Content-Length")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        return {
            "path": relative.as_posix(),
            "url": url,
            "status": None,
            "error": str(exc),
        }
    failure = None
    if status != 200:
        failure = f"HTTP {status}"
    elif check_size and content_length is None:
        failure = "missing Content-Length"
    elif check_size and int(content_length) != expected_size:
        failure = f"size {content_length} != {expected_size}"
    return {
        "path": relative.as_posix(),
        "url": url,
        "status": status,
        "expected_bytes": expected_size,
        "content_length": int(content_length) if content_length else None,
        "error": failure,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--base-url", default="http://127.0.0.1:8766/")
    parser.add_argument(
        "--no-size",
        action="store_true",
        help="check HTTP status only (useful when an origin compresses responses)",
    )
    parser.add_argument("--workers", type=int, default=16)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    files = public_files(root)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        results = list(
            executor.map(
                lambda relative: probe(
                    args.base_url, root, relative, not args.no_size
                ),
                files,
            )
        )
    failures = [row for row in results if row.get("error")]
    summary = {
        "schema": "nsp.http-mirror-verification.v1",
        "base_url": args.base_url,
        "file_count": len(files),
        "checked_bytes": sum((root / path).stat().st_size for path in files),
        "size_check": not args.no_size,
        "failure_count": len(failures),
        "failures": failures,
    }
    if args.report:
        args.report.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
