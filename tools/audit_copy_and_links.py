#!/usr/bin/env python3
"""Comprehensive visual, functional, and copy audit across NorthStar Prime."""
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

IGNORED_SCHEMES = (
    "mailto:", "tel:", "javascript:", "data:", "blob:", "monero:",
    "http://", "https://", "//", "#"
)

def is_template_or_special(ref: str) -> bool:
    if not ref:
        return True
    if any(ref.lower().startswith(s) for s in IGNORED_SCHEMES):
        return True
    if "${" in ref or "}" in ref:
        return True
    return False

def run_audit():
    print("=== NORTHSTAR PRIME COMPREHENSIVE SITE AUDIT ===")
    
    html_files = [p for p in ROOT.rglob("*.html") if "output" not in p.parts and ".git" not in p.parts]
    print(f"Total HTML pages found: {len(html_files)}")
    
    # 1. Emoji Audit
    print("\n--- 1. EMOJI AUDIT (HTML, CSS, JS, JSON) ---")
    emoji_hits = []
    for ext in ("*.html", "*.css", "*.js", "*.json"):
        for p in ROOT.rglob(ext):
            if "output" in p.parts or ".git" in p.parts:
                continue
            txt = p.read_text(encoding="utf-8", errors="ignore")
            emojis = re.findall(r"[\U00010000-\U0010ffff]", txt)
            if emojis:
                emoji_hits.append((p.relative_to(ROOT), len(emojis), [hex(ord(c)) for c in set(emojis)]))
    
    if emoji_hits:
        print(f"FAILED: Found emojis in {len(emoji_hits)} files:")
        for rel, count, codepoints in emoji_hits:
            print(f"  {rel}: {count} emojis -> {codepoints}")
    else:
        print("PASS: Exactly 0 emojis across all HTML, CSS, JS, and JSON files!")

    # 2. Broken Image References
    print("\n--- 2. IMAGE INTEGRITY AUDIT ---")
    broken_images = []
    checked_images = 0
    img_pattern = re.compile(r'<(?:img|source)[^>]+(?:src|srcset)=["\']([^"\']+)["\']', re.IGNORECASE)
    
    for p in html_files:
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for match in img_pattern.finditer(txt):
            raw_ref = match.group(1).split()[0].split("?")[0].split("#")[0]
            if is_template_or_special(raw_ref):
                continue
            checked_images += 1
            if raw_ref.startswith("/"):
                target = ROOT / raw_ref.lstrip("/")
            else:
                target = p.parent / raw_ref
            
            if not target.is_file():
                broken_images.append((p.relative_to(ROOT), raw_ref))
                
    if broken_images:
        print(f"FAILED: Found {len(broken_images)} broken image references:")
        for page, ref in broken_images[:20]:
            print(f"  {page} -> {ref}")
        if len(broken_images) > 20:
            print(f"  ...and {len(broken_images) - 20} more.")
    else:
        print(f"PASS: All {checked_images} local image references verified on disk!")

    # 3. Broken Internal Hyperlinks
    print("\n--- 3. INTERNAL LINK INTEGRITY AUDIT ---")
    broken_links = []
    checked_links = 0
    href_pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\']', re.IGNORECASE)
    
    for p in html_files:
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for match in href_pattern.finditer(txt):
            raw_ref = match.group(1).split("?")[0].split("#")[0]
            if is_template_or_special(raw_ref):
                continue
            checked_links += 1
            if raw_ref.startswith("/"):
                target = ROOT / raw_ref.lstrip("/")
            else:
                target = p.parent / raw_ref
            
            # Check if target is a file or a directory with index.html
            exists = False
            if target.is_file():
                exists = True
            elif target.is_dir() and (target / "index.html").is_file():
                exists = True
            elif not target.suffix and (target / "index.html").is_file():
                exists = True
                
            if not exists:
                broken_links.append((p.relative_to(ROOT), raw_ref))
                
    if broken_links:
        print(f"FAILED: Found {len(broken_links)} broken internal links:")
        for page, ref in broken_links[:25]:
            print(f"  {page} -> {ref}")
        if len(broken_links) > 25:
            print(f"  ...and {len(broken_links) - 25} more.")
    else:
        print(f"PASS: All {checked_links} internal hyperlinks resolve cleanly!")

    # 4. Defeatist / Weak Copy Audit
    print("\n--- 4. DEFEATIST / WEAK PHRASING AUDIT ---")
    defeatist_phrases = [
        "channels are still being established",
        "orders may be delayed",
        "does not hold coloring-page inventory",
        "under construction",
        "sorry for any inconvenience",
        "cannot guarantee delivery",
        "we apologize for",
        "crude prototype",
        "broken prototype",
    ]
    copy_hits = []
    for p in html_files:
        txt = p.read_text(encoding="utf-8", errors="ignore")
        for phrase in defeatist_phrases:
            if phrase.lower() in txt.lower():
                copy_hits.append((p.relative_to(ROOT), phrase))
                
    if copy_hits:
        print(f"Found {len(copy_hits)} defeatist copy occurrences:")
        for page, phrase in copy_hits:
            print(f"  {page}: '{phrase}'")
    else:
        print("PASS: Zero defeatist phrases found!")

    # Final Summary Status
    all_clean = not emoji_hits and not broken_images and not broken_links and not copy_hits
    if all_clean:
        print("\n==========================================")
        print("ALL AUDITS 100% GREEN: ZERO DEFECTS FOUND!")
        print("==========================================")
    else:
        print("\n==========================================")
        print("AUDIT FAILED: Please fix identified issues.")
        print("==========================================")
        sys.exit(1)

if __name__ == "__main__":
    run_audit()
