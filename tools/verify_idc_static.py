#!/usr/bin/env python3
"""Verify the no-cost IDC static recovery surface without third-party packages."""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "idc-programming" / "index.html"
MANIFEST_PATH = ROOT / "static" / "idc_video" / "yt_manifest.json"
MAX_GITHUB_BLOB = 100 * 1024 * 1024


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
        "--network", action="store_true", help="verify all YouTube oEmbed URLs"
    )
    args = parser.parse_args()

    html = HTML_PATH.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if len(manifest) != 9:
        fail(f"expected 9 Season One YouTube entries, found {len(manifest)}")
    if "youtube-nocookie.com/embed/" not in html:
        fail("privacy-enhanced YouTube embed code is missing")
    if "C:/Program Files/Git/" in html:
        fail("frozen Windows paths remain in HTML")

    tracked = set(git_output("ls-tree", "-r", "--name-only", "HEAD").splitlines())
    for stem, url in manifest.items():
        if url not in html:
            fail(f"manifest URL for {stem} is not present in HTML")
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

        def verify_youtube(item: tuple[str, str]) -> tuple[str, str]:
            stem, url = item
            query = urllib.parse.urlencode({"url": url, "format": "json"})
            request = urllib.request.Request(
                "https://www.youtube.com/oembed?" + query,
                headers={"User-Agent": "NorthStarPrimeStaticVerifier/1.0"},
            )
            with urllib.request.urlopen(request, timeout=12) as response:
                if response.status != 200:
                    fail(f"YouTube oEmbed failed for {stem}: HTTP {response.status}")
                data = json.load(response)
                if not data.get("title"):
                    fail(f"YouTube oEmbed returned no title for {stem}")
                return stem, data["title"]

        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
            results = executor.map(verify_youtube, manifest.items())
            for stem, title in results:
                print(f"OK youtube {stem}: {title}")

    print(f"OK: {len(manifest)} verified YouTube mappings")
    print(f"OK: {len(video_paths)} tracked MP4 backups/bumpers")
    if sizes:
        largest = max(sizes, key=lambda item: item[1])
        print(
            f"OK: largest checked video is {largest[1] / 1024 / 1024:.1f} MiB "
            f"({largest[0]})"
        )
    else:
        print("SKIP: video size check needs a full clone or --network")
    print("OK: no frozen Windows asset paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
