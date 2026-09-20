'use strict';
// Behavioral tests execute the actual candidate player against a minimal media/DOM adapter.
// This is not browser decode, audible-listening, or touch-device proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'idr/index.html'), 'utf8');
const source = html.match(/<script id="nsp-idr-single-player">([\s\S]*?)<\/script>/)[1];
const results = [];
class Element {
  constructor() { this.handlers = {}; this.dataset = {}; this.attrs = {}; this.classList = { toggle() {} }; this.hidden = false; this.disabled = false; this.textContent = ''; }
  addEventListener(name, fn) { (this.handlers[name] ||= []).push(fn); }
  emit(name) { (this.handlers[name] || []).forEach(fn => fn()); }
  setAttribute(key, value) { this.attrs[key] = value; }
  closest() { return this; }
  click() { if (!this.disabled) this.emit('click'); }
}
function harness(withExtras = false) {
  const ids = {};
  ['idr-station-audio', 'idr-station-title', 'idr-station-status', 'idr-station-retry', 'idr-station-previous', 'idr-station-next', 'idr-onair-btn', 'idr-genre', 'idr-catalog-count'].forEach(id => ids[id] = new Element());
  ids['idr-genre'].value = '';
  const a = ids['idr-station-audio'];
  a.paused = true; a.ended = false; a.plays = 0; a.loads = 0; a.rejections = [];
  a.play = () => { a.paused = false; a.ended = false; a.plays++; a.emit('play'); return { catch(fn) { a.rejections.push(fn); } }; };
  a.pause = () => { const changed = !a.paused; a.paused = true; if (changed) a.emit('pause'); };
  a.load = () => { a.loads++; a.ended = false; };
  const cards = ['Alpha', 'Beta', 'Gamma'].map((name, i) => Object.assign(new Element(), { dataset: { title: name, audioSrc: `https://example.invalid/${i}.mp3`, kind: 'song', genre: i < 2 ? 'Hip-Hop' : 'Ambient' } }));
  if (withExtras) ['Bed', 'Ident'].forEach((name, i) => cards.push(Object.assign(new Element(), { dataset: {title: name, audioSrc: `https://example.invalid/extra${i}.wav`, kind: i ? 'ident' : 'bed', genre: 'Hip-Hop'} })));
  const sections = ['Hip-Hop', 'Ambient'].map(name => Object.assign(new Element(), {dataset: {songGenre: name}}));
  const timers = new Map(); let sequence = 0;
  vm.runInNewContext(source, { document: { getElementById: id => ids[id], querySelectorAll: selector => selector === '.idr-track-play' ? cards : sections }, setTimeout: fn => { timers.set(++sequence, fn); return sequence; }, clearTimeout: id => timers.delete(id), Math });
  return { ids, a, cards, sections, timers, status: () => ids['idr-station-status'].textContent, click: id => ids[id].click(), end() { a.paused = true; a.ended = true; a.emit('ended'); } };
}
function test(name, fn) { fn(); results.push({name, passed: true}); }
test('No autoplay; first click loads chosen source and status follows actual playing event', () => {
  const h = harness(); assert.equal(h.a.plays, 0); h.cards[1].click();
  assert.equal(h.a.src, h.cards[1].dataset.audioSrc); assert.equal(h.status(), 'Loading track…');
  assert.equal(h.cards[1].attrs['aria-pressed'], 'false'); h.a.emit('playing');
  assert.equal(h.status(), 'Playing'); assert.equal(h.cards[1].attrs['aria-pressed'], 'true');
});
test('Card selection replaces one source and only current card claims playback', () => {
  const h = harness(); h.cards[0].click(); h.a.emit('playing'); h.cards[1].click(); h.a.emit('playing');
  assert.equal(h.a.src, h.cards[1].dataset.audioSrc);
  assert.deepEqual(h.cards.map(c => c.attrs['aria-pressed']), ['false', 'true', 'false']);
});
test('Short track ends advance; playlist end stops without repeating final track', () => {
  const h = harness(); h.cards[0].click(); h.end(); assert.equal(h.a.src, h.cards[1].dataset.audioSrc);
  h.end(); assert.equal(h.a.src, h.cards[2].dataset.audioSrc); const n = h.a.plays; h.end();
  assert.equal(h.a.plays, n); assert.match(h.status(), /Playlist finished/);
});
test('Previous and next follow current queue; shuffle visits every track once', () => {
  const h = harness(); h.click('idr-onair-btn'); const seen = [h.a.src]; h.end(); seen.push(h.a.src); h.end(); seen.push(h.a.src);
  assert.equal(new Set(seen).size, 3); h.click('idr-station-previous'); assert.equal(h.a.src, seen[1]);
  h.click('idr-station-next'); assert.equal(h.a.src, seen[2]);
});
test('Pause uses media truth and resume retains source without reloading', () => {
  const h = harness(); h.cards[0].click(); h.a.emit('playing'); h.a.pause(); assert.equal(h.status(), 'Paused');
  const loads = h.a.loads; h.cards[0].click(); h.a.emit('playing'); assert.equal(h.a.loads, loads); assert.equal(h.status(), 'Playing');
});
test('Load error shows Retry and retry reloads same track', () => {
  const h = harness(); h.cards[0].click(); h.a.emit('error'); assert.equal(h.ids['idr-station-retry'].hidden, false);
  assert.equal(h.a.paused, true); const src = h.a.src; const loads = h.a.loads;
  h.click('idr-station-retry'); assert.equal(h.a.loads, loads + 1); assert.equal(h.a.src, src); h.a.emit('playing');
  assert.equal(h.status(), 'Playing'); assert.equal(h.ids['idr-station-retry'].hidden, true);
});
test('Blocked playback is visible; rejection from superseded selection cannot overwrite new state', () => {
  const h = harness(); h.cards[0].click(); const first = h.a.rejections[0]; h.cards[1].click(); h.a.emit('playing');
  first({ name: 'NotAllowedError' }); assert.equal(h.status(), 'Playing');
  h.a.rejections.at(-1)({ name: 'NotAllowedError' }); assert.match(h.status(), /Playback was blocked/);
});
test('Loading and stalled network have bounded failure states', () => {
  const h = harness(); h.cards[0].click(); [...h.timers.values()][0](); assert.match(h.status(), /Loading took too long/);
  h.click('idr-station-retry'); h.a.emit('playing'); h.a.emit('waiting'); assert.equal(h.status(), 'Buffering…');
  [...h.timers.values()][0](); assert.match(h.status(), /connection stalled/);
});
test('Native pause cancels pending play rejection; stale pause event cannot mask new playback', () => {
  const h = harness(); h.cards[0].click(); const reject = h.a.rejections.at(-1); h.a.pause();
  reject({ name: 'NotAllowedError' }); assert.equal(h.status(), 'Paused');
  h.cards[1].click(); h.a.emit('playing'); h.a.emit('pause'); assert.equal(h.status(), 'Playing');
});
test('Delayed old pause during new load preserves loading watchdog; cancelled playing remains paused', () => {
  const h = harness(); h.cards[0].click(); h.a.emit('playing'); h.cards[1].click();
  h.a.emit('pause'); assert.equal(h.status(), 'Loading track…'); assert.equal(h.timers.size, 1);
  h.a.pause(); h.a.emit('playing'); assert.equal(h.status(), 'Paused'); assert.equal(h.timers.size, 0);
});
test('Native play after error re-enters bounded loading; synchronous play failure shows retry', () => {
  const h = harness(); h.cards[0].click(); h.a.emit('error');
  h.a.paused = false; h.a.emit('play'); assert.equal(h.status(), 'Loading track…'); assert.equal(h.timers.size, 1);
  h.a.pause(); h.a.play = () => { throw new Error('unsupported'); }; h.cards[1].click();
  assert.match(h.status(), /could not play/); assert.equal(h.ids['idr-station-retry'].hidden, false);
});
test('Shuffle excludes station sounds and keeps all song titles in its queue', () => {
  const h = harness(true); h.click('idr-onair-btn'); const seen = [h.a.src]; h.end(); seen.push(h.a.src); h.end(); seen.push(h.a.src); h.end();
  assert.equal(new Set(seen).size, 3); assert.ok(seen.every(url => !url.includes('extra'))); assert.match(h.status(), /Playlist finished/);
});
test('Station sounds form their own queue, without song interruption', () => {
  const h = harness(true); h.cards[3].click(); assert.equal(h.a.src, h.cards[3].dataset.audioSrc); h.end();
  assert.equal(h.a.src, h.cards[4].dataset.audioSrc); h.end(); assert.match(h.status(), /Playlist finished/);
});
test('Genre changes filter discovery without interrupting current queue; next shuffle respects selection', () => {
  const h = harness(true); h.cards[0].click(); const before = h.a.src;
  h.ids['idr-genre'].value = 'Ambient'; h.ids['idr-genre'].emit('change');
  assert.equal(h.a.src, before); assert.deepEqual(h.sections.map(s => s.hidden), [true, false]);
  assert.match(h.ids['idr-catalog-count'].textContent, /^1 songs/);
  h.end(); assert.equal(h.a.src, h.cards[1].dataset.audioSrc);
  h.click('idr-onair-btn'); assert.equal(h.a.src, h.cards[2].dataset.audioSrc); h.end(); assert.match(h.status(), /Playlist finished/);
});
test('Clicking a filtered song follows the filtered queue', () => {
  const h = harness(); h.ids['idr-genre'].value = 'Hip-Hop'; h.ids['idr-genre'].emit('change');
  h.cards[0].click(); h.end(); assert.equal(h.a.src, h.cards[1].dataset.audioSrc); h.end(); assert.match(h.status(), /Playlist finished/);
});
test('Loading button announces cancellation; cancelling stops watchdog and playback', () => {
  const h = harness(); h.cards[0].click(); assert.equal(h.cards[0].textContent, 'Cancel loading'); h.cards[0].click();
  assert.equal(h.a.paused, true); assert.equal(h.timers.size, 0); assert.equal(h.cards[0].textContent, 'Resume track');
});
test('Stale ended event after selecting another source cannot skip new selection', () => {
  const h = harness(); h.cards[0].click(); h.cards[1].click(); h.a.emit('ended');
  assert.equal(h.a.src, h.cards[1].dataset.audioSrc); assert.equal(h.status(), 'Loading track…');
});
test('Release HTML has one audio owner and every pinned public media URL', () => {
  const crypto = require('node:crypto');
  assert.equal((html.match(/<audio\b/g) || []).length, 1);
  assert.equal((html.match(/class="idr-track-play"/g) || []).length, 50);
  const urls = [...html.matchAll(/data-audio-src="([^"]+)"/g)].map(m => m[1]).sort();
  assert.equal(new Set(urls).size, 50);
  assert.equal(crypto.createHash('sha256').update(urls.join('\n')).digest('hex'), '9238878886510303788f0c941e4ad982ef516e96e7e643ef685a95f2bf79b868');
  assert.ok(!html.includes('slotSeconds')); assert.ok(!html.includes('idrOnAir()'));
});
console.log(JSON.stringify({passed: results.length, failed: 0, coverage: 'Actual embedded player with simulated DOM/media. Not browser decode, listening, layout, or touch proof.', results}, null, 2));
