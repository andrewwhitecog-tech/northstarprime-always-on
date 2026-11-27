#!/usr/bin/env python3
"""Verify the no-cost IDC static recovery surface without third-party packages."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "idc-programming" / "index.html"
MANIFEST_PATH = ROOT / "static" / "idc_video" / "yt_manifest.json"
MAX_GITHUB_BLOB = 100 * 1024 * 1024
PRIVATE_PACKET_PATH = ROOT / "static" / "idc" / "idc_anthology_packet_2026-06-06.json"
PRIVATE_PACKET_ROUTE = "/static/idc/idc_anthology_packet_2026-06-06.json"


def git_output(*args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args], text=True, encoding="utf-8"
    )


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


class CinemaPlayers(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.sources: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "video" and "idc-bv" in attrs.get("class", "").split():
            self.sources.append(attrs.get("src") or "")


def cinema_sources(html: str) -> list[str]:
    parser = CinemaPlayers()
    parser.feed(html)
    return parser.sources


def verify_live_players(sources: list[str]) -> None:
    page = "https://northstarprime.net/idc-programming/"
    with urllib.request.urlopen(page, timeout=30) as response:
        deployed = cinema_sources(response.read().decode("utf-8"))
    if len(deployed) != len(sources):
        fail(f"deployed cinema queue has {len(deployed)} players, expected {len(sources)}")
    for original, target in zip(sources, deployed):
        url = urllib.parse.urljoin(page, target)
        if not urllib.parse.urlsplit(url).path.endswith(original):
            fail(f"deployed queue source differs from {original}: {url}")
        request = urllib.request.Request(url, headers={"Range": "bytes=0-31"})
        with urllib.request.urlopen(request, timeout=30) as response:
            if response.status not in (200, 206) or response.read(32)[4:8] != b"ftyp":
                fail(f"invalid MP4 response for {url}")
        print(f"OK live MP4 {original}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--network", action="store_true", help="verify the deployed cinema queue and MP4 responses"
    )
    args = parser.parse_args()

    html = HTML_PATH.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if len(manifest) != 9:
        fail(f"expected 9 Season One YouTube entries, found {len(manifest)}")
    sources = cinema_sources(html)
    if not sources or len(set(sources)) != len(sources):
        fail("cinema queue is empty or contains duplicate players")
    if "C:/Program Files/Git/" in html:
        fail("frozen Windows paths remain in HTML")
    if PRIVATE_PACKET_ROUTE in html:
        fail("owner-review IDC packet is still linked from the public page")
    if PRIVATE_PACKET_PATH.exists():
        fail("owner-review IDC packet is still present in the public tree")
    if "Season file withheld pending owner review" not in html:
        fail("public page is missing the owner-review withholding notice")
    if "/idc-cover/" in html or "/card-art?" in html:
        fail("dynamic-only IDC cover routes remain in the static page")
    fallback = "/static/cards/idc_anthology/season_poster.svg"
    if not (ROOT / fallback.lstrip("/")).is_file():
        fail("static IDC cover fallback is missing")
    if html.count(f"this.onerror=null;this.src='{fallback}'") != 16:
        fail("expected 16 one-shot static IDC cover fallbacks")

    tracked = set(git_output("ls-tree", "-r", "--name-only", "HEAD").splitlines())
    for source in sources:
        if not source.startswith("/static/") or not source.endswith(".mp4") or source[1:] not in tracked:
            fail(f"cinema player needs a tracked MP4 source: {source}")
    for required in ("idc_anthology_s1_teaser", "idc_anthology_e01_arrival"):
        if f"/static/idc_video/{required}.mp4" not in sources:
            fail(f"missing Season One cinema player: {required}")
    if PRIVATE_PACKET_ROUTE.lstrip("/") in tracked:
        fail("owner-review IDC packet is tracked")
    for stem in manifest:
        mp4 = f"static/idc_video/{stem}.mp4"
        if mp4 not in tracked:
            fail(f"missing tracked MP4 backup: {mp4}")

    video_paths = sorted(
        path
        for path in tracked
        if path.startswith("static/idc_video/") and path.endswith(".mp4")
    )
    if len(video_paths) != 25:
        fail(f"expected 25 tracked IDC videos, found {len(video_paths)}")

    size_rows = git_output("ls-tree", "-rl", "HEAD", "--", "static/idc_video").splitlines()
    sizes = []
    for row in size_rows:
        metadata, path = row.split("\t", 1)
        if path in video_paths:
            sizes.append((path, int(metadata.split()[-1])))
    oversized = [(path, size) for path, size in sizes if size >= MAX_GITHUB_BLOB]
    if oversized:
        fail(f"GitHub-size-limit violation: {oversized}")

    if args.network:
        verify_live_players(sources)
    print(f"OK: {len(sources)} direct cinema players and {len(manifest)} archived Season One mappings")
    print(f"OK: {len(video_paths)} tracked MP4 backups/bumpers")
    if sizes:
        largest = max(sizes, key=lambda item: item[1])
        print(
            f"OK: largest checked video is {largest[1] / 1024 / 1024:.1f} MiB "
            f"({largest[0]})"
        )
    else:
        print("SKIP: video size check needs a full clone or --network")
    print("OK: no dynamic-only cover routes, frozen Windows paths, or owner-review IDC packet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
