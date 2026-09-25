"""Keep the curated child-facing reader navigation within its reviewed set."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import re

ROOT=Path(__file__).resolve().parents[1]
SLUGS=('01-ash-and-the-bell-that-needed-two-paws','21-the-kite-with-room-for-a-knot','25-the-quiet-seat-on-the-carousel')
class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.embeds=[]
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='a':self.links.append(attrs.get('href',''))
        if tag in ('iframe','audio','video','form'):self.embeds.append(tag)

def main():
    allowed={'/family/', '/little-light-library/'}|{'/family/'+x+'/' for x in SLUGS}
    for page in [ROOT/'family/index.html']+[ROOT/'family'/x/'index.html' for x in SLUGS]:
        html=page.read_text(encoding='utf-8'); parser=Links();parser.feed(html)
        assert not parser.embeds,(page,parser.embeds)
        for href in parser.links:
            assert href.startswith('#') or href in allowed,(page,href)
        if page.parent.name in SLUGS:
            source=(ROOT/'little-light-library'/page.parent.name/'index.html').read_text(encoding='utf-8')
            # Preserve full published scene content, image source and alt text verbatim.
            scene=lambda value: re.search(r'<div id="story">(.*?)<section class="book-end">',value,re.S).group(1)
            assert scene(html)==scene(source),page
            assert len(re.findall(r'id="scene-\d+"',html))==12,page
    print('PASS: 3 complete source-matched stories; all navigation stays in the reviewed family set; no feed, media player or form embeds.')
if __name__=='__main__':main()
