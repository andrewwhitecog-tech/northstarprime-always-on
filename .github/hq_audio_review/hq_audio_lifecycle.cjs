'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.NSP_PLAYWRIGHT_PATH||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.NSP_PLAYTEST_OUT||path.join(root,'hosted-audio-results');fs.mkdirSync(out,{recursive:true});
const baseline=process.env.NSP_HQ_BASELINE||path.join(root,'hq_audio.upstream.js'),candidate=process.env.NSP_HQ_CANDIDATE||path.join(root,'hq_audio.lifecycle.candidate.js');
const fixtureURL='https://app.northstarprime.net/static/games/hq/vorath_arena/hammer_swing_1.mp3',expected='06def538a41160b719ea580c9cbf37b6904f51454aedfa0ad1be68a6a316a284';
const report={startedUtc:new Date().toISOString(),scope:'Real hosted Chromium, --mute-audio; native AudioContext lifecycle and OfflineAudioContext decode, no synth/mocks or audible review',checks:[],pageErrors:[]};let fixture,browser,server,corsServer,corsURL,corsRequests=[],waiting=[];
function flush(){for(const response of waiting.splice(0)){response.setHeader('Content-Type','audio/mpeg');response.end(fixture);}}
function html(variant){return '<!doctype html><meta charset="utf-8"><title>HQAudio lifecycle regression</title><button id="play">Unlock and request cue</button><button id="resume">Resume game audio</button><script>window.visibilityEvidence=[];document.addEventListener("visibilitychange",()=>window.visibilityEvidence.push({hidden:document.hidden,t:performance.now()}));</script><script src="/engine.js?variant='+variant+'"></script><script>window.hq=HQAudio({base:"/cue/",files:{hit:["test_hit"]},vol:{hit:.25},master:.5,muteKey:"nsp.hq-lifecycle-test"});document.getElementById("play").addEventListener("click",e=>{window.gestureTrusted=e.isTrusted;window.requestTime=performance.now();hq.unlock();hq.play("hit",{limit:20});});document.getElementById("resume").addEventListener("click",()=>hq.resume());</script>';}
function musicHtml(variant){return '<!doctype html><meta charset="utf-8"><title>Native cross-origin music regression</title><button id="start">Start native music</button><script src="/engine.js?variant='+variant+'"></script><script>const nativeCreate=AudioContext.prototype.createMediaElementSource;AudioContext.prototype.createMediaElementSource=function(element){const node=nativeCreate.call(this,element),analyser=this.createAnalyser();analyser.fftSize=2048;node.connect(analyser);window.musicTap={element,analyser,context:this};return node;};window.hq=HQAudio({base:'+JSON.stringify(corsURL+'/'+variant+'/')+',music:"probe",tracks:["probe"],files:{},master:.5,musicVol:.5,muteKey:"nsp-cors-'+variant+'"});document.getElementById("start").addEventListener("click",e=>{window.musicGestureTrusted=e.isTrusted;hq.unlock();hq.music(true);});</script>';}
async function crossOriginMusicCase(context,url,variant){
 const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.stack||e.message));const warnings=[];page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')warnings.push(m.text());});
 try{
  await page.goto(url+'/music-probe?variant='+variant);await page.bringToFront();await page.locator('#start').click();
  await page.waitForFunction(()=>window.musicGestureTrusted&&window.musicTap?.context.state==='running'&&window.hq.isPlayingMusic()&&window.musicTap.element.readyState>=2&&window.musicTap.element.currentTime>0);
  const evidence=await page.evaluate(async()=>{
   const tap=window.musicTap,buffer=new Float32Array(tap.analyser.fftSize),peaks=[];
   for(let i=0;i<40;i++){tap.analyser.getFloatTimeDomainData(buffer);let peak=0;for(const sample of buffer)peak=Math.max(peak,Math.abs(sample));peaks.push(peak);await new Promise(r=>setTimeout(r,30));}
   return {gestureTrusted:window.musicGestureTrusted,documentOrigin:location.origin,resourceOrigin:new URL(tap.element.currentSrc).origin,crossOrigin:tap.element.crossOrigin,nativePlaying:window.hq.isPlayingMusic(),nativeContext:tap.context.state,readyState:tap.element.readyState,currentTime:tap.element.currentTime,samples:peaks.length,peak:Math.max(...peaks),nonzeroWindows:peaks.filter(p=>p>.00001).length,status:window.hq.status()};
  });
  evidence.warnings=warnings;evidence.requests=corsRequests.filter(r=>r.path.startsWith('/'+variant+'/'));return evidence;
 }finally{await page.evaluate(()=>window.hq?.stopMusic()).catch(()=>{});await page.close();}
}

