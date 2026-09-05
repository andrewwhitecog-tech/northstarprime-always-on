#!/usr/bin/env python3
"""Fail closed if the Cabaret Drift mature-lane release contract drifts."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "mature" / "index.html"
VIDEO = ROOT / "mature" / "assets" / "video" / "cabaret_drift_v01.mp4"
POSTER = ROOT / "mature" / "assets" / "video" / "cabaret_drift_v01_poster.jpg"
CAPTIONS = ROOT / "mature" / "assets" / "video" / "cabaret_drift_v01.en.vtt"
EXPECTED_SHA256 = "1E354FA4705BB5DC70D79FDBB62BF7854110E0D0218A29795F94D60B4A74BB8A"


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def main() -> int:
    page = PAGE.read_text(encoding="utf-8")
    for token in (
        "Cabaret Drift — 15-second vertical bumper",
        "fictional adult age 31",
        "cabaret-drift-video",
        "assets/video/cabaret_drift_v01.mp4",
        "assets/video/cabaret_drift_v01_poster.jpg",
        "assets/video/cabaret_drift_v01.en.vtt",
        "no nudity, explicit sex act, coercion, violence, real-person likeness, or medical claim",
    ):
        if token not in page:
            fail(f"missing page contract token: {token}")
    if page.find("source.src='assets/video/cabaret_drift_v01.mp4'") < page.find("function reveal()"):
        fail("video source is not deferred behind reveal()")
    for path in (VIDEO, POSTER, CAPTIONS):
        if not path.is_file() or path.stat().st_size == 0:
            fail(f"missing release asset: {path.relative_to(ROOT)}")
    if VIDEO.stat().st_size > 12_000_000:
        fail(f"video exceeds 12 MB release allocation: {VIDEO.stat().st_size}")
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
    expected_video = {"codec_name": "h264", "width": 1080, "height": 1920, "pix_fmt": "yuv420p", "r_frame_rate": "30/1", "nb_read_frames": "450"}
    if any(video.get(key) != value for key, value in expected_video.items()):
        fail(f"video probe mismatch: {video}")
    if audio.get("codec_name") != "aac" or audio.get("sample_rate") != "48000" or audio.get("channels") != 2:
        fail(f"audio probe mismatch: {audio}")
    if abs(float(probe["format"]["duration"]) - 15.0) > 0.001:
        fail(f"duration mismatch: {probe['format']['duration']}")
    print(f"PASS: Cabaret Drift gated release, media contract, 12 MB allocation, and SHA-256 {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
