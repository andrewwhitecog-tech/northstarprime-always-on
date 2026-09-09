"""Validate the exact reviewed Ladder runtime and public discovery contract."""
import argparse,hashlib,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def verify(root):
 m=json.loads((root/'LADDER_RELEASE_MANIFEST.json').read_text(encoding='utf-8'));assert m['channels']==9
 for row in m['files']:
  path=(root/row['path']).resolve();assert path.is_relative_to(root.resolve()) and path.is_file()
  data=path.read_bytes()
  if path.suffix in {'.html','.css','.js','.mjs','.txt'}:data=data.replace(b'\r\n',b'\n')
  assert len(data)==row['bytes'] and hashlib.sha256(data).hexdigest()==row['sha256'],row['path']
  if path.suffix in {'.html','.css','.js','.mjs'}:assert not re.search(r'https?://(?:127\.0\.0\.1|localhost)|[A-Z]:[\\/](?:Users|Windows)|(?:src|href)=[\"\']https?://',data.decode()),row['path']
 assert 'href="'+m['route']+'"' in (root/'arcade/index.html').read_text(encoding='utf-8')
 catalog=json.loads((root/'arcade/catalog.json').read_text(encoding='utf-8'));assert sum(g['slug']=='ladder' and g['route']==m['route'] for g in catalog['games'])==1
 assert 'https://northstarprime.net'+m['route'] in (root/'sitemap.xml').read_text(encoding='utf-8')
 print(json.dumps({'status':'PASS','exact_runtime_files':len(m['files']),'discovery':'arcade landing, catalog and sitemap'}))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--artifact',type=Path,default=ROOT);args=parser.parse_args();verify(args.artifact.resolve())
