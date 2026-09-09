#!/usr/bin/env python3
"""Verify Chronosphere discovery, exact release files and optional public download identity."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import argparse,hashlib,json,re,urllib.request,xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
REPO='https://github.com/andrewwhitecog-tech/chronosphere'
RELEASE=REPO+'/releases/tag/v1.0.0'

class Links(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.images=[]
    def handle_starttag(self,tag,attrs):
        values=dict(attrs)
        if tag=='a' and 'href' in values:self.links.append(values['href'])
        if tag=='img' and 'src' in values:self.images.append(values['src'])

def verify(root,network=False):
    failures=[];checks=[]
    def check(name,condition):
        (checks if condition else failures).append(name)
    manifest=json.loads((root/'CHRONOSPHERE_RELEASE_MANIFEST.json').read_text(encoding='utf-8'))
    check('eleven themes and sixteen bundled visual assets',manifest['theme_count']==11 and manifest['bundled_visual_assets']==16)
    check('all seventeen release web files listed',len(manifest['browser_files'])==17)
    for row in manifest['browser_files']:
        path=(root/row['path']).resolve()
        valid=path.is_relative_to((root/'chronosphere').resolve()) and path.is_file()
        check('release identity '+row['path'],valid and len(path.read_bytes())==row['bytes'] and hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'])
    page=(root/'software/index.html').read_text(encoding='utf-8')
    parser=Links();parser.feed(page)
    required=['/chronosphere/',REPO,RELEASE,REPO+'/releases/download/v1.0.0/'+manifest['source_archive']['file'],REPO+'/releases/download/v1.0.0/'+manifest['windows_archive']['file']]
    check('browser, source, Windows and release links',all(url in parser.links for url in required))
    check('unsigned build and correct runtime prerequisites',all(text in page for text in ['unsigned','.NET 10 Desktop Runtime','Microsoft Edge WebView2 Runtime','Windows 11']))
    check('clear browser versus native layout boundary',"Ordinary browser tabs do not have" in page)
    check('no account or API key claim',"No account or API key needed" in page)
    check('catalog canonical and one H1','href="https://northstarprime.net/software/"' in page and len(re.findall(r'<h1\b',page))==1)
    for image in parser.images:check('catalog image '+image,(root/image.lstrip('/')).is_file())
    for name in ['index.html','links/index.html']:
        check('software discovery from '+name,'href="/software/"' in (root/name).read_text(encoding='utf-8'))
    sitemap=ET.parse(root/'sitemap.xml')
    locs={e.text for e in sitemap.iter() if e.tag.endswith('}loc') or e.tag=='loc'}
    check('both public routes in sitemap',{'https://northstarprime.net/software/','https://northstarprime.net/chronosphere/'}<=locs)
    app=(root/'chronosphere/index.html').read_text(encoding='utf-8')
    check('private workstation URLs absent',not re.search(r'8909|100\.99\.177\.|192\.168\.50\.|C:[\\/]+Users[\\/]|NORTHSTAR_AUTH_TOKEN',app))
    check('session-only disconnected health default','let oracleEndpoint = null;' in app and "let seraOracleStatus = 'DISCONNECTED';" in app)
    check('browser app does not require native bridge',"const NATIVE_SHELL = !!(window.chrome && window.chrome.webview);" in app)
    check('MIT and artwork notice accompany browser app',(root/'chronosphere/LICENSE').is_file() and (root/'chronosphere/ARTWORK_NOTICE.md').is_file())
    check('no adapter or private configuration published',not any(p.name in {'serve.py','config.local.json','app.py','oracle_seraphim_service.py','auth.json'} for p in (root/'chronosphere').rglob('*')))
    match=re.search(r'<script type="application/ld\+json">(.*?)</script>',page,re.S)
    data=json.loads(match.group(1)) if match else {}
    app_data=data.get('mainEntity',{})
    check('structured data identifies free 1.0.0 application',data.get('@type')=='CollectionPage' and app_data.get('softwareVersion')=='1.0.0' and app_data.get('offers',{}).get('price')=='0')
    if network:
        for key in ['source_archive','windows_archive']:
            item=manifest[key];url=REPO+'/releases/download/v1.0.0/'+item['file']
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'NSP-Chronosphere-Release-Check/1'}),timeout=45) as response:
                payload=response.read(12_000_000)
            check('public download identity '+item['file'],len(payload)==item['bytes'] and hashlib.sha256(payload).hexdigest()==item['sha256'])
    return {'status':'FAIL' if failures else 'PASS','checks':checks,'failures':failures,'network_downloads_checked':network}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--artifact',type=Path,default=ROOT);parser.add_argument('--network',action='store_true')
    args=parser.parse_args();result=verify(args.artifact.resolve(),args.network)
    print(json.dumps(result,indent=2));raise SystemExit(bool(result['failures']))
