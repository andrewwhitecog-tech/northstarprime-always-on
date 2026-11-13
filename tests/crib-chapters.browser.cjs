'use strict';
// Real browser input only. Observers read cloned game snapshots; no state setters,
// fake clocks, entity injection, synthetic wins or canned QA results.
const assert=require('node:assert/strict');
const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const http=require('node:http'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {chromium}=require(process.env.NSP_PLAYWRIGHT_PATH||'playwright');
const repo=path.resolve(__dirname,'..');
const out=process.env.NSP_PLAYTEST_OUT;
if(!out)throw Error('NSP_PLAYTEST_OUT must identify the actual evidence directory');
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function isLocalRuntimeURL(raw,base){
  try{
    const expected=new URL(base),actual=new URL(raw);
    // Embedded GLB textures use blob URLs whose origin is their creator's origin.
    return expected.origin!=='null'&&['http:','https:','blob:'].includes(actual.protocol)&&actual.origin===expected.origin;
  }catch{return false;}
}
const report={schema:'northstar.crib.chapters.real_browser.v1',startedUtc:new Date().toISOString(),
 scope:'Selected plannedCases only. Real desktop and390x844 emulated-touch Chromium chapter journeys. Software CI is not physical-phone, RTX performance or finished visual acceptance. Kosher desktop requires all three contracts and the public ending; touch requires keeper work and saved courier unlock only. Personal mirror ending and touch full campaign remain uncovered. Night covers both chapter circuits and replay.',
 selectedCase:process.env.NSP_BROWSER_CASE??'all',expectedCaseCount:0,plannedCases:[],renderCoverage:'Default full-quality opening compositor; subsequent real mechanics in visibly selected LOW POWER. No native-phone or FPS acceptance.',source:[],cases:[],serverErrors:[]};
function persist(){fs.writeFileSync(path.join(out,'CRIB_CHAPTERS_REAL_BROWSER.json'),JSON.stringify(report,null,2)+'\n');}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.fbx':'application/octet-stream','.md':'text/plain'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');let p=path.resolve(repo,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(repo+path.sep)){res.writeHead(403);res.end();return;}if(u.pathname.endsWith('/'))p=path.join(p,'index.html');const b=await fsp.readFile(p);const relative=path.relative(repo,p).split(path.sep).join('/'),pin=report.source.find(row=>row.path===relative);if(!pin||pin.bytes!==b.length||pin.sha256!==sha(b))throw Error('Unpinned or changed runtime dependency '+relative);res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:b);}catch(e){report.serverErrors.push({url:req.url,error:e.code||String(e)});res.writeHead(404);res.end('Unavailable actual source file');}});
const CASE_WALL_MS=20*60*1000;
const ALL_CASES=[{game:'kosher-lines',device:'desktop1280',phone:false},{game:'night-in',device:'desktop1280',phone:false},{game:'kosher-lines',device:'touch390',phone:true},{game:'night-in',device:'touch390',phone:true}];
function selectedCases(){const requested=process.env.NSP_BROWSER_CASE;if(requested===undefined)return ALL_CASES.map(c=>({...c}));const found=ALL_CASES.find(c=>c.game+':'+c.device===requested);if(!found)throw Error('NSP_BROWSER_CASE must exactly match one of '+ALL_CASES.map(c=>c.game+':'+c.device).join(', ')+'; received '+JSON.stringify(requested));return[{...found}];}
function completedSelectedCases(){return report.expectedCaseCount>0&&report.cases.length===report.expectedCaseCount&&report.cases.every((c,i)=>c.passed&&c.name===report.plannedCases[i].game+'-'+report.plannedCases[i].device);}
let RUN_DEADLINE=Date.now()+CASE_WALL_MS;
async function until(read,accept,label,timeout=45000){const stop=Math.min(Date.now()+timeout,RUN_DEADLINE);let last;do{last=await read();if(accept(last))return last;await new Promise(r=>setTimeout(r,100));}while(Date.now()<stop);throw Error(label+' timed out; actual='+JSON.stringify(last));}
// Observe actual simulation time; never advance or replace the game clock.
async function untilGame(read,accept,label,{sim=8,wall=90000,poll=100}={}){
 const started=Date.now(),deadline=Math.min(started+wall,RUN_DEADLINE);let first,last;
 do{last=await read();if(first===undefined)first=last.elapsed;assert(Number.isFinite(first)&&Number.isFinite(last.elapsed),'Actual game elapsed must be observable');if(accept(last))return last;if(last.elapsed-first>sim)throw Error(label+' exceeded actual simulation budget; simAdvanced='+(last.elapsed-first)+'; wallMs='+(Date.now()-started)+'; actual='+JSON.stringify(last));await new Promise(r=>setTimeout(r,poll));}while(Date.now()<deadline);
 throw Error(label+' exceeded bounded wall time before the condition completed; simAdvanced='+(last.elapsed-first)+'; wallMs='+(Date.now()-started)+'; actual='+JSON.stringify(last));
}
const snap=(page,hook)=>page.evaluate(name=>window[name]?.snapshot?.(),hook);
async function shot(page,selector,name){const p=path.join(out,name+'.png');
// Capture the real page compositor without waiting for an animated element to
// become layout-stable. DOM scrolling is for capture only, never gameplay.
await page.evaluate(sel=>{const el=document.querySelector(sel);if(!el)throw Error('Missing canvas '+sel);el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});},selector);
const geometry=await page.evaluate(sel=>{const r=document.querySelector(sel).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};},selector);
const x=Math.max(0,Math.ceil(geometry.x)),y=Math.max(0,Math.ceil(geometry.y)),right=Math.min(geometry.viewportWidth,Math.floor(geometry.x+geometry.width)),bottom=Math.min(geometry.viewportHeight,Math.floor(geometry.y+geometry.height));const clip={x,y,width:right-x,height:bottom-y};
assert(clip.width>0&&clip.height>0,'Actual canvas intersects viewport');assert(clip.width*clip.height/(geometry.width*geometry.height)>=.65,'Compositor crop includes most of actual canvas');
await page.screenshot({path:p,clip,fullPage:false,animations:'allow',caret:'initial',timeout:60000});const bytes=await fsp.readFile(p);const pixels=pngPixels(bytes);const bins=new Map();let low=255,high=0,saturated=0;for(let i=0;i<pixels.rgb.length;i+=pixels.channels*11){const r=pixels.rgb[i],g=pixels.rgb[i+1],b=pixels.rgb[i+2];const v=(r+g+b)/3;low=Math.min(low,v);high=Math.max(high,v);if(Math.max(r,g,b)-Math.min(r,g,b)>18)saturated++;const key=(r>>4)+','+(g>>4)+','+(b>>4);bins.set(key,(bins.get(key)||0)+1);}const samples=[...bins.values()].reduce((a,b)=>a+b,0);assert(high-low>30,'Compositor frame has visible luminance range');assert(bins.size>=16,'Compositor frame is not a monochrome/empty canvas');assert(Math.max(...bins.values())/samples<.98,'Compositor frame is not a solid-color void');return{file:path.basename(p),sha256:sha(bytes),width:pixels.width,height:pixels.height,colorBins:bins.size,luminanceRange:high-low,saturatedSamples:saturated,geometry,clip};}
function pngPixels(buf){assert.equal(buf.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let p=8,width,height,channels,parts=[];while(p+12<=buf.length){const n=buf.readUInt32BE(p),type=buf.toString('ascii',p+4,p+8),b=buf.subarray(p+8,p+8+n);if(type==='IHDR'){width=b.readUInt32BE(0);height=b.readUInt32BE(4);assert.equal(b[8],8);assert([2,6].includes(b[9]));assert.equal(b[12],0);channels=b[9]===6?4:3;}if(type==='IDAT')parts.push(b);p+=12+n;if(type==='IEND')break;}const data=zlib.inflateSync(Buffer.concat(parts)),stride=width*channels,rgb=Buffer.alloc(height*stride);let at=0;for(let y=0;y<height;y++){const filter=data[at++];for(let x=0;x<stride;x++){const raw=data[at++],a=x>=channels?rgb[y*stride+x-channels]:0,b=y?rgb[(y-1)*stride+x]:0,c=y&&x>=channels?rgb[(y-1)*stride+x-channels]:0;let v;if(filter===0)v=raw;else if(filter===1)v=raw+a;else if(filter===2)v=raw+b;else if(filter===3)v=raw+Math.floor((a+b)/2);else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=raw+(pa<=pb&&pa<=pc?a:pb<=pc?b:c);}else throw Error('Unsupported PNG filter');rgb[y*stride+x]=v&255;}}return{width,height,channels,rgb};}
class RealInput{
 constructor(page,phone,selectors,keyboard,focus){Object.assign(this,{page,phone,selectors,keyboard,focus});this.active=[];this.cdp=null;this.points=[];this.visibility={samples:0,minSceneVisibleFraction:1,last:null};}
 async set(actions){actions=[...new Set(actions)].sort();if(JSON.stringify(actions)===JSON.stringify(this.active)){await this.verifyHeld();return;}if(!this.phone){if(!this.active.length&&actions.length)await this.page.locator(this.focus).focus();for(const a of this.active)if(!actions.includes(a))await this.page.keyboard.up(this.keyboard[a]);for(const a of actions)if(!this.active.includes(a))await this.page.keyboard.down(this.keyboard[a]);}else{if(!this.cdp)this.cdp=await this.page.context().newCDPSession(this.page);const measure=()=>this.page.evaluate(({selectors,actions})=>actions.map(action=>{const e=document.querySelector(selectors[action]);if(!e)return{action,missing:true};const b=e.getBoundingClientRect();const top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{action,x:b.x,y:b.y,width:b.width,height:b.height,hit:top===e||e.contains(top),inside:b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1};}),{selectors:this.selectors,actions});let targets=actions.length?await measure():[];if(targets.some(r=>!r.inside||!r.hit)){if(this.points.length)await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});this.points=[];for(const a of actions)await this.page.locator(this.selectors[a]).scrollIntoViewIfNeeded();targets=await measure();}const next=targets.map((r,i)=>{assert(!r.missing&&r.width>=40&&r.height>=40,'Reachable real touch control '+r.action);assert(r.inside,'Simultaneous touch targets fit viewport '+r.action);return{x:r.x+r.width/2,y:r.y+r.height/2,id:i+1,radiusX:2,radiusY:2,force:1};});if(this.points.length)await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});this.points=next;if(this.points.length)await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:this.points});}this.active=actions;await this.verifyHeld();}
 async tap(selector){const el=this.page.locator(selector);if(!this.phone){await el.click();return;}if(!this.cdp)this.cdp=await this.page.context().newCDPSession(this.page);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox();assert(r,'Real touch target exists');const point={x:r.x+r.width/2,y:r.y+r.height/2,id:99,radiusX:2,radiusY:2,force:1};assert.equal(this.points.length,0,'Ordinary tap requires released held controls');await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 // Resolve real touch rectangles BEFORE charging; no DOM lookup is allowed
 // between release of the ollie and the actual trick touch sequence.
 async cacheTouchTap(selector,holds){assert(this.phone);if(!this.cdp)this.cdp=await this.page.context().newCDPSession(this.page);await this.page.locator(selector).scrollIntoViewIfNeeded();const targets=[];for(const [i,sel]of [...holds.map(a=>this.selectors[a]),selector].entries()){const b=await this.page.locator(sel).boundingBox(),v=this.page.viewportSize();assert(b&&b.width>=40&&b.height>=40,'Actual cached touch target '+sel);assert(b.x>=0&&b.y>=0&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,'Cached hold and trick targets simultaneously visible '+sel);targets.push({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1,radiusX:2,radiusY:2,force:1});}return{actions:[...holds],holdPoints:targets.slice(0,-1),tapPoint:targets.at(-1)};}
 async holdCached(plan){
  await this.release();
  // The trick is a native CLICK handler, not pointerdown. Make its finger the
  // primary touch first; it remains pressed while the second finger charges.
  await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[plan.tapPoint]});
  this.points=[...plan.holdPoints,plan.tapPoint];
  await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:this.points});
  this.active=[...plan.actions].sort();await this.verifyHeld();
 }

 // CDP Input.pdl requires EMPTY points on touchEnd. Both existing contacts
 // release in this one actual event; no new contact is invented on touchEnd.
 // https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Input.pdl
 async releaseAndTapCached(plan){assert(this.points.some(p=>p.id===plan.tapPoint.id),'Actual primary trick contact is armed');await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});this.points=[];this.active=[];}

 async verifyHeld(){if(!this.phone||!this.active.length)return;const actual=await this.page.evaluate(({canvasSelector,selectors,actions})=>{const canvas=document.querySelector(canvasSelector),v={width:innerWidth,height:innerHeight};const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};const c=rect(canvas),iw=Math.max(0,Math.min(c.right,v.width)-Math.max(c.x,0)),ih=Math.max(0,Math.min(c.bottom,v.height)-Math.max(c.y,0));return{viewport:v,canvas:c,sceneVisibleFraction:iw*ih/(c.width*c.height),sceneVisibleHeight:ih,controls:actions.map(action=>{const el=document.querySelector(selectors[action]);if(!el)return{action,missing:true};const b=rect(el),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return{action,rect:b,hit:top===el||el.contains(top),inside:b.x>=0&&b.y>=0&&b.right<=v.width+1&&b.bottom<=v.height+1,canvasOverlap:Math.max(0,Math.min(c.right,b.right)-Math.max(c.x,b.x))*Math.max(0,Math.min(c.bottom,b.bottom)-Math.max(c.y,b.y))};})};},{canvasSelector:this.focus==='#stage'?'#world':this.focus,selectors:this.selectors,actions:this.active});this.visibility.samples++;this.visibility.minSceneVisibleFraction=Math.min(this.visibility.minSceneVisibleFraction,actual.sceneVisibleFraction);this.visibility.last=actual;assert(actual.sceneVisibleFraction>=.65&&actual.sceneVisibleHeight>=Math.min(220,actual.canvas.height*.65),'Most scene remains visible during actual touch holds: '+JSON.stringify(actual));for(const c of actual.controls){assert(!c.missing&&c.inside&&c.hit,'Held touch control remains reachable: '+JSON.stringify(actual));assert(c.rect.width>=40&&c.rect.height>=40,'Usable actual held touch control');assert(c.canvasOverlap<1,'Held controls must not obscure scene: '+JSON.stringify(actual));}}
 async release(){await this.set([]);}
}
async function controls(page){const g=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.disabled).map(b=>({name:b.getAttribute('aria-label')||b.textContent.trim(),height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}))}));assert(g.scrollWidth<=g.width+1,'No horizontal overflow');for(const b of g.buttons){assert(b.name,'Each visible control has an accessible name');assert(b.height>=40&&b.width>=40,'Usable control target '+b.name);}return g;}
async function fullQuality(page,hook){const s=await until(()=>snap(page,hook),s=>s?.graphics?.preset==='high'&&s.graphics.pixelRatio>=1&&s.graphics.shadowMapEnabled===true,'Actual default full-quality graphics',90000);const g=s.graphics;assert(g.css.width>0&&g.css.height>0&&g.drawingBuffer.width>0&&g.drawingBuffer.height>0);return g;}
async function lowPower(page,hook){const select=page.locator('#quality');if(!await select.isVisible()){const details=select.locator('xpath=ancestor::details');assert.equal(await details.count(),1,'Quality control has an operable disclosure');await details.locator('summary').click();}assert(await select.isVisible(),'Low power selector is actually visible');await select.scrollIntoViewIfNeeded();await select.focus();await page.keyboard.press('End');await page.keyboard.press('Enter');assert.equal(await select.inputValue(),'low','Native user selection chooses Low power');const s=await until(()=>snap(page,hook),s=>{const g=s?.graphics;return g?.preset==='low'&&g.pixelRatio===.5&&g.shadowMapEnabled===false&&Math.abs(g.drawingBuffer.width-g.css.width*.5)<=2&&Math.abs(g.drawingBuffer.height-g.css.height*.5)<=2;},'Actual Low power drawing buffer and disabled shadows',90000);assert(s.graphics.css.width>0&&s.graphics.css.height>0);if(hook==='__KOSHER_LINES__'){const b=s.renderer.city.arcadeBays;assert.equal(b.quality,'low');assert(b.activeTriangles<=40000&&b.activeTriangles<b.renderedTriangles);assert.equal(b.activeBatches,11);}return{coverage:'LOW POWER gameplay: real user selection; no phone/RTX/FPS acceptance claim',graphics:s.graphics};}
async function assets(page,hook){const s=await until(()=>snap(page,hook),s=>s&&(hook==='__KOSHER_LINES__'?s.renderer?.modelLoaded&&Object.values(s.renderer.assets||{}).every(v=>v==='loaded'):s.assets?.modelLoaded&&s.assets?.animationLoaded&&s.assets.loaded===s.assets.requested),'Actual skinned model load',90000);if(hook==='__KOSHER_LINES__'){const r=s.renderer,a=r.avatar;assert(r.firstFrame&&r.drawCalls>0);const bay=r.city?.arcadeBays;assert(bay?.loaded,'Authored street bay GLB loaded');assert.equal(bay.bays,20);assert.equal(bay.sourceMeshes,8);assert.equal(bay.batches,11);assert.equal(bay.sourceTriangles,6256);assert.equal(bay.error,null);assert.equal(r.city.storyProps.loaded,true);assert.equal(r.city.storyProps.groups,3);assert(r.city.storyProps.triangles<=6000);assert.equal(a.source,'original-vorath-adult-skater-v05');const nr=r.city?.npcRigs;assert(nr?.loaded,'Actual creator residents installed');assert.equal(nr.count,3);assert.equal(nr.installations,3);assert.deepEqual(nr.errors,[]);assert.deepEqual(nr.residents.map(n=>n.role).sort(),['archivist','courier','keeper']);for(const n of nr.residents){assert(n.loaded&&n.bones>=20&&n.skinnedMeshes>=1&&n.vertices>=500,'Real resident skeleton '+n.role);assert.match(n.idleClip,/\|idle$/i);assert(n.skinTextures.length>=1&&n.costumeBindings>=4,'Actual resident skin and bone attachments '+n.role);}assert.equal(r.modelError,null);assert.deepEqual(r.errors,[]);assert.equal(r.contextLost,false);assert(a.modelLoaded&&a.skinLoaded);assert(a.skinnedMeshes>=1&&a.bones>=20&&a.vertices>=500&&a.triangles>=1000);for(const clip of ['idle','jump','run'])assert(a.animations.some(n=>n.toLowerCase().endsWith('|'+clip)),'Real embedded clip '+clip);assert(Object.values(r.assets).every(v=>v==='loaded'),'No requested texture/model remains failed or pending');}else{const a=s.assets;assert(a.skinTextureLoaded&&a.animationLoaded);assert(a.actualSkinnedMeshes>=1&&a.bones>=20&&a.animationClips>=2);assert.match(a.animationNames?.idle||'',/\|idle$/i,'Actual selected idle clip');assert.match(a.animationNames?.run||'',/\|run$/i,'Actual selected run clip');assert(!/targeting\s*pose/i.test((a.animationNames?.idle||'')+' '+(a.animationNames?.run||'')),'Selected loops are not the FBX setup pose');assert.equal(a.loaded,a.requested);assert.deepEqual(a.failed,[]);assert.deepEqual(a.errors,[]);assert(s.renderFrames>0&&s.renderer.calls>0&&s.renderer.triangles>1000);}return s;}
async function runCase(browser,base,game,phone,journey){RUN_DEADLINE=Date.now()+CASE_WALL_MS;const name=game+'-'+(phone?'touch390':'desktop1280'),entry={name,checks:[],errors:[],requests:[]};report.cases.push(entry);persist();let ctx,page;const step=async(label,fn)=>{const detail=await fn();entry.checks.push({label,detail});persist();return detail;};try{ctx=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:800},hasTouch:phone,isMobile:phone,deviceScaleFactor:1});page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>entry.errors.push({kind:'pageerror',message:String(e)}));page.on('console',m=>{if(m.type()==='error')entry.errors.push({kind:'console',message:m.text()});});page.on('response',r=>{entry.requests.push({url:r.url(),status:r.status()});if(r.status()>=400)entry.errors.push({kind:'http',url:r.url(),status:r.status()});});page.on('requestfailed',r=>{const failure=r.failure()?.errorText;if(!/ERR_ABORTED/.test(failure||''))entry.errors.push({kind:'requestfailed',url:r.url(),failure});});await page.goto(base+'/arcade/custom/'+game+'/',{waitUntil:'domcontentloaded',timeout:60000});await journey({page,phone,entry,step,name});assert.deepEqual(entry.errors,[],'No browser, missing asset or console errors');const external=entry.requests.filter(r=>!isLocalRuntimeURL(r.url,base));assert.deepEqual(external,[],'All game runtime requests remain local');entry.passed=true;}catch(e){entry.passed=false;entry.failure=e.stack||String(e);if(page){try{await page.screenshot({path:path.join(out,name+'-FAIL.png'),fullPage:true});entry.lastSnapshot=await snap(page,game==='kosher-lines'?'__KOSHER_LINES__':'__NIGHT_IN__');}catch(capture){entry.captureError=String(capture);}}console.error(entry.failure);}finally{if(ctx)await ctx.close();persist();}}

