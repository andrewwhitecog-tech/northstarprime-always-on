#!/usr/bin/env python3
"""Rebuild the two cookbook PDFs from their web editions, with every picture loaded.

Serves the repository root on 127.0.0.1 for the length of the run, loads each web
edition over http so that site-root picture addresses resolve, forces every picture
to load, prints with the page's own print style, and stamps title and author.

Pictures are served to the page as smaller JPEG copies held in memory, so the PDFs
stay inside their size budgets; nothing in the repository is changed and no copy is
written to disk. If a finished PDF is over budget the book is rendered again one
step smaller.

A file the HEAD commit tracks but that is absent from this checkout (sparse
checkout, blob-less clone) is served from a --fallback-root folder only when its
bytes hash to the blob id HEAD records for that path.

Three print corrections are applied on top of the page's print style; see
PRINT_CORRECTIONS_CSS. --no-corrections turns them off.

    C:\\Python314\\python.exe tools\\render_cookbook_pdfs.py [--book classic|deluxe]
        [--fallback-root DIR ...] [--no-corrections]
"""
from __future__ import annotations

import argparse
import concurrent.futures
import ctypes
import functools
import hashlib
import html
import http.server
import io
import os
import pathlib
import re
import subprocess
import sys
import threading
import time
import urllib.parse

import pypdf
from PIL import Image, ImageOps
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / "static" / "downloads"
AUTHOR = "Andrew White Jr., NorthStar Prime"
MB = 1_000_000

BOOKS = {
    "classic": {
        "html": "Digital_MasterCook_Book_Freeware_v09.html",
        "pdf": "Digital_MasterCook_Book_Freeware_v09.pdf",
        "budget": 8 * MB,
    },
    "deluxe": {
        "html": "Digital_MasterCook_Deluxe_Illustrated_Edition.html",
        "pdf": "Digital_MasterCook_Deluxe_Illustrated_Edition.pdf",
        "budget": 32 * MB,
    },
}

# (longest side in px, JPEG quality), largest first.
LADDER = [(1000, 75), (900, 74), (800, 72), (720, 70), (640, 68), (560, 66)]
IMAGE_EXTS = {".webp", ".png", ".jpg", ".jpeg", ".gif"}
CREATE_NO_WINDOW = 0x08000000
BELOW_NORMAL_PRIORITY_CLASS = 0x00004000
PICTURE_TIMEOUT_MS = 300_000


def log(msg: str) -> None:
    print(msg, flush=True)


def lower_priority() -> None:
    if os.name == "nt":
        handle = ctypes.windll.kernel32.GetCurrentProcess()
        ctypes.windll.kernel32.SetPriorityClass(handle, BELOW_NORMAL_PRIORITY_CLASS)


def git(*args: str) -> str:
    env = dict(os.environ, GIT_NO_LAZY_FETCH="1")
    result = subprocess.run(
        ["git", "-c", "gc.auto=0", *args],
        cwd=ROOT, env=env, capture_output=True, text=True,
        creationflags=CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip())
    return result.stdout


@functools.lru_cache(maxsize=1)
def head_blobs() -> dict[str, str]:
    """Map repo-relative path -> blob id for every file HEAD tracks."""
    try:
        listing = git("ls-tree", "-r", "-z", "HEAD")
    except (OSError, RuntimeError):
        return {}
    blobs = {}
    for entry in listing.split("\0"):
        if not entry:
            continue
        meta, path = entry.split("\t", 1)
        mode, kind, oid = meta.split()
        if kind == "blob":
            blobs[path] = oid
    return blobs


