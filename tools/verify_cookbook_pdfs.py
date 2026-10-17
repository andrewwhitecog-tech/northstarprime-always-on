#!/usr/bin/env python3
"""Check the two cookbook PDFs against their web editions. Prints PASS or FAIL per
check and exits non-zero on any FAIL.

Everything the PDFs are compared with (chapter labels, plate captions, the closing
block, the reader notice, the licence line, the title) is read from the HTML at the
moment of the run.

    C:\\Python314\\python.exe tools\\verify_cookbook_pdfs.py
"""
from __future__ import annotations

import html as htmllib
import pathlib
import re
import sys
import unicodedata

import fitz
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[1]
DOWNLOADS = ROOT / "static" / "downloads"
AUTHOR = "Andrew White Jr., NorthStar Prime"
MB = 1_000_000
OVERLAP_SHARE = 1 / 3

BOOKS = {
    "classic": ("Digital_MasterCook_Book_Freeware_v09.html", "Digital_MasterCook_Book_Freeware_v09.pdf", 8 * MB),
    "deluxe": ("Digital_MasterCook_Deluxe_Illustrated_Edition.html",
               "Digital_MasterCook_Deluxe_Illustrated_Edition.pdf", 32 * MB),
}

failures = 0


def report(ok: bool, book: str, check: str, detail: str) -> None:
    global failures
    if not ok:
        failures += 1
    print(f"{'PASS' if ok else 'FAIL'}  [{book}] {check}: {detail}", flush=True)


