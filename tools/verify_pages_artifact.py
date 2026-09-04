#!/usr/bin/env python3
"""Fail-closed verification for the curated GitHub Pages artifact."""

from __future__ import annotations

import argparse
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARTIFACT = ROOT / "output" / "pages-artifact"
APP_ORIGIN = "https://app.northstarprime.net"
APP_VIDEO_BASE = f"{APP_ORIGIN}/static/idc_video/"
LOCAL_VIDEO_RE = re.compile(r"(?<!https://app\.northstarprime\.net)/static/idc_video/")
RELEASE_GUARD_BYTES = 900_000_000
FILE_LIMIT_BYTES = 100_000_000
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest"}


class ReferenceParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references: list[str] = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        for name in ("href", "src", "poster"):
            value = values.get(name)
            if value:
                self.references.append(value)


def local_target(artifact: Path, page: Path, reference: str) -> Path | None:
    value = reference.strip()
    if not value or value.startswith(("#", "?", "//", "mailto:", "tel:", "data:", "blob:", "javascript:")):
        return None
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return None
    decoded = urllib.parse.unquote(parsed.path)
    if not decoded:
        return None
    if decoded.startswith("/"):
        target = artifact / decoded.lstrip("/")
    else:
        target = page.parent / decoded
    target = target.resolve()
    if not target.is_relative_to(artifact):
        raise ValueError(f"Reference escapes artifact: {page} -> {reference}")
    return target


def target_exists(target: Path, reference: str) -> bool:
    if target.is_file():
        return True
    if target.is_dir() and (target / "index.html").is_file():
        return True
    if not Path(urllib.parse.urlsplit(reference).path).suffix and (target / "index.html").is_file():
        return True
    return False


def network_status(url: str) -> int:
    request = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "NorthStarPagesArtifact/1"})
    with urllib.request.urlopen(request, timeout=35) as response:
        return response.status


def verify(artifact: Path, network: bool) -> dict:
    artifact = artifact.resolve()
    failures: list[str] = []
    checks: list[str] = []
    if not artifact.is_dir():
        return {"status": "FAIL", "checks": checks, "failures": [f"Missing artifact: {artifact}"]}

    required = (
        "index.html",
        "404.html",
        "CNAME",
        ".nojekyll",
        "services/index.html",
        "links/index.html",
        "sitemap.xml",
        "robots.txt",
        "nsp-pages-artifact.json",
    )
    missing = [name for name in required if not (artifact / name).is_file()]
    if missing:
        failures.append(f"Missing required artifact files: {missing}")
    else:
        checks.append("required front-door, routing, and metadata files")

    if (artifact / "static" / "idc_video").exists():
        failures.append("Local IDC video directory leaked into curated artifact")
    else:
        checks.append("duplicate IDC video payload excluded")

    files = [path for path in artifact.rglob("*") if path.is_file()]
    total_bytes = sum(path.stat().st_size for path in files)
    oversized = [path.relative_to(artifact).as_posix() for path in files if path.stat().st_size > FILE_LIMIT_BYTES]
    if total_bytes > RELEASE_GUARD_BYTES:
        failures.append(f"Artifact is {total_bytes} bytes; guard is {RELEASE_GUARD_BYTES}")
    else:
        checks.append(f"artifact capacity {total_bytes}/{RELEASE_GUARD_BYTES} bytes")
    if oversized:
        failures.append(f"Files above 100 MB: {oversized}")

    if (artifact / "CNAME").is_file() and (artifact / "CNAME").read_text(encoding="utf-8").strip() != "northstarprime.net":
        failures.append("CNAME does not preserve northstarprime.net")

    unresolved: list[str] = []
    local_video_refs: list[str] = []
    local_drive_refs: list[str] = []
    externalized_videos: set[str] = set()
    for path in files:
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8", errors="strict")
        relative = path.relative_to(artifact).as_posix()
        if LOCAL_VIDEO_RE.search(text):
            local_video_refs.append(relative)
        if path.suffix.lower() == ".html" and re.search(
            r"(?:href|src|poster)\s*=\s*[\"'](?:file://|[A-Z]:\\)", text, re.IGNORECASE
        ):
            local_drive_refs.append(relative)
        externalized_videos.update(re.findall(re.escape(APP_VIDEO_BASE) + r"[^\"'\s<>)]+", text))
        if path.suffix.lower() != ".html":
            continue
        parser = ReferenceParser()
        parser.feed(text)
        for reference in parser.references:
            target = local_target(artifact, path, reference)
            if target is not None and not target_exists(target, reference):
                unresolved.append(f"{relative} -> {reference}")

    if local_video_refs:
        failures.append(f"Local IDC video references remain: {local_video_refs[:10]}")
    else:
        checks.append("IDC video references externalized to canonical app")
    if not externalized_videos:
        failures.append("No canonical app IDC video references found")
    if local_drive_refs:
        failures.append(f"Local filesystem references found: {local_drive_refs[:10]}")
    if unresolved:
        failures.append(f"Unresolved local HTML references: {unresolved[:20]}")
    else:
        checks.append("all HTML href, src, and poster references resolve")

    services = (artifact / "services" / "index.html").read_text(encoding="utf-8") if (artifact / "services" / "index.html").is_file() else ""
    if '<link rel="canonical" href="https://app.northstarprime.net/services">' not in services:
        failures.append("Services bridge canonical is missing")
    if "utm_campaign=services_visibility" not in services:
        failures.append("Services bridge attribution is missing")

    if network:
        try:
            if network_status(f"{APP_ORIGIN}/health") != 200:
                failures.append("Canonical app health did not return 200")
            sample_urls = sorted(externalized_videos)[:3]
            for url in sample_urls:
                if network_status(url) != 200:
                    failures.append(f"Canonical app video did not return 200: {url}")
            if not failures:
                checks.append(f"canonical app health and {len(sample_urls)} video samples HTTP 200")
        except Exception as exc:
            failures.append(f"Network verification failed: {type(exc).__name__}: {exc}")

    return {
        "status": "FAIL" if failures else "PASS",
        "artifact": str(artifact),
        "file_count": len(files),
        "bytes": total_bytes,
        "externalized_video_url_count": len(externalized_videos),
        "checks": checks,
        "failures": failures,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--artifact", default=str(DEFAULT_ARTIFACT))
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()
    result = verify(Path(args.artifact), args.network)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