def blob_id(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


class SiteFiles:
    """Resolves a site path to file bytes: the checkout first, then verified fallbacks."""

    def __init__(self, fallback_roots: list[pathlib.Path]):
        self.fallback_roots = fallback_roots
        self.from_fallback: dict[str, pathlib.Path] = {}
        self.missing: set[str] = set()
        self.lock = threading.Lock()

    def read(self, rel: str) -> bytes | None:
        local = (ROOT / rel).resolve()
        if ROOT not in local.parents:
            return None
        if local.is_file():
            return local.read_bytes()
        oid = head_blobs().get(rel)
        if oid:
            for base in self.fallback_roots:
                candidate = base / rel
                if candidate.is_file():
                    data = candidate.read_bytes()
                    if blob_id(data) == oid:
                        with self.lock:
                            self.from_fallback[rel] = candidate
                        return data
        with self.lock:
            self.missing.add(rel)
        return None


def shrink(data: bytes, long_side: int, quality: int) -> bytes:
    with Image.open(io.BytesIO(data)) as im:
        im = ImageOps.exif_transpose(im)
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            flat = Image.new("RGB", im.size, (255, 255, 255))
            flat.paste(im, mask=im.getchannel("A"))
            im = flat
        else:
            im = im.convert("RGB")
        im.thumbnail((long_side, long_side), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, "JPEG", quality=quality, optimize=True)
        return out.getvalue()


class PictureCache:
    """Smaller JPEG copies of pictures, held in memory for one setting."""

    def __init__(self, files: SiteFiles):
        self.files = files
        self.setting = LADDER[0]
        self.cache: dict[str, bytes] = {}
        self.lock = threading.Lock()

    def use(self, setting: tuple[int, int]) -> None:
        with self.lock:
            if setting != self.setting:
                self.cache.clear()
            self.setting = setting

    def get(self, rel: str) -> bytes | None:
        with self.lock:
            hit = self.cache.get(rel)
            setting = self.setting
        if hit is not None:
            return hit
        data = self.files.read(rel)
        if data is None:
            return None
        small = shrink(data, *setting)
        with self.lock:
            if self.setting == setting:
                self.cache[rel] = small
        return small

    def preload(self, rels: list[str]) -> int:
        with concurrent.futures.ThreadPoolExecutor(max_workers=os.cpu_count() or 4) as pool:
            sizes = list(pool.map(lambda r: len(self.get(r) or b""), rels))
        return sum(sizes)


def make_handler(files: SiteFiles, pictures: PictureCache):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, *args):  # keep the run's output readable
            pass

        def do_GET(self):
            path = urllib.parse.unquote(urllib.parse.urlsplit(self.path).path)
            rel = path.lstrip("/")
            suffix = pathlib.PurePosixPath(rel).suffix.lower()
            try:
                if suffix in IMAGE_EXTS:
                    body, ctype = pictures.get(rel), "image/jpeg"
                else:
                    body = files.read(rel)
                    ctype = {
                        ".html": "text/html; charset=utf-8",
                        ".css": "text/css",
                        ".js": "text/javascript",
                        ".svg": "image/svg+xml",
                        ".woff2": "font/woff2",
                        ".woff": "font/woff",
                        ".ttf": "font/ttf",
                    }.get(suffix, "application/octet-stream")
            except Exception as exc:  # a picture that will not decode
                log(f"  server error for {rel}: {exc}")
                self.send_error(500)
                return
            if body is None:
                self.send_error(404)
                return
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

    return Handler


class LocalSite:
    def __init__(self, files: SiteFiles, pictures: PictureCache):
        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), make_handler(files, pictures))
        self.server.daemon_threads = True
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=10)


def book_title(html_text: str) -> str:
    match = re.search(r"<title>(.*?)</title>", html_text, re.S | re.I)
    if not match:
        raise SystemExit("FAIL: the HTML has no <title>")
    return html.unescape(match.group(1)).split(" | ")[0].strip()


def picture_paths(html_text: str, page_rel: str) -> list[str]:
    """Repo-relative paths of every <img> in the HTML, resolved against the page."""
    base = "http://site/" + page_rel
    rels = []
    for src in re.findall(r"<img\b[^>]*?\bsrc=\"([^\"]+)\"", html_text, re.I):
        url = urllib.parse.urljoin(base, html.unescape(src))
        parts = urllib.parse.urlsplit(url)
        if parts.netloc == "site":
            rels.append(urllib.parse.unquote(parts.path).lstrip("/"))
    return sorted(set(rels))


# Print corrections for faults in the web editions' own print style. Each one is
# logged with what it touched; --no-corrections prints with the page style alone.
#  1. The print style hides every .rc recipe card and re-shows them only in the
#     chapters it names; a chapter whose recipes exist only as cards would print
#     without its recipes. Such cards are shown, styled like the named chapters' cards.
#  2. .rc-head is a "1fr auto" grid and .rc-meta is nowrap, so a long nutrition
#     line squeezes the title to one word per line and runs into the next column.
#  3. .photo-credit is hidden in print, which drops the AI-generated-photo note
#     printed under each picture on screen. Credits directly after a picture print.
PRINT_CORRECTIONS_CSS = """@media print {
  .rc.print-restored {
    display: block !important;
    background: #fdfcf8 !important;
    border: 1px solid #ddd !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    margin: 0.15in 0 !important;
    padding: 0.1in !important;
  }
  .rc-head { display: block !important; }
  .rc-meta { white-space: normal !important; text-align: left !important; margin-top: 3pt !important; }
  .rc-meta-row { justify-content: flex-start !important; }
  figure + .photo-credit, img + .photo-credit {
    display: block !important;
    margin: 0 0 6pt !important;
    font-size: 6.5pt !important;
    color: #555 !important;
    text-align: center !important;
  }
}"""

