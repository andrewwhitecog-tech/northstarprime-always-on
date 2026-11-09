'use strict';
// Capture the unmodified, public original Chrono client. Never write game state.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawn, execFileSync} = require('node:child_process');
const out = path.resolve(process.env.CHRONO_CAPTURE_OUT || 'chrono-capture');
const receipt = {startedUtc: new Date().toISOString(), status: 'started', accepted: false,
  audioProvenance: 'Actual ChronoAudio procedural BGM/SFX emitted by the original game; not a recorded OST.',
  inputs: [], observations: [], errors: []};
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function engine(html) {
  const match = html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>/);
  assert.ok(match, 'Actual original inline engine missing');
  return match[1].replace(/\r\n/g, '\n');
}
function assertRecordedImagePresence(records,required=['far-environment-v01.png','interceptor-v02.png','hostiles-v02.png']) {
  assert.ok(Array.isArray(records), 'Actual image response records must be an array');
  for (const asset of required)
    assert.ok(records.some(record => record && typeof record.url==='string' && record.url.endsWith('/'+asset) && record.status===200),
      'Missing actual successful image response: '+asset);
}
function parseLiveInputClock(log) {
  const starts=[...log.matchAll(/Duration: N\/A, start: ([\d.]+)/g)].map(match=>Number(match[1]));
  assert.ok(starts.length>=2&&starts.slice(0,2).every(Number.isFinite),'Actual X11/Pulse input-start timestamps required');
  assert.ok(starts[0]>1e9&&Math.abs(starts[1]-starts[0])<10,'Live inputs must report a plausible shared epoch clock');
  return {x11EpochSeconds:starts[0],pulseEpochSeconds:starts[1],inputStartGapSeconds:starts[1]-starts[0]};
}
function nativeDirectionAt(elapsedMs) {
  assert.ok(Number.isFinite(elapsedMs)&&elapsedMs>=0);
  return ['d','s','a','w'][Math.floor(elapsedMs/250)%4];
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ownChildren = new Set(), childStates = new WeakMap();
let browser, recorder, recorderDone, cleanupPromise, cleaningUp=false;
function bounded(promise,ms,label) {
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+'ms')),ms);})])
    .finally(()=>clearTimeout(timer));
}
function trackOwnedChild(child,label) {
  assert.ok(Number.isInteger(child.pid)&&child.pid>0,'Owned child needs an actual PID');
  const state={pid:child.pid,label,startedUtc:new Date().toISOString(),closed:false};
  const done=new Promise(resolve=>{
    child.once('error',error=>{state.error=String(error);});
    child.once('close',(code,signal)=>{
      Object.assign(state,{closed:true,code,signal,closedUtc:new Date().toISOString()});
      ownChildren.delete(child);resolve(state);
    });
  });
  childStates.set(child,{state,done});ownChildren.add(child);
  (receipt.childProcesses ||= []).push(state);
  return done;
}
function launch(binary, args, stderrName) {
  assert.equal(cleaningUp,false,'Refuse a new child during cleanup');
  const log=fs.openSync(path.join(out,stderrName),'w');
  const child=spawn(binary,args,{stdio:['ignore','ignore','pipe'],windowsHide:true});
  child.once('error',error=>receipt.errors.push(String(error)));
  if(!Number.isInteger(child.pid)||child.pid<=0){fs.closeSync(log);throw Error('Spawn failed: '+binary);}
  trackOwnedChild(child,binary);
  child.stderr.on('data',chunk=>fs.writeSync(log,chunk));
  child.once('close',()=>fs.closeSync(log));
  return child;
}
function closed(child) {
  assert.ok(childStates.has(child),'Only await an owned registered child');
  return childStates.get(child).done;
}
async function stopOwnedChild(child,{softSignal='SIGTERM',graceMs=1500,killMs=1500}={}) {
  assert.ok(childStates.has(child),'Refuse to stop an unregistered child');
  const {state,done}=childStates.get(child),started=Date.now();
  const result={pid:child.pid,softSignal,softSignalSent:false,escalated:false,closedConfirmed:state.closed};
  if(!state.closed) {
    if(child.exitCode===null&&child.signalCode===null) result.softSignalSent=child.kill(softSignal);
    try {await bounded(done,graceMs,'Owned soft-signal close');}
    catch(error) {
      result.softWaitError=String(error);
      if(!state.closed&&child.exitCode===null&&child.signalCode===null) {
        result.escalated=true;result.killSignal='SIGKILL';result.killSignalSent=child.kill('SIGKILL');
      }
      try {await bounded(done,killMs,'Owned forced close');}catch(error){result.closeError=String(error);}
    }
  }
  result.closedConfirmed=state.closed;
  if(state.closed) result.actualExit={code:state.code,signal:state.signal,closedUtc:state.closedUtc};
  result.elapsedMs=Date.now()-started;
  return result;
}
function cleanupOwned(reason) {
  if(cleanupPromise) return cleanupPromise;
  cleaningUp=true;
  cleanupPromise=(async()=>{
    const result=receipt.cleanup={reason,startedUtc:new Date().toISOString(),children:[]};
    if(recorder&&ownChildren.has(recorder)) result.children.push(await stopOwnedChild(recorder,{softSignal:'SIGINT'}).catch(error=>({closedConfirmed:false,error:String(error)})));
    const remaining=[...ownChildren];
    const browserClose=browser
      ? bounded(browser.close(),3000,'Browser close').then(()=>({closed:true}),error=>({closed:false,error:String(error)}))
      : Promise.resolve({notStarted:true});
    const [childResults,browserResult]=await Promise.all([
      Promise.allSettled(remaining.map(child=>stopOwnedChild(child))),browserClose
    ]);
    for(const item of childResults) result.children.push(item.status==='fulfilled'?item.value:{closedConfirmed:false,error:String(item.reason)});
    result.browser=browserResult;result.finishedUtc=new Date().toISOString();
    if(result.children.some(child=>!child.closedConfirmed)||browserResult.closed===false) {
      receipt.status='failed';receipt.errors.push('Owned cleanup did not confirm every exit; inspect cleanup receipt');process.exitCode ||= 1;
    }
    return result;
  })();
  return cleanupPromise;
}
function command(binary, args, name) {
  const child = launch(binary, args, name);
  return closed(child).then(result => {
    assert.equal(result.code, 0, binary + ' failed; inspect ' + name);
    return result;
  });
}
function patchNativeFocus(playwrightPath) {
  const core = path.resolve(playwrightPath, '../playwright-core');
  assert.equal(JSON.parse(fs.readFileSync(path.join(core, 'package.json'))).version, '1.55.1');
  const file = path.join(core, 'lib/server/chromium/crPage.js');
  const before = fs.readFileSync(file, 'utf8');
  const anchor = /(this\._client\.send\(["']Emulation\.setFocusEmulationEnabled["'],\s*\{\s*enabled:\s*)true(\s*\}\))/g;
  assert.equal([...before.matchAll(anchor)].length, 1, 'Pinned native-focus fixture anchor changed');
  const after = before.replace(anchor, '$1false$2');
  fs.writeFileSync(file, after);
  write('NATIVE_FOCUS_FIXTURE.json', {package: 'playwright-core', version: '1.55.1',
    beforeSha256: hash(before), afterSha256: hash(after), replacements: 1,
    scope: 'Disable driver-forced focus only; game source and state unmodified'});
}
async function verifySource(pin, root) {
  assert.equal(pin.captureAuthorizedAfterEnemyAcceptance, true, 'Enemy acceptance handoff is still pending');
  assert.match(pin.acceptedSourceCommit || '', /^[0-9a-f]{40}$/);
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
  assert.equal(head, pin.acceptedSourceCommit, 'Source checkout is not the accepted enemy commit');
  assert.equal(pin.publicOrigin, 'https://northstarprime.net/');
  assert.ok(pin.files.length >= 4, 'Pin page, FAR, player and enemy assets');
  const pagePin = pin.files.find(entry => entry.path === pin.gameRoute.slice(1) + 'index.html');
  assert.ok(pagePin, 'Pin the source page');
  assert.match(pin.releasedEngineSha256 || '', /^[0-9a-f]{64}$/, 'Verified released engine digest is pending');
  const facts = [];
  for (const entry of pin.files) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(!entry.path.includes('..') && !path.isAbsolute(entry.path));
    const bytes = fs.readFileSync(path.join(root, entry.path));
    assert.equal(hash(bytes), entry.sha256, 'Source hash mismatch: ' + entry.path);
    if (entry.path.endsWith('/index.html')) assert.equal(hash(engine(bytes.toString('utf8'))), pin.releasedEngineSha256);
    facts.push({path:entry.path,sourceBytes:bytes.length,sourceSha256:hash(bytes)});
  }
  receipt.source = {commit: head, publicOrigin: pin.publicOrigin, files: facts};
  write('SOURCE_VERIFIED.json', receipt.source);
}
async function main() {
  fs.mkdirSync(out, {recursive:true});
  assert.equal(process.platform, 'linux', 'This workflow uses an isolated Linux virtual display');
  const pin = JSON.parse(fs.readFileSync(path.join(__dirname, 'chrono-gameplay-source-pin.json')));
  const root = path.resolve(process.env.CHRONO_GAME_ROOT);
  await verifySource(pin, root);
  const pwPath = process.env.NSP_PLAYWRIGHT_PATH;
  patchNativeFocus(pwPath);
  const {chromium} = require(pwPath);
  const url = new URL(pin.gameRoute, pin.publicOrigin).href;
  const xScreenText=execFileSync('xdpyinfo',[],{encoding:'utf8',timeout:5000});
  fs.writeFileSync(path.join(out,'X_SCREEN_ACTUAL.txt'),xScreenText);
  const xSize=xScreenText.match(/dimensions:\s+(\d+)x(\d+)\s+pixels/);
  assert.ok(xSize,'Actual X server dimensions were not reported');
  receipt.xScreenDimensions={width:Number(xSize[1]),height:Number(xSize[2]),display:process.env.DISPLAY};
  assert.deepEqual([receipt.xScreenDimensions.width,receipt.xScreenDimensions.height],[1324,900]);
  const windowManager=launch('openbox',['--sm-disable'],'window-manager.log');
  receipt.windowManager={binary:'openbox',pid:windowManager.pid,scope:'Owned disposable X display only; terminated by own-child cleanup'};
  await sleep(500);
  assert.ok(windowManager.exitCode===null && windowManager.signalCode===null,'Owned Openbox exited before native browser startup');
  browser = await chromium.launch({headless: false, args: [
    '--kiosk', '--window-position=0,0', '--window-size=1324,900', '--disable-dev-shm-usage'
  ]});
  const context = await browser.newContext({viewport: null});
  await context.route('**/*', route => /cloudflareinsights\.com|google-analytics\.com|googletagmanager\.com/.test(route.request().url()) ? route.abort() : route.continue());
  const page = await context.newPage();
  page.on('pageerror', e => receipt.errors.push(String(e)));
  const assetResponses = [], assetBodies = [];
  receipt.assetResponses = assetResponses;
  page.on('response', response => {
    const parsed = new URL(response.url());
    if (parsed.origin === pin.publicOrigin.replace(/\/$/, '') && (parsed.pathname.startsWith(pin.gameRoute + 'assets/') || pin.files.some(entry=>'/'+entry.path===parsed.pathname && !entry.path.endsWith('/index.html')))) {
      assetBodies.push((async () => {
        const body = await response.body();
        const observation = {url:response.url(),status:response.status(),bytes:body.length,sha256:hash(body)};
        assetResponses.push(observation);
        const expected = pin.files.find(entry => '/' + entry.path === parsed.pathname);
        assert.ok(expected, 'Unexpected game image response: '+parsed.pathname);
        assert.equal(response.status(),200,'Actual public image HTTP failure');
        assert.equal(observation.sha256,expected.sha256,'Actual public image differs from accepted source');
      })().catch(error => {receipt.errors.push(error.stack || String(error));}));
    }
  });
  const navigation = await page.goto(url, {waitUntil: 'networkidle'});
  assert.ok(navigation && navigation.status()===200, 'Actual public game response failed');
  const publicPage = await navigation.body();
  const publicEngineSha = hash(engine(publicPage.toString('utf8')));
  assert.equal(publicEngineSha,pin.releasedEngineSha256,'Actual public engine differs from the accepted release');
  if (pin.releasedPageSha256) assert.equal(hash(publicPage),pin.releasedPageSha256);
  receipt.publicPage = {url:page.url(),status:navigation.status(),bytes:publicPage.length,
    fullPageSha256:hash(publicPage),engineSha256:publicEngineSha};
  await Promise.all(assetBodies);
  assert.equal(receipt.errors.length,0,'Actual public resource validation failed');
  await page.bringToFront();
  await sleep(750);
  const decoded = await page.evaluate(async () => {
    await Promise.all([farEnvironment.decode(),shipAtlas.decode(),enemyAtlas.decode(),weaponAtlasImage.decode()]);
    return {far: {state: farEnvironmentState, width: farEnvironment.naturalWidth, height: farEnvironment.naturalHeight},
      ship: {state: shipAtlasState, width: shipAtlas.naturalWidth, height: shipAtlas.naturalHeight},
      enemy: {state: enemyAtlasState, width: enemyAtlas.naturalWidth, height: enemyAtlas.naturalHeight},
      weapon:{state:weaponArt?.ready()?'ready':'invalid',width:weaponAtlasImage.naturalWidth,height:weaponAtlasImage.naturalHeight}};
  });
  assert.deepEqual(decoded, {far:{state:'ready',width:1774,height:887},
    ship:{state:'ready',width:1536,height:1024},enemy:{state:'ready',width:1536,height:1024},weapon:{state:'ready',width:1536,height:1024}});
  assertRecordedImagePresence(assetResponses,pin.files.filter(entry=>entry.path.endsWith('.png')).map(entry=>path.basename(entry.path)));
  for(const entry of pin.files.filter(entry=>!entry.path.endsWith('/index.html')))
    assert.ok(assetResponses.some(record=>new URL(record.url).pathname==='/'+entry.path&&record.sha256===entry.sha256),'Actual pinned resource not verified: '+entry.path);
  receipt.decodedImages = decoded;
  receipt.assetResponses = assetResponses;
  const nativeWindow = await context.newCDPSession(page);
  receipt.nativeWindowBefore = await nativeWindow.send('Browser.getWindowForTarget');
  let fullscreenError;
  try {
    await nativeWindow.send('Browser.setWindowBounds', {windowId:receipt.nativeWindowBefore.windowId,bounds:{windowState:'fullscreen'}});
    await page.waitForFunction(() => innerWidth===1324 && innerHeight===900, undefined, {timeout:5000});
  } catch (error) {fullscreenError=error;}
  receipt.nativeWindowAfter = await nativeWindow.send('Browser.getWindowForTarget');
  receipt.browserVersion = await browser.version();
  await page.screenshot({path:path.join(out,'native-window-before-geometry-guard.png')});
  const windowFacts = await page.evaluate(() => ({innerWidth, innerHeight, outerWidth, outerHeight,
    screenX, screenY, screenWidth:screen.width, screenHeight:screen.height,
    availableScreenWidth:screen.availWidth, availableScreenHeight:screen.availHeight, devicePixelRatio, focused: document.hasFocus(), visibility: document.visibilityState,
    imageReadiness: 'Actual canvas image objects decoded and source-sized above'}));
  receipt.window = windowFacts;
  if(fullscreenError) throw fullscreenError;
  assert.equal(receipt.nativeWindowAfter.bounds.windowState,'fullscreen','Require actual native browser fullscreen state');
  assert.deepEqual([windowFacts.screenX, windowFacts.screenY, windowFacts.innerWidth, windowFacts.innerHeight],
    [0, 0, 1324, 900], 'Kiosk geometry differs; do not guess screen-to-canvas alignment');
  assert.equal(windowFacts.devicePixelRatio, 1, 'Verify native pixel ratio rather than setting incompatible null-viewport scale');
  assert.equal(windowFacts.focused, true);
  assert.equal(windowFacts.visibility, 'visible');
  const bounds = await page.locator('#gameCanvas').boundingBox();
  assert.ok(bounds && bounds.width > 800 && bounds.height > 400);
  const crop = {x: Math.floor(bounds.x), y: Math.floor(bounds.y),
    width: Math.floor(bounds.width / 2) * 2, height: Math.floor(bounds.height / 2) * 2};
  assert.deepEqual([crop.width, crop.height], [1024, 576], 'Preserve the reviewed native 16:9 canvas geometry; never scale a different layout');
  receipt.captureGeometry = crop;
  await page.screenshot({path: path.join(out, 'before-native-input.png')});
  if(process.argv.includes('--preflight-only')) {
    receipt.preflight = await page.evaluate(() => ({mode:document.body.dataset.mode,audioInitialized:audio.ctx!==null}));
    assert.equal(receipt.preflight.mode,'TITLE');
    assert.equal(receipt.preflight.audioInitialized,false);
    receipt.status='preflight-native-geometry-verified-no-gameplay-or-recording';
    return;
  }
  assert.equal(await page.locator('body').getAttribute('data-mode'),'TITLE');
  receipt.encoderWarmup={mode:'TITLE',startedEpochMs:Date.now()};
  const raw = path.join(out,'chrono-gameplay-raw-preroll.mp4');
  const final = path.join(out,'chrono-gameplay-native.mp4');
  const display = (process.env.DISPLAY || ':99').replace(/\.\d+$/, '') + '.0';
  const args = ['-hide_banner', '-y', '-thread_queue_size', '512',
    '-use_wallclock_as_timestamps', '1', '-f', 'x11grab', '-draw_mouse', '0',
    '-framerate', '30', '-video_size', crop.width + 'x' + crop.height,
    '-i', display + '+' + crop.x + ',' + crop.y,
    '-thread_queue_size', '512', '-use_wallclock_as_timestamps', '1',
    '-isync','0','-f', 'pulse', '-i', 'nsp_capture.monitor',
    '-map', '0:v:0', '-map', '1:a:0', '-af', 'aresample=async=1:first_pts=0',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2',
    '-pix_fmt', 'yuv420p','-fps_mode','passthrough', '-c:a', 'aac', '-b:a', '192k',
    '-t', '40', '-movflags', '+faststart', raw];
  receipt.ffmpegArgs = args;
  recorder = launch('ffmpeg', args, 'capture.ffmpeg.log');
  recorderDone = closed(recorder);
  await Promise.race([
    new Promise((resolve, reject) => {
      let text = '';
      recorder.stderr.on('data', b => {text += b; if (text.includes('Output #0')) resolve();});
      recorder.once('close', code => reject(Error('Capture exited before ready: ' + code)));
    }),
    sleep(10000).then(() => {throw Error('Capture did not become ready within 10 seconds');})
  ]);
  receipt.encoderWarmup.readyEpochMs=Date.now();
  receipt.rawInputClock=parseLiveInputClock(fs.readFileSync(path.join(out,'capture.ffmpeg.log'),'utf8'));
  receipt.nativeStart={commandBeforeEpochMs:Date.now()};
  await page.locator('#startBtn').click();
  await page.waitForFunction(()=>document.body.dataset.mode==='PLAYING');
  receipt.nativeStart.verified=await page.evaluate(()=>({mode:document.body.dataset.mode,epochMs:Date.now()}));
  receipt.nativeStart.verifiedNodeEpochMs=Date.now();
  assert.equal(receipt.nativeStart.verified.mode,'PLAYING');
  assert.ok(Math.abs(receipt.nativeStart.verifiedNodeEpochMs-receipt.nativeStart.verified.epochMs)<50,'Native control and capture clocks differ');
  assert.equal(await page.locator('#titleScreen').isVisible(),false);
  assert.equal(await page.locator('#gameOverScreen').isVisible(),false);
  const started=performance.now();
  const input=async(kind,key)=>{
    receipt.inputs.push({elapsedMs:Math.round(performance.now()-started),epochMs:Date.now(),kind,key});
    if(kind==='press')await page.keyboard.press(key);
    else if(kind==='down')await page.keyboard.down(key);
    else await page.keyboard.up(key);
  };
  let held='d';await input('down',held);
  await page.mouse.move(bounds.x+bounds.width*.8,bounds.y+bounds.height*.5);
  await page.mouse.down();
  const actions=[{ms:200,key:'c'},{ms:800,key:'Space'},{ms:3000,key:'2'},{ms:7000,key:'c'},{ms:7200,key:'Space'},
    {ms:10000,key:'3'},{ms:14000,key:'c'},{ms:14400,key:'Space'}];
  let nextAction=0,nextDodge=1200,nextObservation=0;
  while(performance.now()-started<20500){
    const elapsed=performance.now()-started;
    const mode=await page.locator('body').getAttribute('data-mode');
    (receipt.modeObservations ||= []).push({elapsedMs:Math.round(elapsed),mode});
    assert.equal(mode,'PLAYING','Actual sortie left PLAYING during capture; no completed showcase');
    const direction=nativeDirectionAt(elapsed);
    if(direction!==held){await input('up',held);held=direction;await input('down',held);}
    while(nextAction<actions.length&&elapsed>=actions[nextAction].ms)await input('press',actions[nextAction++].key);
    if(elapsed>=nextDodge){await input('press','Shift');nextDodge+=1000;}
    const angle=elapsed/1900;
    await page.mouse.move(bounds.x+bounds.width*(.5+.42*Math.cos(angle)),bounds.y+bounds.height*(.5+.42*Math.sin(angle)));
    if(elapsed>=nextObservation){
      receipt.observations.push(await page.evaluate(()=>({epochMs:Date.now(),mode:document.body.dataset.mode,
        score:document.querySelector('#scoreVal')?.textContent,wave:document.querySelector('#waveVal')?.textContent,
        enemies:document.querySelector('#enemyCount')?.textContent})));
      nextObservation+=2500;
    }
    await sleep(50);
  }
  await input('up',held);
  assert.equal(await page.locator('body').getAttribute('data-mode'), 'PLAYING');
  receipt.requestedRecorderStop = 'Completed at least20seconds of observed native PLAYING; raw pre-roll retained';
  receipt.recorderStop = {pid:recorder.pid,exitCodeBeforeSignal:recorder.exitCode,
    signalCodeBeforeSignal:recorder.signalCode,stillRunning:recorder.exitCode===null && recorder.signalCode===null,
    signal:'SIGINT',signalSent:false};
  assert.equal(receipt.recorderStop.stillRunning,true,'Recorder exited before our requested stop; preserve the actual early exit');
  receipt.recorderStop.signalSent = recorder.kill('SIGINT');
  assert.equal(receipt.recorderStop.signalSent,true,'Requested recorder stop signal was not sent');
  await page.mouse.up();
  await page.screenshot({path: path.join(out, 'after-native-input.png')});
  receipt.actualInputDurationSeconds = (performance.now() - started) / 1000;
  const rec = await bounded(recorderDone,4000,'Requested FFmpeg SIGINT close');
  assert.ok(rec.code===0 || (rec.code===255 && receipt.recorderStop.stillRunning && receipt.recorderStop.signalSent),
    'Actual capture failed or exited before our requested SIGINT; inspect capture.ffmpeg.log');
  receipt.recorderExit = rec;
  recorder = null;
  assert.ok(receipt.actualInputDurationSeconds >= 20, 'Sortie ended before the 20-second PLAYING target');
  assert.equal(receipt.errors.length, 0, 'Browser errors during capture');
  const rawProbe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',raw],{encoding:'utf8',timeout:15000}));
  write('raw-ffprobe.json',rawProbe);
  const video=rawProbe.streams.find(stream=>stream.codec_type==='video');
  assert.ok(Math.abs(Number(rawProbe.format.start_time))<.05&&Math.abs(Number(video.start_time))<.05,'Raw media zero must match X11 clock origin before native trim');
  const trimStart=receipt.nativeStart.verified.epochMs/1000-receipt.rawInputClock.x11EpochSeconds+.1;
  assert.ok(trimStart>0&&trimStart<12,'Actual native Start must map inside retained raw pre-roll');
  assert.ok(Number(video.duration)>=trimStart+20,'Raw native video does not cover20seconds after verified Start');
  receipt.rawOutput={file:path.basename(raw),bytes:fs.statSync(raw).size,sha256:hash(fs.readFileSync(raw)),
    duration:Number(rawProbe.format.duration),trimStartSeconds:trimStart,inputClock:receipt.rawInputClock};
  await command('ffmpeg',['-hide_banner','-y','-ss',String(trimStart),'-i',raw,'-t','20','-map','0:v:0','-map','0:a:0',
    '-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p','-fps_mode','passthrough',
    '-c:a','aac','-b:a','192k','-movflags','+faststart',final],'final-trim.log');
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',final],{encoding:'utf8',timeout:15000}));
  write('ffprobe.json',probe);
  const duration=Number(probe.format.duration);
  assert.ok(duration>=19.95&&duration<=20.1,'Final duration must contain the verified20second native interval');
  assert.ok(probe.streams.some(stream=>stream.codec_type==='audio'),'Actual game audio missing');
  await command('ffmpeg', ['-v', 'error', '-i', final, '-f', 'null', '-'], 'full-decode.log');
  for (const [index, fraction] of [0, .25, .5, .75, 1].entries()) {
    const seconds = Math.max(0, Math.min(duration - .15, duration * fraction));
    await command('ffmpeg', ['-v', 'error', '-y', '-ss', String(seconds), '-i', final,
      '-frames:v', '1', path.join(out, 'frame-' + index + '.png')], 'frame-' + index + '.log');
  }
  await command('ffmpeg', ['-hide_banner', '-i', final, '-filter_complex',
    'ebur128=peak=true', '-f', 'null', '-'], 'audio-loudness.log');
  await command('ffmpeg', ['-hide_banner', '-i', final, '-af', 'volumedetect', '-f', 'null', '-'], 'audio-volume.log');
  const volumeLog = fs.readFileSync(path.join(out, 'audio-volume.log'), 'utf8');
  const peakMatch = volumeLog.match(/max_volume:\s*(-?[\d.]+) dB/);
  receipt.nativeAudio = {audible: !!peakMatch && Number(peakMatch[1]) > -60,
    measuredMaxDb: peakMatch ? Number(peakMatch[1]) : null,
    missingSoundtrack: !peakMatch || Number(peakMatch[1]) <= -60,
    scope: 'Native game audio monitor only; no replacement soundtrack'};
  await command('ffmpeg', ['-v', 'error', '-y', '-i', final, '-filter_complex',
    'showwavespic=s=1200x240:colors=gold', '-frames:v', '1', path.join(out, 'actual-audio-waveform.png')], 'waveform.log');
  receipt.output = {file: 'chrono-gameplay-native.mp4', bytes: fs.statSync(final).size,
    sha256: hash(fs.readFileSync(final)), duration};
  receipt.status = 'captured-awaiting-personal-visual-and-auditory-QC';
  // Loudness is measured, not silently normalized or accepted here.
}
if (require.main===module) {
  const onTermination=signal=>{
    if(receipt.terminationSignal)return;
    receipt.terminationSignal=signal;receipt.status='failed';receipt.errors.push('Process received '+signal);
    const code=signal==='SIGTERM'?143:130;process.exitCode=code;
    const finish=()=>{receipt.finishedUtc=new Date().toISOString();write('CAPTURE_ACTUAL.json',receipt);process.exit(code);};
    cleanupOwned(signal).then(finish,error=>{receipt.errors.push(String(error));finish();});
  };
  process.on('SIGTERM',()=>onTermination('SIGTERM'));
  process.on('SIGINT',()=>onTermination('SIGINT'));
  (async()=>{
    try {await main();}
    catch(error){receipt.status='failed';receipt.errors.push(error.stack||String(error));process.exitCode ||= 1;}
    finally {
      await cleanupOwned('finally');
      receipt.finishedUtc=new Date().toISOString();write('CAPTURE_ACTUAL.json',receipt);
      console.log(JSON.stringify({status:receipt.status,accepted:false,output:receipt.output,errorCount:receipt.errors.length},null,2));
    }
  })();
}
module.exports={assertRecordedImagePresence,trackOwnedChild,stopOwnedChild,parseLiveInputClock,nativeDirectionAt};
