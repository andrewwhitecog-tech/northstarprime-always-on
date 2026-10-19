import assert from 'node:assert/strict';
import test,{before,after} from 'node:test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import os from 'node:os';
os.setPriority(0,os.constants.priority.PRIORITY_BELOW_NORMAL);
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.NSP_PLAYWRIGHT_MODULE||'playwright');
const sharp=require(process.env.NSP_SHARP_MODULE||'sharp');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=process.env.NSP_PAINT_EVIDENCE;
if(!out)throw Error('NSP_PAINT_EVIDENCE must name a durable evidence directory');
const digest=b=>createHash('sha256').update(b).digest('hex');
let browser,server,origin,mode='normal',native,html,editor,records,allRecords,requests=[];
const fixturePages=()=>mode==='all'?allRecords:mode==='empty'?[{kind:'kids',title:'Missing page',src:'assets/reviewed/missing.png'}]:mode==='inventory'?[records[0],{kind:'kids',title:'Missing page',src:'assets/reviewed/missing.png'},{...records[0],kind:'unsupported',title:'Invalid shelf'},{...records[0],src:'https://example.invalid/outside.png',title:'Unapproved external origin'},{...records[0],src:'https://raw.githubusercontent.com/andrewwhitecog-tech/northstarprime-always-on/main/coloring-studio/assets/mutable.png',title:'Mutable raw URL'},{...records[0],src:'https://raw.githubusercontent.com/another-owner/another-repository/'+('a'.repeat(40))+'/coloring-studio/assets/wrong.png',title:'Wrong raw repository'},records[1]]:records;
async function serveAll(req,res,i){try{const body=await readFile(resolve(root,'coloring-studio',allRecords[i].src));res.writeHead(200,{'Content-Type':'image/png','Content-Length':body.length});res.end(req.method==='HEAD'?undefined:body)}catch{res.writeHead(404);res.end()}}
before(async()=>{
 await mkdir(out,{recursive:true});
 [html,editor]=await Promise.all(['index.html','paint-editor.js'].map(p=>readFile(resolve(root,'coloring-studio',p),'utf8')));
 allRecords=JSON.parse(await readFile(resolve(root,'coloring-studio/reviewed-inventory.json'),'utf8')).pages;records=allRecords.slice(0,2);
 native=await Promise.all(records.map(p=>readFile(resolve(root,'coloring-studio',p.src))));
 console.log('PAINT_SOURCE_ACTUAL '+JSON.stringify({editorSha256:digest(editor),native:records.map((p,i)=>({title:p.title,sha256:digest(native[i]),expected:p.sha256,bytes:native[i].length}))}));
 for(let i=0;i<2;i++)assert.equal(digest(native[i]),records[i].sha256);
 server=createServer((req,res)=>{const u=new URL(req.url,'http://local');requests.push({method:req.method,path:u.pathname,mode});res.setHeader('Cache-Control','no-store');let body,type='text/html';
 if(u.pathname==='/coloring-studio/')body=html;
 else if(u.pathname==='/coloring-studio/paint-editor.js'){body=editor;type='text/javascript'}
 else if(u.pathname==='/coloring-studio/reviewed-inventory.json'){body=JSON.stringify({pages:fixturePages()});type='application/json'}
 else {const active=mode==='all'?allRecords:records;const i=active.findIndex(p=>new URL(p.src,origin+'/coloring-studio/').pathname===u.pathname);if(i>=0&&!(mode==='failed-next'&&i===1&&req.method==='GET')){body=mode==='all'?null:native[i];if(mode==='all'){serveAll(req,res,i);return}type='image/png'}else{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Intentional unavailable-source fixture');return}}
 res.writeHead(200,{'Content-Type':type,'Content-Length':Buffer.byteLength(body)});res.end(req.method==='HEAD'?undefined:body);
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,executablePath:process.env.NSP_BROWSER_EXECUTABLE||undefined,args:['--mute-audio']});
});
after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server?.close(r));await writeFile(resolve(out,'HTTP_REQUESTS_ACTUAL.json'),JSON.stringify(requests,null,2))});
async function fixture(t,width,selectedMode){mode=selectedMode;const c=await browser.newContext({viewport:{width,height:900},hasTouch:width<500,isMobile:width<500,reducedMotion:'reduce',acceptDownloads:true});t.after(()=>c.close());const page=await c.newPage();page.__paintRequests=[];page.on('request',r=>page.__paintRequests.push(r.url()));await page.addInitScript(()=>{window.__printCalls=0;window.print=()=>window.__printCalls++});page.setDefaultTimeout(10000);await page.goto(origin+'/coloring-studio/');return page}
async function ready(page){await page.waitForFunction(()=>document.querySelector('#paintStatus').dataset.state==='ready')}
async function png(page){return Buffer.from(await page.locator('#paintCanvas').evaluate(c=>c.toDataURL('image/png').split(',')[1]),'base64')}
async function decoded(b){return sharp(b).ensureAlpha().raw().toBuffer({resolveWithObject:true})}
async function samePixels(a,b){const[x,y]=await Promise.all([decoded(a),decoded(b)]);assert.deepEqual(x.info,y.info);assert.deepEqual(x.data,y.data)}
async function download(page,id,name){const p=page.waitForEvent('download');await page.locator(id).click();const d=await p;assert.equal(await d.failure(),null);const path=resolve(out,name);await d.saveAs(path);return readFile(path)}
for(const width of [1440,390])test('failed replacement preserves editable pixels, export, original, undo and print at '+width,async t=>{
 const page=await fixture(t,width,'failed-next');await ready(page);const baseline=await png(page);await page.locator('#paintCanvas').scrollIntoViewIfNeeded();const box=await page.locator('#paintCanvas').boundingBox();const x=box.x+box.width*.42,y=box.y+box.height*.3;
 if(width===390){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+25,y:y+30}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach()}else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+25,{steps:5});await page.mouse.up()}
 const colored=await png(page);assert.notEqual(digest(colored),digest(baseline));
 const failure=page.waitForResponse(r=>r.status()===404&&r.url().includes(records[1].src.split('/').pop()));await page.locator('#nextPage').click();await failure;await page.waitForFunction(()=>document.querySelector('#paintStatus').dataset.state==='error');await samePixels(await png(page),colored);
 for(const id of ['save','downloadOriginal','undo','reset','print'])assert.equal(await page.locator('#'+id).isEnabled(),true,id+' must recover after failed replacement');
 await samePixels(await download(page,'#save','failed-next-'+width+'-colored.png'),colored);assert.equal(digest(await download(page,'#downloadOriginal','failed-next-'+width+'-original.png')),records[0].sha256);
 await page.locator('#print').click();assert.equal(await page.evaluate(()=>window.__printCalls),1);await page.pdf({path:resolve(out,'failed-next-'+width+'.pdf'),preferCSSPageSize:true,printBackground:true});
 await page.locator('#undo').click();await samePixels(await png(page),baseline);await page.screenshot({path:resolve(out,'failed-next-'+width+'.png'),fullPage:false});
 mode='normal';await page.locator('#retryPage').click();await ready(page);assert.equal(await page.locator('#pageTitle').textContent(),records[1].title);
 await page.locator('#previousPage').click();await ready(page);assert.equal(await page.locator('#pageTitle').textContent(),records[0].title);
});
test('unavailable, unsupported, mutable raw and unapproved external entries never enter gallery, count or paging',async t=>{
 const page=await fixture(t,390,'inventory');await ready(page);assert.equal(await page.locator('#gallery .page-card').count(),2);assert.equal(await page.locator('[data-public-coloring-count]').getAttribute('data-public-coloring-count'),'2');assert.equal(await page.locator('[data-filter="all"]').textContent(),'Show all 2');assert.match(await page.locator('.hero h1').textContent(),/^2 reviewed pages/);
 assert.equal(page.__paintRequests.some(u=>u.includes('example.invalid')||u.includes('/main/coloring-studio/')||u.includes('another-owner')),false,'Rejected inventory URLs are never requested');
 assert.deepEqual(await page.locator('#gallery h2').allTextContents(),records.map(p=>p.title));await page.locator('#nextPage').click();await ready(page);assert.equal(await page.locator('#pageTitle').textContent(),records[1].title);await page.locator('#nextPage').click();await ready(page);assert.equal(await page.locator('#pageTitle').textContent(),records[0].title);await page.screenshot({path:resolve(out,'filtered-inventory-390.png')});
});
test('an unavailable inventory exposes an honest empty state, zero count and usable retry',async t=>{
 const page=await fixture(t,390,'empty');await page.waitForFunction(()=>document.querySelector('#paintStatus').dataset.state==='error');assert.equal(await page.locator('#gallery .page-card').count(),0);assert.equal(await page.locator('[data-public-coloring-count]').getAttribute('data-public-coloring-count'),'0');for(const id of ['save','downloadOriginal','reset','print'])assert.equal(await page.locator('#'+id).isDisabled(),true);assert.equal(await page.locator('#retryPage').isVisible(),true);mode='normal';await page.locator('#retryPage').click();await ready(page);assert.equal(await page.locator('#gallery .page-card').count(),2);
});

