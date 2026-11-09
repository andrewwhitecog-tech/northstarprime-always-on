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
function assertRecordedImagePresence(records) {
  assert.ok(Array.isArray(records), 'Actual image response records must be an array');
  for (const asset of ['far-environment-v01.png','interceptor-v02.png','hostiles-v02.png'])
    assert.ok(records.some(record => record && typeof record.url==='string' && record.url.endsWith('/'+asset) && record.status===200),
      'Missing actual successful image response: '+asset);
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ownChildren = new Set();
let browser, recorder, recorderDone;
function launch(binary, args, stderrName) {
  const log = fs.openSync(path.join(out, stderrName), 'w');
  const child = spawn(binary, args, {stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true});
  if (!Number.isInteger(child.pid) || child.pid <= 0) {fs.closeSync(log); throw Error('Spawn failed: ' + binary);}
  ownChildren.add(child);
  child.stderr.on('data', chunk => fs.writeSync(log, chunk));
  child.once('close', () => {ownChildren.delete(child); fs.closeSync(log);});
  child.once('error', e => {receipt.errors.push(String(e));});
  return child;
}
function closed(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({code, signal}));
  });
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
    if (parsed.origin === pin.publicOrigin.replace(/\/$/, '') && parsed.pathname.startsWith(pin.gameRoute + 'assets/')) {
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
    await Promise.all([farEnvironment.decode(), shipAtlas.decode(), enemyAtlas.decode()]);
    return {far: {state: farEnvironmentState, width: farEnvironment.naturalWidth, height: farEnvironment.naturalHeight},
      ship: {state: shipAtlasState, width: shipAtlas.naturalWidth, height: shipAtlas.naturalHeight},
      enemy: {state: enemyAtlasState, width: enemyAtlas.naturalWidth, height: enemyAtlas.naturalHeight}};
  });
  assert.deepEqual(decoded, {far:{state:'ready',width:1774,height:887},
    ship:{state:'ready',width:1536,height:1024},enemy:{state:'ready',width:1536,height:1024}});
  assertRecordedImagePresence(assetResponses);
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
    screenX, screenY, devicePixelRatio, focused: document.hasFocus(), visibility: document.visibilityState,
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
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'PLAYING');
  assert.equal(await page.locator('#titleScreen').isVisible(), false);
  assert.equal(await page.locator('#gameOverScreen').isVisible(), false);
  await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .5);
  await page.mouse.down();
  receipt.beforeCaptureMode = await page.locator('body').getAttribute('data-mode');
  receipt.preCaptureNativeInputs = ['trusted Start click', 'native canvas aim', 'native left mouse down'];
  const raw = path.join(out, 'chrono-gameplay-native.mp4');
  const display = (process.env.DISPLAY || ':99').replace(/\.\d+$/, '') + '.0';
  const args = ['-hide_banner', '-y', '-thread_queue_size', '512',
    '-use_wallclock_as_timestamps', '1', '-f', 'x11grab', '-draw_mouse', '0',
    '-framerate', '30', '-video_size', crop.width + 'x' + crop.height,
    '-i', display + '+' + crop.x + ',' + crop.y,
    '-thread_queue_size', '512', '-use_wallclock_as_timestamps', '1',
    '-f', 'pulse', '-i', 'nsp_capture.monitor',
    '-map', '0:v:0', '-map', '1:a:0', '-af', 'aresample=async=1:first_pts=0',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '2',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
    '-t', '22', '-movflags', '+faststart', raw];
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
  const started = performance.now();
  const input = async (kind, key) => {
    receipt.inputs.push({elapsedMs: Math.round(performance.now() - started), kind, key});
    if (kind === 'press') await page.keyboard.press(key);
    else if (kind === 'down') await page.keyboard.down(key);
    else await page.keyboard.up(key);
  };
  assert.equal(await page.locator('body').getAttribute('data-mode'), 'PLAYING', 'Sortie ended while encoder started');
  // One native sortie: no game globals, seeded randomness, fake actors, scores or time rewrites.
  const movement = ['d', 's', 'a', 'w', 'd', 's', 'a', 'w'];
  let elapsedSeconds = 0;
  for (let segment = 0; segment < movement.length; segment++) {
    const observed = await page.evaluate(() => ({mode: document.body.dataset.mode,
      score: document.querySelector('#scoreVal')?.textContent,
      wave: document.querySelector('#waveVal')?.textContent,
      enemies: document.querySelector('#enemyCount')?.textContent,
      portalThreadVisible: !document.querySelector('#chronoThread')?.hidden}));
    receipt.observations.push({elapsedSeconds, ...observed});
    assert.equal(observed.mode, 'PLAYING', 'Actual sortie left PLAYING; capture is failed, never accepted');
    if (segment === 2) await input('press', '2');
    if (segment === 3) await input('press', 'c');
    if (segment === 5) await input('press', '3');
    if (segment === 6) await input('press', 'Space');
    if (segment === 7) await input('press', 'Shift');
    await input('down', movement[segment]);
    const stopAt = performance.now() + 2500;
    while (performance.now() < stopAt) {
      const mode = await page.locator('body').getAttribute('data-mode');
      receipt.modeObservations = receipt.modeObservations || [];
      receipt.modeObservations.push({elapsedMs:Math.round(performance.now()-started),mode});
      assert.equal(mode, 'PLAYING', 'Actual sortie left PLAYING during capture; no completed showcase');
      const angle = (performance.now() - started) / 1900;
      await page.mouse.move(bounds.x + bounds.width * (.5 + .42 * Math.cos(angle)),
        bounds.y + bounds.height * (.5 + .42 * Math.sin(angle)));
      await sleep(100);
    }
    await input('up', movement[segment]);
    elapsedSeconds = (performance.now() - started) / 1000;
  }
  assert.equal(await page.locator('body').getAttribute('data-mode'), 'PLAYING');
  receipt.requestedRecorderStop = 'Completed 20-second native PLAYING target';
  receipt.recorderStop = {pid:recorder.pid,exitCodeBeforeSignal:recorder.exitCode,
    signalCodeBeforeSignal:recorder.signalCode,stillRunning:recorder.exitCode===null && recorder.signalCode===null,
    signal:'SIGINT',signalSent:false};
  assert.equal(receipt.recorderStop.stillRunning,true,'Recorder exited before our requested stop; preserve the actual early exit');
  receipt.recorderStop.signalSent = recorder.kill('SIGINT');
  assert.equal(receipt.recorderStop.signalSent,true,'Requested recorder stop signal was not sent');
  await page.mouse.up();
  await page.screenshot({path: path.join(out, 'after-native-input.png')});
  receipt.actualInputDurationSeconds = (performance.now() - started) / 1000;
  const rec = await recorderDone;
  assert.ok(rec.code===0 || (rec.code===255 && receipt.recorderStop.stillRunning && receipt.recorderStop.signalSent),
    'Actual capture failed or exited before our requested SIGINT; inspect capture.ffmpeg.log');
  receipt.recorderExit = rec;
  recorder = null;
  assert.ok(receipt.actualInputDurationSeconds >= 20, 'Sortie ended before the 20-second PLAYING target');
  assert.equal(receipt.errors.length, 0, 'Browser errors during capture');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', raw], {encoding: 'utf8'}));
  write('ffprobe.json', probe);
  const duration = Number(probe.format.duration);
  assert.ok(duration >= 19 && duration <= 22, 'Preserve honest actual duration of the 20-second capture target');
  assert.ok(probe.streams.some(s => s.codec_type === 'audio'), 'Actual game sound was not captured');
  await command('ffmpeg', ['-v', 'error', '-i', raw, '-f', 'null', '-'], 'full-decode.log');
  for (const [index, fraction] of [0, .25, .5, .75, 1].entries()) {
    const seconds = Math.max(0, Math.min(duration - .15, duration * fraction));
    await command('ffmpeg', ['-v', 'error', '-y', '-ss', String(seconds), '-i', raw,
      '-frames:v', '1', path.join(out, 'frame-' + index + '.png')], 'frame-' + index + '.log');
  }
  await command('ffmpeg', ['-hide_banner', '-i', raw, '-filter_complex',
    'ebur128=peak=true', '-f', 'null', '-'], 'audio-loudness.log');
  await command('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'volumedetect', '-f', 'null', '-'], 'audio-volume.log');
  const volumeLog = fs.readFileSync(path.join(out, 'audio-volume.log'), 'utf8');
  const peakMatch = volumeLog.match(/max_volume:\s*(-?[\d.]+) dB/);
  receipt.nativeAudio = {audible: !!peakMatch && Number(peakMatch[1]) > -60,
    measuredMaxDb: peakMatch ? Number(peakMatch[1]) : null,
    missingSoundtrack: !peakMatch || Number(peakMatch[1]) <= -60,
    scope: 'Native game audio monitor only; no replacement soundtrack'};
  await command('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-filter_complex',
    'showwavespic=s=1200x240:colors=gold', '-frames:v', '1', path.join(out, 'actual-audio-waveform.png')], 'waveform.log');
  receipt.output = {file: 'chrono-gameplay-native.mp4', bytes: fs.statSync(raw).size,
    sha256: hash(fs.readFileSync(raw)), duration};
  receipt.status = 'captured-awaiting-personal-visual-and-auditory-QC';
  // Loudness is measured, not silently normalized or accepted here.
}
if (require.main===module) {
(async () => {
  try {await main();}
  catch (e) {receipt.status = 'failed'; receipt.errors.push(e.stack || String(e)); process.exitCode = 1;}
  finally {
    if (recorder && recorder.exitCode === null) {recorder.kill('SIGINT'); await recorderDone?.catch(e => receipt.errors.push(String(e)));}
    await browser?.close().catch(e => receipt.errors.push(String(e)));
    for (const child of ownChildren) if (child.exitCode === null) child.kill('SIGTERM');
    receipt.finishedUtc = new Date().toISOString();
    write('CAPTURE_ACTUAL.json', receipt);
    console.log(JSON.stringify({status: receipt.status, accepted: false, output: receipt.output,
      errorCount: receipt.errors.length}, null, 2));
  }
})();
}
module.exports = {assertRecordedImagePresence};
