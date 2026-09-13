"""Rebuild the public catalog from its explicit published-art inventory.

Preview generation is a separate local step. This renderer needs only stdlib.
No filesystem art scanning or automatic publication of production folders.
"""
import json
from collections import defaultdict
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def build():
    data = json.loads((ROOT / 'stickerforge/catalog.json').read_text(encoding='utf-8'))
    items = data['items']
    assert len(items) == data['count'] and len({i['id'] for i in items}) == len(items)
    groups = defaultdict(list)
    for item in items:
        groups[item['collection_id']].append(item)
    preference = ['midnight-cabinet', 'aurora-menagerie', 'flagship', 'nsp-cosmic-wonders', 'dumb-tattoos']
    keys = sorted(groups, key=lambda k: (preference.index(k) if k in preference else 99, k))
    ordered = [groups[k][n] for n in range(max(map(len, groups.values()))) for k in keys if len(groups[k]) > n]
    cards = []
    for n, item in enumerate(ordered):
        e = {key: escape(str(value), quote=True) for key, value in item.items()}
        searchable = escape(' '.join(str(item.get(key, '')) for key in ['name','collection','description']).lower(), quote=True)
        cards.append(f'''<article class="card" id="{e['id']}" data-collection="{e['collection_id']}" data-search="{searchable}" data-description="{e['description']}" data-original="{e['image']}">
<a class="preview" href="{e['image']}" aria-label="View {e['name']} full size"><img src="{e['preview']}" width="420" height="420" alt="{e['name']}" loading="{'eager' if n < 6 else 'lazy'}" decoding="async"><span class="zoom" aria-hidden="true">View +</span></a>
<p class="collection">{e['collection']}</p><h2>{e['name']}</h2><div class="card-actions"><a class="order-link" href="{e['order']}">Request this sticker</a><a href="{e['collection_url']}">Collection ↗</a></div></article>''')
    options = ''.join(f'<option value="{escape(k)}">{escape(groups[k][0]["collection"])} ({len(groups[k])})</option>' for k in keys)
    links = ''.join(f'<a href="{escape(groups[k][0]["collection_url"])}">{escape(groups[k][0]["collection"])} · {len(groups[k])}</a>' for k in keys)
    feature = groups['midnight-cabinet'][0]
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>StickerForge — {len(items)} original stickers | NorthStar Prime</title><meta name="description" content="Explore {len(items)} NorthStar stickers across {len(groups)} collections. Search, switch between three gallery views, and inspect every original at full size.">
<meta name="theme-color" content="#0b0d18"><link rel="canonical" href="https://northstarprime.net/stickerforge/"><link rel="stylesheet" href="catalog.css?v=20260910a"><script src="catalog.js?v=20260910a" defer></script></head>
<body data-view="shop" data-public-sticker-count="{len(items)}" data-guest-view="true" data-guest-purchase="true" data-membership-required="false">
<a class="skip" href="#catalog">Skip to stickers</a><header class="topbar"><a class="brand" href="/">NORTHSTAR PRIME</a><nav aria-label="Primary"><a href="/stickerforge/bumper-stickers/">Bumper stickers</a><a href="/coloring-studio/">PaintForge</a><a href="/contact/">Contact</a></nav></header>
<main><header class="intro"><div><p class="eyebrow">NorthStar original art / StickerForge</p><h1>A little <em>otherworldly.</em></h1><p>Celestial creatures, strange treasures, glass worlds. Find your next sticker.</p></div><div class="inventory"><strong>{len(items)} originals</strong>{len(groups)} collections · No membership required</div></header>
<div class="toolbar" id="catalog"><div class="search-wrap"><label for="search">Find a sticker</label><input id="search" type="search" placeholder="Try dragons, cats, gold…" autocomplete="off"></div><div class="collection-wrap"><label for="collection">Collection</label><select id="collection"><option value="">All {len(groups)} collections</option>{options}</select></div><div class="view-wrap"><p class="label">Your view</p><div class="views" role="group" aria-label="Catalog view"><button type="button" data-view-choice="shop" aria-pressed="true">Shop</button><button type="button" data-view-choice="compact" aria-pressed="false">Compact</button><button type="button" data-view-choice="gallery" aria-pressed="false">VORATH</button></div></div></div>
<section class="gallery-feature" aria-label="Featured collection"><div class="feature-art"><img src="{escape(feature['preview'])}" width="420" height="420" alt="{escape(feature['name'])}" loading="lazy"></div><div class="feature-copy"><p class="eyebrow">Featured / The Midnight Cabinet</p><h2>Small treasures.<br>Impossible worlds.</h2><p>Engraved gold, luminous opal, and rainbow aurora. Explore all 24 designs in The Midnight Cabinet.</p><a class="button" href="?collection=midnight-cabinet&amp;view=gallery#catalog">Explore the collection ↗</a></div></section>
<div class="results-bar"><span id="results" role="status" aria-live="polite">All {len(items)} stickers</span><button id="clear" class="text-button" type="button" hidden>Clear filters</button><span>Original art · Full-size previews</span></div>
<div class="grid" id="sticker-grid">{''.join(cards)}</div><div class="empty" id="empty" hidden><h2>No stickers found.</h2><p>Try a different name or browse every collection.</p><button class="button" id="empty-clear" type="button">Show all stickers</button></div><div class="load-wrap"><button class="button" id="more" type="button" hidden>Show more stickers</button></div>
<noscript><p>All stickers are shown below the search controls. Open any artwork to see the full-size original, or use the collection links.</p><style>.toolbar,.gallery-feature{{display:none!important}}</style></noscript>
<details class="ordering"><summary>Ordering, availability &amp; delivery</summary><p>Guest viewing and ordering — no membership required. Made to order. NorthStar does not keep finished sticker inventory on hand yet, and established production and fulfillment channels are still being finalized. Orders may take longer than standard retail. Final price, production method, shipping, taxes, and estimated delivery are confirmed before payment.</p></details>
<section class="collection-index"><h2>Explore every collection.</h2><div class="collection-links">{links}</div></section></main>
<footer><span>StickerForge / NorthStar Prime original art</span><span>{len(items)} stickers · <a href="/contact/">Talk to the order desk</a></span></footer>
<dialog id="detail" aria-labelledby="detail-name"><button class="close" type="button" aria-label="Close preview">×</button><div class="detail-layout"><img class="detail-art" alt=""><div class="detail-copy"><p class="eyebrow" id="detail-collection"></p><h2 id="detail-name"></h2><p id="detail-description"></p><a class="button primary" id="detail-order">Request this sticker</a><a class="button" id="detail-full" target="_blank" rel="noopener">Open original ↗</a><p>Made to order. Price and delivery confirmed before payment.</p></div></div><div class="detail-nav"><button id="detail-prev" type="button">← Previous</button><span id="detail-position"></span><button id="detail-next" type="button">Next →</button></div></dialog>
</body></html>'''
    (ROOT / 'stickerforge/index.html').write_text(page, encoding='utf-8', newline='\n')
    return {'items': len(items), 'collections': len(groups), 'views': ['shop','compact','gallery']}

if __name__ == '__main__':
    print(json.dumps(build()))
