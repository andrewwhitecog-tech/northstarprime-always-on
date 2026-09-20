#!/usr/bin/env python3
"""Verify IDR catalog identity and the single-player contract.

Offline checks verify artifacts, not browser decoding or audible playback.
--network samples public media bytes; it does not prove complete files.
"""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import urllib.request

# Independent pin of all 50 URLs in the live 2026-09-20 page.
CATALOG_SHA256 = "9238878886510303788F0C941E4AD982EF516E96E7E643EF685A95F2BF79B868"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest().upper()


class Page(HTMLParser):
    def __init__(self, source: str):
        super().__init__()
        self.elements: list[tuple[str, dict]] = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs)))

    def tags(self, name):
        return [attrs for tag, attrs in self.elements if tag == name]


def inspect(source: str, manifest: dict, root: Path, html_path: Path) -> dict[str, bool]:
    page = Page(source)
    buttons = [a for a in page.tags("button") if a.get("class") == "idr-track-play"]
    urls = [a.get("data-audio-src", "") for a in buttons]
    tracks = manifest.get("tracks", [])
    track_urls = [t.get("src") for t in tracks]
    ids = [a["id"] for _, a in page.elements if "id" in a]
    catalog_hash = hashlib.sha256("\n".join(sorted(urls)).encode()).hexdigest().upper()
    audios = page.tags("audio")
    controls = {"idr-station-title", "idr-station-status", "idr-station-retry", "idr-station-previous", "idr-station-next", "idr-onair-btn", "idr-genre"}
    css_info = manifest.get("stylesheet", {})
    css_path = root / css_info.get("path", "idr/customer-radio.css")
    css = css_path.read_text(encoding="utf-8") if css_path.is_file() else ""
    local_links = [a.get("href", "") for a in page.tags("a") + page.tags("link") if a.get("href", "").startswith("/")]
    local_assets = [a.get("src", "") for a in page.tags("img") if a.get("src", "").startswith("/")]
    def exists(route):
        path = root / route.lstrip("/")
        return (path / "index.html").is_file() if route.endswith("/") else path.is_file()
    metadata = {t.get("src"): t for t in tracks}
    return {
        "title": "Interdimensional Radio" in source,
        "canonical": any(a.get("rel") == "canonical" and a.get("href") == "https://northstarprime.net/idr/" for a in page.tags("link")),
        "player_contract": any(a.get("name") == "nsp-static-shell" and a.get("content") == "idr-v3-single-player" for a in page.tags("meta")) and manifest.get("player_contract") == "idr-v3-single-player",
        "one_audio_owner": len(audios) == 1 and audios[0].get("id") == "idr-station-audio",
        "no_autoplay_or_initial_media_fetch": len(audios) == 1 and "autoplay" not in audios[0] and "src" not in audios[0] and audios[0].get("preload") == "none" and not page.tags("source"),
        "native_controls": len(audios) == 1 and "controls" in audios[0] and bool(audios[0].get("aria-label")),
        "controls_and_unique_ids": controls.issubset(ids) and len(ids) == len(set(ids)),
        "all_50_original_urls": len(urls) == len(set(urls)) == 50 and catalog_hash == CATALOG_SHA256,
        "manifest_catalog_matches_html": len(tracks) == 50 and len(set(track_urls)) == 50 and set(track_urls) == set(urls),
        "track_metadata_matches_html": all(a.get("data-title") == metadata.get(a.get("data-audio-src"), {}).get("title") and a.get("data-kind") == metadata.get(a.get("data-audio-src"), {}).get("kind") and a.get("data-genre") == metadata.get(a.get("data-audio-src"), {}).get("genre") for a in buttons),
        "39_songs_11_station_sounds": sum(a.get("data-kind") == "song" for a in buttons) == manifest.get("song_count") == 39 and sum(a.get("data-kind") != "song" for a in buttons) == manifest.get("station_sound_count") == 11 and manifest.get("track_count") == 50,
        "named_keyboard_buttons": all(a.get("type") == "button" and a.get("aria-label") and a.get("aria-pressed") == "false" for a in buttons),
        "guest_listening": "No account needed" in source and "No payment interruptions" in source,
        "no_competing_legacy_player": not any(word in source for word in ("slotSeconds", "idr-song-audio", "nsp-static-idr-dock", "idr-dock", "idrOnAir", "nsp-static-relay-notice")),
        "no_animation_workers": not page.tags("canvas") and "requestAnimationFrame" not in source and "setInterval" not in source,
        "no_private_paths": not re.search(r"localhost|127\.0\.0\.1|file://|[A-Z]:\\", source, re.I),
        "public_asset_origin": all(url.startswith("https://assets.northstarprime.net/idr_audio/") for url in urls),
        "no_app_runtime_dependency": "https://app.northstarprime.net" not in source,
        "hash": sha256(html_path) == manifest.get("output_sha256"),
        "schema": manifest.get("schema") == "nsp-idr-static-freeze-v1",
        "public_route": manifest.get("public_route") == "https://northstarprime.net/idr/",
        "local_destinations_exist": bool(local_links) and all(exists(url) for url in local_links),
        "local_art_exists": bool(local_assets) and all(exists(url) for url in local_assets),
        "cover_hashes": all((root / a["path"]).is_file() and hashlib.sha256((root / a["path"]).read_bytes()).hexdigest().upper() == a["sha256"] for a in manifest.get("local_cover_assets", [])),
        "stylesheet_hash": css_path.is_file() and sha256(css_path) == css_info.get("sha256"),
        "reduced_motion_and_touch": "prefers-reduced-motion:reduce" in css and "min-height:44px" in css and ":focus-visible" in css,
        "noscript_audio_fallback": len(page.tags("noscript")) == 51,
    }


def check_url(url: str) -> tuple[bool, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "NSP-IDR-Verifier/3.0", "Range": "bytes=0-4095"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            chunk = response.read(4096)
            return response.status in (200, 206) and bool(chunk), f"HTTP {response.status}; {len(chunk)} bytes sampled"
    except Exception as exc:
        return False, str(exc)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--html", type=Path, default=Path("idr/index.html"))
    parser.add_argument("--manifest", type=Path, default=Path("IDR_FREEZE_MANIFEST.json"))
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--network", action="store_true", help="Sample three public media files; not playback proof")
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    checks = inspect(args.html.read_text(encoding="utf-8"), manifest, args.root, args.html)
    if args.network:
        urls = [t["src"] for t in manifest["tracks"]]
        for url in (urls[0], urls[len(urls) // 2], urls[-1]):
            passed, detail = check_url(url)
            checks["network:" + url] = passed
            print(detail)
    for name, passed in checks.items():
        print(f"{'PASS' if passed else 'FAIL'} {name}")
    failures = [name for name, passed in checks.items() if not passed]
    print("IDR STATIC VERIFICATION " + ("FAILED: " + ", ".join(failures) if failures else "PASSED"))
    return bool(failures)


if __name__ == "__main__":
    raise SystemExit(main())