async function uiFrame(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true,animations:'allow',caret:'initial',timeout:60000});const bytes=await fsp.readFile(file),pixels=pngPixels(bytes);return{file:path.basename(file),sha256:sha(bytes),width:pixels.width,height:pixels.height,scope:'Actual full-page UI for lead visual review; not an automatic visual-quality acceptance'};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
async function usable(page,selector,phone){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();assert(await el.isVisible(),'Visible chapter control '+selector);
 // Wait for the actual frame to publish interaction availability to the DOM.
 // Never force-enable a control or replace physical proximity checks.
 await until(()=>el.isEnabled(),enabled=>enabled,'Actual enabled chapter control '+selector,30000);
 assert(await el.isEnabled(),'Enabled chapter control '+selector);if(phone){const b=await el.boundingBox();assert(b&&b.width>=40&&b.height>=40,'Chapter touch target '+selector);}return el;}
async function chapterTap(inp,selector){await inp.release();await usable(inp.page,selector,inp.phone);await inp.tap(selector);}
async function skatingChapter({page,phone,entry,step,name}){
 const hook='__KOSHER_LINES__',read=()=>snap(page,hook);
 entry.requiredCoverage=phone?{contracts:1,ending:null,fullCampaign:false}:{contracts:3,ending:'public',fullCampaign:true};
 await assets(page,hook);
 const opening=await until(read,s=>s.renderer.city?.canopyIntensity===2&&s.renderer.wardrobe?.vestColor==='b2a4c5','Actual inhabited plaza before repair');
 assert.equal(opening.renderer.city.interactiveResidents,3);assert(opening.renderer.city.authoredGeometry>0);assert(opening.renderer.wardrobe.chestBone&&opening.renderer.wardrobe.headBone);assert(opening.renderer.wardrobe.vestPatternTexture);
 assert.equal(opening.renderer.city.lanternEmission.length,5);assert(opening.renderer.city.lanternEmission.every(v=>v===.12));
 const inp=new RealInput(page,phone,Object.fromEntries(['left','right','push','brake','ollie','manual'].map(k=>[k,'[data-hold="'+k+'"]'])),{left:'a',right:'d',push:'w',brake:'s',ollie:'Space',manual:'m'},'#plaza');entry.inputVisibility=inp.visibility;
 await step('Authored plaza, model and nonvoid opening compositor',async()=>({graphics:await fullQuality(page,hook),snapshot:await read(),controls:await controls(page),frame:await shot(page,'#plaza',name+'-chapter-01-plaza'),ui:await uiFrame(page,name+'-chapter-01-ui')}));
 await step('Native Low power selection applies actual half-DPR buffer and disables shadows',()=>lowPower(page,hook));
 // A real user-facing ride selector, never a simulation function or save edit.
 await page.locator('#ride-mode').focus();
 await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await chapterTap(inp,'#start');
 await until(read,s=>s.running&&s.sessionMode==='chapter','User selected no-clock chapter');
 async function stop(){await inp.set(['brake']);await untilGame(read,s=>s.speed<.1&&Math.hypot(s.vx,s.vz)<.15,'Skater physically stops',{sim:5,wall:90000});await inp.release();}
 async function approach(x,z,resident=null){
  const end=RUN_DEADLINE,initial=await read(),travelBudget=Math.max(30,Math.hypot(x-initial.x,z-initial.z)/1.2+6);let last;
  try{while(Date.now()<end){last=await read();let dx=x-last.x,dz=z-last.z,d=Math.hypot(dx,dz);if(d<.55||(resident&&last.grounded&&last.speed<1.5&&last.career.nearby===resident)){const beforeStop=last;await stop();last=await read();entry.navigation??=[];entry.navigation.push({target:{x,z,resident},beforeStop:{x:beforeStop.x,z:beforeStop.z,speed:beforeStop.speed,elapsed:beforeStop.elapsed},afterStop:{x:last.x,z:last.z,speed:last.speed,elapsed:last.elapsed},nearby:last.career.nearby});if(Math.hypot(x-last.x,z-last.z)<.65||(resident&&last.grounded&&last.career.nearby===resident))return;dx=x-last.x;dz=z-last.z;d=Math.hypot(dx,dz);}
   assert(last.elapsed-initial.elapsed<travelBudget,'Physical skating waypoint exceeded actual simulation budget');const err=wrap(Math.atan2(-dx,-dz)-last.yaw),actions=[],nearResident=resident&&d<5;if(Math.abs(err)>.06)actions.push(err>0?'left':'right');if(Math.abs(err)>.3||last.speed>(nearResident?1.4:3.2)||(d<1.2&&last.speed>1.2))actions.push('brake');else if(last.speed<(d<1.2?.8:nearResident?1.2:2.6))actions.push('push');await inp.set(actions);await sleep(65);}
   throw Error('Physical skating approach exhausted unchanged case wall budget; actual='+JSON.stringify(last));
  }finally{await stop();}
 }
 await approach(5.15,6.3,'keeper');
 await until(read,s=>s.career.nearby==='keeper','Physical keeper proximity');
 if(phone)await chapterTap(inp,'#talk');else{await page.locator('#plaza').focus();await page.keyboard.press('e');}
 await page.locator('#chapter-dialog').waitFor({state:'visible'});
 await chapterTap(inp,'#contract-accept');
 await step('Keeper physically met and first contract accepted',async()=>{const s=await until(read,s=>s.career.active&&s.career.contract==='borrowed-light','Keeper contract accepted');assert.equal(s.career.completed,0);assert.deepEqual(s.career.progress.tricks,[]);assert.equal(s.career.progress.banked,0);return s;});
 async function cleanTrick(code,id){
  await stop();const before=await read(),serial=before.events.at(-1)?.serial||0;
  const cached=phone?await inp.cacheTouchTap('[data-trick="'+code+'"]',['ollie']):null;
  if(phone)await inp.holdCached(cached);else await inp.set(['ollie']);
  const charged=await untilGame(read,s=>s.charge>=.45-1e-9,'Actual maximum .45-second ollie charge',{sim:2,wall:90000});assert(charged.grounded,'Maximum charge is earned on the floor');
  entry.trickAttempts??=[];entry.trickAttempts.push({id,charge:charged.charge,beforeReleaseElapsed:charged.elapsed,armedTouchContacts:phone?inp.points.length:0});
  // On touch, one empty TouchEnd releases the charged ollie and the already
  // pressed PRIMARY trick finger. The native click must still produce an
  // actual airborne trick-start event and a clean landing; no bail is waived.
  if(phone)await inp.releaseAndTapCached(cached);else{await inp.release();await page.keyboard.press(code==='KeyF'?'f':'k');}
  await untilGame(read,s=>{assert.equal(s.bails,before.bails,'No bail accepted as a clean pop');return !s.grounded&&s.y>.1;},'Actual released ollie is airborne',{sim:2,wall:90000});
  await untilGame(read,s=>{assert.equal(s.bails,before.bails,'No bail accepted as a clean trick');return s.events.some(e=>e.serial>serial&&e.type==='ollie')&&s.events.some(e=>e.serial>serial&&e.type==='trick-start'&&e.id===id);},'Actual pop and trick-start events',{sim:2,wall:90000});
  const landed=await untilGame(read,s=>{assert.equal(s.bails,before.bails,'No bail accepted as a clean landing');return s.grounded&&s.stats.tricks>before.stats.tricks&&s.stats.landings>before.stats.landings;},'Actual trick catches and lands',{sim:3,wall:90000});
  assert(landed.events.some(e=>e.serial>serial&&e.type==='landed-trick'&&e.id===id),'Actual distinct clean trick landing event');
  const pop=landed.events.find(e=>e.serial>serial&&e.type==='ollie'),start=landed.events.find(e=>e.serial>serial&&e.type==='trick-start'&&e.id===id),land=landed.events.find(e=>e.serial>serial&&e.type==='landed-trick'&&e.id===id);
  entry.trickTiming??=[];entry.trickTiming.push({id,input:phone?'primary trick + ollie lifted in one real touchEnd':'keyboard',charge:charged.charge,popAt:pop.time,trickAt:start.time,landAt:land.time,startDelaySim:start.time-pop.time,catchTimeSim:land.time-start.time});
  await untilGame(read,s=>s.career.progress.tricks.includes(id)&&s.pending===0,'Natural combo timeout banks clean trick',{sim:4,wall:120000});return read();
 }

 // 120-point kickflip plus 400-point tre flip exceed 300 without score mutation.
 await step('Kickflip charged, caught, landed and banked',()=>cleanTrick('KeyF','kickflip'));
 await step('Distinct tre flip earns keeper requirement',()=>cleanTrick('KeyK','tre'));
 const ready=await until(read,s=>s.career.ready&&s.career.progress.banked>=300&&s.career.progress.tricks.length>=2,'Real keeper work ready');
 await step('Real skating proof and pre-turn-in compositor',async()=>({snapshot:ready,frame:await shot(page,'#plaza',name+'-chapter-02-earned')}));
 // Still physically beside keeper: turn-in is offered only by that resident.
 await until(read,s=>s.career.nearby==='keeper','Keeper still physically reachable');
 await chapterTap(inp,'#talk');await page.locator('#chapter-dialog').waitFor({state:'visible'});
 await chapterTap(inp,'#contract-complete');
 const complete=await until(read,s=>s.career.completed===1&&s.career.unlocks.wovenVest&&s.renderer.city.canopyIntensity===24&&s.renderer.wardrobe.vestColor==='ffffff','Real turn-in unlocks next contract and rendered canopy/vest');
 assert.equal(complete.career.contract,'last-route');assert.equal(complete.career.active,false);
 assert(complete.renderer.city.lanternEmission.every(v=>v===1.7),'Actual lantern materials respond to keeper repair');assert.notEqual(complete.renderer.wardrobe.vestColor,opening.renderer.wardrobe.vestColor,'Actual garment material changes');
 await step('Keeper turn-in changes plaza and unlocks courier',async()=>({snapshot:complete,frame:await shot(page,'#plaza',name+'-chapter-03-canopy'),ui:await uiFrame(page,name+'-chapter-03-ui')}));
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});await assets(page,hook);await lowPower(page,hook);
 await step('Chapter progress and unlocked contract persist across real reload',async()=>{const s=await until(read,s=>s.career.completed===1&&s.renderer.city.canopyIntensity===24&&s.renderer.wardrobe.vestColor==='ffffff','Saved chapter and actual scene repair restored');assert.equal(s.career.contract,'last-route');assert.equal(s.career.unlocks.wovenVest,true);assert.equal(s.storageAvailable,true);return s;});
 if(phone){entry.coverage={requiredContracts:1,requiredEnding:null,input:'actual emulated touch',uncovered:['Courier contract','Archivist contract','Both plaza endings','Physical-phone performance']};return;}
 // Preserve the keeper's real reload proof above. Begin the remaining journey
 // through the visible untimed ride control and an actual new-session action.
 await page.locator('#ride-mode').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await chapterTap(inp,'#start');
 await until(read,s=>s.running&&s.sessionMode==='chapter','Restart actual untimed ride after saved keeper contract');
 await fullPlazaDesktop({page,entry,step,name,inp,read,approach,stop});
}


