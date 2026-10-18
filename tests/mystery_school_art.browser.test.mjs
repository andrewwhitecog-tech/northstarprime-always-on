import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require(process.env.NSP_PLAYWRIGHT_MODULE || 'playwright');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const evidence=process.env.NSP_MYSTERY_QA_DIR;
if(!evidence) throw new Error('NSP_MYSTERY_QA_DIR must name the isolated review directory');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
let server,browser,origin;
before(async()=>{
  await mkdir(evidence,{recursive:true});
  server=createServer(async(req,res)=>{
    try {
      let file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
      let rel=relative(root,file);
      if(rel.startsWith('..')||rel.split(sep).includes('.git')) {res.writeHead(403);res.end();return;}
      if((await stat(file)).isDirectory()) file=resolve(file,'index.html');
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:data);
    } catch {res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.NSP_BROWSER_EXECUTABLE||undefined,args:['--mute-audio']});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function pageFor(t,path,width){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
 t.after(()=>context.close());
 const page=await context.newPage();const resources=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>resources.push({path:new URL(response.url()).pathname,status:response.status(),type:response.headers()['content-type']||''}));
 await page.goto(origin+path,{waitUntil:'networkidle'});
 return {page,resources,errors};
}
async function loadPictures(page){
 const height=await page.evaluate(()=>document.documentElement.scrollHeight);
 for(let y=0;y<height;y+=750){await page.evaluate(y=>window.scrollTo(0,y),y);await page.waitForTimeout(35);}
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(120);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(image=>image.decode().catch(()=>null))));
}
async function inspectPage(t,route,width,name,artSelector,copySelector){
 const {page,resources,errors}=await pageFor(t,route,width);await loadPictures(page);
 await page.screenshot({path:evidence+'/'+name+'_viewport.png'});await page.screenshot({path:evidence+'/'+name+'_full.png',fullPage:true});
 await writeFile(evidence+'/'+name+'_REQUESTS_ACTUAL.json',JSON.stringify({route,width,resources,errors,scope:'Local candidate preview only'},null,2));
 const art=page.locator(artSelector);const image=await art.evaluate(img=>({src:img.getAttribute('src'),complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,width:img.getBoundingClientRect().width,height:img.getBoundingClientRect().height,transform:getComputedStyle(img).transform,animation:getComputedStyle(img).animationName,objectFit:getComputedStyle(img).objectFit}));
 assert.equal(image.naturalWidth,1672);assert.equal(image.naturalHeight,941);
 assert.ok(Math.abs(image.width/image.height-1672/941)<.01,JSON.stringify(image));
 assert.equal(image.transform,'none');assert.equal(image.animation,'none');assert.equal(image.objectFit,'contain');
 const imageBox=await art.boundingBox();const copyBox=await page.locator(copySelector).boundingBox();
 assert.ok(copyBox.x+copyBox.width<=imageBox.x+1||imageBox.x+imageBox.width<=copyBox.x+1||copyBox.y+copyBox.height<=imageBox.y+1||imageBox.y+imageBox.height<=copyBox.y+1,'Hero copy overlaps painting');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal page overflow');
 const broken=await page.locator('img').evaluateAll(imgs=>imgs.filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.src));assert.deepEqual(broken,[]);
 const share=await page.locator('meta[property="og:image"]').getAttribute('content');const shareResponse=await page.request.get(origin+new URL(share).pathname);assert.equal(shareResponse.status(),200);assert.match(shareResponse.headers()['content-type'],/image\/png/);
 const sourceProperties=await page.locator('img').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),natural:[i.naturalWidth,i.naturalHeight],rendered:[i.width,i.height]})));
 if(route==='/mystery-school/'){
   assert.equal(await page.locator('.story-art').innerText(),'');
   await page.locator('.story-door').screenshot({path:evidence+'/'+name+'_dream_court_card.png'});
 }
 await writeFile(evidence+'/'+name+'_ACTUAL.json',JSON.stringify({route,width,localOrigin:origin,image,resources,errors,sourceProperties,share:{url:share,localPreviewStatus:shareResponse.status()},scope:'Local candidate browser inspection; not deployed/live proof'},null,2));
 assert.deepEqual(resources.filter(r=>r.status>=400),[]);assert.deepEqual(errors,[]);
}
for(const width of [1265,390]){
 test('Mystery entrance original art and clear copy at '+width+'px',t=>inspectPage(t,'/mystery-school/',width,'mystery_school_'+width,'.artifact figure img','.invitation'));
 test('Oracle original art and separate invitation at '+width+'px',t=>inspectPage(t,'/mystery-school/iching/',width,'oracle_'+width,'.oracle-art img','.oracle-invitation'));
}
test('existing three-step attention exercise still keeps and clears optional notes',async t=>{
 const {page,errors}=await pageFor(t,'/mystery-school/',1265);
 await page.locator('#practice-start').click();await page.locator('#observation').fill('A cool edge.');await page.locator('#practice-next').click();await page.locator('#interpretation').fill('A vessel for starlight.');await page.locator('#practice-next').click();
 assert.equal(await page.locator('#observation-review').textContent(),'A cool edge.');assert.equal(await page.locator('#interpretation-review').textContent(),'A vessel for starlight.');
 await page.locator('#next-attention').fill('Notice the window.');await page.locator('#practice-next').click();assert.equal(await page.locator('#attention-review').textContent(),'Notice the window.');
 await page.locator('#practice-review').click();assert.equal(await page.locator('#next-attention').inputValue(),'Notice the window.');await page.locator('#practice-next').click();await page.locator('#practice-restart').click();assert.equal(await page.locator('#observation').inputValue(),'');assert.deepEqual(errors,[]);
});
test('oracle silent preset and reset retain six-line interpretation mechanics',async t=>{
 const {page,errors}=await pageFor(t,'/mystery-school/iching/',1265);
 assert.equal(await page.evaluate(()=>window.AetheriaIChing.HEXAGRAMS.length),64);
 // Preset exploration is silent; toss/instant audio is deliberately not exercised headlessly.
 await page.locator('button.preset-pill-hex[data-hex="1"]').click();assert.match(await page.locator('#castStatusBadge').textContent(),/Hexagram Sealed/);assert.equal(await page.locator('#hexagramStack .line-solid,#hexagramStack .line-broken').count(),6);
 await page.locator('#btnReset').click();assert.match(await page.locator('#castStatusBadge').textContent(),/Line 1 of 6/);assert.equal(await page.locator('#hexagramStack .line-empty').count(),6);assert.deepEqual(errors,[]);
});
test('legacy oracle doorway preserves query and fragment on the existing destination',async t=>{
 const {page,errors}=await pageFor(t,'/iching/?source=preview#coins',390);
 await page.waitForURL(origin+'/mystery-school/iching/?source=preview#coins');assert.deepEqual(errors,[]);
});

