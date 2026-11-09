'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {chromium}=require(process.env.NSP_PLAYWRIGHT_PATH||'playwright');
const repo='https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/';
const revision='f531d31e';const baseline='f9888033f6815b5526af5b8359ac53542cfe48fc';
const oldNote='Public profile permalinks (fee-0 Option B interim while chromaticprints.store stays unregistered).';
const newNote='Choose a digital download below, then complete your purchase on Gumroad.';
const out=path.join(process.env.NSP_PLAYTEST_OUT||process.cwd(),'chromatic');fs.mkdirSync(out,{recursive:true});
const report={checkedUtc:new Date().toISOString(),revision,baseline,scope:'Independent rendered copy review at pinned source; no link clicks or purchases',viewports:[]};let browser;
async function get(rev){const r=await fetch(repo+rev+'/chromatic/index.html');assert.ok(r.ok,'source HTTP '+r.status);return r.text();}
(async()=>{try{const [html,before]=await Promise.all([get(revision),get(baseline)]);assert.equal(before.split(oldNote).length,2,'exact prior note appears once');assert.equal(html,before.replace(oldNote,newNote),'candidate differs only by the named copy edit');report.sourceSha256=crypto.createHash('sha256').update(html).digest('hex');
 browser=await chromium.launch({headless:true,args:['--disable-gpu','--disable-dev-shm-usage','--no-sandbox']});const page=await browser.newPage();
 for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.setContent(html.replace('<head>','<head><base href="https://northstarprime.net/">'),{waitUntil:'networkidle',timeout:30000});
 const note=await page.locator('.gumroad-block > .note').innerText();assert.equal(note,newNote);assert.ok(!await page.locator('body').innerText().then(t=>t.includes('Option B interim')));
 const links=await page.locator('.gumroad-list a').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),href:n.href})));assert.equal(links.length,18);assert.equal(new Set(links.map(x=>x.href)).size,18);assert.ok(links.every(x=>x.href.startsWith('https://andrewcog.gumroad.com/l/')&&x.text));
 const size=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.viewport,'no horizontal overflow at '+width);
 const scripts=await page.locator('script[type="application/ld+json"]').allTextContents();for(const script of scripts)JSON.parse(script);
 await page.screenshot({path:path.join(out,'chromatic-'+width+'.png'),fullPage:true});report.viewports.push({width,note,links:links.length,uniqueLinks:new Set(links.map(x=>x.href)).size,noHorizontalOverflow:true,jsonLdBlocks:scripts.length,renderedTitle:await page.title()});}
 report.passed=true;
}catch(e){report.passed=false;report.error=e.stack;console.error(e.stack);process.exitCode=1;}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'CHROMATIC_REVIEW_ACTUAL.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
