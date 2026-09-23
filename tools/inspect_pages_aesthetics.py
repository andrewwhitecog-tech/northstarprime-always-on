#!/usr/bin/env python3
"""Inspect pages across NorthStar Prime for aesthetic quality, image references, and stubs."""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{title}</title>
  <link rel="canonical" href="{target_url}">
  <meta http-equiv="refresh" content="0;url={target_url}">
  <meta name="theme-color" content="#080c16">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root {{
      --void: #060913;
      --panel: #0d1322;
      --panel-border: rgba(237, 202, 131, 0.22);
      --gold: #edca83;
      --cyan: #38bdf8;
      --muted: #94a3b8;
    }}
    body {{
      background: radial-gradient(ellipse at 50% 20%, rgba(237,202,131,0.08), transparent 45%),
                  radial-gradient(ellipse at 80% 80%, rgba(56,189,248,0.06), transparent 50%),
                  var(--void);
      color: #f1f5f9;
      font-family: 'Space Grotesk', system-ui, -apple-system, sans-serif;
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      box-sizing: border-box;
      text-align: center;
    }}
    .transit-card {{
      max-width: 520px;
      width: 100%;
      background: rgba(13, 19, 34, 0.85);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 3rem 2rem;
      box-shadow: 0 20px 50px rgba(0,0,0,0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }}
    .transit-star {{
      font-size: 2.5rem;
      color: var(--gold);
      display: block;
      margin-bottom: 1rem;
      animation: pulseGlow 2.5s ease-in-out infinite;
    }}
    @keyframes pulseGlow {{
      0%, 100% {{ transform: scale(1); filter: drop-shadow(0 0 10px rgba(237,202,131,0.4)); }}
      50% {{ transform: scale(1.08); filter: drop-shadow(0 0 20px rgba(237,202,131,0.8)); }}
    }}
    .transit-tag {{
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      color: var(--cyan);
      margin-bottom: 0.6rem;
    }}
    h1 {{
      font-size: clamp(1.8rem, 4vw, 2.4rem);
      margin: 0 0 1rem;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: -0.5px;
    }}
    p {{
      color: var(--muted);
      font-size: 1rem;
      line-height: 1.6;
      margin: 0 0 2rem;
    }}
    .btn-enter {{
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.8rem 1.8rem;
      border-radius: 999px;
      font-weight: 700;
      font-size: 0.92rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-decoration: none;
      background: var(--gold);
      color: #060913;
      box-shadow: 0 0 25px rgba(237,202,131,0.35);
      transition: all 0.25s ease;
    }}
    .btn-enter:hover {{
      background: #fff;
      transform: translateY(-2px);
      box-shadow: 0 0 35px rgba(237,202,131,0.6);
    }}
  </style>
</head>
<body>
  <div class="transit-card">
    <span class="transit-star" aria-hidden="true">✦</span>
    <div class="transit-tag">Dimensional Transit · NorthStar Prime</div>
    <h1>{heading}</h1>
    <p>{description}</p>
    <a class="btn-enter" href="{target_url}">Enter Destination Immediately →</a>
  </div>
  <script>location.replace('{target_url}'+location.search+location.hash)</script>
</body>
</html>
"""

def extract_target_url(txt):
    m = re.search(r'url=([^"\'\s>]+)', txt, re.IGNORECASE)
    if m:
        return m.group(1).rstrip('"\'')
    m = re.search(r'replace\([\'"]([^\'"]+)[\'"]', txt)
    if m:
        return m.group(1)
    m = re.search(r'href=[\'"]([^\'"]+)[\'"]', txt)
    if m:
        return m.group(1)
    return "/"

def get_clean_name(rel_path):
    parts = list(rel_path.parts)
    if parts[-1] == "index.html":
        parts.pop()
    if not parts:
        return "NorthStar Prime"
    name = parts[-1].replace("-", " ").title()
    return name

def inspect_and_elevate(apply_elevate=False):
    html_files = [p for p in ROOT.rglob("*.html") if "output" not in p.parts and ".git" not in p.parts]
    print(f"Total HTML files to inspect: {len(html_files)}")
    
    stubs = []
    
    # Exclude pages we already custom elevated
    custom_elevated = {
        Path("404.html"),
        Path("solarium/index.html"),
        Path("stickers/index.html"),
        Path("spacecash/index.html"),
        Path("brand/index.html"),
    }

    for p in html_files:
        rel = p.relative_to(ROOT)
        if rel in custom_elevated:
            continue
        content = p.read_text(encoding="utf-8", errors="ignore")
        size = len(content)
        
        if size < 2500 and ("http-equiv=\"refresh\"" in content.lower() or "location.replace" in content):
            stubs.append((p, rel, size, content))
            
    print(f"\n--- Stubs to Elevate ({len(stubs)}) ---")
    for p, rel, size, content in sorted(stubs, key=lambda x: str(x[1])):
        target = extract_target_url(content)
        name = get_clean_name(rel)
        print(f"  {str(rel):45s} -> {name:25s} | {target}")
        
        if apply_elevate:
            title = f"{name} — NorthStar Prime Transit"
            heading = name
            description = f"Connecting to {name} within the NorthStar sovereign network..."
            new_html = TEMPLATE.format(
                title=title,
                target_url=target,
                heading=heading,
                description=description
            )
            p.write_text(new_html, encoding="utf-8")
            print(f"    ELEVATED {rel}")

if __name__ == "__main__":
    import sys
    do_apply = "--apply" in sys.argv
    inspect_and_elevate(apply_elevate=do_apply)
