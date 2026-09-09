#!/usr/bin/env python3
"""Check the exact original Side Street export and its public catalog contract."""
from pathlib import Path
import argparse,hashlib,json,re

ROOT=Path(__file__).resolve().parents[1]
def verify(root):
    m=json.loads((root/'SIDE_STREET_RELEASE_MANIFEST.json').read_text(encoding='utf-8'));failures=[];checks=[]
    def check(name,value):(checks if value else failures).append(name)
    check('12-board experimental release with finite daily cycle',m['classification']=='original experimental release' and m['board_count']==12 and m['daily_cycle_utc_days']==12)
    check('five exact runtime files',len(m['files'])==5)
    for row in m['files']:
        path=(root/row['path']).resolve();ok=path.is_relative_to((root/'arcade/custom/side-street').resolve()) and path.is_file()
        check('reviewed runtime '+row['path'],ok and path.stat().st_size==row['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'])
    folder=root/'arcade/custom/side-street'
    check('no research captions or private packet copied',{p.name for p in folder.iterdir()}=={'index.html','style.css','core.js','puzzles.js','app.js'})
    html=(folder/'index.html').read_text(encoding='utf-8')
    check('local scripts and stylesheet',all(f'"{name}"' in html for name in ['style.css','core.js','puzzles.js','app.js']))
    check('repeat cadence and physical-controller limit disclosed','repeats after 12 days' in html and 'Physical gamepad testing is still pending' in html)
    check('no remote runtime or private URLs',not re.search(r'(?:src|href)=["\']https?://|127\.0\.0\.1|localhost|[A-Z]:\\',html))
    landing=(root/'arcade/index.html').read_text(encoding='utf-8')
    check('discoverable experimental arcade entry','href="/arcade/custom/side-street/"' in landing and 'Original experimental release' in landing and 'daily pick repeats after 12 UTC days' in landing)
    catalog=json.loads((root/'arcade/catalog.json').read_text(encoding='utf-8'))
    matches=[g for g in catalog['games'] if g['slug']=='side-street']
    check('exactly one matching catalog entry',len(matches)==1 and matches[0]['route']==m['route'])
    check('sitemap includes puzzle route','https://northstarprime.net/arcade/custom/side-street/' in (root/'sitemap.xml').read_text(encoding='utf-8'))
    return {'status':'FAIL' if failures else 'PASS','checks':checks,'failures':failures}
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--artifact',type=Path,default=ROOT)
    args=parser.parse_args();result=verify(args.artifact.resolve());print(json.dumps(result,indent=2));raise SystemExit(bool(result['failures']))
