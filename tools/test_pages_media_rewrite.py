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

class ReviewedArtRelease(unittest.TestCase):
 def test_actual_eighteen_source_bindings(self):
  art = m.pages_art_quality
  self.assertEqual(len(art.REPLACEMENTS), 18)
  art.validate_source(ROOT.parent)
  self.assertNotEqual(
   art.BY_OLD_PATH["/static/literature_covers/loomwheel/map_of_erased_places_v01/cover.webp"]["old_sha256"],
   art.BY_OLD_PATH["/literature/a-map-of-erased-places/cover.webp"]["old_sha256"])
 def test_exact_old_urls_with_query_and_fragment(self):
  art=m.pages_art_quality
  for row in art.REPLACEMENTS:
   with self.subTest(id=row["id"]):
    value='<img src="'+row["old_path"]+'?v=old#detail">'
    expected='<img src="'+row["delivery_path"]+'?v='+row["sha256"][:16]+'#detail">'
    self.assertEqual(art.rewrite_reviewed_art_urls(value,Path("literature/index.html")),expected)
 def test_first_party_open_graph_and_relative_reader(self):
  art=m.pages_art_quality
  row=art.BY_OLD_PATH["/literature/a-map-of-erased-places/cover.webp"]
  target=row["delivery_path"]+"?v="+row["sha256"][:16]
  self.assertEqual(
   art.rewrite_reviewed_art_urls('<img src="cover.webp">',Path("literature/a-map-of-erased-places/index.html")),
   '<img src="'+target+'">')
  self.assertEqual(
   art.rewrite_reviewed_art_urls('<meta property="og:image" content="https://northstarprime.net'+row["old_path"]+'">',Path("literature/index.html")),
   '<meta property="og:image" content="https://northstarprime.net'+target+'">')
 def test_unrelated_hosts_paths_and_provenance_unchanged(self):
  art=m.pages_art_quality
  old=art.REPLACEMENTS[0]["old_path"]
  for value in ['"https://example.org'+old+'"','"https://northstarprime.net.example.org'+old+'"',
                '"F:/private'+old+'"','"#contents"','"/static/untouched.webp"',
                '"https://app.northstarprime.net'+old+'"','"//["']:
   self.assertEqual(art.rewrite_reviewed_art_urls(value,Path("index.html")),value)
 def test_real_page_rewrite_is_idempotent(self):
  art=m.pages_art_quality
  for name in ["literature/index.html","literature/the-null-calendar/index.html",
               "literature/the-null-calendar/read/index.html","literature/a-map-of-erased-places/index.html"]:
   source=(ROOT.parent/name).read_text(encoding="utf-8")
   rewritten=art.rewrite_reviewed_art_urls(source,Path(name))
   self.assertNotEqual(source,rewritten,name)
   self.assertEqual(art.rewrite_reviewed_art_urls(rewritten,Path(name)),rewritten)
 def test_builder_retires_old_and_retains_new_tracked_paths(self):
  art=m.pages_art_quality
  selected={relative.as_posix() for _,relative in m.iter_source_files()}
  for row in art.REPLACEMENTS:
   self.assertNotIn(row["old_path"].lstrip("/"),selected)
   self.assertIn(row["delivery_path"].lstrip("/"),selected)
 def test_actual_old_byte_drift_is_rejected(self):
  import uuid,shutil
  from unittest.mock import patch
  art=m.pages_art_quality
  row=art.REPLACEMENTS[0]
  fixture=ROOT.parent/"output"/"art-quality-test-fixtures"/str(uuid.uuid4())
  old=fixture/row["old_path"].lstrip("/")
  new=fixture/row["delivery_path"].lstrip("/")
  old.parent.mkdir(parents=True,exist_ok=True);new.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(ROOT.parent/row["old_path"].lstrip("/"),old)
  shutil.copy2(ROOT.parent/row["delivery_path"].lstrip("/"),new)
  with patch.object(art,"REPLACEMENTS",(row,)), patch.object(art,"ADDITIONAL_ASSETS",()), patch.object(art,"WITHHELD_MEDIA",()), patch.object(art,"SOURCE_OVERRIDES",()):
   art.validate_source(fixture)
   data=bytearray(old.read_bytes());data[-1]^=1;old.write_bytes(data)
   with self.assertRaisesRegex(ValueError,"Reviewed original changed"):
    art.validate_source(fixture)
 def test_actual_artifact_rejects_leaks_references_and_corruption(self):
  import uuid,shutil
  art=m.pages_art_quality
  fixture=ROOT.parent/"output"/"art-quality-test-fixtures"/str(uuid.uuid4())
  fixture.mkdir(parents=True)
  for row in (*art.REPLACEMENTS,*art.ADDITIONAL_ASSETS):
   target=fixture/row["delivery_path"].lstrip("/")
   target.parent.mkdir(parents=True,exist_ok=True)
   shutil.copy2(ROOT.parent/row["delivery_path"].lstrip("/"),target)
  for held in art.SOURCE_OVERRIDES:
   page=fixture/held["path"].lstrip("/");page.parent.mkdir(parents=True,exist_ok=True)
   shutil.copy2(ROOT.parent/held["template_path"],page)
  (fixture/"nsp-pages-artifact.json").write_text(json.dumps({"public_art_quality":art.release_record()}),encoding="utf-8")
  self.assertEqual(art.verify_artifact(fixture),[])
  row=art.REPLACEMENTS[0]
  old=fixture/row["old_path"].lstrip("/")
  old.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(ROOT.parent/row["old_path"].lstrip("/"),old)
  (fixture/"index.html").write_text('<img src="'+row["old_path"]+'">',encoding="utf-8")
  failures=art.verify_artifact(fixture)
  self.assertTrue(any("Retired artwork leaked" in f for f in failures))
  self.assertTrue(any("Retired artwork URL remains" in f for f in failures))
  new=fixture/row["delivery_path"].lstrip("/")
  data=bytearray(new.read_bytes());data[-1]^=1;new.write_bytes(data)
  self.assertTrue(any("Reviewed artwork bytes mismatch" in f for f in art.verify_artifact(fixture)))

 def test_held_public_media_are_omitted_but_originals_preserved(self):
  art=m.pages_art_quality
  self.assertEqual(len(art.WITHHELD_MEDIA),26)
  selected={relative.as_posix() for _,relative in m.iter_source_files()}
  external=m.release_media_index()
  for row in art.WITHHELD_MEDIA:
   name=row["path"].lstrip("/")
   self.assertNotIn(name,selected)
   self.assertNotIn(name,external)
   self.assertEqual(art.sha256(ROOT.parent/name),row["sha256"])
 def test_actual_unavailable_manga_override_does_not_change_source(self):
  art=m.pages_art_quality
  relative=Path("manga/index.html")
  original=(ROOT.parent/relative).read_text(encoding="utf-8")
  replacement=art.artifact_page_text(ROOT.parent,relative,original)
  self.assertNotEqual(original,replacement)
  self.assertIn("currently unavailable",replacement)
  self.assertNotIn("/manga/assets/",replacement)
  self.assertEqual(art.artifact_page_text(ROOT.parent,Path("index.html"),"unchanged"),"unchanged")
  self.assertEqual(art.sha256(ROOT.parent/relative),art.SOURCE_OVERRIDES[0]["source_sha256"])
 def test_actual_consumer_story_and_separation_repairs(self):
  root=ROOT.parent
  shelf=(root/"literature/index.html").read_text(encoding="utf-8")
  self.assertNotIn('href="/manga/"',shelf)
  self.assertNotIn("The Silent Partner",shelf)
  self.assertNotIn("Sub-Bass Wardens",shelf)
  self.assertIn("Starmap Deposition",shelf)
  self.assertIn('href="/little-light-library/42-a-name-for-the-new-blue/"',shelf)
  for name in ["literature/a-map-of-erased-places/index.html","dream-court/index.html",
               "dream-court/case-002/index.html","dream-court/case-003/index.html","dream-court/case-004/index.html"]:
   with self.subTest(name=name):
    self.assertNotIn('href="/hire/"',(root/name).read_text(encoding="utf-8"))
  reader=(root/"comics/reader/index.html").read_text(encoding="utf-8")
  self.assertNotIn('value="duel_zexal"',reader)
  self.assertNotIn("duel_zexal: {",reader)
  self.assertIn('window.location.replace("/manga/")',reader)
  for name in ["APEX_EXTRA_EX10","APEX_EXTRA_EX11","APEX_OBSIDIAN"]:
   row=next(row for row in m.pages_art_quality.REPLACEMENTS if row["id"]==name)
   self.assertIn(row["delivery_path"],reader)
  self.assertIn("pageSource(series, curPage)",reader)
  self.assertIn("pageSource(series, nextP)",reader)

if __name__=="__main__":unittest.main()
