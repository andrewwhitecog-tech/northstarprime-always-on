"""Verify the apex XMR page and cross-origin Warband capture contract."""
from __future__ import annotations

import argparse
import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DONATIONS = "8A6nB3pDDrVJ8jxGdg6F7W581ZgUgKEVEFuboZnMoNHXS9GwSjw5sMzWESry9wLf5KdffH8YgSsNcZJvE7B1PmfGPJ9AVSX"
PAYMENTS = "84hj8S3BiHQXrJiujjbzyE9wj8pTpkDM179RMnWdzCQZCWV5jzFACcagMZ6T6Ndrsbcu1KyVtdgV6AGj1ZZs6gA2J5MQnBA"


def verify(network: bool = False) -> dict:
    xmr = (ROOT / "xmr" / "index.html").read_text(encoding="utf-8")
    warband = (ROOT / "warband" / "index.html").read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "static" / "xmr" / "manifest.json").read_text(encoding="utf-8"))
    checks = {
        "xmr_addresses_present": DONATIONS in xmr and PAYMENTS in xmr,
        "spacecash_boundary_present": "no XMR-to-SPACE exchange" in xmr,
        "warband_uses_durable_app": "https://app.northstarprime.net/api/warband/notify" in warband,
        "warband_waits_for_response": "await fetch" in warband and "if(!response.ok||!body.ok)" in warband,
        "warband_no_false_local_fallback": "localStorage.setItem" not in warband,
    }
    for lane in ("donations", "payments"):
        asset = ROOT / "static" / "xmr" / f"{lane}.png"
        checks[f"{lane}_png"] = asset.is_file() and asset.read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
        checks[f"{lane}_manifest"] = manifest["assets"][lane]["address"] in xmr
        checks[f"{lane}_sha256"] = bool(hashlib.sha256(asset.read_bytes()).hexdigest())
    if network:
        request = urllib.request.Request(
            "https://app.northstarprime.net/api/warband/notify",
            method="OPTIONS",
            headers={"Origin": "https://northstarprime.net", "Access-Control-Request-Method": "POST"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                checks["live_preflight"] = response.status == 204 and response.headers.get("Access-Control-Allow-Origin") == "https://northstarprime.net"
        except (urllib.error.URLError, TimeoutError):
            checks["live_preflight"] = False
    result = {"ok": all(checks.values()), "checks": checks}
    if not result["ok"]:
        raise SystemExit(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--network", action="store_true")
    args = parser.parse_args()
    print(json.dumps(verify(args.network), indent=2))
