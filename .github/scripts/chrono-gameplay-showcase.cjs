'use strict';
// Capture the unmodified, public original Chrono client. Never write game state.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawn, execFileSync} = require('node:child_process');
const out = path.resolve(process.env.CHRONO_CAPTURE_OUT || 'chrono-capture');
fs.mkdirSync(out, {recursive: true});
const receipt = {startedUtc: new Date().toISOString(), status: 'started', accepted: false,
  audioProvenance: 'Actual ChronoAudio procedural BGM/SFX emitted by the original game; not a recorded OST.',
  inputs: [], observations: [], errors: []};
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const ownChildren = new Set();
let server, browser, recorder, recorderDone;
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
  assert.ok(pin.files.length >= 4, 'Pin page, FAR, player and enemy assets');
  const facts = [];
  for (const entry of pin.files) {
    assert.match(entry.sha256, /^[0-9a-f]{64}$/);
    assert.ok(!entry.path.includes('..') && !path.isAbsolute(entry.path));
    const bytes = fs.readFileSync(path.join(root, entry.path));
    assert.equal(hash(bytes), entry.sha256, 'Source hash mismatch: ' + entry.path);
    const response = await fetch(new URL(entry.path, pin.publicOrigin), {signal: AbortSignal.timeout(20000)});
    assert.equal(response.status, 200, 'Released resource unavailable: ' + entry.path);
    const live = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(live), entry.releasedSha256 || entry.sha256, 'Live release hash mismatch: ' + entry.path);
    facts.push({path: entry.path, sourceBytes: bytes.length, sourceSha256: hash(bytes),
      releasedBytes: live.length, releasedSha256: hash(live)});
  }
  receipt.source = {commit: head, publicOrigin: pin.publicOrigin, files: facts};
  write('SOURCE_VERIFIED.json', receipt.source);
}
async function main() {
  assert.equal(process.platform, 'linux', 'This workflow uses an isolated Linux virtual display');
  const pin = JSON.parse(fs.readFileSync(path.join(__dirname, 'chrono-gameplay-source-pin.json')));
  const root = path.resolve(process.env.CHRONO_GAME_ROOT);
  await verifySource(pin, root);
  const pwPath = process.env.NSP_PLAYWRIGHT_PATH;
  patchNativeFocus(pwPath);
  const {chromium} = require(pwPath);
  server = http.createServer((req, res) => {
    try {
      const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, '.' + relative);
      if (!file.startsWith(root + path.sep)) throw Error('Outside source root');
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) {res.writeHead(404); res.end(); return;}
      const mime = {'.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript',
        '.json': 'application/json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg'}[path.extname(file)] || 'application/octet-stream';
      res.writeHead(200, {'Content-Type': mime, 'Cache-Control': 'no-store'});
      fs.createReadStream(file).pipe(res);
    } catch {res.writeHead(400); res.end();}
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + pin.gameRoute;
  browser = await chromium.launch({headless: false, args: [
    '--kiosk', '--window-position=0,0', '--window-size=1324,900', '--disable-dev-shm-usage'
  ]});
  const context = await browser.newContext({viewport: null, deviceScaleFactor: 1});
  const page = await context.newPage();
  page.on('pageerror', e => receipt.errors.push(String(e)));
  page.on('response', response => {
    if (response.url().includes(pin.gameRoute + 'assets/') && !response.ok())
      receipt.errors.push('Asset HTTP ' + response.status() + ': ' + response.url());
  });
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.bringToFront();
  await sleep(750);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  const windowFacts = await page.evaluate(() => ({innerWidth, innerHeight, outerWidth, outerHeight,
    screenX, screenY, focused: document.hasFocus(), visibility: document.visibilityState,
    images: [...document.images].map(image => ({src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight}))}));
  receipt.window = windowFacts;
  assert.deepEqual([windowFacts.screenX, windowFacts.screenY, windowFacts.innerWidth, windowFacts.innerHeight],
    [0, 0, 1324, 900], 'Kiosk geometry differs; do not guess screen-to-canvas alignment');
  assert.equal(windowFacts.focused, true);
  assert.equal(windowFacts.visibility, 'visible');
  const bounds = await page.locator('#gameCanvas').boundingBox();
  assert.ok(bounds && bounds.width > 800 && bounds.height > 400);
  const crop = {x: Math.floor(bounds.x), y: Math.floor(bounds.y),
    width: Math.floor(bounds.width / 2) * 2, height: Math.floor(bounds.height / 2) * 2};
  assert.deepEqual([crop.width, crop.height], [1024, 576], 'Preserve the reviewed native 16:9 canvas geometry; never scale a different layout');
  receipt.captureGeometry = crop;
  await page.screenshot({path: path.join(out, 'before-native-input.png')});
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
    '-t', '27', '-movflags', '+faststart', raw];
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
  await page.locator('#startBtn').click();
  await page.waitForFunction(() => document.body.dataset.mode === 'PLAYING');
  // One native sortie: no game globals, seeded randomness, fake actors, scores or time rewrites.
  await page.mouse.move(bounds.x + bounds.width * .8, bounds.y + bounds.height * .5);
  await page.mouse.down();
  const movement = ['d', 's', 'a', 'w', 'd', 's', 'a', 'w'];
  let elapsedSeconds = 0;
  for (let segment = 0; segment < movement.length; segment++) {
    const observed = await page.evaluate(() => ({mode: document.body.dataset.mode,
      score: document.querySelector('#scoreVal')?.textContent,
      wave: document.querySelector('#waveVal')?.textContent,
      enemies: document.querySelector('#enemyCount')?.textContent,
      portalThreadVisible: !document.querySelector('#chronoThread')?.hidden}));
    receipt.observations.push({elapsedSeconds, ...observed});
    if (observed.mode !== 'PLAYING') {receipt.stoppedForActualGameMode = observed.mode; break;}
    if (segment === 2) await input('press', '2');
    if (segment === 3) await input('press', 'c');
    if (segment === 5) await input('press', '3');
    if (segment === 6) await input('press', 'Space');
    if (segment === 7) await input('press', 'Shift');
    await input('down', movement[segment]);
    const stopAt = performance.now() + 3000;
    while (performance.now() < stopAt) {
      const angle = (performance.now() - started) / 1900;
      await page.mouse.move(bounds.x + bounds.width * (.5 + .42 * Math.cos(angle)),
        bounds.y + bounds.height * (.5 + .42 * Math.sin(angle)));
      await sleep(100);
    }
    await input('up', movement[segment]);
    elapsedSeconds = (performance.now() - started) / 1000;
  }
  await page.mouse.up();
  await page.screenshot({path: path.join(out, 'after-native-input.png')});
  receipt.actualInputDurationSeconds = (performance.now() - started) / 1000;
  const rec = await recorderDone;
  assert.equal(rec.code, 0, 'Actual capture failed; inspect capture.ffmpeg.log');
  recorder = null;
  assert.ok(receipt.actualInputDurationSeconds >= 15, 'Sortie ended before a useful gameplay interval');
  assert.equal(receipt.errors.length, 0, 'Browser errors during capture');
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', raw], {encoding: 'utf8'}));
  write('ffprobe.json', probe);
  const duration = Number(probe.format.duration);
  assert.ok(duration >= 25 && duration <= 29);
  assert.ok(probe.streams.some(s => s.codec_type === 'audio'), 'Actual game sound was not captured');
  await command('ffmpeg', ['-v', 'error', '-i', raw, '-f', 'null', '-'], 'full-decode.log');
  for (const [index, fraction] of [0, .25, .5, .75, 1].entries()) {
    const seconds = Math.max(0, Math.min(duration - .15, duration * fraction));
    await command('ffmpeg', ['-v', 'error', '-y', '-ss', String(seconds), '-i', raw,
      '-frames:v', '1', path.join(out, 'frame-' + index + '.png')], 'frame-' + index + '.log');
  }
  await command('ffmpeg', ['-hide_banner', '-i', raw, '-filter_complex',
    'ebur128=peak=true', '-f', 'null', '-'], 'audio-loudness.log');
  await command('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-filter_complex',
    'showwavespic=s=1200x240:colors=gold', '-frames:v', '1', path.join(out, 'actual-audio-waveform.png')], 'waveform.log');
  receipt.output = {file: 'chrono-gameplay-native.mp4', bytes: fs.statSync(raw).size,
    sha256: hash(fs.readFileSync(raw)), duration};
  receipt.status = 'captured-awaiting-personal-visual-and-auditory-QC';
  // Loudness is measured, not silently normalized or accepted here.
}
(async () => {
  try {await main();}
  catch (e) {receipt.status = 'failed'; receipt.errors.push(e.stack || String(e)); process.exitCode = 1;}
  finally {
    if (recorder && recorder.exitCode === null) recorder.kill('SIGINT');
    await browser?.close().catch(e => receipt.errors.push(String(e)));
    if (server) await new Promise(resolve => server.close(resolve));
    for (const child of ownChildren) if (child.exitCode === null) child.kill('SIGTERM');
    receipt.finishedUtc = new Date().toISOString();
    write('CAPTURE_ACTUAL.json', receipt);
    console.log(JSON.stringify({status: receipt.status, accepted: false, output: receipt.output,
      errorCount: receipt.errors.length}, null, 2));
  }
})();
