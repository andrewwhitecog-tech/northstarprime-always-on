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
const report={schema:'northstar.crib.chapters.real_browser.v1',startedUtc:new Date().toISOString(),
 scope:'Real desktop and390x844 emulated-touch Chromium chapter journeys. Software CI is not physical-phone, RTX performance or finished visual acceptance. Kosher covers keeper contract and second-contract unlock only; Aurora grind, east-garden manual and final costly choice are not covered. Night covers both chapter circuits and replay.',
 source:[],cases:[],serverErrors:[]};
function persist(){fs.writeFileSync(path.join(out,'CRIB_CHAPTERS_REAL_BROWSER.json'),JSON.stringify(report,null,2)+'\n');}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.fbx':'application/octet-stream','.md':'text/plain'};
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://local');let p=path.resolve(repo,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(repo+path.sep)){res.writeHead(403);res.end();return;}if(u.pathname.endsWith('/'))p=path.join(p,'index.html');const b=await fsp.readFile(p);const relative=path.relative(repo,p).split(path.sep).join('/'),pin=report.source.find(row=>row.path===relative);if(!pin||pin.bytes!==b.length||pin.sha256!==sha(b))throw Error('Unpinned or changed runtime dependency '+relative);res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:b);}catch(e){report.serverErrors.push({url:req.url,error:e.code||String(e)});res.writeHead(404);res.end('Unavailable actual source file');}});
const RUN_DEADLINE=Date.now()+20*60*1000;
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
 constructor(page,phone,selectors,keyboard,focus){Object.assign(this,{page,phone,selectors,keyboard,focus});this.active=[];this.cdp=null;this.points=[];}
 async set(actions){actions=[...new Set(actions)].sort();if(JSON.stringify(actions)===JSON.stringify(this.active))return;if(!this.phone){if(!this.active.length&&actions.length)await this.page.locator(this.focus).focus();for(const a of this.active)if(!actions.includes(a))await this.page.keyboard.up(this.keyboard[a]);for(const a of actions)if(!this.active.includes(a))await this.page.keyboard.down(this.keyboard[a]);}else{if(!this.cdp)this.cdp=await this.page.context().newCDPSession(this.page);if(this.points.length)await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});this.points=[];for(const a of actions)await this.page.locator(this.selectors[a]).scrollIntoViewIfNeeded();for(const [i,a]of actions.entries()){const el=this.page.locator(this.selectors[a]);const r=await el.boundingBox();assert(r&&r.width>=40&&r.height>=40,'Reachable real touch control '+a);const view=this.page.viewportSize();assert(r.x>=0&&r.y>=0&&r.x+r.width<=view.width+1&&r.y+r.height<=view.height+1,'Simultaneous touch targets fit viewport '+a);this.points.push({x:r.x+r.width/2,y:r.y+r.height/2,id:i+1,radiusX:2,radiusY:2,force:1});}if(this.points.length)await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:this.points});}this.active=actions;}
 async tap(selector){const el=this.page.locator(selector);if(!this.phone){await el.click();return;}if(!this.cdp)this.cdp=await this.page.context().newCDPSession(this.page);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox();assert(r,'Real touch target exists');const point={x:r.x+r.width/2,y:r.y+r.height/2,id:99,radiusX:2,radiusY:2,force:1};await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...this.points,point]});await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:this.points});}
 // Resolve real touch rectangles BEFORE charging; no DOM lookup is allowed
 // between release of the ollie and the actual trick touch sequence.
 async cacheTouchTap(selector,holds){assert(this.phone);if(!this.cdp)this.cdp=await this.page.context().newCDPSession(this.page);await this.page.locator(selector).scrollIntoViewIfNeeded();const targets=[];for(const [i,sel]of [...holds.map(a=>this.selectors[a]),selector].entries()){const b=await this.page.locator(sel).boundingBox(),v=this.page.viewportSize();assert(b&&b.width>=40&&b.height>=40,'Actual cached touch target '+sel);assert(b.x>=0&&b.y>=0&&b.x+b.width<=v.width+1&&b.y+b.height<=v.height+1,'Cached hold and trick targets simultaneously visible '+sel);targets.push({x:b.x+b.width/2,y:b.y+b.height/2,id:i+1,radiusX:2,radiusY:2,force:1});}return{actions:[...holds],holdPoints:targets.slice(0,-1),tapPoint:targets.at(-1)};}
 async holdCached(plan){await this.release();await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:plan.holdPoints});this.points=plan.holdPoints;this.active=[...plan.actions].sort();}
 async releaseAndTapCached(plan){await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});this.points=[];this.active=[];await this.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[plan.tapPoint]});await this.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 async release(){await this.set([]);}
}
async function controls(page){const g=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('button')].filter(b=>b.getClientRects().length&&!b.disabled).map(b=>({name:b.getAttribute('aria-label')||b.textContent.trim(),height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}))}));assert(g.scrollWidth<=g.width+1,'No horizontal overflow');for(const b of g.buttons){assert(b.name,'Each visible control has an accessible name');assert(b.height>=40&&b.width>=40,'Usable control target '+b.name);}return g;}
async function assets(page,hook){const s=await until(()=>snap(page,hook),s=>s&&(hook==='__KOSHER_LINES__'?s.renderer?.modelLoaded&&Object.values(s.renderer.assets||{}).every(v=>v==='loaded'):s.assets?.modelLoaded&&s.assets?.animationLoaded&&s.assets.loaded===s.assets.requested),'Actual skinned model load',90000);if(hook==='__KOSHER_LINES__'){const r=s.renderer,a=r.avatar;assert(r.firstFrame&&r.drawCalls>0);assert.equal(r.modelError,null);assert.deepEqual(r.errors,[]);assert.equal(r.contextLost,false);assert(a.modelLoaded&&a.skinLoaded);assert(a.skinnedMeshes>=1&&a.bones>=20&&a.vertices>=500&&a.triangles>=1000);for(const clip of ['idle','jump','run'])assert(a.animations.some(n=>n.toLowerCase().endsWith('|'+clip)),'Real embedded clip '+clip);assert(Object.values(r.assets).every(v=>v==='loaded'),'No requested texture/model remains failed or pending');}else{const a=s.assets;assert(a.skinTextureLoaded&&a.animationLoaded);assert(a.actualSkinnedMeshes>=1&&a.bones>=20&&a.animationClips>=2);assert.equal(a.loaded,a.requested);assert.deepEqual(a.failed,[]);assert.deepEqual(a.errors,[]);assert(s.renderFrames>0&&s.renderer.calls>0&&s.renderer.triangles>1000);}return s;}
async function runCase(browser,base,game,phone,journey){const name=game+'-'+(phone?'touch390':'desktop1280'),entry={name,checks:[],errors:[],requests:[]};report.cases.push(entry);persist();let ctx,page;const step=async(label,fn)=>{const detail=await fn();entry.checks.push({label,detail});persist();return detail;};try{ctx=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:800},hasTouch:phone,isMobile:phone,deviceScaleFactor:1});page=await ctx.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>entry.errors.push({kind:'pageerror',message:String(e)}));page.on('console',m=>{if(m.type()==='error')entry.errors.push({kind:'console',message:m.text()});});page.on('response',r=>{entry.requests.push({url:r.url(),status:r.status()});if(r.status()>=400)entry.errors.push({kind:'http',url:r.url(),status:r.status()});});page.on('requestfailed',r=>{const failure=r.failure()?.errorText;if(!/ERR_ABORTED/.test(failure||''))entry.errors.push({kind:'requestfailed',url:r.url(),failure});});await page.goto(base+'/arcade/custom/'+game+'/',{waitUntil:'load'});await journey({page,phone,entry,step,name});assert.deepEqual(entry.errors,[],'No browser, missing asset or console errors');const external=entry.requests.filter(r=>!r.url.startsWith(base));assert.deepEqual(external,[],'All game runtime requests remain local');entry.passed=true;}catch(e){entry.passed=false;entry.failure=e.stack||String(e);if(page){try{await page.screenshot({path:path.join(out,name+'-FAIL.png'),fullPage:true});entry.lastSnapshot=await snap(page,game==='kosher-lines'?'__KOSHER_LINES__':'__NIGHT_IN__');}catch(capture){entry.captureError=String(capture);}}console.error(entry.failure);}finally{if(ctx)await ctx.close();persist();}}

