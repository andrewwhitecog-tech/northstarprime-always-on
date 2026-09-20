#!/usr/bin/env python3
"""Verify customer journeys and all resources referenced by the static homepage."""
from __future__ import annotations
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "HOME_FREEZE_MANIFEST.json"
ORIGIN = "https://northstarprime.net"
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".svg", ".md", ".txt"}
LOCAL_REF_RE = re.compile(r"file://|[A-Z]:\\|https?://(?:localhost|127\.0\.0\.1)(?=[:/\s\"']|$)", re.I)
CSS_URL = re.compile(r"url\(\s*['\"]?([^)'\"\s]+)|@import\s+['\"]([^'\"]+)", re.I)
RESOURCE_RELS = {"stylesheet", "icon", "manifest", "preload", "modulepreload", "apple-touch-icon"}

class Page(HTMLParser):
    """Parse actual attributes instead of incidental URLs in copy/scripts."""
    def __init__(self, html: str):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.canonicals = []
        self.links = []
        self.resources = []
        self.ids = set()
        self.styles = []
        self.main_count = self.h1_count = 0
        self.doctype = False
        self._in_title = self._in_style = False
        self.feed(html)

    def handle_decl(self, decl):
        self.doctype |= decl.lower() == "doctype html"

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == "base":
            raise SystemExit("Unexpected base URL in static customer page")
        if values.get("id"):
            self.ids.add(values["id"])
        if tag == "a" and values.get("name"):
            self.ids.add(values["name"])
        self.main_count += tag == "main"
        self.h1_count += tag == "h1"
        if tag == "title": self._in_title = True
        if tag == "style": self._in_style = True
        if values.get("style"): self.styles.append(values["style"])
        if tag in {"a", "area"} and "href" in values:
            self.links.append(values["href"] or "")
        if tag == "form" and "action" in values:
            self.links.append(values["action"] or "")
        if tag == "link":
            rels = set((values.get("rel") or "").lower().split())
            if "canonical" in rels: self.canonicals.append(values.get("href") or "")
            if rels & RESOURCE_RELS: self.resources.append(values.get("href") or "")
        for attr in ("src", "poster"):
            if values.get(attr): self.resources.append(values[attr])
        for attr in ("srcset", "imagesrcset"):
            if values.get(attr):
                self.resources.extend(part.strip().split()[0] for part in values[attr].split(",") if part.strip())
        if tag == "meta" and (values.get("property") or values.get("name")) in {"og:image", "twitter:image"}:
            self.resources.append(values.get("content") or "")

    def handle_endtag(self, tag):
        if tag == "title": self._in_title = False
        if tag == "style": self._in_style = False

    def handle_data(self, data):
        if self._in_title: self.title += data
        if self._in_style: self.styles.append(data)

def contained_path(root: Path, relative: str) -> Path:
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise SystemExit(f"Path escapes static root: {relative}")
    return path

def local_reference(root: Path, page_path: Path, ref: str):
    base = ORIGIN + "/" + page_path.relative_to(root).as_posix()
    url = urlsplit(urljoin(base, ref))
    if url.scheme in {"mailto", "tel", "data", "blob"}: return None
    if url.scheme not in {"http", "https"}:
        raise SystemExit(f"Unsupported static reference: {ref}")
    if url.netloc != urlsplit(ORIGIN).netloc: return None
    path = contained_path(root, unquote(url.path).lstrip("/"))
    if path.is_dir(): path /= "index.html"
    return path, unquote(url.fragment)

def read_page(path: Path) -> Page:
    html = path.read_text(encoding="utf-8")
    if LOCAL_REF_RE.search(html):
        raise SystemExit(f"Local machine reference in {path.name}")
    return Page(html)

def check_identity(page: Page, title: str, canonical: str) -> None:
    if page.title.strip() != title or page.canonicals != [canonical]:
        raise SystemExit(f"Page title/canonical mismatch: {canonical}")
    if not page.doctype or page.main_count != 1 or page.h1_count != 1:
        raise SystemExit(f"Expected HTML document with one main and h1: {canonical}")

