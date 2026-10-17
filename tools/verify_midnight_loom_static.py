#!/usr/bin/env python3
"""Fail closed if the MIDNIGHT LOOM mature-lane release contract drifts."""

from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "mature" / "index.html"
VIDEO = ROOT / "mature" / "assets" / "video" / "midnight_loom_v02.mp4"
POSTER = ROOT / "mature" / "assets" / "video" / "midnight_loom_v02_poster.jpg"
CAPTIONS = ROOT / "mature" / "assets" / "video" / "midnight_loom_v02.en.vtt"
EXPECTED_SHA256 = "70A0D94BAF315142F778F2CA0BE6C3BC96DBFA3DE3552307A20A22FF9DC509F7"
MAX_ASSET_BYTES = 7_200_000


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> int:
    page = PAGE.read_text(encoding="utf-8")
    for token in (
        "MIDNIGHT LOOM V2 — photoreal chorus-sync bumper",
        "fictional adult age 29",
        "four moving shots",
        "midnight-loom-video",
        "assets/video/midnight_loom_v02.mp4",
        "assets/video/midnight_loom_v02_poster.jpg",
        "assets/video/midnight_loom_v02.en.vtt",
        "no nudity, explicit sex act, coercion, sexual violence, real-person likeness, illegal content, or medical claim",
    ):
        if token not in page:
            fail(f"missing page contract token: {token}")
    if page.find("source.src='assets/video/midnight_loom_v02.mp4'") < page.find("function reveal()"):
        fail("video source is not deferred behind reveal()")
    for path in (VIDEO, POSTER, CAPTIONS):
        if not path.is_file() or path.stat().st_size == 0:
            fail(f"missing release asset: {path.relative_to(ROOT)}")
    asset_bytes = sum(path.stat().st_size for path in (VIDEO, POSTER, CAPTIONS))
    if asset_bytes > MAX_ASSET_BYTES:
        fail(f"release assets exceed 7.2 MB allocation: {asset_bytes}")
    digest = hashlib.sha256(VIDEO.read_bytes()).hexdigest().upper()
    if digest != EXPECTED_SHA256:
        fail(f"video hash mismatch: {digest}")
    ffprobe = shutil.which("ffprobe")
    if ffprobe:
        probe = json.loads(subprocess.check_output([
            ffprobe, "-v", "error", "-count_frames",
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
        probe_status = "ffprobe media contract verified"
    else:
        # GitHub's minimal Pages runner does not ship FFmpeg. The exact video
        # hash binds CI to the locally decoded and probed master.
        probe_status = "exact hash verified; ffprobe unavailable on runner"
    print(f"PASS: MIDNIGHT LOOM V2 gated photoreal release, {probe_status}, 7.2 MB allocation, and SHA-256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
