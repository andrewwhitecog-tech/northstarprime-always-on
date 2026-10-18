import importlib.util,json,unittest,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location("builder",ROOT/"build_pages_artifact.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
commit="a"*40
base="https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/"+commit+"/"
selected={"idc/season-4/audio/a.mp3","idc/season-3/audio/excerpts/a.mp3","static/games/sfx/dharma_jump.mp3","static/idc_covers/x.png"}
class MediaRewrite(unittest.TestCase):
 def rewrite(self,text,page="idc/season-4/index.html"):
  return m.rewrite_release_media_refs(text,Path(page),selected,commit)
 def test_literal(self):
  self.assertEqual(self.rewrite("'audio/a.mp3'"),"'"+base+"idc/season-4/audio/a.mp3'")
 def test_prefix(self):
  self.assertEqual(self.rewrite("'audio/' + name"),"'"+base+"idc/season-4/audio/' + name")
 def test_partial_prefix(self):
  self.assertEqual(self.rewrite("'/static/games/sfx/dharma_'+name+'.mp3'"),"'"+base+"static/games/sfx/dharma_'+name+'.mp3'")
 def test_json_document_base(self):
  self.assertEqual(self.rewrite('"audio/excerpts/a.mp3"',"idc/season-3/data/listening_manifest.json"),'"'+base+'idc/season-3/audio/excerpts/a.mp3"')
 def test_css(self):
  self.assertEqual(self.rewrite("url('/static/idc_covers/x.png')"),"url('"+base+"static/idc_covers/x.png')")
 def test_unrelated_and_provenance(self):
  for value in ['"https://example.org/a.mp3"','"F:/private/a.mp3"','"/static/missing.mp3"',"'jump'",'"../secret.mp3"']:
   self.assertEqual(self.rewrite(value),value)
 def test_encoded_filename(self):
  result=m.rewrite_release_media_refs("'audio/a%23b.mp3'",Path("index.html"),{"audio/a#b.mp3"},commit)
  self.assertEqual(result,"'"+base+"audio/a%23b.mp3'")
  result=m.rewrite_release_media_refs("'audio/a%20b.mp3?download=1#seek'",Path("index.html"),{"audio/a b.mp3"},commit)
  self.assertEqual(result,"'"+base+"audio/a%20b.mp3?download=1#seek'")
 def test_actual_sfx_gallery_script(self):
  canonical=ROOT.parent
  source=canonical/"static/games/sfx/index.html"
  html=source.read_text(encoding="utf-8")
  for file in (source.parent).glob("*.mp3"):
   self.assertFalse(m.external_release_media(file.relative_to(canonical)))
  for file in (source.parent).glob("*.wav"):
   self.assertFalse(m.external_release_media(file.relative_to(canonical)))
  rewritten=m.rewrite_release_media_refs(html,Path("static/games/sfx/index.html"),selected,commit)
  script=re.search(r"<script>(.*?)</script>",rewritten,re.S).group(1)
  harness="const box={};const document={getElementById:()=>box};"+script+"\nprocess.stdout.write(box.innerHTML);"
  rendered=subprocess.check_output(["node","-e",harness],text=True,encoding="utf-8")
  links=re.findall(r'href="([^" ]+)"',rendered)
  audio=re.findall(r"new Audio\('([^']+)'\)",rendered)
  self.assertEqual(len(links),16);self.assertEqual(len(audio),8)
  for path in links+audio:
   self.assertTrue((source.parent/path).is_file(),path)
   self.assertFalse(m.external_release_media((source.parent/path).relative_to(canonical)))
 def test_page_links_to_media_folders(self):
  pages={"idr/single-052/a.mp3","idc/season-4/chrono-convergence/b.mp4"}
  for value in ['href="/idr/single-052/"',"href='/idc/season-4/chrono-convergence/'",'href="../single-052/"']:
   self.assertEqual(m.rewrite_release_media_refs(value,Path("idr/single-053/index.html"),pages,commit),value)
 def test_paint_originals_use_versioned_raw_delivery(self):
  original=Path("coloring-studio/assets/reviewed/deep_reef__09_octopus.png")
  self.assertTrue(m.external_release_media(original))
  self.assertFalse(m.external_release_media(Path("coloring-studio/reviewed-inventory.json")))
  manifest={"pages":[{"kind":"kids","title":"Deep Reef: Octopus","src":"assets/reviewed/deep_reef__09_octopus.png","sha256":"b"*64,"bytes":2506442}]}
  encoded=json.dumps(manifest)
  rewritten=m.rewrite_release_media_refs(encoded,Path("coloring-studio/reviewed-inventory.json"),{original.as_posix()},commit)
  actual=json.loads(rewritten)
  self.assertEqual(actual["pages"][0],{**manifest["pages"][0],"src":base+original.as_posix()})
  self.assertEqual(m.rewrite_release_media_refs(rewritten,Path("coloring-studio/reviewed-inventory.json"),{original.as_posix()},commit),rewritten)
 def test_actual_reviewed_paint_inventory_stays_hash_bound(self):
  manifest_path=ROOT.parent/"coloring-studio/reviewed-inventory.json"
  manifest=json.loads(manifest_path.read_text(encoding="utf-8"))
  pages=manifest["pages"]
  self.assertEqual(len(pages),20)
  self.assertEqual(sum(p["kind"]=="kids" for p in pages),10)
  originals={(Path("coloring-studio")/p["src"]).as_posix() for p in pages}
  rewritten=json.loads(m.rewrite_release_media_refs(json.dumps(manifest),Path("coloring-studio/reviewed-inventory.json"),originals,commit))
  for original,delivered in zip(pages,rewritten["pages"]):
   actual_path=manifest_path.parent/original["src"]
   self.assertEqual(actual_path.stat().st_size,original["bytes"])
   self.assertEqual(m.sha256(actual_path).lower(),original["sha256"])
   self.assertTrue(m.external_release_media(actual_path.relative_to(ROOT.parent)))
   self.assertEqual(delivered,{**original,"src":base+actual_path.relative_to(ROOT.parent).as_posix()})
 def test_idempotent(self):
  out=self.rewrite("'audio/a.mp3'");self.assertEqual(self.rewrite(out),out)
if __name__=="__main__":unittest.main()