async function fullPlazaDesktop({page,entry,step,name,inp,read,approach,stop}){
 // Desktop extension only. Phone still proves its keeper contract separately;
 // analog/manual touch continuity has not yet been established by a real run.
 const wait=(predicate,label,sim=8)=>untilGame(read,predicate,label,{sim,wall:180000,poll:50});
 const noBail=(s,before,label)=>assert.equal(s.bails,before,label+' must remain a clean physical attempt');
 async function route(points){for(const [x,z]of points){await approach(x,z);const s=await read();assert(s.running&&!s.paused&&!s.ended&&s.sessionMode==='chapter','Actual untimed session remains active');}}
 async function align(yaw){await stop();const started=await read();let last;try{while(Date.now()<RUN_DEADLINE){last=await read();const error=wrap(yaw-last.yaw);if(Math.abs(error)<.13)return last;assert(last.elapsed-started.elapsed<8,'Real steering failed to settle into launch heading');await inp.set([error>0?'left':'right','brake']);await sleep(20);}throw Error('Case wall cap during actual heading alignment: '+JSON.stringify(last));}finally{await inp.release();}}
 async function talk(id){await stop();await wait(s=>s.career.nearby===id,'Physical conversation range: '+id,3);await page.locator('#plaza').focus();await page.keyboard.press('e');await page.locator('#chapter-dialog').waitFor({state:'visible'});}
 async function accept(id,completed,contract){await talk(id);await chapterTap(inp,'#contract-accept');return wait(s=>s.career.completed===completed&&s.career.active&&s.career.contract===contract,'Actual '+id+' acceptance',3);}
 async function visit(id,point){await route([point]);const s=await read(),beacon=s.career.beacons.find(b=>b.id===id);assert(beacon,'Actual memory stone exists');assert(Math.hypot(s.x-beacon.x,s.z-beacon.z)<1.7,'Physical slow dwell radius: '+id);return wait(s=>s.grounded&&s.speed<3&&s.career.progress.visited.includes(id),'Actual >=.6-second relay dwell: '+id,4);}
 async function frame(label){return{snapshot:await read(),frame:await shot(page,'#plaza',name+'-full-'+label),ui:await uiFrame(page,name+'-full-'+label+'-ui')};}
 const initial=await read();assert.equal(initial.career.completed,1);assert.equal(initial.career.active,false);assert(initial.running&&initial.sessionMode==='chapter');
 // Source-reviewed lanes avoid the west bench, ledge and garden colliders.
 await route([[-10.5,5],[-10.5,-6],[-12.8,-6]]);
 await step('Courier physically accepts the second contract',()=>accept('courier',1,'last-route'));
 await route([[-12,-12.5]]);
 // Aim through the real rail's center, compensating actual approach offset.
 // This merely chooses keyboard steering; it does not change coordinates.
 const beforeAim=await read();await align(Math.atan2(-(-12-beforeAim.x),-(-18-beforeAim.z)));
 const beforeRail=await read(),railBails=beforeRail.bails;
 assert(Math.abs(beforeRail.x+12)<.75,'Physical launch is inside Aurora approach corridor');
 await inp.set(['push']);const speed=await wait(s=>s.speed>=3.2,'Real push builds Aurora launch speed',3);assert(speed.speed<6,'Aurora approach remains bounded');
 // Stop pushing before charging; momentum carries the real ollie onto the rail.
 await inp.set(['ollie']);await wait(s=>s.charge>=.14,'Real rail ollie charge',2);await inp.release();
 await wait(s=>{noBail(s,railBails,'Aurora pop');return !s.grounded&&s.y>.03;},'Real ollie before Aurora',2);
 const captured=await wait(s=>{noBail(s,railBails,'Aurora approach');assert(!s.grounded,'Actual ollie landed without an Aurora capture');return s.rail==='outer';},'Descending physical Aurora capture',3);
 assert.equal(captured.mode,'grind');
 const held=await wait(s=>{noBail(s,railBails,'Aurora hold');assert.equal(s.rail,'outer','Real rail contact persists through dwell');return s.grindTime>=.72;},'Real outer-rail dwell >=.72 seconds',3);
 assert(held.grindTime>=.6);await inp.set(['brake']);
 const landed=await wait(s=>{noBail(s,railBails,'Aurora brake exit');return s.grounded&&s.career.progress.grind>=.6;},'Actual clean grind-landed event',4);
 assert(landed.events.some(e=>e.type==='grind-landed'&&e.rail==='outer'&&e.duration>=.6),'Actual qualifying Aurora landing event');await stop();
 await step('Aurora captured, held, exited and landed through real skating',()=>frame('02-aurora'));
 await route([[-10.5,-26]]);await visit('west',[-9,-27.8]);
 // Cross beyond the quarter back edge at z=-30.8, west of the archive counter.
 await route([[-9,-30.8],[7,-30.8]]);await visit('east',[7,-27.8]);
 await wait(s=>s.career.ready,'Courier work earned by real rail and both relays',3);
 await route([[7,-30.8],[-10.5,-30.8],[-10.5,-6],[-12.8,-6]]);
 await talk('courier');await chapterTap(inp,'#contract-complete');
 await step('Courier turn-in restores actual jewels and relay materials',async()=>{const s=await wait(s=>s.career.completed===2&&s.renderer.wheelJewelsVisible===4&&s.renderer.wardrobe.shoulderJewelsVisible===4,'Actual courier geometry reward',3);assert.deepEqual(s.renderer.city.relays.filter(r=>r.id!=='return').map(r=>[r.id,r.emission]).sort(),[['east',2.8],['west',2.8]],'Both earned garden relays stay lit');assert.equal(s.renderer.city.relays.find(r=>r.id==='return').emission,.22,'Final return cell stays disconnected before the archivist contract');assert.equal(s.career.contract,'return-hour');return frame('03-courier');});
 // Cross south of the quarter and north of the stair ramps, then approach the
 // archivist from the south, avoiding the resident and archive colliders.
 await route([[-10.5,-19.5],[11,-19.5],[11,-25.5],[10,-25.5]]);
 await step('Archivist physically accepts the final contract',()=>accept('archivist',2,'return-hour'));
 await route([[11.5,-23.5]]);await align(Math.PI);
 const beforeManual=await read();await inp.set(['push']);await wait(s=>s.speed>=3.3,'Actual push for garden manual',3);
 await inp.set(['manual']);const manualStart=await wait(s=>s.mode==='manual','Actual M hold starts a manual',2);
 let lastManual,heldLongEnough=false;
 while(Date.now()<RUN_DEADLINE){lastManual=await read();noBail(lastManual,beforeManual.bails,'East-lane manual');assert.equal(lastManual.mode,'manual');assert(lastManual.x>5.5&&lastManual.x<15.5&&lastManual.z> -25.5&&lastManual.z< -9.5,'Actual manual remains inside qualifying garden lane');
  if(lastManual.elapsed-manualStart.elapsed>=1.4){heldLongEnough=true;break;}
  const actions=['manual'];if(lastManual.balance>.16)actions.push('right');else if(lastManual.balance<-.16)actions.push('left');if(lastManual.speed<1.8)actions.push('push');await inp.set(actions);await sleep(35);
 }
 assert(heldLongEnough,'Actual balanced manual lasts beyond the required1.2 seconds: '+JSON.stringify(lastManual));await inp.release();
 const manual=await wait(s=>{noBail(s,beforeManual.bails,'Manual release');return s.career.progress.manual>=1.2&&s.stats.manuals>beforeManual.stats.manuals;},'Actual garden manual-complete event',3);
 assert(manual.events.some(e=>e.type==='manual-complete'&&e.gardenDuration>=1.2&&e.x>5&&e.x<16&&e.z> -26&&e.z< -9),'Actual event records qualifying position and duration');await stop();
 await step('Garden manual earned through keyboard balance correction and release',()=>frame('04-manual'));
 await visit('east',[7,-27.8]);await route([[7,-30.8],[-9,-30.8]]);await visit('west',[-9,-27.8]);
 await route([[-10.5,-27.8],[-10.5,5],[0,5]]);await visit('return',[0,9.4]);
 const ready=await wait(s=>s.career.ready&&s.career.progress.manual>=1.2&&['west','east','return'].every(id=>s.career.progress.visited.includes(id)),'Actual manual and all three memory stones',3);assert.equal(ready.career.completed,2);
 await route([[5,5],[5,-19.5],[11,-19.5],[11,-25.5],[10,-25.5]]);
 await talk('archivist');await chapterTap(inp,'[data-ending="public"]');
 const ending=await wait(s=>s.career.completed===3&&s.career.choice==='public'&&s.renderer.city.constellationVisible&&s.renderer.city.publicReturnStudsVisible>0&&s.renderer.city.constellationBarsVisible>0,'Actual public ending changes rendered geometry',3);
 assert.equal(ending.career.active,false);assert.equal(ending.career.contract,null);assert.equal(ending.renderer.city.mirrorVisible,false);assert.equal(ending.renderer.wardrobe.mirrorCrestVisible,false);assert(ending.career.unlocks.publicLight&&ending.career.unlocks.openEye);
 await step('All three contracts earn actual public constellation and return lights',()=>frame('05-public-ending'));
 await inp.release();await page.reload({waitUntil:'domcontentloaded',timeout:60000});await assets(page,'__KOSHER_LINES__');await lowPower(page,'__KOSHER_LINES__');
 await step('Three contracts and actual public scene survive a real reload',async()=>{const s=await wait(s=>s.career.completed===3&&s.career.choice==='public'&&s.renderer.city.constellationVisible&&s.renderer.city.publicReturnStudsVisible>0&&s.renderer.city.constellationBarsVisible>0&&s.renderer.wheelJewelsVisible===4,'Actual saved public ending restored',3);assert.equal(s.renderer.city.mirrorVisible,false);assert(s.renderer.city.relays.every(r=>r.emission===2.8),'All actually restored relay cores stay lit after final turn-in and reload');assert.equal(s.storageAvailable,true);assert(s.renderer.city.canopyIntensity===24&&s.renderer.city.lanternEmission.every(v=>v===1.7));return frame('06-reloaded');});
 entry.coverage={requiredContracts:3,requiredEnding:'public',input:'actual desktop keyboard',uncovered:['Personal mirror ending','Phone full campaign','Physical controller hardware','Finished visual/story acceptance']};
}

