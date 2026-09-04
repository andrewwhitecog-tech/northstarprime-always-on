#!/usr/bin/env python3
"""Verify always-on contact and RFC 9116 security-contact surfaces."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTACT = ROOT / "contact" / "index.html"
SECURITY = ROOT / ".well-known" / "security.txt"
NOJEKYLL = ROOT / ".nojekyll"


def main() -> None:
    html = CONTACT.read_text(encoding="utf-8")
    policy = SECURITY.read_text(encoding="utf-8")
    if not NOJEKYLL.is_file():
        raise SystemExit("Missing .nojekyll; GitHub Pages would omit .well-known")
    if "contact@northstarprime.net" not in html:
        raise SystemExit("Contact page is missing the branded address")
    if "mailto:contact@northstarprime.net" not in html:
        raise SystemExit("Contact page is missing its mailto fallback")
    if "private forwarding destination is never exposed" not in html:
        raise SystemExit("Contact privacy boundary is not disclosed")
    if "https://app.northstarprime.net/hire/ai-incident-readiness?" not in html:
        raise SystemExit("Contact page does not expose the free readiness scorecard")
    if "utm_medium=owned_contact" not in html or "utm_content=free_scorecard" not in html:
        raise SystemExit("Contact scorecard link lacks distinct owned attribution")
    if re.search(r"file://|[A-Z]:\\", html, re.IGNORECASE):
        raise SystemExit("Contact page contains a local filesystem reference")
    required = {
        "Contact": "mailto:security@northstarprime.net",
        "Canonical": "https://northstarprime.net/.well-known/security.txt",
        "Preferred-Languages": "en",
    }
    rows = dict(line.split(": ", 1) for line in policy.splitlines() if ": " in line)
    for key, expected in required.items():
        if rows.get(key) != expected:
            raise SystemExit(f"security.txt {key} mismatch")
    expires = datetime.fromisoformat(rows["Expires"].replace("Z", "+00:00"))
    if expires <= datetime.now(timezone.utc):
        raise SystemExit("security.txt is expired")
    print("OK: always-on contact page exposes only branded mail aliases")
    print("OK: security.txt contact, canonical URL, language, and expiry")


if __name__ == "__main__":
    main()
