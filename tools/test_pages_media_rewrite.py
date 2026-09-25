import importlib.util,json,unittest,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location("builder",ROOT/"build_pages_artifact.py")
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
commit="a"*40
base="https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/"+commit+"/"
selected={"idc/season-4/audio/a.mp3","idc/season-3/audio/excerpts/a.mp3","static/games/sfx/dharma_jump.mp3","static/idc_covers/x.png"}
dirs={"idc/season-4/audio/","static/idc_covers/"}
class MediaRewrite(unittest.TestCase):
 def rewrite(self,text,page="idc/season-4/index.html"):
  return m.rewrite_release_media_refs(text,Path(page),selected,dirs,commit)
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
  result=m.rewrite_release_media_refs("'audio/a%23b.mp3'",Path("index.html"),{"audio/a#b.mp3"},set(),commit)
  self.assertEqual(result,"'"+base+"audio/a%23b.mp3'")
  result=m.rewrite_release_media_refs("'audio/a%20b.mp3?download=1#seek'",Path("index.html"),{"audio/a b.mp3"},set(),commit)
  self.assertEqual(result,"'"+base+"audio/a%20b.mp3?download=1#seek'")
 def test_actual_sfx_gallery_script(self):
  canonical=ROOT.parent
  if not (canonical/"static/games/sfx/index.html").is_file():
   canonical=Path(r"C:\Users\andre\scripts\the_workshop\projects\northstarprime-always-on")
  source=canonical/"static/games/sfx/index.html"
  html=source.read_text(encoding="utf-8")
  for file in (source.parent).glob("*.mp3"):
   self.assertFalse(m.external_release_media(file.relative_to(canonical)))
  for file in (source.parent).glob("*.wav"):
   self.assertFalse(m.external_release_media(file.relative_to(canonical)))
  rewritten=m.rewrite_release_media_refs(html,Path("static/games/sfx/index.html"),selected,dirs,commit)
  script=re.search(r"<script>(.*?)</script>",rewritten,re.S).group(1)
  harness="const box={};const document={getElementById:()=>box};"+script+"\nprocess.stdout.write(box.innerHTML);"
  rendered=subprocess.check_output(["node","-e",harness],text=True,encoding="utf-8")
  links=re.findall(r'href="([^" ]+)"',rendered)
  audio=re.findall(r"new Audio\('([^']+)'\)",rendered)
  self.assertEqual(len(links),16);self.assertEqual(len(audio),8)
  for path in links+audio:
   self.assertTrue((source.parent/path).is_file(),path)
   self.assertFalse(m.external_release_media((source.parent/path).relative_to(canonical)))
 def test_idempotent(self):
  out=self.rewrite("'audio/a.mp3'");self.assertEqual(self.rewrite(out),out)
if __name__=="__main__":unittest.main()