// Plan walking routes from actual read-only collision bounds. Only real held
// WASD/touch directions move the resident; no click-to-walk setter is invoked.
function walkingPath(s,target,chapterStation){
 const spacing=.2,xmin=-5,zmin=-3,xn=51,zn=32;
 const point=i=>({x:xmin+(i%xn)*spacing,z:zmin+Math.floor(i/xn)*spacing});
 const freeAt=(p,margin)=>p.x>=-5&&p.x<=5&&p.z>=-3&&p.z<=3.2&&!s.collisionBounds.some(b=>p.x>b[0]-margin&&p.x<b[1]+margin&&p.z>b[2]-margin&&p.z<b[3]+margin);
 const free=p=>freeAt(p,.38);
 const line=(a,b,margin=.38)=>{const n=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.06);for(let k=0;k<=n;k++)if(!freeAt({x:a.x+(b.x-a.x)*k/Math.max(1,n),z:a.z+(b.z-a.z)*k/Math.max(1,n)},margin))return false;return true;};
 const ids=Array.from({length:xn*zn},(_,i)=>i).filter(i=>free(point(i)));
 // Connect the actual stopped position with the source collision clearance;
 // subsequent graph segments use extra clearance for input sampling tolerance.
 const start=ids.filter(i=>line(s,point(i),.205)).sort((a,b)=>Math.hypot(point(a).x-s.x,point(a).z-s.z)-Math.hypot(point(b).x-s.x,point(b).z-s.z))[0];
 assert.notEqual(start,undefined,'Resident has a physical free path');
 const goal=i=>{const p=point(i);if(Math.hypot(p.x-target.x,p.z-target.z)>.45)return false;if(chapterStation){const near=[...s.story.stations].sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0];return near.id===chapterStation;}return true;};
 const queue=[start],parents=new Map([[start,null]]);let found=null;
 for(let qi=0;qi<queue.length;qi++){const id=queue[qi];if(goal(id)){found=id;break;}const x=id%xn,z=Math.floor(id/xn);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]){const nx=x+dx,nz=z+dz,ni=nz*xn+nx;if(nx<0||nx>=xn||nz<0||nz>=zn||parents.has(ni)||!free(point(ni))||!line(point(id),point(ni)))continue;parents.set(ni,id);queue.push(ni);}}
 assert.notEqual(found,null,'No collision-free physical route to '+JSON.stringify(target));
 const route=[];for(let p=found;p!==null;p=parents.get(p))route.push(point(p));route.reverse();
 const simple=[];for(let i=0;i<route.length;i++){if(i===0||i===route.length-1){simple.push(route[i]);continue;}const a=route[i-1],b=route[i],c=route[i+1];if(Math.sign(b.x-a.x)!==Math.sign(c.x-b.x)||Math.sign(b.z-a.z)!==Math.sign(c.z-b.z))simple.push(b);}return simple;
}
function roomActions(dx,dz){const angle=Math.atan2(dz,dx),sector=(Math.round(angle/(Math.PI/4))+8)%8;return [['down','right'],['down'],['down','left'],['left'],['up','left'],['up'],['up','right'],['right']][sector];}
async function apartmentChapter({page,phone,entry,step,name}){
 const hook='__NIGHT_IN__',read=()=>snap(page,hook);
 await assets(page,hook);await until(read,s=>s.story?.mosaicLoaded&&s.story.neighborSkinnedMeshes>0,'Actual chapter mosaic and animated neighbor',90000);
 const inp=new RealInput(page,phone,{up:'[data-dir="up"]',down:'[data-dir="down"]',left:'[data-dir="left"]',right:'[data-dir="right"]'},{up:'w',down:'s',left:'a',right:'d'},'#stage');entry.inputVisibility=inp.visibility;
 await step('Inhabited room and original material actually render',async()=>({graphics:await fullQuality(page,hook),snapshot:await read(),controls:await controls(page),frame:await shot(page,'#world',name+'-chapter-01-room'),ui:await uiFrame(page,name+'-chapter-01-ui')}));
 await step('Native Low power selection applies actual half-DPR buffer and disables shadows',()=>lowPower(page,hook));
 async function walkTo(target,station=null,ordinaryStation=null){
  const reached=s=>station?s.story.near===station:ordinaryStation?s.near===ordinaryStation:false;
  let s=await read();if(reached(s)){await inp.release();return s;}
  const route=walkingPath(s,target,station);
  for(const waypoint of route){const wallEnd=Math.min(Date.now()+120000,RUN_DEADLINE),start=await read(),simBudget=Math.max(4,Math.hypot(waypoint.x-start.x,waypoint.z-start.z)/1.2+3);let arrived=false,last;
   try{while(Date.now()<wallEnd){last=await read();const dx=waypoint.x-last.x,dz=waypoint.z-last.z,distance=Math.hypot(dx,dz);if(reached(last)||distance<.18){arrived=true;break;}assert(!last.over&&!last.activity&&!last.paused,'Resident is free to walk');assert(last.elapsed-start.elapsed<simBudget,'Walking exceeded actual simulation budget; target='+JSON.stringify(waypoint)+'; actual='+JSON.stringify(last));await inp.set(roomActions(dx,dz));
    if(distance<.65){const tick=last.elapsed;await untilGame(read,n=>n.elapsed>tick+1e-5||reached(n),'Near-waypoint real input pulse',{sim:.5,wall:20000,poll:40});await inp.release();}else await sleep(65);
   }}finally{await inp.release();}
   assert(arrived,'Held movement reaches a useful physical waypoint; target='+JSON.stringify(waypoint)+'; actual='+JSON.stringify(last));if(reached(last))return last;
  }
  if(station)return untilGame(read,s=>s.story.near===station,'Physical chapter station '+station,{sim:2,wall:30000});
  if(ordinaryStation)return untilGame(read,s=>s.near===ordinaryStation,'Physical room station '+ordinaryStation,{sim:2,wall:30000});return read();
 }

 async function station(id){const s=await read(),p=s.story.stations.find(p=>p.id===id);assert(p);await walkTo(p,id);}
 async function investigate(){await inp.release();if(phone)await chapterTap(inp,'#investigate');else{await page.locator('#stage').focus();await page.keyboard.press('f');}}
 async function playEnding(choice,number){
  await station('neighbor');await investigate();assert((await read()).story.met,'Actually meet neighbor');
  await station('letter');await investigate();await until(read,s=>s.story.letter,'Letter physically collected');
  await station('trace');await investigate();const traced=await until(read,s=>s.story.trace&&s.story.pattern&&s.story.rendered.heldPrismVisible&&!s.story.rendered.letterVisible,'Actual window clue and carried prism observed');
  const pattern=[...traced.story.pattern];assert.equal(pattern.length,3);
  await step('Chapter '+number+': letter and spatial window clue earned',async()=>({snapshot:traced,frame:await shot(page,'#world',name+'-chapter-'+number+'-window')}));
  const stereo=(await read()).stations.find(p=>p.id==='stereo');assert(stereo);await walkTo({x:stereo.x,z:stereo.z+.6},null,'stereo');await until(read,s=>s.near==='stereo','Reach real record player');
  for(let n=0;n<4&&(await read()).track!==1;n++){if(phone){
   await until(async()=>{const s=await read();return{near:s.near,paused:s.paused,over:s.over,activity:s.activity,renderFrames:s.renderFrames,enabled:await page.locator('#interact').isEnabled()};},v=>v.near==='stereo'&&!v.paused&&!v.over&&!v.activity&&v.enabled,'Physical stereo proximity and actual Interact readiness',30000);
   await chapterTap(inp,'#interact');
  }else{await page.locator('#stage').focus();await page.keyboard.press('e');}await sleep(100);}
  assert.equal((await read()).track,1,'Crib Static chosen through real record controls');
  await station('receiver');await investigate();await usable(page,'#sendSignal',phone);
  // Deliberately send the real wrong combination first: no unearned tune.
  const attempts=(await read()).story.attempts;
  await chapterTap(inp,'#sendSignal');
  const wrong=await until(read,s=>s.story.attempts===attempts+1,'Actual failed transmission recorded');assert.equal(wrong.story.tuned,false);
  for(let i=0;i<3;i++){let n=0;while((await read()).story.dials[i]!==pattern[i]){assert(n++<4,'Finite physical dial cycle');await chapterTap(inp,'#dial'+i);}}
  await chapterTap(inp,'#sendSignal');await until(read,s=>s.story.tuned&&s.story.rendered.dialRotations.every((v,i)=>Math.abs(v+pattern[i]*Math.PI/2)<1e-8),'Real clue combination and physical dial rotations repair receiver');
  await step('Chapter '+number+': wrong attempt rejected, observed dials tune receiver',async()=>({snapshot:await read(),pattern,frame:await shot(page,'#world',name+'-chapter-'+number+'-receiver'),ui:await uiFrame(page,name+'-chapter-'+number+'-receiver-ui')}));
  await station('junction');await investigate();await chapterTap(inp,choice==='hearth'?'#chooseHearth':'#chooseBeacon');
  await until(read,s=>s.story.choice===choice&&!s.story.delivered,'Actual one-cell choice before return');
  await station('neighbor');await investigate();
  const destination=choice==='hearth'?[-2.25,0,1.6]:[4.45,0,2.75];
  const done=await untilGame(read,s=>{const r=s.story.rendered;return s.story.delivered&&s.story.stage==='closed'&&!r.heldPrismVisible&&r.returnedPrismVisible&&r.blanketMaterial===(choice==='hearth'?'original-throw':'neighbor-blanket')&&r.roomLampIntensity===(choice==='hearth'?42:13)&&r.neighborPosition&&Math.hypot(r.neighborPosition[0]-destination[0],r.neighborPosition[2]-destination[2])<.18&&(choice==='hearth'||r.streetAnswerLightsVisible>0);},'Prism returned and actual room/neighbor consequence settles',{sim:12,wall:150000});
  const rendered=done.story.rendered;assert.equal(rendered.hearthLightIntensity,choice==='hearth'?7:2);assert.equal(rendered.beaconEmissive,choice==='hearth'?0x182940:0x6d4bd0);assert.equal(rendered.letterVisible,false);
  if(choice==='hearth'){assert.equal(rendered.beaconLightIntensity,0);assert.equal(rendered.streetAnswerLightsVisible,0);}else assert(rendered.beaconLightIntensity>=5.5&&rendered.beaconLightIntensity<=6.5);
  assert.equal(done.story.choice,choice);assert(done.story.archive.includes(choice));assert.equal(done.story.consequence.hearthPowered,choice==='hearth');assert.equal(done.story.consequence.streetBeaconPowered,choice==='beacon');assert(done.story.consequence.prismReturned);
  assert.equal(done.story.storageOK,true);assert.deepEqual(done.story.assetErrors,[]);
  await step('Chapter '+number+': '+choice+' ending changes actual room',async()=>({snapshot:done,frame:await shot(page,'#world',name+'-chapter-'+number+'-'+choice)}));
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});await assets(page,hook);await lowPower(page,hook);
  const saved=await until(read,s=>s.story.delivered&&s.story.choice===choice&&s.story.rendered.roomLampIntensity===(choice==='hearth'?42:13)&&s.story.rendered.blanketMaterial===(choice==='hearth'?'original-throw':'neighbor-blanket')&&!s.story.rendered.heldPrismVisible&&s.story.rendered.returnedPrismVisible,'Chapter ending and actual room consequence survive real reload');assert(saved.story.archive.includes(choice));assert(saved.story.storageOK);
  await step('Chapter '+number+': ending and archive restored after reload',async()=>({snapshot:saved,frame:await shot(page,'#world',name+'-chapter-'+number+'-saved')}));
  return pattern;
 }
 const first=await playEnding('hearth',1);
 await chapterTap(inp,'#chapterReplay');
 await until(read,s=>s.story.turn===1&&!s.story.letter&&!s.story.delivered&&s.story.choice===null,'User replay resets puzzle but retains history');
 await untilGame(read,s=>{const p=s.story.rendered.neighborPosition;return p&&Math.hypot(p[0]+3.65,p[2]-2.95)<.15;},'Neighbor physically returns after replay',{sim:12,wall:150000});
 const second=await playEnding('beacon',2);
 assert.notDeepEqual(first,second,'Replay has a genuinely different clue');
 const final=await read();assert.deepEqual(final.story.archive,['hearth','beacon']);
 await step('Both exclusive endings earned and alternate trace persists',async()=>({firstPattern:first,secondPattern:second,snapshot:final}));
}