def check_local_links(root: Path, path: Path, page: Page) -> None:
    for ref in page.links:
        target = local_reference(root, path, ref)
        if target is None: continue
        destination, fragment = target
        if not destination.is_file():
            raise SystemExit(f"Dangling local link in {path.relative_to(root)}: {ref}")
        if fragment and destination.suffix.lower() == ".html":
            ids = page.ids if destination == path else read_page(destination).ids
            if fragment not in ids:
                raise SystemExit(f"Missing link fragment in {path.relative_to(root)}: {ref}")

def collect_local_assets(root: Path, path: Path, page: Page) -> set[str]:
    """Include CSS dependencies and share images as well as visible media."""
    pending = [(path, ref) for ref in page.resources]
    for style in page.styles:
        pending.extend((path, a or b) for a, b in CSS_URL.findall(style))
    assets = set()
    while pending:
        source, ref = pending.pop()
        if ref.startswith(("data:", "blob:", "#")): continue
        target = local_reference(root, source, ref)
        if target is None: raise SystemExit(f"Remote resource dependency: {ref}")
        asset, _ = target
        if not asset.is_file(): raise SystemExit(f"Missing local resource: {ref}")
        name = asset.relative_to(root).as_posix()
        if name in assets: continue
        assets.add(name)
        if asset.suffix.lower() == ".css":
            css = asset.read_text(encoding="utf-8")
            if LOCAL_REF_RE.search(css): raise SystemExit(f"Local machine reference in {name}")
            pending.extend((asset, a or b) for a, b in CSS_URL.findall(css))
    return assets

def canonical_bytes(path: Path) -> bytes:
    raw = path.read_bytes()
    return raw.replace(b"\r\n", b"\n") if path.suffix.lower() in TEXT_SUFFIXES else raw

def check_frozen_row(root: Path, row: dict) -> int:
    path = contained_path(root, str(row["relative_path"]))
    if not path.is_file(): raise SystemExit(f"Missing frozen file: {row['relative_path']}")
    data = canonical_bytes(path)
    if len(data) != row["bytes"] or hashlib.sha256(data).hexdigest() != row["sha256"]:
        raise SystemExit(f"Canonical size/hash mismatch: {row['relative_path']}")
    return len(data)

def check_asset_manifest(root: Path, rows: list[dict], references: set[str]) -> int:
    names = [str(row["relative_path"]) for row in rows]
    if len(names) != len(set(names)): raise SystemExit("Duplicate resource manifest entry")
    if set(names) != references:
        raise SystemExit(f"Resource manifest coverage mismatch: missing={sorted(references-set(names))}, unused={sorted(set(names)-references)}")
    return sum(check_frozen_row(root, row) for row in rows)

def main() -> None:
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if payload.get("schema") != "nsp.always-on-home-freeze.v1":
        raise SystemExit("Unexpected or missing home-freeze schema")
    if payload["index"]["relative_path"] != "index.html":
        raise SystemExit("Home manifest must freeze index.html")
    check_frozen_row(ROOT, payload["index"])
    path = ROOT / "index.html"
    page = read_page(path)
    check_identity(page, "NorthStar Prime — Music, Games & Films", ORIGIN + "/")
    required = {"/idr/", "/arcade/", "/idc-programming/", "/access/", "/mystery-school/", "/hire/", "/contact/", "/literature/", "/stickerforge/", "/store/", "/links/", "/renalshield/"}
    if not required.issubset(page.links):
        raise SystemExit(f"Missing customer destination: {sorted(required-set(page.links))}")
    check_local_links(ROOT, path, page)
    assets = payload.get("assets", [])
    total = check_asset_manifest(ROOT, assets, collect_local_assets(ROOT, path, page))
    if len(assets) != payload.get("referenced_asset_count") or total != payload.get("referenced_asset_bytes"):
        raise SystemExit("Homepage resource totals do not match manifest")
    print("OK: customer homepage identity and local destinations")
    print(f"OK: {len(assets)} referenced resources / {total} frozen bytes")

if __name__ == "__main__":
    main()
