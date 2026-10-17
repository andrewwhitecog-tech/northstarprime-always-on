#!/usr/bin/env python3
"""Freeze the cloud IDR catalog into the always-on GitHub Pages shell.

The catalog HTML stays on the apex. Large media remains on the cloud app so the
Pages repository does not become an audio archive. The dynamic pulse endpoint
is replaced by a deterministic browser-side selector built from the catalog's
existing track elements; this avoids a cross-origin fetch and keeps the dock
useful when served from the apex.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


APP_ORIGIN = "https://app.northstarprime.net"


def normalize_generated_text(value: str) -> str:
    """Use stable LF endings, no trailing spaces, and one final newline."""
    lines = [line.rstrip() for line in value.splitlines()]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines) + "\n"
ASSET_ORIGIN = "https://assets.northstarprime.net"
APEX_ORIGIN = "https://northstarprime.net"

STATIC_ROUTES = {
    "/": "/",
    "/arcade": "/arcade/",
    "/contact": "/contact/",
    "/continuity-atlas": "/continuity-atlas/",
    "/idc-programming": "/idc-programming/",
    "/idr": "/idr/",
    "/site.webmanifest": "/site.webmanifest",
}

STATIC_DOCK_SCRIPT = r"""<script id="nsp-static-idr-dock">
(function(){
  var a=document.getElementById('idr-audio'),btn=document.getElementById('idr-toggle'),
      tEl=document.getElementById('idr-title'),arEl=document.getElementById('idr-artist');
  if(!a||!btn) return;
  var tracks=Array.prototype.slice.call(document.querySelectorAll('.idr-song-audio')).map(function(el){
    return {src:el.src,title:el.getAttribute('data-title')||'IDR Transmission'};
  }).filter(function(track){ return track.src; });
  if(!tracks.length){ arEl.textContent='catalog relay unavailable'; btn.disabled=true; return; }
  var cur=null,playing=false,slotSeconds=300;
  function tune(autoplay){
    var now=Math.floor(Date.now()/1000),slot=Math.floor(now/slotSeconds),track=tracks[slot%tracks.length];
    tEl.textContent=track.title; arEl.textContent='IDR Records · always-on cloud relay';
    if(cur!==track.src){
      cur=track.src; a.src=track.src;
      a.addEventListener('loadedmetadata',function h(){
        var duration=isFinite(a.duration)&&a.duration>0?a.duration:slotSeconds;
        try{a.currentTime=(now%slotSeconds)%duration;}catch(e){}
        a.removeEventListener('loadedmetadata',h);
        if(playing)a.play().catch(function(){});
      },{once:true});
    }
    if(autoplay)a.play().catch(function(){});
  }
  btn.addEventListener('click',function(){
    if(playing){a.pause();playing=false;btn.innerHTML='&#9654;';}
    else{playing=true;btn.innerHTML='&#10073;&#10073;';tune(true);}
  });
  a.addEventListener('ended',function(){tune(true);});
  setInterval(function(){if(playing)tune(false);},20000);
})();
</script>"""

STATUS_BANNER = """
<aside id="nsp-static-relay-notice" style="position:relative;z-index:20;padding:.55rem 1rem;text-align:center;background:#080812;border-bottom:1px solid rgba(0,229,255,.28);color:#c7c8d8;font:600 .68rem/1.4 monospace;letter-spacing:.08em">
  ALWAYS-ON CATALOG &middot; AUDIO IS RELAYED FROM THE NSP CLOUD APP. IF A PLAYER IS WAKING, RETRY IN A MOMENT.
