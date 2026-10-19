"""Scoped original-art bindings; no whole-school or live acceptance implied."""
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.tags=[]
        self.raw=path.read_text(encoding='utf-8')
        self.feed(self.raw)
    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


def test_original_painting_bytes_and_native_dimensions_are_preserved():
    expected={'oracle-chamber-v01.png':'c0d94e481c070d8f5924fa25a42553c6f5bc0d2179174a43990f117c20bc2817','dark-mirror-library-v01.png':'afce660f462a6c58e8f298c416268ec6fb30fe88015c25ba36528cf125aa4dd4'}
    for name, digest in expected.items():
        data=(ROOT/'mystery-school/art'/name).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('!II',data[16:24]) == (1672,941)
        assert sha256(data).hexdigest() == digest


def test_changed_page_art_references_have_real_local_sources_and_dimensions():
    for path in ('mystery-school/index.html','mystery-school/iching/index.html'):
        page=Page(ROOT/path)
        paintings=[attrs for tag,attrs in page.tags if tag=='img' and attrs.get('src','').startswith('/mystery-school/art/')]
        assert paintings
        for image in paintings:
            assert (ROOT/image['src'].lstrip('/')).is_file()
            assert (image['width'],image['height']) == ('1672','941')
            assert image.get('alt','').strip()


def test_share_images_resolve_to_saved_art_in_this_same_build():
    for path in ('mystery-school/index.html','mystery-school/iching/index.html'):
        page=Page(ROOT/path)
        share=[attrs['content'] for tag,attrs in page.tags if tag=='meta' and (attrs.get('property')=='og:image' or attrs.get('name')=='twitter:image')]
        assert len(share)==2
        assert len(set(share))==1
        for url in share:
            prefix='https://northstarprime.net/'
            assert url.startswith(prefix+'mystery-school/art/')
            assert (ROOT/url[len(prefix):]).is_file()


def test_story_copy_is_below_the_unobscured_painting():
    page=Page(ROOT/'mystery-school/index.html')
    art=re.search(r'<div class="story-art">(.*?)</div>',page.raw,re.S).group(1)
    assert '<img ' in art
    assert '<span' not in art and '<p' not in art and '<h' not in art
    assert 'class="story-tagline">The world takes the stand.</p>' in page.raw
    css=(ROOT/'mystery-school/school.css').read_text(encoding='utf-8')
    assert '.story-art::after' not in css and '.story-art>span' not in css


def test_original_links_and_interactive_entrypoints_remain_present():
    page=Page(ROOT/'mystery-school/index.html')
    hrefs={attrs.get('href') for tag,attrs in page.tags if tag=='a'}
    for path in ('/mystery-school/curriculum/','/mystery-school/chambers/','/mystery-school/vault/','/mystery-school/iching/','/dream-court/','#look-again'):
        assert path in hrefs
    for identifier in ('practice-start','practice-next','practice-back','practice-download','practice-review','practice-restart'):
        assert any(attrs.get('id')==identifier for _,attrs in page.tags)


def test_oracle_keeps_its_existing_data_and_control_bindings():
    page=Page(ROOT/'mystery-school/iching/index.html')
    assert any(tag=='script' and attrs.get('src')=='iching_data.js' for tag,attrs in page.tags)
    assert (ROOT/'mystery-school/iching/iching_data.js').is_file()
    for identifier in ('btnToss','btnInstant','btnReset','btnExportSticker','btnCopyReading'):
        assert any(attrs.get('id')==identifier for _,attrs in page.tags)


def test_school_controller_is_byte_preserved_and_oracle_has_source_labels():
    assert sha256((ROOT/'mystery-school/school.js').read_bytes()).hexdigest() == 'f35b0e00775217297248558332ef96974dd659de616319ba9842a3b609ea4311'
    raw=(ROOT/'mystery-school/iching/index.html').read_text(encoding='utf-8')
    scripts='\n'.join(re.findall(r'<script(?:\s[^>]*)?>([\s\S]*?)</script>',raw))
    assert 'function identitySubtitle(hexagram)' in scripts
    assert 'function setSourceLinks(id, pages)' in scripts
    assert 'The Judgment · James Legge, 1882' in raw
    assert 'The Great Image · James Legge, 1882' in raw
    for source_id in ('resJudgmentSource','resImageSource','transJudgmentSource','transImageSource'):
        assert any(attrs.get('id')==source_id for _,attrs in Page(ROOT/'mystery-school/iching/index.html').tags)
    assert 'quantum' not in raw.lower()
    assert 'retainedReflection' not in scripts
    assert 'No individual changing-line translation is supplied.' in raw
    assert 'The Judgment (King Wen)' not in raw
    assert 'The Image (Confucius / Duke of Zhou)' not in raw
