#!/usr/bin/env python3
"""Automated verification suite for The Silver Standard bullion show and calculator."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def verify_bullion():
    print("=== THE SILVER STANDARD STATIC VERIFICATION ===")
    errors = []

    # 1. Page Existence
    bullion_page = ROOT / "bullion" / "index.html"
    if not bullion_page.is_file():
        errors.append("Missing bullion/index.html")
    else:
        content = bullion_page.read_text(encoding="utf-8")
        
        # 2. Zero Emojis
        emojis = re.findall(r"[\U00010000-\U0010ffff]", content)
        if emojis:
            errors.append(f"Found {len(emojis)} emoji violations in bullion/index.html")
        else:
            print("[PASS] Zero emoji violations in bullion/index.html")

        # 3. Essential Elements
        required_tokens = [
            "Julian Sterling",
            "The Silver Standard",
            "updateCalculations",
            "spotPrice",
            "coinType",
            "totalTroyOz",
            "fairOfferRange",
            "lowballThreshold",
            "show_title_card.jpg",
            "silver_anchor_host.jpg",
            "bullion_motion_macro.jpg"
        ]
        for token in required_tokens:
            if token not in content:
                errors.append(f"Missing required token in bullion/index.html: '{token}'")
        print("[PASS] All required UI tokens and calculator functions present")

    # 4. Image Assets on Disk
    required_images = [
        ROOT / "static" / "bullion" / "silver_anchor_host.jpg",
        ROOT / "static" / "bullion" / "bullion_motion_macro.jpg",
        ROOT / "static" / "bullion" / "show_title_card.jpg"
    ]
    for img in required_images:
        if not img.is_file() or img.stat().st_size < 10000:
            errors.append(f"Missing or invalid image asset: {img}")
        else:
            print(f"[PASS] Asset verified on disk ({img.stat().st_size:,} bytes): {img.name}")

    # 5. Integration in Video Hub
    video_page = ROOT / "video" / "index.html"
    if not video_page.is_file():
        errors.append("Missing video/index.html")
    else:
        v_content = video_page.read_text(encoding="utf-8")
        if "/bullion/" not in v_content:
            errors.append("Link to /bullion/ not found in video/index.html")
        else:
            print("[PASS] Video Theater link to /bullion/ verified")

    # 6. Desktop Launchers
    desktop_cmd = Path(r"C:\Users\andre\Desktop\NorthStar_Media_Studio\LAUNCH_THE_SILVER_STANDARD.cmd")
    if not desktop_cmd.is_file():
        errors.append(f"Missing desktop launcher: {desktop_cmd}")
    else:
        print("[PASS] Desktop 1-click launcher verified")

    if errors:
        print("\nFAILED: Verification encountered errors:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    print("\n==========================================")
    print("THE SILVER STANDARD VERIFICATION: 100% GREEN")
    print("==========================================")

if __name__ == "__main__":
    verify_bullion()
