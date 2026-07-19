/* ============================================================
   CUBIC COSMOS · dimensions.js — THE GEODE & THE VITRINE
   Two alternate realms replacing nether/end tropes:

   THE GEODE — a thick obsidian-walled cube prison, veined with
   gold and lined with crystal clusters, inhabited ONLY by cute
   friendly geode pups who hop toward you out of pure curiosity.
   A prison where the punishment is comfort.

   THE VITRINE — a glass box hanging in vacuum: nonsense
   shipwrecks loaded with treasure chests, guarded by the
   RAINBOW CRYSTAL DRAGON. Its lasers don't aim at you — they
   shatter the GLASS. Fail to build/maintain platforms (or fly)
   and the void feeds you back to the overworld.

   Travel: stand on a gate pad ~1.2s. Gates sit on the main
   island (GEODE: aurora-cornered pad · VITRINE: glass-cornered
   pad). Return pads inside each realm.
   Saves: only the overworld persists; realm edits are session
   stashes (saveGame is guarded in main.js).
   ============================================================ */
window.CosmosDimensions = (function () {
  'use strict';

  var CC = null;
  var current = 'over';
  var stash = {};            // dim -> {blocks, edits, locations, spawn}
  var padTimer = 0, padTarget = null;
  var pups = [], dragon = null, laserTimer = 7, beams = [];
  var elapsed = 0;

  var GATES = {
    over_geode:   { dim: 'over', to: 'geode',   x: 12, z: 0,  corner: 3 },
    over_vitrine: { dim: 'over', to: 'vitrine', x: 0,  z: 12, corner: 13 },
    geode_back:   { dim: 'geode',   to: 'over', x: 0,  z: 0 },
    vitrine_back: { dim: 'vitrine', to: 'over', x: 0,  z: 0 }
  };

  // ----------------------------------------------------------
  function set(x, y, z, t) { CC.world.set(x, y, z, t); }
  function rnd(n) { return Math.floor(Math.random() * n); }

  function buildGatePad(x, y, z, cornerBlock) {
    set(x, y, z, 12);
    if (cornerBlock) {
      set(x + 1, y, z + 1, cornerBlock); set(x - 1, y, z + 1, cornerBlock);
      set(x + 1, y, z - 1, cornerBlock); set(x - 1, y, z - 1, cornerBlock);
    }
  }

  function buildOverworldGates() {
    var g1 = GATES.over_geode, g2 = GATES.over_vitrine;
    var y1 = CC.findTop(g1.x, g1.z, 12), y2 = CC.findTop(g2.x, g2.z, 12);
    if (y1 > -20) { GATES.over_geode.y = y1 + 1; buildGatePad(g1.x, y1 + 1, g1.z, g1.corner); CC.rebuildAround(g1.x, y1 + 1, g1.z); }
    if (y2 > -20) { GATES.over_vitrine.y = y2 + 1; buildGatePad(g2.x, y2 + 1, g2.z, g2.corner); CC.rebuildAround(g2.x, y2 + 1, g2.z); }
  }

  // ----------------------------------------------------------
  // THE GEODE
  // ----------------------------------------------------------
  function generateGeode() {
    var R = 18, TH = 3, FLOOR = -15;
    for (var x = -R; x <= R; x++)
      for (var y = -R; y <= R; y++)
        for (var z = -R; z <= R; z++) {
          var m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
          if (m > R - TH) {
            // thick obsidian shell, gold-veined
            set(x, y, z, Math.random() < 0.06 ? 2 : 1);
          }
        }
    // floor
    for (var fx = -(R - TH); fx <= R - TH; fx++)
      for (var fz = -(R - TH); fz <= R - TH; fz++)
        set(fx, FLOOR, fz, 9);
    // crystal clusters on floor, walls, ceiling
    var GEMS = [3, 4, 6, 7, 3, 4];
    for (var c = 0; c < 46; c++) {
      var cx = rnd(2 * (R - TH - 1)) - (R - TH - 1);
      var cz = rnd(2 * (R - TH - 1)) - (R - TH - 1);
      var side = rnd(3);
      var cy = side === 0 ? FLOOR + 1 : (side === 1 ? R - TH : FLOOR + 1 + rnd(8));
      var n = 3 + rnd(5), t = GEMS[rnd(GEMS.length)];
      for (var b = 0; b < n; b++)
        set(cx + rnd(3) - 1, cy + (side === 1 ? -rnd(3) : rnd(3)), cz + rnd(3) - 1, t);
    }
    // return pad
    buildGatePad(0, FLOOR + 1, 0, 2);
    GATES.geode_back.y = FLOOR + 1;
    CC.world.spawn = { x: 3.5, y: FLOOR + 2, z: 3.5 };
    spawnPups(FLOOR + 1);
  }

  function makePup() {
    var g = new THREE.Group();
    var hue = Math.random();
    var bodyM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    bodyM.color.setHSL(hue, 0.7, 0.6);
    bodyM.emissive.setHSL(hue, 0.9, 0.25);
    var b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.5), bodyM);
    b.position.y = 0.25; g.add(b);
    var eyeM = new THREE.MeshStandardMaterial({ color: 0x0a0a12, emissive: 0xffffff, emissiveIntensity: 0.35 });
    var e1 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), eyeM);
    e1.position.set(-0.11, 0.34, 0.26); g.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.11; g.add(e2);
    var ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 6), bodyM);
    ear.position.set(-0.13, 0.52, 0); g.add(ear);
    var ear2 = ear.clone(); ear2.position.x = 0.13; g.add(ear2);
    return g;
  }

  function spawnPups(floorY) {
    for (var i = 0; i < 8; i++) {
      var g = makePup();
      g.position.set(rnd(20) - 10 + 0.5, floorY + 1, rnd(20) - 10 + 0.5);
      CC.scene.add(g);
      pups.push({ g: g, hop: Math.random() * 2, tx: g.position.x, tz: g.position.z, y0: floorY + 1 });
    }
  }

  function updatePups(dt) {
    var p = CC.player.pos;
    for (var i = 0; i < pups.length; i++) {
      var u = pups[i];
      u.hop -= dt;
      if (u.hop <= 0) {
        u.hop = 0.9 + Math.random() * 1.6;
        var dx = p.x - u.g.position.x, dz = p.z - u.g.position.z;
        var d = Math.hypot(dx, dz);
        if (d < 10 && d > 1.6) {          // curious: hop toward you
          u.tx = u.g.position.x + (dx / d) * 1.2;
          u.tz = u.g.position.z + (dz / d) * 1.2;
        } else {                           // wander
          u.tx = u.g.position.x + (Math.random() - 0.5) * 2.4;
          u.tz = u.g.position.z + (Math.random() - 0.5) * 2.4;
        }
        u.tx = Math.max(-13, Math.min(13, u.tx));
        u.tz = Math.max(-13, Math.min(13, u.tz));
      }
      var k = Math.min(1, dt * 4);
      u.g.position.x += (u.tx - u.g.position.x) * k;
      u.g.position.z += (u.tz - u.g.position.z) * k;
      u.g.position.y = u.y0 + Math.abs(Math.sin(u.hop * 5)) * 0.35;
      u.g.rotation.y = Math.atan2(p.x - u.g.position.x, p.z - u.g.position.z);
    }
  }

  function clearPups() {
    for (var i = 0; i < pups.length; i++) CC.scene.remove(pups[i].g);
    pups = [];
  }

  // ----------------------------------------------------------
  // THE VITRINE
  // ----------------------------------------------------------
  var VIT = { X: 30, YLO: -12, YHI: 18 };

  function generateVitrine() {
    var X = VIT.X, YLO = VIT.YLO, YHI = VIT.YHI;
    for (var x = -X; x <= X; x++)
      for (var y = YLO; y <= YHI; y++)
        for (var z = -X; z <= X; z++) {
          var shell = (Math.abs(x) === X || Math.abs(z) === X || y === YLO || y === YHI);
          if (shell) set(x, y, z, 13);
        }
    // spawn platform + return pad
    for (var px = -2; px <= 2; px++)
      for (var pz = -2; pz <= 2; pz++)
        set(px, YLO + 1, pz, 9);
    buildGatePad(0, YLO + 2, 0, 2);
    GATES.vitrine_back.y = YLO + 2;
    // scattered maintenance platforms
    for (var s = 0; s < 7; s++) {
      var sx = rnd(2 * X - 12) - (X - 6), sz = rnd(2 * X - 12) - (X - 6);
      var sy = YLO + 3 + rnd(YHI - YLO - 8);
      set(sx, sy, sz, 9); set(sx + 1, sy, sz, 9); set(sx, sy, sz + 1, 9); set(sx + 1, sy, sz + 1, 9);
    }
    // nonsense shipwrecks — tilted keels, ribs, gold spill, chests
    for (var w = 0; w < 3; w++) {
      var wx = rnd(2 * X - 20) - (X - 10), wz = rnd(2 * X - 20) - (X - 10);
      var wy = YLO + 4 + rnd(8);
      for (var k2 = 0; k2 < 9; k2++) {
        var kx = wx + k2, ky = wy + Math.floor(k2 * 0.35);
        set(kx, ky, wz, 5);                                 // tilted keel
        if (k2 % 2 === 0) { set(kx, ky + 1, wz - 1, 1); set(kx, ky + 1, wz + 1, 1); }  // ribs
        if (Math.random() < 0.3) set(kx, ky + 1, wz, 2);    // gold spill
      }
      set(wx + 2, wy + 1, wz, 14);                          // treasure
      set(wx + 6, wy + 3, wz, 14);
      if (Math.random() < 0.7) set(wx + 4, wy + 2, wz + 1, 14);
    }
    CC.world.spawn = { x: 0.5, y: YLO + 3, z: 0.5 };
    spawnDragon();
  }

  function spawnDragon() {
    var segs = [];
    var group = new THREE.Group();
    for (var i = 0; i < 14; i++) {
      var m = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.3, metalness: 0.4 });
      var s = i === 0 ? 1.1 : (1.0 - i * 0.05);
      var mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.8, s), m);
      group.add(mesh);
      segs.push({ mesh: mesh, m: m });
    }
    // eyes on the head
    var eyeM = new THREE.MeshStandardMaterial({ color: 0x090909, emissive: 0xff2244, emissiveIntensity: 2 });
    var e1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), eyeM);
    e1.position.set(-0.25, 0.15, 0.5); segs[0].mesh.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.25; segs[0].mesh.add(e2);
    CC.scene.add(group);
    dragon = { group: group, segs: segs, t: Math.random() * 100 };
  }

  function dragonPos(t) {
    // Lissajous wander inside the box, clear of walls
    var X = VIT.X - 6;
    return {
      x: Math.sin(t * 0.31) * X * 0.8,
      y: (VIT.YLO + VIT.YHI) / 2 + Math.sin(t * 0.47) * (VIT.YHI - VIT.YLO) * 0.30,
      z: Math.sin(t * 0.23 + 1.7) * X * 0.8
    };
  }

  function updateDragon(dt) {
    if (!dragon) return;
    dragon.t += dt;
    for (var i = 0; i < dragon.segs.length; i++) {
      var p = dragonPos(dragon.t - i * 0.32);
      var s = dragon.segs[i];
      s.mesh.position.set(p.x, p.y, p.z);
      var hue = ((elapsed * 0.15) + i / dragon.segs.length) % 1;
      s.m.emissive.setHSL(hue, 1, 0.45);
      s.m.color.setHSL(hue, 0.8, 0.25);
      if (i === 0) {
        var ahead = dragonPos(dragon.t + 0.4);
        s.mesh.lookAt(ahead.x, ahead.y, ahead.z);
      }
    }
    // laser: shatter the glass, not the player
    laserTimer -= dt;
    if (laserTimer <= 0) {
      laserTimer = 6 + Math.random() * 5;
      fireDragonLaser();
    }
    for (var b = beams.length - 1; b >= 0; b--) {
      beams[b].life -= dt;
      beams[b].mesh.material.opacity = Math.max(0, beams[b].life / 0.45);
      if (beams[b].life <= 0) { CC.scene.remove(beams[b].mesh); beams.splice(b, 1); }
    }
  }

  function fireDragonLaser() {
    var head = dragon.segs[0].mesh.position;
    // pick a random point on a random wall
    var X = VIT.X, YLO = VIT.YLO, YHI = VIT.YHI;
    var wall = rnd(6), tx, ty, tz;
    if (wall === 0) { tx = X; ty = YLO + 2 + rnd(YHI - YLO - 3); tz = rnd(2 * X - 4) - (X - 2); }
    else if (wall === 1) { tx = -X; ty = YLO + 2 + rnd(YHI - YLO - 3); tz = rnd(2 * X - 4) - (X - 2); }
    else if (wall === 2) { tz = X; ty = YLO + 2 + rnd(YHI - YLO - 3); tx = rnd(2 * X - 4) - (X - 2); }
    else if (wall === 3) { tz = -X; ty = YLO + 2 + rnd(YHI - YLO - 3); tx = rnd(2 * X - 4) - (X - 2); }
    else if (wall === 4) { ty = YHI; tx = rnd(2 * X - 4) - (X - 2); tz = rnd(2 * X - 4) - (X - 2); }
    else { ty = YLO; tx = rnd(2 * X - 4) - (X - 2); tz = rnd(2 * X - 4) - (X - 2); }

    // beam visual
    var from = new THREE.Vector3(head.x, head.y, head.z);
    var to = new THREE.Vector3(tx, ty, tz);
    var len = from.distanceTo(to);
    var hue = (elapsed * 0.15) % 1;
    var mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 1 });
    mat.color.setHSL(hue, 1, 0.6);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 6), mat);
    beam.position.copy(from).lerp(to, 0.5);
    beam.lookAt(to);
    beam.rotateX(Math.PI / 2);
    CC.scene.add(beam);
    beams.push({ mesh: beam, life: 0.45 });

    // shatter a 3x3 glass panel around the hit
    var broke = 0;
    for (var a = -1; a <= 1; a++)
      for (var b = -1; b <= 1; b++) {
        var hx = tx, hy = ty, hz = tz;
        if (wall <= 1) { hy = ty + a; hz = tz + b; }
        else if (wall <= 3) { hy = ty + a; hx = tx + b; }
        else { hx = tx + a; hz = tz + b; }
        if (CC.world.get(hx, hy, hz) === 13) { CC.world.set(hx, hy, hz, 0); broke++; }
      }
    if (broke) {
      CC.rebuildAround(tx, ty, tz);
      CC.toast('the dragon’s lament cracks the vitrine — ' + broke + ' panes gone');
    }
  }

  function clearDragon() {
    if (dragon) { CC.scene.remove(dragon.group); dragon = null; }
    for (var b = 0; b < beams.length; b++) CC.scene.remove(beams[b].mesh);
    beams = [];
  }

  // ----------------------------------------------------------
  // dimension switching
  // ----------------------------------------------------------
  function switchTo(dim) {
    // stash current realm
    stash[current] = {
      blocks: CC.world.blocks, edits: CC.world.edits,
      locations: CC.world.locations, spawn: CC.world.spawn
    };
    clearPups(); clearDragon();
    current = dim;
    if (stash[dim]) {
      CC.world.blocks = stash[dim].blocks;
      CC.world.edits = stash[dim].edits;
      CC.world.locations = stash[dim].locations;
      CC.world.spawn = stash[dim].spawn;
      if (dim === 'geode') spawnPups(-14);
      if (dim === 'vitrine') spawnDragon();
    } else {
      CC.world.blocks = new Map();
      CC.world.edits = {};
      CC.world.locations = [];
      if (dim === 'geode') generateGeode();
      else if (dim === 'vitrine') generateVitrine();
    }
    CC.buildAllChunks();
    CC.respawn();
    if (window.CosmosNPCs) window.CosmosNPCs.rebuild();
    if (window.CosmosSaucer && window.CosmosSaucer.setVisible)
      window.CosmosSaucer.setVisible(dim === 'over');
    CC.toast(dim === 'geode' ? 'THE GEODE — a prison of comfort. the pups are pleased.'
      : dim === 'vitrine' ? 'THE VITRINE — glass, vacuum, treasure. mind the dragon’s aim.'
      : 'the overworld resumes. the aurora missed you.');
  }

  function checkPads(dt) {
    var p = CC.player.pos;
    var found = null;
    var keys = Object.keys(GATES);
    for (var i = 0; i < keys.length; i++) {
      var g = GATES[keys[i]];
      if (g.dim !== current || g.y === undefined) continue;
      if (Math.abs(p.x - (g.x + 0.5)) < 1.2 && Math.abs(p.z - (g.z + 0.5)) < 1.2 &&
          Math.abs(p.y - g.y - 1) < 2.2) { found = g; break; }
    }
    if (found) {
      padTimer += dt;
      if (padTarget !== found) { padTarget = found; padTimer = dt; }
      if (padTimer > 1.2) { padTimer = 0; padTarget = null; switchTo(found.to); }
    } else { padTimer = 0; padTarget = null; }
  }

  function update(dt, playing) {
    elapsed += dt;
    if (!CC) return;
    if (playing) checkPads(dt);
    if (current === 'geode') updatePups(dt);
    if (current === 'vitrine') {
      updateDragon(dt);
      if (CC.player.pos.y < VIT.YLO - 22) {
        CC.toast('the vacuum feeds the dragon. you are elsewhere now.');
        switchTo('over');
      }
    }
  }

  function init(cc) {
    CC = cc;
    buildOverworldGates();
  }

  return {
    init: init, update: update, switchTo: switchTo,
    get current() { return current; }
  };
})();
