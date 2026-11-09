"""Derive only the Souls release files using the real owning Pages transforms."""
from pathlib import Path
import hashlib,json,os,sys,subprocess
ROOT=Path(__file__).resolve().parents[4]
sys.path.insert(0,str(ROOT/'tools'))
import build_pages_artifact as builder
relative=Path('arcade/custom/vorath-souls')
out=Path(os.environ.get('NSP_PLAYTEST_OUT',ROOT/'scratch'/'souls-public-export'))/'derived-export'
out.mkdir(parents=True,exist_ok=True)
roles=('pursuer','flanker','charger','hexer','bulwark','reaver')
files=['index.html','earned-story.js','atlas.js','combat.js','input.js','journey.js','threats.js','camera.js','assets/vorath_exile_atlas.png','assets/maw_guard_atlas_candidate.png','assets/inner_ring_clean_floor_v05.png','assets/threshold_floor_v08.png']+[f'assets/thrall_{r}_strip_v03.png' for r in roles]
subprocess.run(['git','diff','--quiet','HEAD','--'],cwd=ROOT,check=True)
selected=builder.release_media_index();commit=builder.source_commit();rows=[]
for name in files:
 source=ROOT/relative/name;target=out/name;target.parent.mkdir(parents=True,exist_ok=True)
 # Souls is outside the builder's immutable Chronosphere-only release root.
 builder.copy_artifact_source(source,relative/name,target,selected,commit,frozenset())
 payload=target.read_bytes();rows.append({'name':name,'bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()})
print(json.dumps({'sourceCommit':commit,'builderSha256':hashlib.sha256((ROOT/'tools/build_pages_artifact.py').read_bytes()).hexdigest(),'scope':'Actual per-file Pages copy and transform functions; no full build or deployment invoked','files':rows}))