</aside>
"""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def load_source(source_url: str, source_html: Path | None) -> tuple[str, str]:
    if source_html:
        return source_html.read_text(encoding="utf-8"), str(source_html.resolve())
    request = urllib.request.Request(source_url, headers={"User-Agent": "NSP-IDR-Freezer/1.0"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode("utf-8"), source_url


def rewrite_assets(html: str) -> str:
    replacements = (
        ('"/static/', f'"{APP_ORIGIN}/static/'),
        ("'/static/", f"'{APP_ORIGIN}/static/"),
        ("url(/static/", f"url({APP_ORIGIN}/static/"),
    )
    for old, new in replacements:
        html = html.replace(old, new)
    available_channel_covers = {"ambient", "country", "edm", "hiphop", "rock_metal"}
    cover_pattern = re.compile(
        re.escape(APP_ORIGIN) + r"/static/idr_covers/([^/]+)/([^\"')\s]+)"
    )

    def repair_cover(match: re.Match[str]) -> str:
        channel, filename = match.groups()
        if channel in available_channel_covers:
            if filename.endswith("_ident_cover.png"):
                target = f"{channel}_ident_cover.png"
            else:
                target = f"{channel}_bed_cover.png"
            return f"/static/idr_covers/{channel}/{target}"
        return "/static/idr_covers/generic.webp"

    html = cover_pattern.sub(repair_cover, html)
    for relative in (
        "brand/dalle3_CyberFed_Badge_perf.webp",
        "cards/signal_cartographer_prime/hero.svg",
    ):
        html = html.replace(
            f"{APP_ORIGIN}/static/{relative}",
            f"/static/{relative}",
        )
    return html


def materialize_covers(asset_root: Path | None, repo_root: Path) -> list[dict[str, object]]:
    if not asset_root:
        return []
    sources: list[tuple[Path, Path]] = []
    for channel in ("ambient", "country", "edm", "hiphop", "rock_metal"):
        for kind in ("bed", "ident"):
            relative = Path("static") / "idr_covers" / channel / f"{channel}_{kind}_cover.png"
            sources.append((asset_root / relative, repo_root / relative))
    sources.append(
        (
            asset_root / "static" / "brand" / "nsp_vorath_wallpaper_perf.webp",
            repo_root / "static" / "idr_covers" / "generic.webp",
        )
    )
    for relative in (
        Path("brand") / "dalle3_CyberFed_Badge_perf.webp",
        Path("cards") / "signal_cartographer_prime" / "hero.svg",
    ):
        sources.append(
            (
                asset_root / "static" / relative,
                repo_root / "static" / relative,
            )
        )
    copied: list[dict[str, object]] = []
    for source, destination in sources:
        if not source.is_file():
            raise RuntimeError(f"required local IDR cover is missing: {source}")
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.is_file() or source.read_bytes() != destination.read_bytes():
            shutil.copy2(source, destination)
        copied.append(
            {
                "path": destination.relative_to(repo_root).as_posix(),
                "bytes": destination.stat().st_size,
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest().upper(),
            }
        )
    return copied


def materialize_pwa(repo_root: Path) -> list[dict[str, object]]:
    outputs: list[dict[str, object]] = []
    request = urllib.request.Request(
        f"{APP_ORIGIN}/favicon.ico",
        headers={"User-Agent": "NSP-IDR-Freezer/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        favicon_data = response.read()
    favicon_path = repo_root / "favicon.svg"
    favicon_path.write_bytes(favicon_data)
    outputs.append(
        {
            "path": "favicon.svg",
            "bytes": len(favicon_data),
            "sha256": sha256_bytes(favicon_data),
        }
    )

    request = urllib.request.Request(
        f"{APP_ORIGIN}/site.webmanifest",
        headers={"User-Agent": "NSP-IDR-Freezer/1.0"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        manifest_data = json.loads(response.read().decode("utf-8"))
    manifest_data["icons"] = [
        {
            "src": "/favicon.svg",
            "sizes": "any",
            "type": "image/svg+xml",
            "purpose": "any maskable",
        }
    ]
    webmanifest_data = (json.dumps(manifest_data, indent=2) + "\n").encode("utf-8")
    webmanifest_path = repo_root / "site.webmanifest"
    webmanifest_path.write_bytes(webmanifest_data)
    outputs.append(
        {
            "path": "site.webmanifest",
            "bytes": len(webmanifest_data),
            "sha256": sha256_bytes(webmanifest_data),
        }
    )
    ico_path = repo_root / "favicon.ico"
    if not ico_path.is_file() or not ico_path.read_bytes().startswith(b"\x00\x00\x01\x00"):
        raise RuntimeError("a valid committed favicon.ico is required")
    ico_data = ico_path.read_bytes()
    outputs.append(
        {
            "path": "favicon.ico",
            "bytes": len(ico_data),
            "sha256": sha256_bytes(ico_data),
        }
    )
    return outputs


def rewrite_routes(html: str) -> str:
    pattern = re.compile(r"(href=[\"'])(/[^\"'#?]*)([\"'])")

    def replace(match: re.Match[str]) -> str:
        prefix, path, suffix = match.groups()
        normalized = path.rstrip("/") or "/"
        target = STATIC_ROUTES.get(normalized)
        if target is None:
            target = APP_ORIGIN + path
        return prefix + target + suffix

    return pattern.sub(replace, html)


def replace_dynamic_dock(html: str) -> str:
    marker = "<!-- IDR LIVE DOCK"
    end_marker = "<!-- COSMIC BACKGROUND"
    start = html.find(marker)
    end = html.find(end_marker, start)
    if start < 0 or end < 0:
        raise RuntimeError("IDR dock markers were not found")
    segment = html[start:end]
    script_pattern = re.compile(
        r"<script>\s*\(function\(\)\{\s*var a=document\.getElementById\('idr-audio'\).*?</script>",
        re.DOTALL,
    )
    updated, count = script_pattern.subn(STATIC_DOCK_SCRIPT, segment, count=1)
    if count != 1:
        raise RuntimeError("dynamic IDR dock script was not replaced exactly once")
    return html[:start] + updated + html[end:]


def freeze(html: str) -> str:
    if "Interdimensional Radio" not in html or "fetch('/api/pulse')" not in html:
        raise RuntimeError("source does not look like the expected live IDR page")
    html = rewrite_assets(html)
    html = rewrite_routes(html)
    html = replace_dynamic_dock(html)
    html = html.replace(
        '<link rel="canonical" href="https://northstarprime.net/idr">',
        '<link rel="canonical" href="https://northstarprime.net/idr/">',
    )
    html = html.replace(
        "</head>",
        (
            '<meta name="nsp-static-shell" content="idr-v1-cloud-relay">\n'
            '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n'
            "</head>"
        ),
        1,
    )
    html = re.sub(r"(<body[^>]*>)", r"\1\n" + STATUS_BANNER, html, count=1, flags=re.I)
    return html


def dependency_inventory(html: str, asset_root: Path | None) -> dict[str, object]:
    urls = sorted(
        set(
            re.findall(
                r"https://(?:app\.northstarprime\.net/static|assets\.northstarprime\.net)/[^\"'()<>\s]+",
                html,
            )
        )
    )
    total_bytes = 0
    found = 0
    missing: list[str] = []
    if asset_root:
        for url in urls:
            if url.startswith(APP_ORIGIN + "/static/"):
                relative = url.split("/static/", 1)[1]
            else:
                relative = url.split(ASSET_ORIGIN + "/", 1)[1]
            candidate = asset_root / "static" / relative
            if candidate.is_file():
                found += 1
                total_bytes += candidate.stat().st_size
            else:
                missing.append(relative)
    return {
        "externalized_asset_count": len(urls),
        "local_asset_count": found if asset_root else None,
        "local_asset_bytes": total_bytes if asset_root else None,
        "missing_from_optional_asset_root": missing if asset_root else [],
        "externalized_assets": urls,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-url", default=f"{APP_ORIGIN}/idr")
    parser.add_argument("--source-html", type=Path)
    parser.add_argument("--output", type=Path, default=Path("idr/index.html"))
    parser.add_argument("--manifest", type=Path, default=Path("IDR_FREEZE_MANIFEST.json"))
    parser.add_argument("--asset-root", type=Path)
    parser.add_argument("--repo-root", type=Path, default=Path("."))
    args = parser.parse_args()

    source, source_id = load_source(args.source_url, args.source_html)
    frozen = normalize_generated_text(freeze(source))
    output_bytes = frozen.encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(output_bytes)

    inventory = dependency_inventory(frozen, args.asset_root)
    local_covers = materialize_covers(args.asset_root, args.repo_root.resolve())
    pwa_assets = materialize_pwa(args.repo_root.resolve())
    manifest = {
        "schema": "nsp-idr-static-freeze-v1",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "source": source_id,
        "public_route": f"{APEX_ORIGIN}/idr/",
        "media_origins": [APP_ORIGIN, ASSET_ORIGIN],
        "strategy": "always-on catalog HTML with cloud-relayed media and deterministic local dock",
        "output": args.output.as_posix(),
        "output_sha256": sha256_bytes(output_bytes),
        "track_count": len(re.findall(r'class="idr-song-audio"', frozen)),
        "local_cover_assets": local_covers,
        "pwa_assets": pwa_assets,
        **inventory,
    }
    args.manifest.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in manifest.items() if k != "externalized_assets"}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
