#!/usr/bin/env python3
"""Check every Little Light reader, download reference and exact illustration copy."""
from pathlib import Path
from html.parser import HTMLParser
import argparse,hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
RAW='https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/main/little-light-media/'
DOWNLOAD='https://github.com/andrewwhitecog-tech/northstarprime-always-on/releases/download/little-light-library-50-v1/'
class Page(HTMLParser):
 def __init__(self,text):
  super().__init__();self.tags=[];self.feed(text)
 def handle_starttag(self,tag,attrs):self.tags.append((tag,dict(attrs)))

def verify(artifact,source):
 failures=[];folder=artifact/'little-light-library';manifest=json.loads((folder/'edition-manifest.json').read_text(encoding='utf-8'));books=manifest['books'];media=manifest['media'];by_path={x['path']:x for x in media}
 def check(value,message):
  if not value:failures.append(message)
 check([b['volume'] for b in books]==list(range(1,51)),'Expected consecutive books 1-50')
 check(len({b['url'] for b in books})==50,'Duplicate reader URL')
 check(sum(bool(b['epub']) for b in books)==30,'Expected 30 EPUB downloads')
 check(len(media)==663 and len(by_path)==663,'Expected 663 unique page and scene exports')
 check(not (artifact/'little-light-media').exists() if artifact!=source else True,'Large image directory leaked into Pages')
 for m in media:
  path=(source/m['path']).resolve();check(path.is_relative_to((source/'little-light-media').resolve()),'Image escaped allowed source directory')
  check(path.is_file(),f'Missing media: {m["path"]}')
  if path.is_file():check(hashlib.sha256(path.read_bytes()).hexdigest()==m['sha256'],f'Image bytes differ: {m["path"]}')
  check(m['src']==RAW+m['path'].removeprefix('little-light-media/'),'Image URL does not address verified source')
 for b in books:
  path=artifact/b['url'].strip('/')/'index.html';check(path.is_file(),f'Missing reader {b["volume"]}')
  if not path.is_file():continue
  text=path.read_text(encoding='utf-8');page=Page(text)
  check(not re.search(r'private review|unreleased|C:\\|F:\\|client_secret|[\ufffd]',text,re.I),f'Internal or damaged text in book {b["volume"]}')
  scenes=[a for t,a in page.tags if t=='section' and a.get('id','').startswith('scene-')]
  check(len(scenes)==(24 if b['volume']==7 else 13 if b['volume']==9 else 12),f'Incomplete story {b["volume"]}')
  for tag,attrs in page.tags:
   if tag=='img' and 'data-media-path' in attrs:
    m=by_path.get(attrs['data-media-path']);check(m is not None and attrs.get('src')==m['src'],f'Unverified illustration in {b["volume"]}')
    check(bool(attrs.get('alt')) and bool(attrs.get('width')) and bool(attrs.get('height')),f'Image attributes absent in {b["volume"]}')
   if tag=='link' and attrs.get('rel')=='canonical':check(attrs['href']=='https://northstarprime.net'+b['url'],f'Wrong canonical for {b["volume"]}')
  for kind in ['pdf','epub']:
   d=b[kind]
   if d:check(d['url']==DOWNLOAD+d['name'] and d['url'] in text and len(d['sha256'])==64 and d['bytes']>100000,f'Invalid {kind} in {b["volume"]}')
  check('id="bigger"' in text and 'id="text-only"' in text,f'Missing reading controls in {b["volume"]}')
 landing=(folder/'index.html').read_text(encoding='utf-8');check(landing.count('class="card"')==50,'Shelf has wrong book count')
 check('/little-light-library/' in (artifact/'literature/index.html').read_text(encoding='utf-8'),'Literature entry absent')
 check((artifact/'sitemap.xml').read_text(encoding='utf-8').count('https://northstarprime.net/little-light-library/')==51,'Sitemap missing series routes')
 return {'status':'FAIL' if failures else 'PASS','books':len(books),'pdf_downloads':50,'epub_downloads':30,'verified_media':len(media),'failures':failures}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--artifact',type=Path,default=ROOT);p.add_argument('--source',type=Path,default=ROOT);a=p.parse_args();r=verify(a.artifact.resolve(),a.source.resolve());print(json.dumps(r,indent=2));raise SystemExit(bool(r['failures']))