async function pinTree(relative){for(const entry of await fsp.readdir(path.join(repo,relative),{withFileTypes:true})){if(entry.name==='.nsp')continue;const p=relative+'/'+entry.name;if(entry.isSymbolicLink())throw Error('Unexpected source symlink '+p);if(entry.isDirectory())await pinTree(p);else if(entry.isFile()){const bytes=await fsp.readFile(path.join(repo,p));report.source.push({path:p,bytes:bytes.length,sha256:sha(bytes)});}}}
(async()=>{let browser;try{const planned=selectedCases();report.plannedCases=planned;report.expectedCaseCount=planned.length;assert(planned.length>0,'At least one exact browser case must be selected');persist();
 for(const relative of ['arcade/custom/kosher-lines','arcade/custom/night-in','arcade/custom/crib-recovered-assets','static/vendor/three/0.160.0','static/fonts'])await pinTree(relative);
 for(const relative of ['static/customer-experience.css','favicon.svg','favicon.ico']){const bytes=await fsp.readFile(path.join(repo,relative));report.source.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});}
 report.source.sort((a,b)=>a.path.localeCompare(b.path));persist();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const chosen of planned){await runCase(browser,base,chosen.game,chosen.phone,chosen.game==='kosher-lines'?skatingChapter:apartmentChapter);}
 }catch(e){report.failure=e.stack||String(e);console.error(report.failure);}finally{
 if(browser)await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));
 report.finishedUtc=new Date().toISOString();report.passed=completedSelectedCases()&&!report.failure&&report.serverErrors.length===0;persist();
 console.log(JSON.stringify({passed:report.passed,scope:report.scope,selectedCase:report.selectedCase,expectedCaseCount:report.expectedCaseCount,cases:report.cases.map(c=>({name:c.name,passed:c.passed,failure:c.failure})),evidence:out},null,2));if(!report.passed)process.exitCode=1;
 }})();
