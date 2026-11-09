"""Derive only Commentary runtime files with the actual owning Pages transforms."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
from html.parser import HTMLParser
from urllib.parse import urljoin
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_pages_artifact as builder
out=Path(os.environ['NSP_PLAYTEST_OUT'])/'derived-export'
out.mkdir(parents=True,exist_ok=True)
subprocess.run(['git','diff','--quiet','HEAD','--'],cwd=ROOT,check=True)
relative=Path('arcade/custom/dharma-invaders')
files=[relative/'index.html',relative/'assets/title-v01.png',relative/'assets/start-v01.png',Path('static/games/chiptune.js'),Path('static/art/games/vorath_overhaul_v01/commentary_siege/commentary_sentinel_redaction_atlas_v01.webp'),Path('static/art/games/vorath_overhaul_v01/commentary_siege/commentary_sentinel_redaction_atlas_v01.png')]
selected=builder.release_media_index();commit=builder.source_commit();rows=[]
for rel in files:
    target=out/rel;target.parent.mkdir(parents=True,exist_ok=True)
    builder.copy_artifact_source(ROOT/rel,rel,target,selected,commit,frozenset())
    raw=target.read_bytes()
    stable=raw.replace(('https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/'+commit+'/').encode(),b'https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/__SOURCE_COMMIT__/') if rel.suffix.lower() in {'.html','.js','.json'} else raw
    url=('https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/'+commit+'/' if rel.as_posix() in selected else 'https://northstarprime.net/')+rel.as_posix()
    if rel.name=='index.html':url='https://northstarprime.net/arcade/custom/dharma-invaders/'
    rows.append({'relative':rel.as_posix(),'url':url,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'stable_bytes':len(stable),'stable_sha256':hashlib.sha256(stable).hexdigest(),'role':'unused PNG fallback verified by explicit GET, not native fallback activation' if rel.name.endswith('_v01.png') and 'sentinel' in rel.name else 'runtime'})
html=(out/relative/'index.html').read_text(encoding='utf-8')
class ScriptElements(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=='script':
            src=dict(attrs).get('src')
            if src:self.urls.append(urljoin('https://northstarprime.net/arcade/custom/dharma-invaders/',src))
scripts=ScriptElements();scripts.feed(html)
for row in rows:
    if row['relative'].endswith('/index.html'):continue
    assert row['url'] in html or ('/'+row['relative']) in html,'derived page does not reference '+row['relative']
print(json.dumps({'sourceCommit':commit,'builderSha256':hashlib.sha256((ROOT/'tools/build_pages_artifact.py').read_bytes()).hexdigest(),'qualitySha256':hashlib.sha256((ROOT/'tools/pages_art_quality.py').read_bytes()).hexdigest(),'qualityManifestSha256':hashlib.sha256((ROOT/'tools/public_art_quality_20261019.json').read_bytes()).hexdigest(),'scriptElements':scripts.urls,'scope':'Actual owning copy_artifact_source for Commentary HTML, two lettering crops, chiptune and primary/fallback actor atlas. No full build/deploy. PNG fallback GET is not native fault coverage.','files':sorted(rows,key=lambda row:row['relative'])}))
