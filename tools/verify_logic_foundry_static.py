"""Check the exact Logic Foundry release, discovery and local runtime dependencies."""
import argparse,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def verify(root):
 m=json.loads((root/'LOGIC_FOUNDRY_RELEASE_MANIFEST.json').read_text(encoding='utf-8'));assert m['circuits']==6 and m['model_checks']==61 and m['state_transition_checks']==18
 for row in m['files']:
  p=(root/row['path']).resolve();assert p.is_relative_to(root.resolve()) and p.is_file(),row['path'];data=p.read_bytes()
  if p.suffix in {'.html','.css','.js','.mjs','.txt'}:data=data.replace(b'\r\n',b'\n')
  assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
  if p.suffix in {'.html','.css','.js','.mjs'}:
   text=data.decode();assert not re.search(r'https?://(?:127\.0\.0\.1|localhost)|[A-Z]:[\\/](?:Users|Windows)|(?:src|href)=[\"\']https?://',text),row['path']
   for asset in re.findall(r'/static/(?:games/logic_foundry_v14|vendor/three/0\.160\.0)/[a-zA-Z0-9_./-]+',text):assert (root/asset.lstrip('/')).is_file(),asset
 assert 'href="'+m['route']+'"' in (root/'arcade/index.html').read_text(encoding='utf-8')
 catalog=json.loads((root/'arcade/catalog.json').read_text(encoding='utf-8'));assert sum(g['slug']=='logic-foundry' and g['route']==m['route'] for g in catalog['games'])==1
 assert 'https://northstarprime.net'+m['route'] in (root/'sitemap.xml').read_text(encoding='utf-8')
 print(json.dumps({'status':'PASS','exact_runtime_files':len(m['files']),'discovery':'landing, catalog and sitemap'}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--artifact',type=Path,default=ROOT);args=parser.parse_args();verify(args.artifact.resolve())