def squash(text: str) -> str:
    """Compare text the way it prints: compatibility forms folded, upper case, no whitespace."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", text)).upper()


def visible_text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


# ---------- what the HTML says ----------

class Source:
    def __init__(self, path: pathlib.Path):
        raw = path.read_text(encoding="utf-8")
        self.soup = BeautifulSoup(raw, "lxml")
        title = re.search(r"<title>(.*?)</title>", raw, re.S | re.I)
        self.title = htmllib.unescape(title.group(1)).split(" | ")[0].strip() if title else ""
        self.img_count = len(self.soup.find_all("img"))
        self.labels = [visible_text(e) for e in self.soup.select(".chapter > .ch-label, .appendix > .ch-label")]
        self.appendix_labels = [visible_text(e) for e in self.soup.select(".appendix > .ch-label")]
        self.captions = [visible_text(e) for e in self.soup.select("figure.deluxe-plate-figure .deluxe-plate-caption")]
        self.plates = len(self.soup.select("figure.deluxe-plate-figure"))
        self.closing = self._closing_lines()
        self.notice_lead, self.caution, self.notice_full = self._notice()
        self.licence = self._licence_line()

    def _closing_lines(self) -> list[str]:
        appendices = self.soup.select("body > .appendix")
        if not appendices:
            return []
        lines = []
        for sib in appendices[-1].find_next_siblings():
            if sib.name in ("script", "style") or "no-print" in (sib.get("class") or []):
                continue
            for child in sib.find_all(class_="no-print"):
                child.decompose()
            lines += [ln for ln in (visible_text(BeautifulSoup(part, "lxml"))
                                    for part in re.split(r"<br\s*/?>|</div>|</p>", str(sib))) if ln]
        return lines

    def _notice(self) -> tuple[str, str, str]:
        node = self.soup.select_one("#reader-notice") or self.soup.select_one("body aside")
        if node is None:
            return "", "", ""
        lead_node = node.find(["strong", "b"])
        lead = visible_text(lead_node) if lead_node else ""
        full = visible_text(node)
        rest = full[len(lead):].strip() if lead and full.startswith(lead) else full
        first = re.match(r"(.+?[.!?])(\s|$)", rest)
        return lead, (first.group(1) if first else rest), full

    def _licence_line(self) -> str:
        cover = self.soup.select_one(".cover")
        if cover is None:
            return ""
        for part in re.split(r"<br\s*/?>", str(cover)):
            line = visible_text(BeautifulSoup(part, "lxml"))
            if re.search(r"(?i)freeware:|licen[cs]e|free to read", line):
                return line
        return ""


# ---------- what the PDF says ----------

class Printed:
    def __init__(self, path: pathlib.Path):
        self.doc = fitz.open(path)
        self.pages = self.doc.page_count
        # one stream of squashed text, with the page each character came from
        self.stream = []
        self.stream_page = []
        self.lines = []  # (page index, squashed line text, bbox)
        for pno, page in enumerate(self.doc):
            for block in page.get_text("dict")["blocks"]:
                for line in block.get("lines", []):
                    text = "".join(s["text"] for s in line["spans"])
                    sq = squash(text)
                    if not sq:
                        continue
                    self.lines.append((pno, sq, fitz.Rect(line["bbox"]), line))
                    self.stream.append(sq)
                    self.stream_page += [pno] * len(sq)
        self.stream = "".join(self.stream)
        # Chromium draws rounded picture corners through a grey mask image with no
        # xref of its own; only image objects with an xref are pictures.
        self.all_images = [page.get_image_info(xrefs=True) for page in self.doc]
        self.images = [[im for im in imgs if im["xref"] > 0 and fitz.Rect(im["bbox"]).get_area() > 100]
                       for imgs in self.all_images]

    def find_in_order(self, needles: list[str], start: int = 0) -> list[tuple[str, int | None, int | None]]:
        """Find each needle after the previous one; returns (needle, stream offset, page)."""
        found, pos = [], start
        for needle in needles:
            sq = squash(needle)
            at = self.stream.find(sq, pos) if sq else -1
            if at < 0:
                found.append((needle, None, None))
                continue
            found.append((needle, at, self.stream_page[at]))
            pos = at + len(sq)
        return found

    def find_labels(self, labels: list[str]) -> list[tuple[str, int | None, int | None]]:
        """A label must be a printed line of its own (or up to three consecutive lines)."""
        found, i = [], 0
        for label in labels:
            want = squash(label)
            hit = None
            for j in range(i, len(self.lines)):
                joined = ""
                for k in range(j, min(j + 3, len(self.lines))):
                    joined += self.lines[k][1]
                    if joined == want:
                        hit = (j, k)
                        break
                    if not want.startswith(joined):
                        break
                if hit:
                    break
            if hit is None:
                found.append((label, None, None))
                continue
            j, k = hit
            offset = sum(len(t[1]) for t in self.lines[:j])
            found.append((label, offset, self.lines[j][0]))
            i = k + 1
        return found


def overlapping_lines(page: fitz.Page) -> list[tuple[str, str, float]]:
    """Pairs of text lines whose boxes overlap vertically by more than a third of a line height."""
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"]).strip()
            if text:
                lines.append((fitz.Rect(line["bbox"]), text))
    lines.sort(key=lambda t: t[0].y0)
    hits = []
    for a in range(len(lines)):
        ra, ta = lines[a]
        for b in range(a + 1, len(lines)):
            rb, tb = lines[b]
            if rb.y0 >= ra.y1:
                break
            if min(ra.x1, rb.x1) - max(ra.x0, rb.x0) <= 1.0:
                continue
            v = min(ra.y1, rb.y1) - max(ra.y0, rb.y0)
            if v > OVERLAP_SHARE * min(ra.height, rb.height):
                hits.append((ta, tb, v / min(ra.height, rb.height)))
    return hits


def painted_check(pdf: Printed, dpi: int = 40, min_stddev: float = 6.0) -> list[str]:
    """Placements whose centre renders flat, i.e. an empty box where a picture should be."""
    flat = []
    for pno, imgs in enumerate(pdf.images):
        if not imgs:
            continue
        page = pdf.doc[pno]
        pix = page.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
        scale = dpi / 72
        for im in imgs:
            box = fitz.Rect(im["bbox"]) & page.rect
            if box.is_empty:
                flat.append(f"page {pno + 1}: picture entirely off the page")
                continue
            cx, cy, w, h = (box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, box.width / 4, box.height / 4
            x0, x1 = int((cx - w) * scale), max(int((cx + w) * scale), int((cx - w) * scale) + 1)
            y0, y1 = int((cy - h) * scale), max(int((cy + h) * scale), int((cy - h) * scale) + 1)
            values = [pix.samples[y * pix.stride + x] for y in range(y0, min(y1, pix.height))
                      for x in range(x0, min(x1, pix.width))]
            if not values:
                continue
            mean = sum(values) / len(values)
            std = (sum((v - mean) ** 2 for v in values) / len(values)) ** 0.5
            if std < min_stddev:
                flat.append(f"page {pno + 1}: grey std dev {std:.1f}")
    return flat


def overlap_selftest() -> None:
    doc = fitz.open()
    bad = doc.new_page()
    bad.insert_text((72, 100), "First line of a recipe printed here", fontsize=10)
    bad.insert_text((80, 104), "Second line printed over the first", fontsize=10)
    good = doc.new_page()
    for n in range(20):
        good.insert_text((72, 100 + n * 13), f"Line {n} of ordinary body text", fontsize=10)
        good.insert_text((320, 100 + n * 13), f"Column two line {n}", fontsize=10)
    caught, clean = overlapping_lines(doc[0]), overlapping_lines(doc[1])
    report(bool(caught) and not clean, "self-test", "overlap detector",
           f"synthetic overprinted page flagged {len(caught)} pair(s); clean two-column page flagged {len(clean)}")


# ---------- checks ----------

def check_book(name: str) -> None:
    html_name, pdf_name, budget = BOOKS[name]
    pdf_path = DOWNLOADS / pdf_name
    if not pdf_path.exists():
        report(False, name, "PDF exists", f"{pdf_name} is missing")
        return
    src = Source(DOWNLOADS / html_name)
    pdf = Printed(pdf_path)
    size = pdf_path.stat().st_size

    report(pdf.pages > 0 and size <= budget, name, "pages and size",
           f"{pdf.pages} pages, {size:,} bytes ({size / MB:.2f} MB) against a {budget / MB:.0f} MB budget")

    meta = pdf.doc.metadata or {}
    report(meta.get("author") == AUTHOR, name, "author field", repr(meta.get("author")))
    report(meta.get("title") == src.title, name, "title field", f"{meta.get('title')!r} (HTML title {src.title!r})")

    drawn = sum(len(p) for p in pdf.images)
    masks = sum(len(p) for p in pdf.all_images) - drawn
    distinct = len({im["xref"] for p in pdf.images for im in p})
    report(drawn >= src.img_count, name, "pictures drawn",
           f"{drawn} picture placements ({distinct} distinct pictures; {masks} corner masks not counted) "
           f"for {src.img_count} <img> in the HTML")

    blank = painted_check(pdf)
    report(not blank, name, "pictures visibly painted",
           f"centre of each of {drawn} placements rasterised at 40 dpi"
           + (f"; flat (empty-box) placements: {'; '.join(blank[:8])}" if blank else "; none flat"))

    if name == "deluxe":
        report(drawn >= src.plates, name, "plate placements",
               f"{drawn} picture placements for {src.plates} plates in the HTML")
        hits = pdf.find_in_order(src.captions)
        missing = [c for c, at, _ in hits if at is None]
        report(not missing, name, "plate captions printed",
               f"{len(src.captions) - len(missing)} of {len(src.captions)} captions found in order"
               + (f"; first missing: {missing[0]!r}" if missing else ""))
        per_page = {}
        for _, at, pno in hits:
            if pno is not None:
                per_page[pno] = per_page.get(pno, 0) + 1
        orphans = []
        for pno, n in sorted(per_page.items()):
            here = len(pdf.images[pno])
            before = len(pdf.images[pno - 1]) if pno > 0 else 0
            if here + before == 0 or n > here + before:
                orphans.append(f"page {pno + 1}: {n} caption(s), {here} picture(s) here, {before} on the page before")
        report(not orphans, name, "every caption has its picture",
               f"{len(per_page)} pages carry captions; "
               + ("each has pictures on that page or the page before, at least one per caption"
                  if not orphans else "; ".join(orphans[:10])))

    labels = pdf.find_labels(src.labels)
    lost = [lab for lab, at, _ in labels if at is None]
    report(not lost and len(src.labels) > 0, name, "chapter labels in order",
           f"{len(src.labels) - len(lost)} of {len(src.labels)} labels from the HTML found in the same order"
           + (f"; missing or out of order: {lost[:6]}" if lost else
              f"; first on page {labels[0][2] + 1}, last on page {labels[-1][2] + 1}"))

    app = [(lab, at, pno) for lab, at, pno in labels if lab in src.appendix_labels]
    report(len(src.appendix_labels) == 3 and all(at is not None for _, at, _ in app), name, "three appendices",
           ", ".join(f"{lab!r} p{pno + 1}" if pno is not None else f"{lab!r} MISSING" for lab, _, pno in app)
           or "no appendix labels in the HTML")

    last_label_at = max((at for _, at, _ in labels if at is not None), default=0)
    closing = pdf.find_in_order(src.closing, start=last_label_at)
    gone = [c for c, at, _ in closing if at is None]
    end_page = closing[-1][2] if closing and closing[-1][2] is not None else None
    report(bool(src.closing) and not gone and end_page == pdf.pages - 1, name, "closing page",
           f"{len(src.closing) - len(gone)} of {len(src.closing)} closing lines found after the last appendix"
           + (f", ending on page {end_page + 1} of {pdf.pages}" if end_page is not None else "")
           + (f"; missing: {gone}" if gone else ""))

    overlaps = []
    for pno, page in enumerate(pdf.doc):
        for ta, tb, share in overlapping_lines(page):
            overlaps.append(f"page {pno + 1}: {ta[:30]!r} / {tb[:30]!r} ({share:.0%} of a line)")
    report(not overlaps, name, "no overlapping text lines",
           f"{pdf.pages} pages scanned" + (f"; {len(overlaps)} overlaps: " + "; ".join(overlaps[:8]) if overlaps else ""))

    page1 = squash(pdf.doc[0].get_text())
    caution = f"{src.notice_lead} {src.caution}".strip()
    report(bool(src.caution) and squash(caution) in page1, name, "page 1 caution sentence",
           f"{caution[:90]!r}...")
    report(bool(src.notice_full) and squash(src.notice_full) in page1, name, "page 1 whole reader notice",
           f"{len(src.notice_full)} characters of the HTML's reader notice")
    report(bool(src.licence) and squash(src.licence) in page1, name, "page 1 licence line",
           f"{src.licence[:60]!r}...")

    fonts = sorted({f[3] for pno in range(pdf.pages) for f in pdf.doc.get_page_fonts(pno)})
    print(f"INFO  [{name}] fonts embedded ({len(fonts)}): {', '.join(fonts)}")
    pdf.doc.close()


def main() -> int:
    overlap_selftest()
    for name in BOOKS:
        check_book(name)
    print(f"{'ALL PASS' if failures == 0 else f'{failures} FAIL'}", flush=True)
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
