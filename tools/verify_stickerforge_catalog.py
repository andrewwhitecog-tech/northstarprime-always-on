"""Verify the complete catalog, its preview hashes and static browsing fallback."""
import hashlib
import json
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]

class Cards(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = []; self.originals = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'article' and a.get('class') == 'card':
            self.ids.append(a['id']); self.originals.append(a['data-original'])

def verify():
    data = json.loads((ROOT/'stickerforge/catalog.json').read_text(encoding='utf-8'))
    items = data['items']; html = (ROOT/'stickerforge/index.html').read_text(encoding='utf-8')
    parser = Cards(); parser.feed(html)
    assert len(items) == data['count'] == len(parser.ids)
    assert len(set(parser.ids)) == len(items) == len(set(parser.originals))
    assert set(parser.ids) == {i['id'] for i in items}
    for item in items:
        preview = ROOT/item['preview_file']
        assert hashlib.sha256(preview.read_bytes()).hexdigest() == item['preview_sha256'], item['id']
        assert item['preview'].endswith('/'+item['preview_file'])
        assert (ROOT/item['collection_url'].strip('/')/'index.html').is_file()
        assert item['order'].startswith('/contact/?')
        if item['image'].startswith('/'):
            assert (ROOT/item['image'].lstrip('/')).is_file(), item['id']
    for view in ['shop','compact','gallery']:
        assert f'data-view-choice="{view}"' in html
    assert 'scroll-snap-type:y mandatory' not in html
    assert 'no membership required' in html and 'confirmed before payment' in html
    return {'status':'PASS','items':len(items),'collections':len({i['collection_id'] for i in items}),'preview_hashes':len(items),'static_fallback_cards':len(parser.ids)}

if __name__ == '__main__':
    print(json.dumps(verify(),indent=2))
