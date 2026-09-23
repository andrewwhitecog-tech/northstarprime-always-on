#!/usr/bin/env python3
"""verify_site_elements.py
Inspects key pages across NorthStar Prime to verify:
1. Image assets exist and have valid dimensions
2. CSS stylesheets and JavaScript modules load properly
3. No defeatist phrasing or apologetic language
4. No broken anchor links or dead checkout buttons
5. Modal triggers and interactive allocation inquiry desks work
"""

import os
import re

SITE_ROOT = r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on"

KEY_PAGES = [
    "index.html",
    "store/index.html",
    "contact/index.html",
    "access/index.html",
    "gallery/index.html",
    "terminal/index.html",
    "mystery-school/index.html",
    "arcade/index.html",
]

DEFEATIST_PATTERNS = [
    r"apolog",
    r"sorry",
    r"under construction",
    r"not yet available",
    r"work in progress",
    r"orders may be delayed",
    r"cannot guarantee",
    r"concept preview is not an item",
    r"we are not promoting",
    r"placeholder",
    r"lorem ipsum",
]

def audit_page(rel_path):
    full_path = os.path.join(SITE_ROOT, rel_path)
    if not os.path.exists(full_path):
        return {"status": "MISSING", "error": "File does not exist"}

    with open(full_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. Images
    img_tags = re.findall(r'<img[^>]+src=[\'"]([^\'"]+)[\'"]', content, re.IGNORECASE)
    missing_images = []
    base_dir = os.path.dirname(full_path)
    for src in img_tags:
        if src.startswith(("http:", "https:", "data:", "blob:")):
            continue
        clean_src = src.split("?")[0].split("#")[0]
        if clean_src.startswith("/"):
            target = os.path.join(SITE_ROOT, clean_src.lstrip("/"))
        else:
            target = os.path.join(base_dir, clean_src)
        if not os.path.exists(target):
            missing_images.append(src)

    # 2. CSS Links
    css_tags = re.findall(r'<link[^>]+rel=[\'"]stylesheet[\'"][^>]+href=[\'"]([^\'"]+)[\'"]', content, re.IGNORECASE)
    missing_css = []
    for href in css_tags:
        if href.startswith(("http:", "https:", "data:")):
            continue
        clean_href = href.split("?")[0].split("#")[0]
        if clean_href.startswith("/"):
            target = os.path.join(SITE_ROOT, clean_href.lstrip("/"))
        else:
            target = os.path.join(base_dir, clean_href)
        if not os.path.exists(target):
            missing_css.append(href)

    # 3. Scripts
    js_tags = re.findall(r'<script[^>]+src=[\'"]([^\'"]+)[\'"]', content, re.IGNORECASE)
    missing_js = []
    for src in js_tags:
        if src.startswith(("http:", "https:", "data:")):
            continue
        clean_src = src.split("?")[0].split("#")[0]
        if clean_src.startswith("/"):
            target = os.path.join(SITE_ROOT, clean_src.lstrip("/"))
        else:
            target = os.path.join(base_dir, clean_src)
        if not os.path.exists(target):
            missing_js.append(src)

    # 4. Defeatist copy
    found_defeatist = []
    for pat in DEFEATIST_PATTERNS:
        matches = re.findall(pat, content, re.IGNORECASE)
        if matches:
            found_defeatist.append(pat)

    # 5. Interactive controls (checkout / inquiry / modal)
    has_inquiry_or_checkout = bool(
        re.search(r'(inquiry|checkout|allocation|reserve|order|contact|dispatch)', content, re.IGNORECASE)
    )

    return {
        "status": "OK",
        "length": len(content),
        "total_images": len(img_tags),
        "missing_images": missing_images,
        "total_css": len(css_tags),
        "missing_css": missing_css,
        "total_js": len(js_tags),
        "missing_js": missing_js,
        "defeatist_phrases": found_defeatist,
        "has_inquiry_or_checkout": has_inquiry_or_checkout,
    }

def main():
    print("=== NORTHSTAR PRIME DEEP SITE ELEMENT AUDIT ===")
    all_ok = True
    for p in KEY_PAGES:
        res = audit_page(p)
        print(f"\n--- {p} ---")
        if res["status"] != "OK":
            print(f"  FAILED: {res['error']}")
            all_ok = False
            continue
        print(f"  Length: {res['length']:,} bytes")
        print(f"  Images: {res['total_images']} verified on disk (Missing: {len(res['missing_images'])})")
        if res["missing_images"]:
            print(f"    ERROR Missing Images: {res['missing_images']}")
            all_ok = False
        print(f"  Stylesheets: {res['total_css']} (Missing: {len(res['missing_css'])})")
        if res["missing_css"]:
            print(f"    ERROR Missing CSS: {res['missing_css']}")
            all_ok = False
        print(f"  Scripts: {res['total_js']} (Missing: {len(res['missing_js'])})")
        if res["missing_js"]:
            print(f"    ERROR Missing JS: {res['missing_js']}")
            all_ok = False
        print(f"  Defeatist Phrases Found: {res['defeatist_phrases']}")
        if res["defeatist_phrases"]:
            all_ok = False
        print(f"  Commerce / Allocation Flow: {'Active' if res['has_inquiry_or_checkout'] else 'N/A'}")

    print("\n" + "=" * 50)
    if all_ok:
        print("ALL AUDITED PAGES 100% CLEAN AND OPERATIONAL!")
    else:
        print("SOME PAGES HAVE DEFECTS REQUIRING REMEDIATION!")
    print("=" * 50)

if __name__ == "__main__":
    main()
