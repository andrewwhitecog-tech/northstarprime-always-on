#!/usr/bin/env python3
"""
Purify emojis and fix broken links in arcade files for northstarprime-always-on.
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 1. Create crypto/index.html redirect
crypto_dir = ROOT / "crypto"
crypto_dir.mkdir(parents=True, exist_ok=True)
crypto_html = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SpaceCash Crypto Attestation — NorthStar Prime</title>
  <link rel="canonical" href="https://northstarprime.net/spacecash/">
  <meta http-equiv="refresh" content="0;url=/spacecash/">
  <script>location.replace('/spacecash/' + location.search + location.hash);</script>
</head>
<body style="background:#060a14;color:#cbd5e1;font-family:sans-serif;padding:2rem;text-align:center;">
  <p>Redirecting to SpaceCash Sovereign Ledger...</p>
  <a href="/spacecash/" style="color:#ffd56b;">Click here if not redirected automatically.</a>
</body>
</html>
"""
(crypto_dir / "index.html").write_text(crypto_html, encoding="utf-8")
print("Created crypto/index.html")

# 2. Purify emojis in the 3 arcade files
emoji_pattern = re.compile(r'[\U00010000-\U0010ffff]', flags=re.UNICODE)
emoji_files = [
    ROOT / "arcade" / "custom" / "system1-arena" / "index.html",
    ROOT / "arcade" / "custom" / "vorath-arena" / "index.html",
    ROOT / "arcade" / "custom" / "vorath-dominion" / "index.html"
]

for ef in emoji_files:
    if ef.exists():
        content = ef.read_text(encoding="utf-8")
        cleaned, count = emoji_pattern.subn('', content)
        ef.write_text(cleaned, encoding="utf-8")
        print(f"Purified {ef.name}: stripped {count} emojis")

print("All purifications complete.")
