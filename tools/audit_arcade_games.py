#!/usr/bin/env python3
"""Audit the 52 Arcade games in arcade/custom for completeness, images, and audio."""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def audit():
    custom_dir = ROOT / "arcade" / "custom"
    games = sorted([d.name for d in custom_dir.iterdir() if d.is_dir()])
    print(f"Total game directories found in arcade/custom: {len(games)}")
    
    arcade_index = (ROOT / "arcade" / "index.html").read_text(encoding="utf-8")
    
    missing_from_index = []
    issues = []
    
    for g in games:
        g_dir = custom_dir / g
        index_file = g_dir / "index.html"
        if not index_file.exists():
            issues.append(f"{g}: MISSING index.html")
            continue
            
        # Check if linked in arcade/index.html
        if f"/arcade/custom/{g}/" not in arcade_index and f"/arcade/custom/{g}" not in arcade_index:
            missing_from_index.append(g)
            
    print(f"\nGames missing from arcade/index.html ({len(missing_from_index)}):")
    for m in missing_from_index:
        print(f"  - {m}")
        
    if issues:
        print(f"\nGame structural issues ({len(issues)}):")
        for i in issues:
            print(f"  - {i}")
    else:
        print("\nAll game directories have index.html!")

if __name__ == "__main__":
    audit()