// Force a formerly missing identity through the existing silent preset event path.
test('formerly missing31 renders complete sourced Legge passages at390px',async t=>{
 const {page,errors}=await pageFor(t,'/mystery-school/iching/',390);
 const preset=page.locator('button.preset-pill-hex').first();
 await preset.evaluate(button=>button.dataset.hex='31');await preset.click();
 assert.equal(await page.locator('#resGlyph').textContent(),'䷞');
 assert.equal(await page.locator('#resTitle').textContent(),'Hexagram 31: Influence');
 assert.equal(await page.locator('#resChinese').textContent(),'King Wen 31 · Unicode U+4DDE');
 const sourceFixture=JSON.parse(await readFile(new URL('./fixtures/iching_legge1882_passages.json',import.meta.url),'utf8'));const expected=sourceFixture.records.find(r=>r.number===31);
 assert.equal(await page.locator('#resJudgment').textContent(),expected.judgment.text);
 assert.equal(await page.locator('#resImage').textContent(),expected.image.text);
 assert.equal(await page.locator('#resJudgmentSource a').getAttribute('href'),expected.judgment.source_urls[0]);
 assert.equal(await page.locator('#resImageSource a').getAttribute('href'),expected.image.source_urls[0]);
 assert.equal(await page.locator('#resJudgmentSource').innerText(),'Legge (1882), p. 123');
 assert.equal(await page.locator('#resImageSource').innerText(),'Legge (1882), p. 305');
 assert.equal(await page.locator('#resJudgmentSource a').evaluate(link=>getComputedStyle(link).color),'rgb(110, 231, 183)');
 assert.equal(await page.locator('#hexagramStack .line-solid,#hexagramStack .line-broken').count(),6);
 assert.match(await page.locator('#oracle-source-heading').textContent(),/Sources/);
 assert.equal(await page.locator('#resultPanel').innerText().then(t=>t.includes('undefined')),false);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.evaluate(()=>{const panel=document.getElementById('resultPanel').getBoundingClientRect();const header=document.querySelector('.iching-header').getBoundingClientRect();window.scrollTo(0,window.scrollY+panel.top-header.height-12);});
 await page.waitForTimeout(80);
 const titleBox=await page.locator('#resTitle').boundingBox();const headerBox=await page.locator('.iching-header').boundingBox();assert.ok(titleBox.y>=headerBox.y+headerBox.height,'Reading title is hidden under the sticky navigation');
 await page.screenshot({path:evidence+'/oracle_390_formerly_missing31_reading.png'});
 await page.screenshot({path:evidence+'/oracle_390_formerly_missing31_full.png',fullPage:true});
 await writeFile(evidence+'/oracle_390_formerly_missing31_ACTUAL.json',JSON.stringify({case:31,sourceBits:'001110',glyph:await page.locator('#resGlyph').textContent(),title:await page.locator('#resTitle').textContent(),subtitle:await page.locator('#resChinese').textContent(),judgment:await page.locator('#resJudgment').textContent(),errors,scope:'Actual local candidate silent preset path; not live'},null,2));
 assert.deepEqual(errors,[]);
});

test('all64 silent readings have sourced judgment and Great Image, with no fabricated changing-line texts',async t=>{
 const {page,errors}=await pageFor(t,'/mystery-school/iching/',1265);const fixture=JSON.parse(await readFile(new URL('./fixtures/iching_legge1882_passages.json',import.meta.url),'utf8'));
 // Reuse a real preset event path; no toss/instant playback or external requests.
 const preset=page.locator('button.preset-pill-hex').first();
 for(const record of fixture.records){if(record.number!==1)await page.locator('#btnReset').click();await preset.evaluate((button,n)=>button.dataset.hex=String(n),record.number);await preset.click();assert.equal(await page.locator('#resJudgment').textContent(),record.judgment.text);assert.equal(await page.locator('#resImage').textContent(),record.image.text);assert.equal(await page.locator('#resJudgmentSource a').count(),record.judgment.source_urls.length);assert.equal(await page.locator('#resImageSource a').count(),record.image.source_urls.length);}
 assert.ok(!(await page.title()).toLowerCase().includes('quantum'));assert.match(await page.locator('#oracle-source-heading').textContent(),/Sources/);assert.deepEqual(errors,[]);
});
