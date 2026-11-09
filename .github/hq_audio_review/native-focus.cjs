'use strict';
// Playwright1.55.1 deliberately forces every page focused/visible. That prevents a
// native tab-loss test even in headed Chromium. Disable only that fixture override;
// the game still has to receive actual browser events and pass its strict checks.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const assert=require('node:assert/strict');
const root=path.resolve(process.env.NSP_PLAYWRIGHT_PATH,'../playwright-core');
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version,'1.55.1','review a different browser-driver source before adjusting its focus fixture');
const file=path.join(root,'lib/server/chromium/crPage.js');const before=fs.readFileSync(file,'utf8');
const anchor=/(this\._client\.send\(["']Emulation\.setFocusEmulationEnabled["'],\s*\{\s*enabled:\s*)true(\s*\}\))/g;
assert.equal([...before.matchAll(anchor)].length,1,'exactly one known owning-session initialization must match');
const after=before.replace(anchor,'$1false$2');assert.notEqual(before,after);
fs.writeFileSync(file,after);
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const receipt={sourcePackage:'playwright-core',version:'1.55.1',file:'lib/server/chromium/crPage.js',reason:'Native browser visibility/focus acceptance; remove driver-forced focused/visible override only',beforeSha256:hash(before),afterSha256:hash(after),replacementCount:1};
const out=path.resolve(process.env.NSP_PLAYTEST_OUT);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'NATIVE_FOCUS_FIXTURE.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
