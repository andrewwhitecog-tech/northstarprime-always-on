/* Shared by the real encounter and its deterministic contract tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VorathCombat = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class ActionBuffer {
    constructor(windowSeconds = 0.18) { this.window = windowSeconds; this.actions = new Map(); }
    queue(action, payload, time) { this.actions.set(action, { payload, expires: time + this.window }); }
    consume(action, ready, time) {
      const item = this.actions.get(action);
      if (!item) return null;
      if (item.expires < time) { this.actions.delete(action); return null; }
      if (!ready) return null;
      this.actions.delete(action); return item;
    }
    clear() { this.actions.clear(); }
  }
  function canFinish(enemy) { return !!enemy && !enemy.dead && enemy.staggerT > 0; }
  function beginStagger(enemy, force = false) {
    if (enemy.dead || enemy.staggerT > 0 || (!force && enemy.stun < enemy.maxStun)) return false;
    enemy.staggerMax = enemy.type === 'guard' ? 2.4 : 1.6;
    enemy.staggerT = enemy.staggerMax;
    enemy.stun = enemy.maxStun;
    enemy.state = 'stunned';
    enemy.stateT = 0;
    return true;
  }
  function advanceStagger(enemy, dt) {
    if (!(enemy.staggerT > 0)) return false;
    enemy.staggerT = Math.max(0, enemy.staggerT - Math.max(0, dt));
    if (enemy.staggerT > 0) { enemy.stun = enemy.maxStun; enemy.state = 'stunned'; }
    else { enemy.stun = enemy.maxStun * 0.35; enemy.state = 'recover'; enemy.stateT = 0.55; }
    return true;
  }
  return { ActionBuffer, canFinish, beginStagger, advanceStagger };
});
