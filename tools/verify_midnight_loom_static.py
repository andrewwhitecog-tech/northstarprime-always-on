#!/usr/bin/env python3
"""Fail closed if the MIDNIGHT LOOM mature-lane release contract drifts."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "mature" / "index.html"
VIDEO = ROOT / "mature" / "assets" / "video" / "midnight_loom_v01.mp4"
POSTER = ROOT / "mature" / "assets" / "video" / "midnight_loom_v01_poster.jpg"
CAPTIONS = ROOT / "mature" / "assets" / "video" / "midnight_loom_v01.en.vtt"
EXPECTED_SHA256 = "A0CB04267055CC62B9224661C79324894D815075FE2FC8DC24E3B22B66F58561"
MAX_ASSET_BYTES = 6_300_000


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> int:
    page = PAGE.read_text(encoding="utf-8")
    for token in (
        "MIDNIGHT LOOM — original chorus-sync bumper",
        "fictional adult age 29",
        "midnight-loom-video",
        "assets/video/midnight_loom_v01.mp4",
        "assets/video/midnight_loom_v01_poster.jpg",
        "assets/video/midnight_loom_v01.en.vtt",
        "no nudity, explicit sex act, coercion, sexual violence, real-person likeness, illegal content, or medical claim",
    ):
        if token not in page:
            fail(f"missing page contract token: {token}")
    if page.find("source.src='assets/video/midnight_loom_v01.mp4'") < page.find("function reveal()"):
        fail("video source is not deferred behind reveal()")
    for path in (VIDEO, POSTER, CAPTIONS):
        if not path.is_file() or path.stat().st_size == 0:
            fail(f"missing release asset: {path.relative_to(ROOT)}")
    asset_bytes = sum(path.stat().st_size for path in (VIDEO, POSTER, CAPTIONS))
    if asset_bytes > MAX_ASSET_BYTES:
        fail(f"release assets exceed 6.3 MB allocation: {asset_bytes}")
    digest = hashlib.sha256(VIDEO.read_bytes()).hexdigest().upper()
    if digest != EXPECTED_SHA256:
        fail(f"video hash mismatch: {digest}")
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-count_frames",
        "-show_entries", "format=duration:stream=codec_name,width,height,pix_fmt,r_frame_rate,nb_read_frames,sample_rate,channels",
        "-of", "json", str(VIDEO),
    ], text=True))
    streams = probe["streams"]
    video = next(item for item in streams if item.get("width"))
    audio = next(item for item in streams if item.get("sample_rate"))
    expected_video = {"codec_name": "h264", "width": 1080, "height": 1920, "pix_fmt": "yuv420p", "r_frame_rate": "30/1", "nb_read_frames": "360"}
    if any(video.get(key) != value for key, value in expected_video.items()):
        fail(f"video probe mismatch: {video}")
    if audio.get("codec_name") != "aac" or audio.get("sample_rate") != "48000" or audio.get("channels") != 2:
        fail(f"audio probe mismatch: {audio}")
    if abs(float(probe["format"]["duration"]) - 12.0) > 0.001:
        fail(f"duration mismatch: {probe['format']['duration']}")
    print(f"PASS: MIDNIGHT LOOM gated release, media contract, 6.3 MB allocation, and SHA-256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
