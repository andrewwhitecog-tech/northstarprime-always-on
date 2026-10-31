#!/usr/bin/env python3
"""Verify the no-cost IDC static recovery surface without third-party packages."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import urllib.request
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--network", action="store_true", help="verify video blob sizes through the GitHub API"
    )
    args = parser.parse_args()

    html = HTML_PATH.read_text(encoding="utf-8")
    # yt_manifest.json is the retired record of the nine Season One uploads.
    # All nine are unavailable on YouTube, so the page plays its own MP4s.
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if len(manifest) != 9:
        fail(f"expected 9 Season One entries, found {len(manifest)}")
    if "youtube-nocookie.com/embed/" in html or "IDC_YT" in html:
        fail("the retired YouTube player is back on the public page")
    if '.idc-bv[src*="/bumper_"]' not in html:
        fail("Play Local Bumpers no longer stops at the bumpers")
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
    for stem, url in manifest.items():
        if url in html:
            fail(f"retired YouTube link for {stem} is back in HTML")
        mp4 = f"static/idc_video/{stem}.mp4"
        if f'src="/{mp4}"' not in html:
            fail(f"page does not play {mp4}")
        if mp4 not in tracked:
            fail(f"missing tracked MP4: {mp4}")

    video_paths = sorted(
        path
        for path in tracked
        if path.startswith("static/idc_video/") and path.endswith(".mp4")
    )
    if len(video_paths) != 25:
        fail(f"expected 25 tracked IDC videos, found {len(video_paths)}")

    materialized = [path for path in video_paths if (ROOT / path).is_file()]
    sizes = [(path, (ROOT / path).stat().st_size) for path in materialized]
    if sizes:
        oversized = [(path, size) for path, size in sizes if size >= MAX_GITHUB_BLOB]
        if oversized:
            fail(f"GitHub-size-limit violation: {oversized}")

    if args.network:
        request = urllib.request.Request(
            "https://api.github.com/repos/andrewwhitecog-tech/"
            "northstarprime-always-on/git/trees/main?recursive=1",
            headers={"User-Agent": "NorthStarPrimeStaticVerifier/1.0"},
        )
        with urllib.request.urlopen(request, timeout=20) as response:
            remote_tree = json.load(response)["tree"]
        remote_sizes = [
            (item["path"], int(item["size"]))
            for item in remote_tree
            if item["path"] in video_paths
        ]
        if len(remote_sizes) != 25:
            fail(f"GitHub API returned {len(remote_sizes)} of 25 video blobs")
        oversized = [item for item in remote_sizes if item[1] >= MAX_GITHUB_BLOB]
        if oversized:
            fail(f"GitHub-size-limit violation: {oversized}")
        sizes = remote_sizes

    print(f"OK: {len(manifest)} Season One episodes play from direct-hosted MP4s")
    print(f"OK: {len(video_paths)} tracked MP4 episodes/bumpers")
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
