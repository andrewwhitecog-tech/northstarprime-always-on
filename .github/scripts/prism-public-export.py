"""Derive Prism runtime bytes with the actual owning Pages transforms; no full build/deploy."""
from pathlib import Path
import hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
import build_pages_artifact as builder
relative=Path('arcade/custom/prism-drift')
out=Path(os.environ['NSP_PLAYTEST_OUT'])/'derived-export'
out.mkdir(parents=True,exist_ok=True)
subprocess.run(['git','diff','--quiet','HEAD','--'],cwd=ROOT,check=True)
files=[relative/'index.html',Path('static/games/nsp-return.js')]
for folder in ('art','audio'):
    files.extend(p.relative_to(ROOT) for p in sorted((ROOT/relative/folder).rglob('*'))
                 if p.is_file() and p.suffix.lower() in {'.png','.jpg','.jpeg','.webp','.mp3','.wav','.ogg'})
selected=builder.release_media_index();commit=builder.source_commit();rows=[]
for rel in files:
    target=out/rel;target.parent.mkdir(parents=True,exist_ok=True)
    builder.copy_artifact_source(ROOT/rel,rel,target,selected,commit,frozenset())
    raw=target.read_bytes()
    # Immutable media URLs change only their source-commit segment on unrelated releases.
    # Normalize that exact owning prefix for native-proof reuse only; actual delivery hashes stay exact.
    stable=raw.replace(('https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/'+commit+'/').encode(),
                       b'https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/__SOURCE_COMMIT__/') if rel.suffix.lower() in {'.html','.js','.json'} else raw
    rows.append({'relative':rel.as_posix(),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                 'stable_bytes':len(stable),'stable_sha256':hashlib.sha256(stable).hexdigest()})
print(json.dumps({'sourceCommit':commit,'builderSha256':hashlib.sha256((ROOT/'tools/build_pages_artifact.py').read_bytes()).hexdigest(),
 'scope':'Actual per-file Pages transforms for Prism HTML, runtime images/recorded audio and genuinely external return script; no build/deployment invoked',
 'files':sorted(rows,key=lambda row:row['relative'])}))