MARK_CARD_ONLY_CHAPTERS = """() => {
  const restored = [];
  for (const ch of document.querySelectorAll('.chapter, .appendix')) {
    const hidden = Array.from(ch.querySelectorAll('.rc')).filter(r => getComputedStyle(r).display === 'none');
    if (!hidden.length) continue;
    const longForm = Array.from(ch.querySelectorAll('h2'))
      .some(h => !h.closest('.rc') && getComputedStyle(h).display !== 'none');
    if (longForm) continue;
    hidden.forEach(r => r.classList.add('print-restored'));
    restored.push(`${ch.id}: ${hidden.length} cards`);
  }
  const credits = document.querySelectorAll('figure + .photo-credit, img + .photo-credit').length;
  return {restored, credits};
}"""

ALL_PICTURES_LOADED = """() => {
  const imgs = Array.from(document.images);
  return imgs.length > 0 && imgs.every(i => i.complete && i.naturalWidth > 0);
}"""

PICTURES_NOT_LOADED = """() => Array.from(document.images)
  .filter(i => !(i.complete && i.naturalWidth > 0))
  .map(i => i.getAttribute('src'))"""


def print_book(browser, url: str, out_pdf: pathlib.Path, expected_imgs: int, corrections: bool) -> dict:
    page = browser.new_page(viewport={"width": 1200, "height": 1600})
    try:
        page.goto(url, wait_until="load", timeout=PICTURE_TIMEOUT_MS)
        count = page.evaluate("""() => {
          const imgs = Array.from(document.images);
          imgs.forEach(i => { i.loading = 'eager'; i.setAttribute('loading', 'eager'); });
          return imgs.length;
        }""")
        if count != expected_imgs:
            raise SystemExit(f"FAIL: page has {count} pictures, HTML source has {expected_imgs} <img> tags")
        try:
            page.wait_for_function(ALL_PICTURES_LOADED, timeout=PICTURE_TIMEOUT_MS, polling=500)
        except Exception:
            failed = page.evaluate(PICTURES_NOT_LOADED)
            sample = "\n    ".join(failed[:20])
            raise SystemExit(f"FAIL: {len(failed)} of {count} pictures did not load:\n    {sample}")
        page.evaluate("() => Promise.all(Array.from(document.images).map(i => i.decode().catch(() => null)))")
        fonts = page.evaluate("""async () => {
          await document.fonts.ready;
          return Array.from(document.fonts).map(f => f.family + ' ' + f.status);
        }""")
        page.emulate_media(media="print")
        applied = None
        if corrections:
            applied = page.evaluate(MARK_CARD_ONLY_CHAPTERS)
            page.add_style_tag(content=PRINT_CORRECTIONS_CSS)
        page.wait_for_timeout(1500)
        page.pdf(path=str(out_pdf), prefer_css_page_size=True, print_background=True)
        return {"pictures": count, "web_fonts": fonts, "corrections": applied}
    finally:
        page.close()


def stamp(raw_pdf: pathlib.Path, final_pdf: pathlib.Path, title: str) -> int:
    reader = pypdf.PdfReader(str(raw_pdf))
    writer = pypdf.PdfWriter(clone_from=reader)
    writer.add_metadata({"/Title": title, "/Author": AUTHOR})
    tmp = final_pdf.with_name(final_pdf.name + ".part")
    try:
        with open(tmp, "wb") as fh:
            writer.write(fh)
        os.replace(tmp, final_pdf)
    finally:
        if tmp.exists():
            tmp.unlink()
    return len(reader.pages)