async function mark(name,fn){await fn();report.checks.push({name,passed:true,atUtc:new Date().toISOString()});}
async function ready(page){await page.waitForFunction(()=>typeof window.hq?.status==='function');}
async function pending(){const deadline=Date.now()+5000;while(!waiting.length&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.equal(waiting.length,1,'real pending HTTP sample fetch required');}
async function fresh(context,url,variant){const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(e.stack||e.message));await page.goto(url+'/?variant='+variant);await ready(page);return page;}
async function visibilityCase(context,url,variant){
 const page=await fresh(context,url,variant),other=await context.newPage();const a=await context.newCDPSession(page),b=await context.newCDPSession(other);await a.send('Emulation.setFocusEmulationEnabled',{enabled:false});await b.send('Emulation.setFocusEmulationEnabled',{enabled:false});await other.goto('about:blank');await page.bringToFront();await page.waitForFunction(()=>!document.hidden,null,{polling:10,timeout:3000});await pending();
 await page.locator('#play').click();assert.equal(await page.evaluate(()=>window.gestureTrusted),true);await page.waitForFunction(()=>window.hq.status().context==='running');
 await other.bringToFront();await page.waitForFunction(()=>document.hidden,null,{polling:10,timeout:3000});await page.bringToFront();await page.waitForFunction(()=>!document.hidden,null,{polling:10,timeout:3000});
 const releasedAfterMs=await page.evaluate(()=>performance.now()-window.requestTime);assert.ok(releasedAfterMs<700,'reproduction must release inside upstream 800ms freshness window; actual '+releasedAfterMs);flush();await page.waitForFunction(()=>window.hq.loaded()===1);await page.waitForTimeout(80);
 const evidence=await page.evaluate(()=>({status:window.hq.status(),visibility:window.visibilityEvidence,elapsed:performance.now()-window.requestTime}));evidence.releasedAfterMs=releasedAfterMs;assert.ok(evidence.visibility.some(e=>e.hidden)&&evidence.visibility.some(e=>!e.hidden),'must observe native hidden and visible transitions');await a.detach();await b.detach();await other.close();await page.close();return evidence;
}
(async()=>{try{
 if(process.env.NSP_HQ_FIXTURE)fixture=fs.readFileSync(process.env.NSP_HQ_FIXTURE);else{const r=await fetch(fixtureURL,{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);fixture=Buffer.from(await r.arrayBuffer());}
 const hash=crypto.createHash('sha256').update(fixture).digest('hex');assert.equal(hash,expected,'actual registered sample must match inspected bytes');report.fixture={source:process.env.NSP_HQ_FIXTURE?'pinned_public_fixture':'public_app_http',url:fixtureURL,bytes:fixture.length,sha256:hash,sourceRegister:'Verified already-public registered SFX bytes; technical regression fixture, not a score or listening acceptance'};
 server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');const u=new URL(req.url,'http://local');if(u.pathname==='/music-probe'){res.setHeader('Content-Type','text/html');return res.end(musicHtml(u.searchParams.get('variant')==='baseline'?'baseline':'candidate'));}if(u.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}if(u.pathname==='/engine.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(u.searchParams.get('variant')==='baseline'?baseline:candidate));}if(u.pathname==='/cue/test_hit.mp3'){waiting.push(res);return;}if(['/raw-fixture.mp3','/cue/music_a.mp3','/cue/music_b.mp3'].includes(u.pathname)){res.setHeader('Content-Type','audio/mpeg');return res.end(fixture);}res.setHeader('Content-Type','text/html');res.end(html(u.searchParams.get('variant')==='baseline'?'baseline':'candidate'));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 corsServer=http.createServer((req,res)=>{corsRequests.push({path:req.url,origin:req.headers.origin||null,mode:req.headers['sec-fetch-mode']||null});res.setHeader('Access-Control-Allow-Origin',url);res.setHeader('Vary','Origin');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','audio/mpeg');res.end(fixture);});
 await new Promise(resolve=>corsServer.listen(0,'127.0.0.1',resolve));corsURL='http://127.0.0.1:'+corsServer.address().port;

 browser=await chromium.launch({headless:process.env.NSP_HQ_HEADLESS==='1',args:['--mute-audio','--disable-gpu','--disable-dev-shm-usage','--no-sandbox']});const context=await browser.newContext();
 await mark('baseline reproduces late cue after a genuine hide/return during fetch',async()=>{report.baseline=await visibilityCase(context,url,'baseline');assert.equal(report.baseline.status.played.hit,1,'existing upstream must actually reproduce the stale cue');});
 await mark('candidate cancels the same late cue and decodes the real sample',async()=>{report.candidate=await visibilityCase(context,url,'candidate');assert.equal(report.candidate.status.played.hit||0,0);assert.equal(report.candidate.status.decoded.length,1);assert.equal(report.candidate.status.limiter,true);});
 const page=await fresh(context,url,'candidate');await pending();await page.locator('#play').click();await page.waitForFunction(()=>window.hq.status().context==='running');
 await mark('manual pause cancels pending decode and refuses further cue calls',async()=>{await page.evaluate(()=>{window.hq.pause();window.hq.play('hit');});flush();await page.waitForFunction(()=>window.hq.loaded()===1);const s=await page.evaluate(()=>window.hq.status());assert.equal(s.paused,true);assert.equal(s.played.hit||0,0);assert.equal(s.activeVoices,0);assert.deepEqual(s.pendingCues,[]);});
 await mark('explicit trusted resume enables a fresh cue without replaying the paused one',async()=>{await page.locator('#resume').click();await page.waitForFunction(()=>window.hq.status().context==='running');assert.equal((await page.evaluate(()=>window.hq.status())).played.hit||0,0);await page.locator('#play').click();await page.waitForFunction(()=>window.hq.status().played.hit===1);await page.evaluate(()=>window.hq.pause());const s=await page.evaluate(()=>window.hq.status());assert.equal(s.activeVoices,0);assert.equal(s.paused,true);});
 await mark('native OfflineAudioContext decodes actual registered SFX without playback',async()=>{report.decode=await page.evaluate(async()=>{const c=new OfflineAudioContext(2,48000,48000),b=await c.decodeAudioData(await(await fetch('/raw-fixture.mp3')).arrayBuffer());let peak=0;for(let ch=0;ch<b.numberOfChannels;ch++)for(const v of b.getChannelData(ch))peak=Math.max(peak,Math.abs(v));return{duration:b.duration,sampleRate:b.sampleRate,channels:b.numberOfChannels,peak};});assert.ok(report.decode.duration>.4&&report.decode.duration<.9);assert.ok(report.decode.peak>.001&&report.decode.peak<=1);});
 await mark('stopMusic during the real delayed track swap remains stopped',async()=>{
  await page.evaluate(()=>{window.hq.setMusic('music_a');window.hq.music(true);});await page.locator('#resume').click();
  await page.waitForFunction(()=>window.hq.isPlayingMusic()&&window.hq.status().musicTime>0);
  await page.evaluate(()=>{window.hq.setMusic('music_b');const scheduled=window.hq.status();window.hq.stopMusic();window.stopMusicRequest={request:'stopMusic()',at:performance.now(),scheduled,nativePlayingImmediatelyAfter:window.hq.isPlayingMusic()};});
  await page.waitForTimeout(420);
  report.lateStop=await page.evaluate(()=>({request:window.stopMusicRequest,afterMs:performance.now()-window.stopMusicRequest.at,nativeIsPlayingMusic:window.hq.isPlayingMusic(),status:window.hq.status()}));
  assert.ok(report.lateStop.afterMs>=350);assert.equal(report.lateStop.request.scheduled.music,'playing');assert.equal(report.lateStop.nativeIsPlayingMusic,false);assert.equal(report.lateStop.status.music,'paused');assert.equal(report.lateStop.status.musicName,'music_b');
 });
 await page.close();
 await mark('anonymous CORS music routing produces real native audio where the no-CORS baseline is silent',async()=>{
  report.crossOriginMusic={baseline:await crossOriginMusicCase(context,url,'baseline'),candidate:await crossOriginMusicCase(context,url,'candidate')};
  const before=report.crossOriginMusic.baseline,after=report.crossOriginMusic.candidate;
  assert.notEqual(before.resourceOrigin,before.documentOrigin);assert.notEqual(after.resourceOrigin,after.documentOrigin);
  assert.equal(before.nativePlaying,true);assert.equal(after.nativePlaying,true);assert.equal(before.crossOrigin,null);assert.equal(after.crossOrigin,'anonymous');
  assert.equal(before.peak,0,'real no-CORS MediaElementSource baseline must reproduce silence');assert.ok(after.peak>.001,'real CORS-enabled native analyser must observe non-silent sample data');
  assert.ok(after.nonzeroWindows>0);assert.ok(after.requests.some(r=>r.origin===after.documentOrigin&&r.mode==='cors'));
 });
 await context.close();assert.deepEqual(report.pageErrors,[]);report.passed=true;
 }catch(error){report.passed=false;report.error=error.stack||String(error);console.error(report.error);process.exitCode=1;}
 finally{flush();if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));if(corsServer)await new Promise(resolve=>corsServer.close(resolve));report.endedUtc=new Date().toISOString();fs.writeFileSync(path.join(out,'hq-audio-lifecycle-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
