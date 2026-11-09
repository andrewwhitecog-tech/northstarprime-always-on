'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.NSP_PLAYWRIGHT_PATH||'playwright');
const gameRoot=path.resolve(__dirname,'..'),out=process.env.NSP_PLAYTEST_OUT||path.join(gameRoot,'live-artifacts');
fs.mkdirSync(out,{recursive:true});
const publicURL='https://northstarprime.net/arcade/custom/northstar-chrono-defender/';
const assetURL=publicURL+'assets/interceptor-v02.png';
const engine=s=>{const m=s.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);assert.ok(m,'actual engine script must exist');return m[1].replace(/\r\n/g,'\n');};
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const expectedEngine=sha(engine(fs.readFileSync(path.join(gameRoot,'index.html'),'utf8')));
const expectedAsset=sha(fs.readFileSync(path.join(gameRoot,'assets/interceptor-v02.png')));
assert.equal(expectedAsset,'08880990b86f7c17ad3bd5c741a7847642e73774491613edb1a087dee87a1744');
const report={scope:'Actual public release, muted Chromium and native CDP gestures; automated QA visits, not organic traffic. No game-state mutation or physical-hardware claim.',publicURL,expectedEngine,expectedAsset,polls:[],views:[],pageErrors:[]};
let browser;
async function read(p){return p.evaluate(()=>({state:gameState,x:player.x,y:player.y,angle:player.angle,shipState:shipAtlasState,pose:chooseShipPose(),width:shipAtlas.naturalWidth,height:shipAtlas.naturalHeight,bullets:bullets.length,owners:{...stickOwners},aimFire:touch.aimFire}));}
async function point(p,id,dx=0,dy=0){const r=await p.locator(id).boundingBox();assert.ok(r,id+' visible');return{x:r.x+r.width/2+dx*r.width,y:r.y+r.height/2+dy*r.height};}
(async()=>{try{
 const deadline=Date.now()+480000;let ready=false;
 while(Date.now()<deadline){
  const observation={utc:new Date().toISOString()};
  try{
   const html=await fetch(publicURL+'?nsp_qa='+expectedEngine,{signal:AbortSignal.timeout(15000)});observation.pageStatus=html.status;
   if(html.ok){observation.engine=sha(engine(await html.text()));if(observation.engine===expectedEngine){
    const png=await fetch(assetURL+'?nsp_qa='+expectedAsset,{signal:AbortSignal.timeout(15000)});observation.assetStatus=png.status;
    if(png.ok){observation.asset=sha(Buffer.from(await png.arrayBuffer()));ready=observation.asset===expectedAsset;}
   }}
  }catch(e){observation.error=e.message;}
  report.polls.push(observation);if(ready)break;await new Promise(r=>setTimeout(r,10000));
 }
 assert.ok(ready,'public engine and exported PNG must match the merged source before browser proof');
 browser=await chromium.launch({headless:true,args:['--mute-audio','--disable-gpu','--no-sandbox']});
 for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
  const label=viewport.width+'x'+viewport.height,isPhone=viewport.width!==1280,context=await browser.newContext({viewport,hasTouch:isPhone,isMobile:isPhone});
  try{
   // Exclude third-party analytics so these synthetic QA visits are not sales/traffic evidence.
   await context.route('**/*',route=>/cloudflareinsights\.com|google-analytics\.com|googletagmanager\.com/.test(route.request().url())?route.abort():route.continue());
   const p=await context.newPage();p.on('pageerror',e=>report.pageErrors.push(e.message));await p.goto(publicURL+'?nsp_qa='+expectedEngine);
   await p.waitForFunction(()=>shipAtlasState==='ready');assert.deepEqual(await p.evaluate(()=>[shipAtlas.naturalWidth,shipAtlas.naturalHeight]),[1536,1024]);
   if(isPhone)await p.locator('#startBtn').tap();else await p.locator('#startBtn').press('Enter');
   await p.waitForFunction(()=>gameState==='PLAYING');const before=await read(p);
   if(isPhone){
    const client=await context.newCDPSession(p),move=await point(p,'#moveStick',.3,0),aim=await point(p,'#aimStick',0,-.3);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...move,id:1},{...aim,id:2}]});
    await p.waitForFunction(x=>player.x>x+2&&touch.aimFire&&bullets.length>0,before.x);
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await p.waitForFunction(()=>stickOwners.move===null&&stickOwners.aim===null&&!touch.aimFire);await client.detach();
   }else{await p.keyboard.down('d');await p.waitForFunction(x=>player.x>x+2,before.x);await p.keyboard.up('d');}
   const layout=await p.evaluate(()=>({viewport:[innerWidth,innerHeight],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight]}));
   assert.deepEqual(layout.document,layout.viewport,'live release must fit exact viewport');
   report.views.push({label,layout,observed:await read(p)});await p.screenshot({path:path.join(out,'live-'+label+'.png'),fullPage:true});
  }finally{await context.close();}
 }
 assert.deepEqual(report.pageErrors,[]);report.passed=true;
}catch(error){report.passed=false;report.error=error.stack;console.error(error.stack);process.exitCode=1;}
finally{if(browser)await browser.close();report.finishedUtc=new Date().toISOString();fs.writeFileSync(path.join(out,'LIVE_ACTUAL.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}})();