test('all actual reviewed PNGs retain hashes, native dimensions and counted gallery without duplicated fixtures',async t=>{
 assert.equal(allRecords.length,20);
 for(const p of allRecords){const b=await readFile(resolve(root,'coloring-studio',p.src));assert.equal(b.length,p.bytes);assert.equal(digest(b),p.sha256);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a')}
 const page=await fixture(t,390,'all');await ready(page);assert.equal(await page.locator('#gallery .page-card').count(),allRecords.length);assert.equal(await page.locator('[data-public-coloring-count]').getAttribute('data-public-coloring-count'),String(allRecords.length));
 assert.equal(requests.filter(r=>r.mode==='all'&&r.method==='HEAD').length,allRecords.length);
 const dimensions=await page.locator('#paintCanvas').evaluate(c=>({width:c.width,height:c.height}));const original=await sharp(resolve(root,'coloring-studio',allRecords[0].src)).metadata();assert.deepEqual(dimensions,{width:original.width,height:original.height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:resolve(out,'all-reviewed-390.png')});
});

for(const width of [320,390,1440])test('all palette swatches fit the panel and viewport at '+width,async t=>{
 const page=await fixture(t,width,'normal');await ready(page);await page.locator('#palette').scrollIntoViewIfNeeded();
 const geometry=await page.locator('#palette').evaluate(el=>{const box=e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};return{palette:box(el),panel:box(el.closest('.panel')),swatches:[...el.querySelectorAll('button')].map(box),viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}});
 await writeFile(resolve(out,'palette-'+width+'-geometry.json'),JSON.stringify(geometry,null,2));await page.screenshot({path:resolve(out,'palette-'+width+'.png')});
 assert.equal(geometry.swatches.length,12);assert.ok(geometry.scrollWidth<=geometry.viewport,'No horizontal document overflow');
 for(const swatch of geometry.swatches){assert.ok(swatch.width>=44&&swatch.height>=44,'Every color remains a usable target');assert.ok(swatch.left>=geometry.panel.left-.5&&swatch.right<=geometry.panel.right+.5,'Every swatch stays within panel');assert.ok(swatch.left>=geometry.palette.left-.5&&swatch.right<=geometry.palette.right+.5,'Every swatch stays within palette');assert.ok(swatch.left>=-.5&&swatch.right<=geometry.viewport+.5,'Every swatch stays within viewport')}
 const choices=page.locator('#palette .swatch');for(let i=0;i<12;i++){const button=choices.nth(i),expected=(await button.getAttribute('aria-label')).replace('Paint color ','');if(width<500)await button.tap();else await button.click();assert.equal(await page.locator('#customColor').inputValue(),expected);assert.equal(await button.getAttribute('class'),'swatch active')}
});
