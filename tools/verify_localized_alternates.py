"""Validate reciprocal locale alternates against actual HTML and sitemap files."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin
import argparse
import sys
import xml.etree.ElementTree as ET

ORIGIN = "https://northstarprime.net/"
LOCALES = {"en": "", "es": "es", "ru": "ru", "ko": "ko", "zh-Hans": "zh", "cs": "cs", "ja": "ja"}
FAMILIES = ("", "contact", "hire", "portfolio")

class HeadLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.alternates = []
        self.canonicals = []
    def handle_starttag(self, tag, attrs):
        if tag != "link":
            return
        attrs = dict(attrs)
        rel = attrs.get("rel", "").split()
        if "alternate" in rel and "hreflang" in attrs:
            self.alternates.append((attrs["hreflang"], attrs.get("href", "")))
        if "canonical" in rel:
            self.canonicals.append(attrs.get("href", ""))

def page_url(locale, family):
    parts = [part for part in (LOCALES[locale], family) if part]
    return ORIGIN + ("/".join(parts) + "/" if parts else "")

def validate(root):
    errors = []
    tree = ET.parse(root / "sitemap.xml")
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
    sitemap = {node.findtext("s:loc", namespaces=ns): node for node in tree.findall("s:url", ns)}
    count = 0
    for family in FAMILIES:
        expected = {lang: page_url(lang, family) for lang in LOCALES}
        expected["x-default"] = expected["en"]
        for lang, prefix in LOCALES.items():
            path = root.joinpath(*[p for p in (prefix, family, "index.html") if p])
            parser = HeadLinks()
            parser.feed(path.read_text(encoding="utf-8"))
            url = expected[lang]
            alternates = {key: urljoin(url, value) for key, value in parser.alternates}
            if len(parser.alternates) != len(expected) or alternates != expected:
                for key, target in expected.items():
                    actual = alternates.get(key)
                    if actual != target:
                        errors.append(f"{path.relative_to(root)}: {key}: {actual!r} != {target!r}")
                if len(parser.alternates) != len(expected):
                    errors.append(f"{path.relative_to(root)}: expected exactly {len(expected)} alternates, found {len(parser.alternates)}")
            if parser.canonicals != [url]:
                errors.append(f"{path.relative_to(root)}: canonical {parser.canonicals!r} != {[url]!r}")
            node = sitemap.get(url)
            if node is None:
                errors.append(f"sitemap.xml: missing {url}")
            else:
                links = [(x.get("hreflang"), x.get("href")) for x in node.findall("x:link", ns)]
                if len(links) != len(expected) or dict(links) != expected:
                    errors.append(f"sitemap.xml: alternate cluster mismatch for {url}")
            count += 1
    return count, errors

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = ap.parse_args()
    count, errors = validate(args.root)
    for error in errors:
        print(error)
    print(f"Checked {count} HTML pages and {count} sitemap clusters; {len(errors)} errors")
    sys.exit(bool(errors))