async function uiFrame(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true,animations:'allow',caret:'initial',timeout:60000});const bytes=await fsp.readFile(file),pixels=pngPixels(bytes);return{file:path.basename(file),sha256:sha(bytes),width:pixels.width,height:pixels.height,scope:'Actual full-page UI for lead visual review; not an automatic visual-quality acceptance'};}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
async function usable(page,selector,phone){const el=page.locator(selector);await el.scrollIntoViewIfNeeded();assert(await el.isVisible(),'Visible chapter control '+selector);assert(await el.isEnabled(),'Enabled chapter control '+selector);if(phone){const b=await el.boundingBox();assert(b&&b.width>=40&&b.height>=40,'Chapter touch target '+selector);}return el;}
async function chapterTap(inp,selector){await inp.release();await usable(inp.page,selector,inp.phone);await inp.tap(selector);}
async function skatingChapter({page,phone,step,name}){
 const hook='__KOSHER_LINES__',read=()=>snap(page,hook);
 await assets(page,hook);
 const opening=await until(read,s=>s.renderer.city?.canopyIntensity===2&&s.renderer.wardrobe?.vestColor==='b2a4c5','Actual inhabited plaza before repair');
 assert.equal(opening.renderer.city.interactiveResidents,3);assert(opening.renderer.city.authoredGeometry>0);assert(opening.renderer.wardrobe.chestBone&&opening.renderer.wardrobe.headBone);assert(opening.renderer.wardrobe.vestPatternTexture);
 assert.equal(opening.renderer.city.lanternEmission.length,5);assert(opening.renderer.city.lanternEmission.every(v=>v===.12));
 const inp=new RealInput(page,phone,Object.fromEntries(['left','right','push','brake','ollie'].map(k=>[k,'[data-hold="'+k+'"]'])),{left:'a',right:'d',push:'w',brake:'s',ollie:'Space'},'#plaza');
 await step('Authored plaza, model and nonvoid opening compositor',async()=>({snapshot:await read(),controls:await controls(page),frame:await shot(page,'#plaza',name+'-chapter-01-plaza'),ui:await uiFrame(page,name+'-chapter-01-ui')}));
 // A real user-facing ride selector, never a simulation function or save edit.
 await page.locator('#ride-mode').focus();
 await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await chapterTap(inp,'#start');
 await until(read,s=>s.running&&s.sessionMode==='chapter','User selected no-clock chapter');
 async function stop(){await inp.set(['brake']);await untilGame(read,s=>s.speed<.1&&Math.hypot(s.vx,s.vz)<.15,'Skater physically stops',{sim:5,wall:90000});await inp.release();}
 async function approach(x,z){const end=Math.min(Date.now()+150000,RUN_DEADLINE);const initial=await read();let last;try{while(Date.now()<end){last=await read();assert(last.elapsed-initial.elapsed<30,'Keeper approach exceeded actual simulation budget');const dx=x-last.x,dz=z-last.z,d=Math.hypot(dx,dz);if(d<.55)break;const err=wrap(Math.atan2(-dx,-dz)-last.yaw);const actions=[];if(Math.abs(err)>.06)actions.push(err>0?'left':'right');if(Math.abs(err)>.3||last.speed>3.2||(d<1.2&&last.speed>1.2))actions.push('brake');else if(last.speed<(d<1.2?.8:2.6))actions.push('push');await inp.set(actions);await sleep(65);}assert(Math.hypot(x-last.x,z-last.z)<.65,'Real skating reaches keeper approach; '+JSON.stringify(last));}finally{await stop();}}
 await approach(5.15,6.3);
 await until(read,s=>s.career.nearby==='keeper','Physical keeper proximity');
 if(phone)await chapterTap(inp,'#talk');else{await page.locator('#plaza').focus();await page.keyboard.press('e');}
 await page.locator('#chapter-dialog').waitFor({state:'visible'});
 await chapterTap(inp,'#contract-accept');
 await step('Keeper physically met and first contract accepted',async()=>{const s=await until(read,s=>s.career.active&&s.career.contract==='borrowed-light','Keeper contract accepted');assert.equal(s.career.completed,0);assert.deepEqual(s.career.progress.tricks,[]);assert.equal(s.career.progress.banked,0);return s;});
 async function cleanTrick(code,id){
  await stop();const before=await read(),serial=before.events.at(-1)?.serial||0;
  const cached=phone?await inp.cacheTouchTap('[data-trick="'+code+'"]',['ollie']):null;
  if(phone)await inp.holdCached(cached);else await inp.set(['ollie']);
  await untilGame(read,s=>s.charge>=.4,'Real ollie charges',{sim:2,wall:90000});
  // Deliver actual trick input immediately after actual release; do not spend
  // the airborne window scrolling/querying the DOM or polling a snapshot.
  if(phone)await inp.releaseAndTapCached(cached);else{await inp.release();await page.keyboard.press(code==='KeyF'?'f':'k');}
  await untilGame(read,s=>{assert.equal(s.bails,before.bails,'No bail accepted as a clean pop');return !s.grounded&&s.y>.1;},'Actual released ollie is airborne',{sim:2,wall:90000});
  await untilGame(read,s=>{assert.equal(s.bails,before.bails,'No bail accepted as a clean trick');return s.events.some(e=>e.serial>serial&&e.type==='ollie')&&s.events.some(e=>e.serial>serial&&e.type==='trick-start'&&e.id===id);},'Actual pop and trick-start events',{sim:2,wall:90000});
  const landed=await untilGame(read,s=>{assert.equal(s.bails,before.bails,'No bail accepted as a clean landing');return s.grounded&&s.stats.tricks>before.stats.tricks&&s.stats.landings>before.stats.landings;},'Actual trick catches and lands',{sim:3,wall:90000});
  assert(landed.events.some(e=>e.serial>serial&&e.type==='landed-trick'&&e.id===id),'Actual distinct clean trick landing event');
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
 await page.reload({waitUntil:'load'});await assets(page,hook);
 await step('Chapter progress and unlocked contract persist across real reload',async()=>{const s=await until(read,s=>s.career.completed===1&&s.renderer.city.canopyIntensity===24&&s.renderer.wardrobe.vestColor==='ffffff','Saved chapter and actual scene repair restored');assert.equal(s.career.contract,'last-route');assert.equal(s.career.unlocks.wovenVest,true);assert.equal(s.storageAvailable,true);return s;});
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
async function apartmentChapter({page,phone,step,name}){
 const hook='__NIGHT_IN__',read=()=>snap(page,hook);
 await assets(page,hook);await until(read,s=>s.story?.mosaicLoaded&&s.story.neighborSkinnedMeshes>0,'Actual chapter mosaic and animated neighbor',90000);
 const inp=new RealInput(page,phone,{up:'[data-dir="up"]',down:'[data-dir="down"]',left:'[data-dir="left"]',right:'[data-dir="right"]'},{up:'w',down:'s',left:'a',right:'d'},'#stage');
 await step('Inhabited room and original material actually render',async()=>({snapshot:await read(),controls:await controls(page),frame:await shot(page,'#world',name+'-chapter-01-room'),ui:await uiFrame(page,name+'-chapter-01-ui')}));
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
  for(let n=0;n<4&&(await read()).track!==1;n++){if(phone)await chapterTap(inp,'#interact');else{await page.locator('#stage').focus();await page.keyboard.press('e');}await sleep(100);}
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
  await page.reload({waitUntil:'load'});await assets(page,hook);
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
(async()=>{let browser;try{
 for(const relative of ['arcade/custom/kosher-lines','arcade/custom/night-in','arcade/custom/crib-recovered-assets','static/vendor/three/0.160.0','static/fonts'])await pinTree(relative);
 for(const relative of ['static/customer-experience.css','favicon.svg','favicon.ico']){const bytes=await fsp.readFile(path.join(repo,relative));report.source.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});}
 report.source.sort((a,b)=>a.path.localeCompare(b.path));persist();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 for(const phone of [false,true]){await runCase(browser,base,'kosher-lines',phone,skatingChapter);await runCase(browser,base,'night-in',phone,apartmentChapter);}
 }catch(e){report.failure=e.stack||String(e);console.error(report.failure);}finally{
 if(browser)await browser.close();server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));
 report.finishedUtc=new Date().toISOString();report.passed=report.cases.length===4&&report.cases.every(c=>c.passed)&&!report.failure&&report.serverErrors.length===0;persist();
 console.log(JSON.stringify({passed:report.passed,scope:report.scope,cases:report.cases.map(c=>({name:c.name,passed:c.passed,failure:c.failure})),evidence:out},null,2));if(!report.passed)process.exitCode=1;
 }})();
