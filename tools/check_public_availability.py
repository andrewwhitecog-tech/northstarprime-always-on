#!/usr/bin/env python3
"""Anonymous, bounded public checks, runnable outside the production server.

Never submits forms, redeems codes, sends email, or restarts/deploys anything.
Local history describes sampled failures, not exact downtime or visitor counts.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import time
import urllib.error
import urllib.request

APEX = "https://northstarprime.net"
APP = "https://app.northstarprime.net"
CHECKS = [
    ("home", APEX + "/", "html"),
    ("arcade", APEX + "/arcade/", "html"),
    ("radio", APEX + "/idr/", "html"),
    ("watch", APEX + "/idc-programming/", "html"),
    ("library", APEX + "/literature/", "html"),
    ("kitchen", APEX + "/ckd-kitchen/", "html"),
    ("stickers", APEX + "/stickerforge/", "html"),
    ("hire", APEX + "/hire/", "html"),
    ("contact", APEX + "/contact/", "html"),
    ("sticker_image", APEX + "/stickerforge/assets/01_uncle_vorath_portal.png", "image"),
    ("radio_audio", "https://assets.northstarprime.net/idr_audio/hiphop/hiphop_ident.wav", "audio"),
    ("watch_video", APP + "/static/idc_video/idc_anthology_e08_final_transmission.mp4", "video"),
    ("app_health", APP + "/health", "health"),
    ("storefront", APP + "/api/nsp/storefront/status", "json"),
    ("membership", APP + "/api/nsp/membership/stripe/status", "json"),
    ("redemption", APP + "/api/nsp/redeem/health", "redeem"),
]


def now():
    return datetime.now(timezone.utc).isoformat()


def probe(check):
    name, url, kind = check
    start = time.monotonic()
    result = {"name": name, "url": url, "ok": False, "status": 0}
    headers = {"User-Agent": "NorthStar-Availability/2", "Cache-Control": "no-cache"}
    media = kind in {"image", "audio", "video"}
    if media:
        headers["Range"] = "bytes=0-1023"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result["status"] = response.status
            result["final_url"] = response.geturl()
            data = response.read(1024 if media else 512_000)
            raw = data.decode("utf-8", errors="replace")
            if response.status not in ({200, 206} if media else {200}) or response.geturl() != url:
                raise ValueError("unexpected status or destination")
            if media:
                content_type = response.headers.get("Content-Type", "")
                if not data or not content_type.startswith(kind + "/"):
                    raise ValueError("expected media bytes/content type missing")
            elif kind == "html":
                if "northstar" not in raw.lower() or "<html" not in raw.lower():
                    raise ValueError("expected NorthStar page missing")
                if re.search(r'<meta\b[^>]*http-equiv\s*=\s*[\"\']?refresh', raw, re.I):
                    raise ValueError("always-on page unexpectedly redirects")
            else:
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError("expected JSON object missing")
                if kind == "health":
                    release = payload.get("release_commit", "")
                    if payload.get("status") != "ok" or payload.get("service") != "northstar-prime" or not re.fullmatch("[0-9a-f]{40}", release):
                        raise ValueError("app health or release identity invalid")
                    result["release_commit"] = release
                if kind == "redeem" and (payload.get("ok") is not True or payload.get("mutates_state") is not False):
                    raise ValueError("read-only redemption health failed")
            result["ok"] = True
    except urllib.error.HTTPError as exc:
        result.update(status=exc.code, error=f"HTTP {exc.code}")
    except Exception as exc:
        result["error"] = f"{type(exc).__name__}: {exc}"
    result["seconds"] = round(time.monotonic() - start, 3)
    return result


def collect():
    started = now()
    with ThreadPoolExecutor(max_workers=4) as pool:
        checks = list(pool.map(probe, CHECKS))
    return {"schema": "northstar.public-availability.v1", "checked": now(),
            "started": started, "healthy": all(row["ok"] for row in checks),
            "failures": [row["name"] for row in checks if not row["ok"]], "checks": checks,
            "measurement": "sampled anonymous requests; affected visitors and exact downtime unknown"}


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def record(root, report):
    root.mkdir(parents=True, exist_ok=True)
    state_path = root / "incidents.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        state = {"active": {}, "last_ok": {}}
    stamp = report["checked"]
    events = []
    for row in report["checks"]:
        name = row["name"]
        if not row["ok"]:
            if name not in state["active"]:
                state["active"][name] = {"first_failed_sample": stamp, "last_good_sample": state["last_ok"].get(name)}
                events.append({"event": "failure_observed", "name": name, **state["active"][name]})
        else:
            state["last_ok"][name] = stamp
            if name in state["active"]:
                incident = state["active"].pop(name)
                events.append({"event": "recovery_observed", "name": name, **incident, "first_recovered_sample": stamp})
    state["checked"] = stamp
    atomic_json(state_path, state)
    atomic_json(root / "latest.json", report)
    # Monthly files keep each history file bounded without removing evidence.
    with (root / f"samples-{stamp[:7]}.jsonl").open("a", encoding="utf-8") as stream:
        stream.write(json.dumps(report, separators=(",", ":")) + "\n")
    if events:
        with (root / "incidents.jsonl").open("a", encoding="utf-8") as stream:
            for event in events:
                stream.write(json.dumps(event) + "\n")
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--state-dir", type=Path)
    args = parser.parse_args()
    report = collect()
    if args.output:
        atomic_json(args.output, report)
    if args.state_dir:
        record(args.state_dir, report)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as stream:
            stream.write("| Surface | Result | Seconds |\n|---|---|---|\n")
            for row in report["checks"]:
                stream.write(f"| {row['name']} | {'OK' if row['ok'] else row.get('error', 'FAILED')} | {row['seconds']} |\n")
    if sys_stdout_available():
        print(json.dumps(report, indent=2))
    return 0 if report["healthy"] else 1


def sys_stdout_available():
    import sys
    return sys.stdout is not None


if __name__ == "__main__":
    raise SystemExit(main())
