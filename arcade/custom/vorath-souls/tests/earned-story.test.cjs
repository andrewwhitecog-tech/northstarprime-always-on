'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const progress = require('../journey.js');
const story = require('../earned-story.js');
const source = fs.readFileSync(path.join(__dirname, '../earned-story.js'), 'utf8');
const firstGate = () => { const journey = new progress.Journey(); assert.equal(journey.completeArena(), true); return journey; };

test('fresh journey has no story destination', () => {
  assert.equal(story.signal(new progress.Journey()), null);
  assert.equal(story.signal(null), null);
  assert.equal(story.signal(undefined), null);
});
test('earning the maximum unbanked charge does not reveal the trail', () => {
  const journey = new progress.Journey();
  for (let i = 0; i < 6; i++) journey.earn(20);
  assert.equal(journey.charges, 99);
  assert.equal(story.signal(journey), null);
});
test('actual first passage completion reveals the single optional public destination', () => {
  const journey = firstGate();
  assert.equal(journey.phase, 'checkpoint');
  assert.equal(journey.bank.cleared, 1);
  assert.deepEqual(story.signal(journey), {
    href: 'https://northstarprime.net/404.html', label: 'Signal Lost',
    disclosure: 'Optional VORATH fiction · free to explore · no purchase needed.'
  });
});
test('existing checkpoint serialization restores the trail without separate persistence', () => {
  const journey = firstGate();
  const restored = new progress.Journey(progress.read(journey.serialize()));
  assert.deepEqual(story.signal(restored), story.signal(journey));
  assert.equal(restored.bank.cleared, 1);
});
test('spending upgrades does not revoke earned progress', () => {
  const journey = new progress.Journey();
  journey.earn(5); journey.completeArena();
  assert.equal(journey.spend('blade'), true);
  const restored = new progress.Journey(progress.read(journey.serialize()));
  assert.equal(restored.upgrades.blade, 1);
  assert.ok(story.signal(restored));
});
test('entering and retrying the next arena retain the banked trail', () => {
  const journey = firstGate(); journey.enter(); journey.earn(2); journey.retry();
  assert.equal(journey.phase, 'combat');
  assert.equal(journey.charges, 0);
  assert.ok(story.signal(journey));
});
test('all three actual journey completions retain access through the existing bank', () => {
  const journey = firstGate(); journey.enter(); journey.completeArena();
  assert.equal(journey.bank.cleared, 2);
  journey.enter(); journey.completeArena();
  assert.equal(journey.completed, true);
  assert.equal(journey.cleared, 3);
  assert.equal(journey.bank.cleared, 2);
  assert.ok(story.signal(journey));
});
test('a new journey resets access while an earlier completed object remains independent', () => {
  const prior = firstGate(); const fresh = new progress.Journey();
  assert.ok(story.signal(prior)); assert.equal(story.signal(fresh), null);
});
test('raw arena counters and unlock-like fields cannot replace a validated bank', () => {
  assert.equal(story.signal({arena: 2, cleared: 3, completed: true, unlocked: true}), null);
  assert.equal(story.signal({bank: new progress.Journey().bank, arena: 2, cleared: 3, completed: true}), null);
});
test('malformed, unsupported or out-of-range bank data fails closed', () => {
  const bank = firstGate().bank;
  for (const invalid of [null, [], {...bank, version: 2}, {...bank, cleared: 0}, {...bank, arena: 3, cleared: 3},
    {...bank, charges: -1}, {...bank, upgrades: {...bank.upgrades, blade: 4}}]) {
    assert.equal(story.signal({bank: invalid}), null);
  }
});
test('reading the descriptor mutates neither the bank nor live journey fields', () => {
  const journey = firstGate(); const before = JSON.stringify(journey);
  const descriptor = story.signal(journey);
  assert.equal(JSON.stringify(journey), before);
  assert.equal(Object.isFrozen(descriptor), true);
  assert.throws(() => { descriptor.href = 'https://example.invalid/'; }, TypeError);
  assert.equal(story.signal(journey).href, 'https://northstarprime.net/404.html');
});
test('browser export reads genuine Journey state without touching DOM, storage or navigation', () => {
  const sandbox = {VorathJourney: progress};
  for (const name of ['document', 'localStorage', 'location', 'fetch'])
    Object.defineProperty(sandbox, name, {get() { throw Error('Unexpected side effect: ' + name); }});
  vm.runInNewContext(source, sandbox);
  assert.equal(sandbox.VorathEarnedStory.signal(firstGate()).href, 'https://northstarprime.net/404.html');
  assert.equal(sandbox.VorathEarnedStory.signal(new progress.Journey()), null);
});
test('missing or unsupported browser dependency keeps the optional trail unavailable', () => {
  for (const dependency of [undefined, {}, {VERSION: 2, validate: progress.validate}]) {
    const sandbox = {VorathJourney: dependency}; vm.runInNewContext(source, sandbox);
    assert.equal(sandbox.VorathEarnedStory.signal(firstGate()), null);
  }
});