def build(name: str, browser, port: int, pictures: PictureCache, files: SiteFiles, corrections: bool,
          out_dir: pathlib.Path) -> dict:
    spec = BOOKS[name]
    html_path = DOWNLOADS / spec["html"]
    pdf_path = out_dir / spec["pdf"]
    page_rel = html_path.relative_to(ROOT).as_posix()
    html_text = html_path.read_text(encoding="utf-8")
    title = book_title(html_text)
    imgs = len(re.findall(r"<img\b", html_text, re.I))
    rels = picture_paths(html_text, page_rel)
    url = f"http://127.0.0.1:{port}/{page_rel}"
    log(f"[{name}] {spec['html']}: {imgs} pictures ({len(rels)} distinct files), budget {spec['budget'] / MB:.0f} MB")
    log(f"[{name}] title: {title}")

    raw = pdf_path.with_name(pdf_path.name + ".raw")
    overhead = 0  # PDF bytes beyond the pictures, learned from the first print
    try:
        for step, setting in enumerate(LADDER):
            pictures.use(setting)
            started = time.time()
            served = pictures.preload(rels)
            if files.missing & set(rels):
                gone = sorted(files.missing & set(rels))
                raise SystemExit(
                    f"FAIL: {len(gone)} pictures are not in this checkout and no verified fallback had them:\n    "
                    + "\n    ".join(gone[:20])
                    + "\n  Pass --fallback-root <folder holding static/...> to serve HEAD-identical copies."
                )
            log(f"[{name}] pictures at {setting[0]} px, quality {setting[1]}: {served / MB:.1f} MB "
                f"prepared in {time.time() - started:.0f}s")
            if served + overhead > spec["budget"] and step < len(LADDER) - 1:
                log(f"[{name}] {served / MB:.1f} MB of pictures + {overhead / MB:.1f} MB of other PDF content "
                    f"exceeds the budget; stepping down")
                continue
            started = time.time()
            info = print_book(browser, url, raw, imgs, corrections)
            size = raw.stat().st_size
            overhead = max(overhead, size - served)
            pages = stamp(raw, pdf_path, title)
            size = pdf_path.stat().st_size
            log(f"[{name}] printed {pages} pages, {size:,} bytes ({size / MB:.2f} MB) in {time.time() - started:.0f}s; "
                f"all {info['pictures']} pictures loaded; web fonts loaded: {info['web_fonts'] or 'none declared'}")
            fixes = info["corrections"]
            if fixes is None:
                log(f"[{name}] print corrections: off")
            else:
                log(f"[{name}] print corrections: recipe-card header stacked; "
                    f"cards restored in card-only chapters: {', '.join(fixes['restored']) or 'none'}; "
                    f"photo credits under pictures printed: {fixes['credits']}")
            if size <= spec["budget"]:
                return {"book": name, "pdf": pdf_path, "pages": pages, "bytes": size, "setting": setting}
            log(f"[{name}] {size / MB:.2f} MB is over the {spec['budget'] / MB:.0f} MB budget; stepping down")
        raise SystemExit(f"FAIL: {name} stays over budget at the smallest picture setting {LADDER[-1]}")
    finally:
        if raw.exists():
            raw.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--book", choices=sorted(BOOKS), action="append",
                        help="build only this book (repeatable); default both")
    parser.add_argument("--fallback-root", action="append", default=[], type=pathlib.Path,
                        help="checkout folder holding HEAD-identical copies of files absent here (repeatable)")
    parser.add_argument("--no-corrections", action="store_true",
                        help="print with the page's own print style only (see PRINT_CORRECTIONS_CSS)")
    parser.add_argument("--out-dir", type=pathlib.Path, default=DOWNLOADS,
                        help="write the PDFs here instead of static/downloads")
    args = parser.parse_args()
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    lower_priority()

    files = SiteFiles([p.resolve() for p in args.fallback_root])
    pictures = PictureCache(files)
    results = []
    with LocalSite(files, pictures) as site:
        log(f"serving {ROOT} on http://127.0.0.1:{site.port}/")
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            try:
                for name in args.book or ["classic", "deluxe"]:
                    results.append(build(name, browser, site.port, pictures, files, not args.no_corrections, out_dir))
            finally:
                browser.close()
    log("local server stopped")

    for rel, src in sorted(files.from_fallback.items()):
        log(f"served from verified fallback (blob id matches HEAD): {rel} <- {src}")
    if files.missing:
        log(f"not found by the server (404): {', '.join(sorted(files.missing))}")
    for r in results:
        log(f"DONE {r['book']}: {r['pdf'].as_posix()} {r['pages']} pages, "
            f"{r['bytes']:,} bytes, pictures at {r['setting'][0]} px q{r['setting'][1]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
