"""Restore first-party cabinet art whenever the arcade landing is frozen."""
from html.parser import HTMLParser
from pathlib import Path
import re
from urllib.parse import urlsplit


class CabinetArtParser(HTMLParser):
    def __init__(self, html, root):
        super().__init__()
        self.root = root
        self.lines = [0]
        self.lines.extend(match.end() for match in re.finditer(r"\n", html))
        self.card_tag = None
        self.depth = 0
        self.insertions = []
        self.art = None
        self.illustrated = False

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        classes = (fields.get("class") or "").split()
        if self.card_tag is None:
            if tag in {"article", "div"} and "game-card" in classes:
                self.card_tag = tag
                self.depth = 1
                self.art = None
                self.illustrated = False
                line, column = self.getpos()
                self.card_start = self.lines[line - 1] + column + len(self.get_starttag_text())
            return
        if tag == self.card_tag:
            self.depth += 1
        if tag == "img":
            self.illustrated = True
        if tag == "a" and "play-btn" in classes:
            target = urlsplit(fields.get("href") or "")
            if target.netloc not in {"", "app.northstarprime.net", "northstarprime.net"}:
                return
            match = re.fullmatch(r"/(?:games|arcade/custom)/([a-z0-9-]+)(?:/|\.html)?", target.path)
            if match:
                art = f"static/idg/cabinet-art/{match[1]}.webp"
                if (self.root / art).is_file():
                    self.art = art

    def handle_endtag(self, tag):
        if tag != self.card_tag:
            return
        self.depth -= 1
        if self.depth:
            return
        if self.art and not self.illustrated:
            image = (f'\n        <img class="cabinet-art" src="/{self.art}" alt="" '
                     'width="480" height="300" loading="lazy" decoding="async">')
            self.insertions.append((self.card_start, image))
        self.card_tag = None


def illustrate_arcade(html, root):
    parser = CabinetArtParser(html, Path(root))
    parser.feed(html)
    parser.close()
    for offset, image in reversed(parser.insertions):
        html = html[:offset] + image + html[offset:]
    if parser.insertions and 'id="cabinet-art-styles"' not in html:
        styles = """<style id="cabinet-art-styles">
    .game-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr)); }
    .cabinet-art {
      display: block; width: 100%; height: auto; aspect-ratio: 8 / 5;
      border-radius: 6px; margin-bottom: 1rem; background: #0b1020;
    }
    @media (max-width: 420px) {
      .flagship-3d-deck > div[style*="display:grid"] { grid-template-columns: minmax(0, 1fr) !important; }
    }
  </style>
"""
        html = html.replace("</head>", styles + "</head>", 1)
    return html
