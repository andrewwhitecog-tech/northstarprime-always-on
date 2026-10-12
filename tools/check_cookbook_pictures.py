#!/usr/bin/env python3
"""Picture health list for the Deluxe cookbook: for every picture the Deluxe web
edition uses, does it decode, what are its pixel dimensions, and is it blank or
near-blank. Read-only; prints the list and exits non-zero if any picture fails.

A picture fails when it does not decode, has fewer than 16 distinct grey levels,
has a grey-level standard deviation under 3, or has more than 90% of its pixels on
one grey level.

    C:\\Python314\\python.exe tools\\check_cookbook_pictures.py [--all]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import html
import os
import pathlib
import re
import sys
import urllib.parse

from PIL import Image, ImageStat

ROOT = pathlib.Path(__file__).resolve().parents[1]
DELUXE = ROOT / "static" / "downloads" / "Digital_MasterCook_Deluxe_Illustrated_Edition.html"
MIN_GREY_LEVELS = 16
MIN_STDDEV = 3.0
MAX_DOMINANT_SHARE = 0.90


def used_pictures() -> list[str]:
    text = DELUXE.read_text(encoding="utf-8")
    base = "http://site/" + DELUXE.relative_to(ROOT).as_posix()
    rels = set()
    for src in re.findall(r"<img\b[^>]*?\bsrc=\"([^\"]+)\"", text, re.I):
        url = urllib.parse.urlsplit(urllib.parse.urljoin(base, html.unescape(src)))
        rels.add(urllib.parse.unquote(url.path).lstrip("/"))
    return sorted(rels)


def inspect(rel: str) -> dict:
    row = {"file": rel, "decodes": False, "size": "", "levels": 0, "stddev": 0.0, "dominant": 0.0, "problems": []}
    path = ROOT / rel
    if not path.is_file():
        row["problems"].append("file missing")
        return row
    try:
        with Image.open(path) as im:
            im.load()
            row["decodes"] = True
            row["size"] = f"{im.width}x{im.height}"
            grey = im.convert("L")
    except Exception as exc:
        row["problems"].append(f"does not decode: {exc}")
        return row
    hist = grey.histogram()
    total = sum(hist)
    row["levels"] = sum(1 for n in hist if n)
    row["stddev"] = ImageStat.Stat(grey).stddev[0]
    row["dominant"] = max(hist) / total
    if row["levels"] < MIN_GREY_LEVELS:
        row["problems"].append(f"only {row['levels']} grey levels")
    if row["stddev"] < MIN_STDDEV:
        row["problems"].append(f"grey std dev {row['stddev']:.1f}")
    if row["dominant"] > MAX_DOMINANT_SHARE:
        row["problems"].append(f"{row['dominant']:.0%} of pixels on one grey level")
    return row


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--all", action="store_true", help="print a line for every picture, not only failures")
    args = parser.parse_args()

    rels = used_pictures()
    with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
        rows = list(pool.map(inspect, rels))
    failed = [r for r in rows if r["problems"]]
    sizes = sorted({r["size"] for r in rows if r["size"]})

    print(f"Deluxe pictures used by the page: {len(rows)}")
    print(f"decode: {sum(r['decodes'] for r in rows)} of {len(rows)}")
    print(f"pixel dimensions seen: {', '.join(sizes)}")
    if rows:
        print(f"fewest grey levels: {min(r['levels'] for r in rows)}; lowest grey std dev: "
              f"{min(r['stddev'] for r in rows):.1f}; largest one-level share: {max(r['dominant'] for r in rows):.1%}")
    if args.all:
        print("file | decodes | pixels | grey levels | grey std dev | largest one-level share | result")
        for r in rows:
            print(f"{pathlib.PurePosixPath(r['file']).name} | {'yes' if r['decodes'] else 'NO'} | {r['size']} | "
                  f"{r['levels']} | {r['stddev']:.1f} | {r['dominant']:.1%} | "
                  f"{'FAIL: ' + '; '.join(r['problems']) if r['problems'] else 'ok'}")
    print(f"failing pictures: {len(failed)}")
    for r in failed:
        print(f"FAIL  {pathlib.PurePosixPath(r['file']).name}: {'; '.join(r['problems'])}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
