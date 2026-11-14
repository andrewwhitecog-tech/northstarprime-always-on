'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

// Exercise each actual harness filter without loading Playwright or launching a browser.
function classifier(file){
  const source=fs.readFileSync(path.join(__dirname,file),'utf8');
  const filter=source.match(/const external=entry\.requests\.filter\(r=>([^;]+)\);assert\.deepEqual\(external/);
  assert(filter,'The real runtime response filter is present in '+file);
  const helper=source.match(/function isLocalRuntimeURL\(raw,base\)\{[\s\S]*?\n\}/)?.[0]||'';
  return vm.runInNewContext(`${helper}\n(url,base)=>{const r={url};return !(${filter[1]});}`,{URL});
}

const base='http://127.0.0.1:4312';
for(const file of ['crib-recovery.browser.cjs','crib-chapters.browser.cjs']){
  const local=classifier(file);
  test(file+' accepts same-origin requests and embedded GLB texture blobs',()=>{
    for(const url of [base+'/',base+'/arcade/model.glb',base+'/texture.png?revision=1',
      'blob:'+base+'/32830378-10bf-4820-82bb-c220899e730a'])assert.equal(local(url,base),true,url);
  });
  test(file+' rejects foreign origins, including foreign blobs',()=>{
    for(const origin of ['https://example.com','http://localhost:4312','http://127.0.0.1:4313','https://127.0.0.1:4312']){
      for(const url of [origin+'/asset.png','blob:'+origin+'/32830378-10bf-4820-82bb-c220899e730a'])assert.equal(local(url,base),false,url);
    }
  });
  test(file+' rejects origin-prefix lookalikes',()=>{
    for(const url of [base+'0/asset.png',base+'@example.com/asset.png','blob:'+base+'0/texture',
      'blob:'+base+'@example.com/texture'])assert.equal(local(url,base),false,url);
  });
  test(file+' fails closed for malformed, opaque and non-runtime protocols',()=>{
    for(const url of ['',null,undefined,'/relative.png','not a URL','blob:null/texture',
      'blob:blob:'+base+'/texture','data:image/png;base64,aGVsbG8=','javascript:alert(1)',
      'file:///texture.png','ftp://127.0.0.1:43127/asset.png','ws://127.0.0.1:43127/socket'])assert.equal(local(url,base),false,String(url));
  });
}
