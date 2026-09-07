#!/usr/bin/env python3
"""Build the curated NorthStar Prime GitHub Pages artifact.

The branch remains the complete source archive. The Pages artifact omits the
large IDC video copies and rewrites their public URLs to the identical files on
the canonical NorthStar application host. Little Light reading pages reference
immutable-named WebP exports in the public source repository; those image copies
are also excluded from the capacity-limited Pages artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "output" / "pages-artifact"
APP_VIDEO_BASE = "https://app.northstarprime.net/static/idc_video/"
LOCAL_VIDEO_BASE = "/static/idc_video/"
PUBLISHED_LIMIT_BYTES = 1_000_000_000
# Keep 80 MB below the 1 GB provider limit; Maison Gooch adds 8.9 MB.
RELEASE_GUARD_BYTES = 920_000_000
GIT_BLOB_LIMIT_BYTES = 100_000_000
SKIP_TOP_LEVEL = {".git", ".github", "output", "tools", "__pycache__", ".pytest_cache", ".playwright-cli", ".playwright", "little-light-media"}
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest"}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def source_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def safe_output(value: str | Path) -> Path:
    output = Path(value).expanduser().resolve()
    allowed_root = (ROOT / "output").resolve()
    if output == allowed_root or not output.is_relative_to(allowed_root):
        raise ValueError(f"Output must be a child of {allowed_root}")
    return output


def iter_source_files():
    for path in ROOT.rglob("*"):
        relative = path.relative_to(ROOT)
        if not relative.parts or relative.parts[0] in SKIP_TOP_LEVEL:
            continue
        if path.is_symlink():
            raise ValueError(f"Symlinks are not allowed in the Pages artifact: {relative.as_posix()}")
        if not path.is_file():
            continue
        if relative.parts[:2] == ("static", "idc_video"):
            continue
        yield path, relative


def build(output: Path) -> dict:
    video_root = ROOT / "static" / "idc_video"
    video_files = sorted(path for path in video_root.rglob("*") if path.is_file())
    omitted_video_bytes = sum(path.stat().st_size for path in video_files)

    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)

    rewrites = 0
    copied = 0
    for source, relative in iter_source_files():
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.suffix.lower() in TEXT_SUFFIXES:
            raw = source.read_text(encoding="utf-8")
            count = raw.count(LOCAL_VIDEO_BASE)
            if count:
                raw = raw.replace(LOCAL_VIDEO_BASE, APP_VIDEO_BASE)
                rewrites += count
            destination.write_text(raw, encoding="utf-8", newline="\n")
            shutil.copymode(source, destination)
        else:
            shutil.copy2(source, destination)
        copied += 1

    payload_files = [path for path in output.rglob("*") if path.is_file()]
    payload_bytes = sum(path.stat().st_size for path in payload_files)
    oversized = [
        {"path": path.relative_to(output).as_posix(), "bytes": path.stat().st_size}
        for path in payload_files
        if path.stat().st_size > GIT_BLOB_LIMIT_BYTES
    ]
    if payload_bytes > RELEASE_GUARD_BYTES:
        raise ValueError(
            f"Curated artifact is {payload_bytes} bytes; release guard is {RELEASE_GUARD_BYTES}"
        )
    if oversized:
        raise ValueError(f"Curated artifact contains files above 100 MB: {oversized}")

    manifest = {
        "schema": "northstar.pages-curated-artifact.v1",
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "source_commit": source_commit(),
        "file_count_excluding_manifest": copied,
        "payload_bytes_excluding_manifest": payload_bytes,
        "release_guard_bytes": RELEASE_GUARD_BYTES,
        "published_limit_bytes": PUBLISHED_LIMIT_BYTES,
        "headroom_to_release_guard_bytes": RELEASE_GUARD_BYTES - payload_bytes,
        "omitted": {
            "path": "static/idc_video",
            "file_count": len(video_files),
            "bytes": omitted_video_bytes,
            "replacement_base_url": APP_VIDEO_BASE,
            "rewritten_references": rewrites,
        },
        "little_light_media": {
            "path": "little-light-media",
            "delivery": "raw.githubusercontent.com public repository, content-hashed filenames",
            "file_count": sum(1 for path in (ROOT / "little-light-media").rglob("*") if path.is_file()),
            "bytes": sum(path.stat().st_size for path in (ROOT / "little-light-media").rglob("*") if path.is_file()),
        },
        "critical_files": {
            relative: sha256(output / relative)
            for relative in ("index.html", "services/index.html", "links/index.html", "sitemap.xml")
        },
    }
    (output / "nsp-pages-artifact.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()
    manifest = build(safe_output(args.output))
    print(json.dumps(manifest, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
