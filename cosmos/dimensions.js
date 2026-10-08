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
    over_geode:   { dim: 'over', to: 'geode',   x: 12, z: 0,   corner: 3 },
    over_vitrine: { dim: 'over', to: 'vitrine', x: 0,  z: 12,  corner: 13 },
    over_crucible:{ dim: 'over', to: 'crucible',x: -12,z: 0,   corner: 16 },
    over_abyss:   { dim: 'over', to: 'abyss',   x: 0,  z: -12, corner: 18 },
    over_singularity:{ dim: 'over', to: 'singularity', x: 12, z: 12, corner: 21 },
    over_frost:   { dim: 'over', to: 'frost',   x: -12,z: -12, corner: 24 },
    over_solaris: { dim: 'over', to: 'solaris', x: -12,z: 12,  corner: 27 },
    geode_back:   { dim: 'geode',   to: 'over', x: 0,  z: 0 },
    vitrine_back: { dim: 'vitrine', to: 'over', x: 0,  z: 0 },
    crucible_back:{ dim: 'crucible',to: 'over', x: 4,  z: 0 },
    abyss_back:   { dim: 'abyss',   to: 'over', x: 0,  z: -4 },
    singularity_back:{ dim: 'singularity', to: 'over', x: 0, z: -6 },
    frost_back:   { dim: 'frost',   to: 'over', x: 0,  z: -6 },
    solaris_back: { dim: 'solaris', to: 'over', x: 0,  z: -6 }
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
    var g1 = GATES.over_geode, g2 = GATES.over_vitrine, g3 = GATES.over_crucible, g4 = GATES.over_abyss, g5 = GATES.over_singularity, g6 = GATES.over_frost, g7 = GATES.over_solaris;
    var y1 = CC.findTop(g1.x, g1.z, 12), y2 = CC.findTop(g2.x, g2.z, 12), y3 = CC.findTop(g3.x, g3.z, 12), y4 = CC.findTop(g4.x, g4.z, 12), y5 = CC.findTop(g5.x, g5.z, 12), y6 = CC.findTop(g6.x, g6.z, 12), y7 = CC.findTop(g7.x, g7.z, 12);
    if (y1 > -20) { GATES.over_geode.y = y1 + 1; buildGatePad(g1.x, y1 + 1, g1.z, g1.corner); CC.rebuildAround(g1.x, y1 + 1, g1.z); }
    if (y2 > -20) { GATES.over_vitrine.y = y2 + 1; buildGatePad(g2.x, y2 + 1, g2.z, g2.corner); CC.rebuildAround(g2.x, y2 + 1, g2.z); }
    if (y3 > -20) { GATES.over_crucible.y = y3 + 1; buildGatePad(g3.x, y3 + 1, g3.z, g3.corner); CC.rebuildAround(g3.x, y3 + 1, g3.z); }
    if (y4 > -20) { GATES.over_abyss.y = y4 + 1; buildGatePad(g4.x, y4 + 1, g4.z, g4.corner); CC.rebuildAround(g4.x, y4 + 1, g4.z); }
    if (y5 > -20) { GATES.over_singularity.y = y5 + 1; buildGatePad(g5.x, y5 + 1, g5.z, g5.corner); CC.rebuildAround(g5.x, y5 + 1, g5.z); }
    if (y6 > -20) { GATES.over_frost.y = y6 + 1; buildGatePad(g6.x, y6 + 1, g6.z, g6.corner); CC.rebuildAround(g6.x, y6 + 1, g6.z); }
    if (y7 > -20) { GATES.over_solaris.y = y7 + 1; buildGatePad(g7.x, y7 + 1, g7.z, g7.corner); CC.rebuildAround(g7.x, y7 + 1, g7.z); }
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
  // THE CRUCIBLE (MANTLE CORE & OBSIDIAN FORGE)
  // ----------------------------------------------------------
  var CRU = { R: 26, FLOOR: -18, CEIL: 16 };
  var golem = null, shockwaves = [], forgeTimer = 0, stompTimer = 8;
  var steamVents = [
    { x: -10, z: -10 }, { x: 10, z: -10 },
    { x: -10, z: 10 },  { x: 10, z: 10 }
  ];

  function generateCrucible() {
    var R = CRU.R, FLOOR = CRU.FLOOR, CEIL = CRU.CEIL;
    for (var x = -R; x <= R; x++) {
      for (var z = -R; z <= R; z++) {
        var d2 = x * x + z * z;
        if (d2 <= R * R) {
          set(x, FLOOR, z, (x * z) % 3 === 0 ? 1 : 15);
          var dist = Math.sqrt(d2);
          if (Math.abs(x) <= 1 || Math.abs(z) <= 1 || (dist > 14 && dist < 17)) {
            set(x, FLOOR, z, 16);
          }
          var domeH = Math.floor(CEIL - (d2 / (R * R)) * 12);
          set(x, domeH, z, 1);
        }
      }
    }
    var pillars = [
      { x: -16, z: -8 }, { x: -16, z: 8 },
      { x: 16, z: -8 },  { x: 16, z: 8 },
      { x: -8, z: -16 }, { x: 8, z: -16 },
      { x: -8, z: 16 },  { x: 8, z: 16 }
    ];
    for (var p = 0; p < pillars.length; p++) {
      var px = pillars[p].x, pz = pillars[p].z;
      for (var y = FLOOR + 1; y <= CEIL - 4; y++) {
        set(px, y, pz, 15);
        set(px + 1, y, pz, 15);
        set(px, y, pz + 1, 15);
        if (y % 4 === 0) set(px + 1, y, pz + 1, 2);
      }
    }
    for (var v = 0; v < steamVents.length; v++) {
      var vx = steamVents[v].x, vz = steamVents[v].z;
      set(vx, FLOOR + 1, vz, 10);
      set(vx, FLOOR, vz, 16);
    }
    for (var fx = -2; fx <= 2; fx++) {
      for (var fz = -2; fz <= 2; fz++) {
        set(fx, FLOOR + 1, fz, 17);
      }
    }
    set(0, FLOOR + 2, 0, 7);
    buildGatePad(4, FLOOR + 2, 0, 16);
    GATES.crucible_back.x = 4;
    GATES.crucible_back.y = FLOOR + 2;
    GATES.crucible_back.z = 0;

    CC.world.spawn = { x: 4.5, y: FLOOR + 3, z: 2.5 };
    spawnGolem();
  }

  function spawnGolem() {
    var group = new THREE.Group();
    var basaltMat = new THREE.MeshStandardMaterial({ color: 0x1c1414, roughness: 0.85, metalness: 0.2 });
    var magmaMat = new THREE.MeshStandardMaterial({ color: 0xff3e00, emissive: 0xff4500, emissiveIntensity: 2.2 });
    var eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0022, emissive: 0xff0033, emissiveIntensity: 3.0 });

    var torso = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.2, 1.4), basaltMat);
    torso.position.y = 2.4;
    group.add(torso);

    var core = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 1.45), magmaMat);
    core.position.y = 2.4;
    group.add(core);

    var head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.1), basaltMat);
    head.position.set(0, 3.8, 0.1);
    var e1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.1), eyeMat);
    e1.position.set(-0.3, 0.1, 0.56);
    head.add(e1);
    var e2 = e1.clone();
    e2.position.x = 0.3;
    head.add(e2);
    group.add(head);

    var leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), basaltMat);
    leftArm.position.set(-1.6, 2.2, 0);
    group.add(leftArm);
    var rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2.4, 0.7), basaltMat);
    rightArm.position.set(1.6, 2.2, 0);
    group.add(rightArm);

    var leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), basaltMat);
    leftLeg.position.set(-0.6, 0.8, 0);
    group.add(leftLeg);
    var rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), basaltMat);
    rightLeg.position.set(0.6, 0.8, 0);
    group.add(rightLeg);

    group.position.set(0, CRU.FLOOR + 1, -8);
    CC.scene.add(group);

    golem = {
      group: group,
      torso: torso,
      core: core,
      head: head,
      leftArm: leftArm,
      rightArm: rightArm,
      leftLeg: leftLeg,
      rightLeg: rightLeg,
      t: 0,
      blessed: false
    };
  }

  function updateGolem(dt) {
    if (!golem) return;
    golem.t += dt;
    var pulse = 0.5 + 0.5 * Math.sin(golem.t * 3.5);
    golem.core.material.emissiveIntensity = 1.8 + pulse * 1.5;

    var p = CC.player.pos;
    var dx = p.x - golem.group.position.x;
    var dz = p.z - golem.group.position.z;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 1.5) {
      var angle = Math.atan2(dx, dz);
      golem.group.rotation.y = angle;
    }

    golem.leftArm.rotation.x = Math.sin(golem.t * 2.0) * 0.35;
    golem.rightArm.rotation.x = -Math.sin(golem.t * 2.0) * 0.35;

    stompTimer -= dt;
    if (stompTimer <= 0) {
      stompTimer = 9 + Math.random() * 6;
      fireGolemStomp();
    }

    for (var s = shockwaves.length - 1; s >= 0; s--) {
      var sw = shockwaves[s];
      sw.radius += dt * 9.0;
      sw.life -= dt;
      sw.mesh.scale.set(sw.radius, 1, sw.radius);
      sw.mesh.material.opacity = Math.max(0, sw.life / 1.5);
      if (sw.life <= 0) {
        CC.scene.remove(sw.mesh);
        shockwaves.splice(s, 1);
      }
    }

    if (dist < 3.2 && !golem.blessed) {
      golem.blessed = true;
      CC.toast('VULCANOR awakens — "The mantle burns true." Received +10 Creation Gems.');
      if (CC.player && CC.player.addGems) CC.player.addGems(10);
      else if (CC.addGems) CC.addGems(10);
    }
  }

  function fireGolemStomp() {
    var pos = golem.group.position;
    var geo = new THREE.RingGeometry(0.8, 1.4, 32);
    var mat = new THREE.MeshBasicMaterial({ color: 0xff4500, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    var ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(pos.x, CRU.FLOOR + 1.05, pos.z);
    CC.scene.add(ring);
    shockwaves.push({ mesh: ring, radius: 1.0, life: 1.5 });
    CC.toast('Vulcanor strikes the anvil — shockwave surges through the mantle!');
  }

  function clearGolem() {
    if (golem) {
      CC.scene.remove(golem.group);
      golem = null;
    }
    for (var i = 0; i < shockwaves.length; i++) {
      CC.scene.remove(shockwaves[i].mesh);
    }
    shockwaves = [];
  }

  function checkCrucibleMechanics(dt) {
    var p = CC.player.pos;
    for (var v = 0; v < steamVents.length; v++) {
      var vx = steamVents[v].x, vz = steamVents[v].z;
      if (Math.abs(p.x - vx) < 1.4 && Math.abs(p.z - vz) < 1.4 && p.y < CRU.FLOOR + 5) {
        if (CC.player.vel) CC.player.vel.y = 14.5;
        CC.toast('Geothermal Steam Vent launches you skyward!');
        break;
      }
    }
    if (Math.abs(p.x) < 2.5 && Math.abs(p.z) < 2.5 && Math.abs(p.y - (CRU.FLOOR + 2)) < 2.5) {
      forgeTimer += dt;
      if (forgeTimer > 2.5) {
        forgeTimer = 0;
        CC.toast('Solar Forge transmutes raw matter — +5 Forged Gems harnessed!');
        if (CC.player && CC.player.addGems) CC.player.addGems(5);
        else if (CC.addGems) CC.addGems(5);
      }
    } else {
      forgeTimer = 0;
    }
  }

  // ----------------------------------------------------------
  // THE ABYSS — Phase 7: Hadal Ocean Trench & Leviathan Siren
  // ----------------------------------------------------------
  var ABYSS = { FLOOR: -26, CEIL: 10, R: 20 };
  var siren = null, sirenVortexTimer = 8, sirenVortices = [];
  var hydroSpires = [], syphonTimer = 0;

  function generateAbyss() {
    var F = ABYSS.FLOOR, R = ABYSS.R;
    // 1. Oceanic Hadal Silt Seabed (Block 19)
    for (var x = -R; x <= R; x++) {
      for (var z = -R; z <= R; z++) {
        var d = Math.sqrt(x * x + z * z);
        if (d > R) continue;
        set(x, F, z, 19); // Hadal Silt Floor
        set(x, F - 1, z, 15); // Basalt Sub-Bed
        
        // Deep Oceanic Trench Rim Walls
        if (d > R - 3) {
          var wallH = Math.floor((d - (R - 3)) * 6);
          for (var wy = 1; wy <= wallH; wy++) {
            set(x, F + wy, z, (wy % 3 === 0) ? 18 : 15);
          }
        }
      }
    }

    // 2. Bioluminescent Abyssal Prism Clusters (Block 18)
    var prismCoords = [
      { x: -8, z: -8 }, { x: 8, z: 8 }, { x: -12, z: 6 }, { x: 12, z: -6 },
      { x: 0, z: 10 }, { x: -6, z: -14 }, { x: 14, z: 12 }
    ];
    for (var i = 0; i < prismCoords.length; i++) {
      var pc = prismCoords[i];
      for (var py = 1; py <= 3; py++) {
        set(pc.x, F + py, pc.z, 18);
        if (py === 2) {
          set(pc.x + 1, F + py, pc.z, 18);
          set(pc.x - 1, F + py, pc.z, 18);
        }
      }
    }

    // 3. Towering Hydrothermal Chimney Spires (Block 20)
    hydroSpires = [
      { x: -10, z: 6 }, { x: 10, z: -6 }, { x: 6, z: 10 }, { x: -6, z: -10 }
    ];
    for (var h = 0; h < hydroSpires.length; h++) {
      var sp = hydroSpires[h];
      for (var sy = 1; sy <= 8; sy++) {
        set(sp.x, F + sy, sp.z, 20); // Hydrothermal Spire
      }
      set(sp.x, F + 9, sp.z, 18); // Prism Cap
    }

    // 4. Return Pad
    var bg = GATES.abyss_back;
    GATES.abyss_back.y = F + 1;
    buildGatePad(bg.x, F + 1, bg.z, 18);
    CC.world.spawn = { x: 0.5, y: F + 2, z: -2.5 };

    // 5. Spawn Leviathan Siren
    spawnSiren();
  }

  function spawnSiren() {
    clearSiren();
    var group = new THREE.Group();
    // 8-segment serpentine spine
    var segments = [];
    var headGeo = new THREE.DodecahedronGeometry(1.6, 1);
    var headMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x005577, roughness: 0.2, metalness: 0.8 });
    var headMesh = new THREE.Mesh(headGeo, headMat);
    group.add(headMesh);

    // Bioluminescent Lure (Angler Bulb)
    var lureGeo = new THREE.SphereGeometry(0.5, 16, 16);
    var lureMat = new THREE.MeshBasicMaterial({ color: 0x50c878 });
    var lureMesh = new THREE.Mesh(lureGeo, lureMat);
    lureMesh.position.set(0, 2.2, 1.8);
    headMesh.add(lureMesh);

    // Body segments
    for (var i = 0; i < 7; i++) {
      var segRadius = 1.4 - i * 0.12;
      var segGeo = new THREE.SphereGeometry(segRadius, 16, 16);
      var segMat = new THREE.MeshStandardMaterial({
        color: (i % 2 === 0) ? 0x00aacc : 0x50c878,
        roughness: 0.3, metalness: 0.6
      });
      var segMesh = new THREE.Mesh(segGeo, segMat);
      group.add(segMesh);
      segments.push(segMesh);
    }

    group.position.set(0, ABYSS.FLOOR + 10, 0);
    CC.scene.add(group);
    siren = { group: group, head: headMesh, segments: segments, blessed: false, time: 0 };
  }

  function updateSiren(dt) {
    if (!siren) return;
    siren.time += dt;
    var t = siren.time;

    // Serpentine swimming path
    var pathR = 12.0;
    var cx = Math.cos(t * 0.5) * pathR;
    var cz = Math.sin(t * 0.5) * pathR;
    var cy = ABYSS.FLOOR + 9.0 + Math.sin(t * 1.2) * 3.5;
    siren.group.position.set(cx, cy, cz);
    siren.head.rotation.y = -(t * 0.5) + Math.PI / 2;
    siren.head.rotation.z = Math.sin(t * 2.0) * 0.25;

    // Undulating spinal kinematics
    for (var i = 0; i < siren.segments.length; i++) {
      var seg = siren.segments[i];
      var lag = (i + 1) * 0.35;
      var sx = Math.sin(t * 2.2 - lag) * (1.2 + i * 0.3);
      var sy = Math.cos(t * 1.8 - lag) * 0.8;
      var sz = -(i + 1) * 1.6;
      seg.position.set(sx, sy, sz);
    }

    // Ultrasonic Vortex Ring Burst
    sirenVortexTimer -= dt;
    if (sirenVortexTimer <= 0) {
      sirenVortexTimer = 7.5 + Math.random() * 4;
      fireSirenVortex();
    }

    for (var v = sirenVortices.length - 1; v >= 0; v--) {
      var vox = sirenVortices[v];
      vox.radius += dt * 8.5;
      vox.life -= dt;
      vox.mesh.scale.set(vox.radius, vox.radius, vox.radius);
      vox.mesh.material.opacity = Math.max(0, vox.life / 2.0);
      if (vox.life <= 0) {
        CC.scene.remove(vox.mesh);
        sirenVortices.splice(v, 1);
      }
    }

    // Blessing interaction
    var p = CC.player.pos;
    var dist = Math.hypot(p.x - cx, p.z - cz);
    if (dist < 4.0 && !siren.blessed && Math.abs(p.y - cy) < 4.0) {
      siren.blessed = true;
      CC.toast('THE ABYSSAL SIREN sings — "The deep water remembers." Received +12 Creation Gems.');
      if (CC.player && CC.player.addGems) CC.player.addGems(12);
      else if (CC.addGems) CC.addGems(12);
    }
  }

  function fireSirenVortex() {
    var pos = siren.group.position;
    var geo = new THREE.TorusGeometry(1.2, 0.25, 16, 32);
    var mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 });
    var torus = new THREE.Mesh(geo, mat);
    torus.position.set(pos.x, pos.y, pos.z);
    torus.rotation.x = Math.PI / 2;
    CC.scene.add(torus);
    sirenVortices.push({ mesh: torus, radius: 1.0, life: 2.0 });
    CC.toast('The Leviathan Siren emits an ultrasonic pressure vortex!');
  }

  function clearSiren() {
    if (siren) {
      CC.scene.remove(siren.group);
      siren = null;
    }
    for (var i = 0; i < sirenVortices.length; i++) {
      CC.scene.remove(sirenVortices[i].mesh);
    }
    sirenVortices = [];
  }

  function checkAbyssMechanics(dt) {
    var p = CC.player.pos;
    // Hydrothermal Spire Updrafts & Energy Syphon
    for (var s = 0; s < hydroSpires.length; s++) {
      var sp = hydroSpires[s];
      if (Math.abs(p.x - sp.x) < 1.8 && Math.abs(p.z - sp.z) < 1.8 && p.y < ABYSS.FLOOR + 12) {
        if (CC.player.vel) CC.player.vel.y = 16.0;
        CC.toast('Hydrothermal Spire thermal plume propels you upward!');
        break;
      }
    }
    // Energy Syphon near center reef
    if (Math.abs(p.x) < 3.0 && Math.abs(p.z) < 3.0 && Math.abs(p.y - (ABYSS.FLOOR + 2)) < 3.0) {
      syphonTimer += dt;
      if (syphonTimer > 3.0) {
        syphonTimer = 0;
        CC.toast('Abyssal Prism resonance tapped — +6 Abyssal Gems harnessed!');
        if (CC.player && CC.player.addGems) CC.player.addGems(6);
        else if (CC.addGems) CC.addGems(6);
      }
    } else {
      syphonTimer = 0;
    }
  }

  // ==========================================================
  // THE CHRONO-SINGULARITY — Phase 8 Alternate Realm
  // A fractured hyper-dimensional tesseract suspended in void.
  // Floating void tesseract citadel, chrono quartz time towers,
  // singularity eye wormholes, guarded by THE CHRONO-SPHINX.
  // ==========================================================
  var SINGULARITY = {
    FLOOR: -25,
    CEIL: 35,
    RADIUS: 32
  };
  var sphinx = null, sphinxRoarTimer = 8, chronoRings = [];
  var chronoTimer = 0, wormholeCooldown = 0;

  function generateSingularity() {
    CC.world.spawn = { x: 0.5, y: SINGULARITY.FLOOR + 2.5, z: -5.5 };
    var F = SINGULARITY.FLOOR;

    // 1. Hyper-dimensional central platform (Void Tesseract & Liminal Stone)
    for (var x = -10; x <= 10; x++) {
      for (var z = -10; z <= 10; z++) {
        var d2 = x * x + z * z;
        if (d2 <= 90) {
          set(x, F, z, 21); // VOID TESSERACT floor
          if (d2 <= 20) set(x, F + 1, z, 9); // Liminal Stone inner dais
          if (d2 === 0) set(x, F + 2, z, 23); // Central Singularity Eye
        }
      }
    }

    // 2. Return Gate Pad at (0, F+1, -6)
    buildGatePad(0, F + 1, -6, 21);
    GATES.singularity_back.y = F + 1;

    // 3. Four Chrono-Quartz Temporal Towers at cardinal extremes
    var towers = [
      { x: 18, z: 0 }, { x: -18, z: 0 },
      { x: 0, z: 18 }, { x: 0, z: -18 }
    ];
    for (var t = 0; t < towers.length; t++) {
      var tx = towers[t].x, tz = towers[t].z;
      // Floating tower base
      for (var dx = -2; dx <= 2; dx++) {
        for (var dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= 3) {
            set(tx + dx, F, tz + dz, 21);
          }
        }
      }
      // Vertical Chrono-Spire
      for (var h = 1; h <= 12; h++) {
        set(tx, F + h, tz, (h % 3 === 0) ? 22 : 21); // Chrono Quartz alternating with Void Tesseract
      }
      // Spire beacon top
      set(tx, F + 13, tz, 22); // CHRONO QUARTZ apex
      set(tx, F + 14, tz, 3);  // AURORA CRYSTAL crown

      // Bridge arches connecting towers to central dais
      var steps = 8;
      for (var s = 1; s <= steps; s++) {
        var bx = Math.round(tx * (1 - s / (steps + 2)));
        var bz = Math.round(tz * (1 - s / (steps + 2)));
        var by = F + Math.round(Math.sin((s / steps) * Math.PI) * 3);
        set(bx, by, bz, 13); // VOID GLASS luminous bridge
      }
    }

    // 4. Floating Tesseract Satellites & Singularity Eyes
    var satellites = [
      { x: 12, y: F + 8, z: 12 },
      { x: -12, y: F + 8, z: 12 },
      { x: 12, y: F + 8, z: -12 },
      { x: -12, y: F + 8, z: -12 }
    ];
    for (var s = 0; s < satellites.length; s++) {
      var sat = satellites[s];
      set(sat.x, sat.y, sat.z, 23); // SINGULARITY EYE
      set(sat.x + 1, sat.y, sat.z, 21);
      set(sat.x - 1, sat.y, sat.z, 21);
      set(sat.x, sat.y, sat.z + 1, 21);
      set(sat.x, sat.y, sat.z - 1, 21);
      set(sat.x, sat.y + 1, sat.z, 22); // Chrono Quartz cap
    }

    // Spawn Boss
    spawnSphinx();
  }

  function spawnSphinx() {
    clearSphinx();
    var F = SINGULARITY.FLOOR;
    var THREE = window.THREE;
    if (!THREE || !CC.scene) return;

    var group = new THREE.Group();
    group.position.set(0, F + 10, 14);

    // Sphinx Body: Gold / Obsidian hybrid
    var bodyGeo = new THREE.BoxGeometry(4.5, 3.0, 7.0);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1a0f26,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x3d007a,
      emissiveIntensity: 0.35
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Golden Sphinx Chest Plate
    var chestGeo = new THREE.BoxGeometry(4.2, 3.2, 2.5);
    var chestMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3
    });
    var chest = new THREE.Mesh(chestGeo, chestMat);
    chest.position.set(0, 0.4, 2.2);
    group.add(chest);

    // Sphinx Head with Pharaoh Nemes Crown
    var headGeo = new THREE.BoxGeometry(2.8, 3.2, 2.8);
    var headMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.2
    });
    var head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 2.8, 2.6);
    group.add(head);

    // Glowing Cyan Visor / Singularity Eye
    var visorGeo = new THREE.BoxGeometry(2.4, 0.6, 0.4);
    var visorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    var visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 2.9, 4.05);
    group.add(visor);

    // Chrono Tesseract Rings (orbital concentric rings)
    chronoRings = [];
    var ringMats = [
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true }),
      new THREE.MeshBasicMaterial({ color: 0xffd700, wireframe: true }),
      new THREE.MeshBasicMaterial({ color: 0x9a5fe0, wireframe: true })
    ];
    for (var r = 0; r < 3; r++) {
      var rGeo = new THREE.TorusGeometry(3.5 + r * 1.5, 0.12, 8, 32);
      var ring = new THREE.Mesh(rGeo, ringMats[r]);
      ring.rotation.x = Math.PI / 4 * r;
      ring.rotation.y = Math.PI / 3 * r;
      group.add(ring);
      chronoRings.push(ring);
    }

    CC.scene.add(group);
    sphinx = group;
  }

  function clearSphinx() {
    if (sphinx && CC && CC.scene) {
      CC.scene.remove(sphinx);
      sphinx = null;
      chronoRings = [];
    }
  }

  function updateSphinx(dt) {
    if (!sphinx) return;
    var F = SINGULARITY.FLOOR;

    // Hover kinematics
    sphinx.position.y = F + 10 + Math.sin(elapsed * 1.4) * 1.8;
    sphinx.position.x = Math.sin(elapsed * 0.5) * 4.0;

    // Rotate Chrono Tesseract Rings
    for (var r = 0; r < chronoRings.length; r++) {
      var speed = (r + 1) * 0.8;
      chronoRings[r].rotation.x += dt * speed;
      chronoRings[r].rotation.y += dt * (speed * 0.7);
      chronoRings[r].rotation.z += dt * (speed * 0.5);
    }

    // Sphinx Chrono Roar
    sphinxRoarTimer -= dt;
    if (sphinxRoarTimer <= 0) {
      sphinxRoarTimer = 9.0 + Math.random() * 4.0;
      fireChronoPulse();
    }
  }

  function fireChronoPulse() {
    if (!sphinx || !CC) return;
    CC.toast('THE CHRONO-SPHINX dilates the temporal flow — time accelerates!');
    if (CC.playAudioChime) CC.playAudioChime(528); // Solfeggio 528Hz frequency
  }

  function checkSingularityMechanics(dt) {
    if (!CC || !CC.player) return;
    var p = CC.player.pos;
    var F = SINGULARITY.FLOOR;

    // 1. Temporal Dilation Field: Near center dais (|x| < 12, |z| < 12)
    var distToCenter = Math.sqrt(p.x * p.x + p.z * p.z);
    if (distToCenter < 14) {
      // Temporal glide: reduced fall rate, fast drift
      if (CC.player.vel && CC.player.vel.y < -3.0) {
        CC.player.vel.y = -2.5; // low gravity cushion
      }
    }

    // 2. Chrono Quartz Energy Harvest
    if (distToCenter < 22 && distToCenter > 14 && Math.abs(p.y - F) < 4.0) {
      chronoTimer += dt;
      if (chronoTimer > 3.0) {
        chronoTimer = 0;
        CC.toast('Chrono Quartz temporal resonance harvested — +8 SpaceCash Chrono Gems!');
        if (CC.player && CC.player.addGems) CC.player.addGems(8);
        else if (CC.addGems) CC.addGems(8);
      }
    } else {
      chronoTimer = 0;
    }

    // 3. Singularity Eye Wormhole Warp
    wormholeCooldown = Math.max(0, wormholeCooldown - dt);
    if (wormholeCooldown <= 0) {
      // Check if player stands on Block 23 (Singularity Eye)
      var bx = Math.floor(p.x), by = Math.floor(p.y - 0.5), bz = Math.floor(p.z);
      var bType = CC.world.get(bx, by, bz);
      if (bType === 23) {
        wormholeCooldown = 4.0;
        // Warp to opposite satellite platform
        var targetX = -bx, targetZ = -bz;
        CC.player.pos.x = targetX + 0.5;
        CC.player.pos.z = targetZ + 0.5;
        CC.player.pos.y = F + 9.5;
        if (CC.player.vel) { CC.player.vel.x = 0; CC.player.vel.y = 4.0; CC.player.vel.z = 0; }
        CC.toast('Singularity Eye wormhole traversed — quantum fold displacement!');
      }
    }
  }

  // ----------------------------------------------------------
  // THE HYPERBOREAN FROST EXPANSE (Phase 9)
  // ----------------------------------------------------------
  var FROST = {
    FLOOR: -18,
    CEIL: 24,
    RADIUS: 26
  };
  var colossus = null, blizzardTimer = 8.5, frostRings = [];
  var cryoTimer = 0, vaultCooldown = 0;

  function generateFrost() {
    var F = FROST.FLOOR, R = FROST.RADIUS;
    CC.world.spawn = [0, F + 2, -6];

    // 1. Central Glacial Shelf (Frost Obsidian + Glacial Core)
    for (var x = -R; x <= R; x++) {
      for (var z = -R; z <= R; z++) {
        var d = Math.sqrt(x * x + z * z);
        if (d <= R) {
          // Tiered concentric ice terraces
          var h = Math.floor(Math.cos(d * 0.18) * 3) + (d < 10 ? 2 : (d < 18 ? 1 : 0));
          for (var y = F - 4; y <= F + h; y++) {
            if (y === F + h) {
              // Surface layer: Frost Obsidian with Glacial Core veins
              set(x, y, z, (x * x + z * z) % 7 === 0 ? 25 : 24);
            } else {
              set(x, y, z, 24); // Solid Frost Obsidian
            }
          }
        }
      }
    }

    // 2. Glacial Crevasse Chasm ring between R=12 and R=15
    for (var a = 0; a < Math.PI * 2; a += 0.05) {
      var rx = Math.round(Math.cos(a) * 13.5);
      var rz = Math.round(Math.sin(a) * 13.5);
      // Carve chasm air pockets except at 4 crystalline bridge points (cardinal directions)
      if (Math.abs(rx) > 2 && Math.abs(rz) > 2) {
        for (var cy = F - 4; cy <= F + 5; cy++) {
          set(rx, cy, rz, 0);
          set(rx + 1, cy, rz, 0);
        }
      } else {
        // Crystalline ice bridge across chasm
        for (var by = F; by <= F + 1; by++) {
          set(rx, by, rz, 25);
        }
      }
    }

    // 3. Four Cryo-Shard Clusters on the perimeter
    var spireOffsets = [[18, 0], [-18, 0], [0, 18], [0, -18]];
    for (var s = 0; s < spireOffsets.length; s++) {
      var sx = spireOffsets[s][0], sz = spireOffsets[s][1];
      for (var sy = 1; sy <= 6; sy++) {
        set(sx, F + sy, sz, 26); // Cryo Shard pillar
      }
      set(sx + 1, F + 1, sz, 26);
      set(sx - 1, F + 1, sz, 26);
      set(sx, F + 1, sz + 1, 26);
      set(sx, F + 1, sz - 1, 26);
    }

    // 4. Return Gate Pad at (0, -6)
    buildGatePad(0, F + 1, -6, 25);
    GATES.frost_back.y = F + 1;

    // 5. Central Dais Altar with Glacial Core Leap Pad at (0, 0)
    for (var dx = -2; dx <= 2; dx++) {
      for (var dz = -2; dz <= 2; dz++) {
        set(dx, F + 1, dz, 24);
      }
    }
    set(0, F + 1, 0, 25); // Central Glacial Core

    // Spawn Boss
    spawnColossus();
  }

  function spawnColossus() {
    clearColossus();
    var F = FROST.FLOOR;
    var THREE = window.THREE;
    if (!THREE || !CC.scene) return;

    var group = new THREE.Group();
    group.position.set(0, F + 11, 14);

    // Colossus Torso: Frost Obsidian monolith with glowing core
    var bodyGeo = new THREE.BoxGeometry(4.0, 5.0, 3.5);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: 0x152238,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x00e5ff,
      emissiveIntensity: 0.35
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Glowing Glacial Heart
    var heartGeo = new THREE.BoxGeometry(2.0, 2.0, 3.7);
    var heartMat = new THREE.MeshBasicMaterial({ color: 0x7df9ff });
    var heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(0, 0.2, 0);
    group.add(heart);

    // Colossus Crystalline Crown & Head
    var headGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
    var headMat = new THREE.MeshStandardMaterial({
      color: 0x2a3d54,
      metalness: 0.9,
      roughness: 0.15,
      emissive: 0x7df9ff,
      emissiveIntensity: 0.25
    });
    var head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 3.8, 0);
    group.add(head);

    // Blizzard Eye Slit
    var eyeGeo = new THREE.BoxGeometry(2.2, 0.5, 0.4);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 3.9, 1.4);
    group.add(eye);

    // Left and Right Cryo-Shard Arm Spikes
    var armGeo = new THREE.BoxGeometry(1.5, 6.0, 1.5);
    var armMat = new THREE.MeshStandardMaterial({
      color: 0x7df9ff,
      metalness: 0.7,
      roughness: 0.1,
      emissive: 0x00ffff,
      emissiveIntensity: 0.4
    });
    var leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-3.2, -0.5, 0);
    group.add(leftArm);

    var rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(3.2, -0.5, 0);
    group.add(rightArm);

    // Blizzard Frost Rings (3 orbiting cryogenic gyroscopes)
    frostRings = [];
    var ringMats = [
      new THREE.MeshBasicMaterial({ color: 0x7df9ff, wireframe: true }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true })
    ];
    for (var r = 0; r < 3; r++) {
      var rGeo = new THREE.TorusGeometry(4.2 + r * 1.6, 0.12, 8, 32);
      var ring = new THREE.Mesh(rGeo, ringMats[r]);
      ring.rotation.x = Math.PI / 3 * r;
      ring.rotation.z = Math.PI / 4 * r;
      group.add(ring);
      frostRings.push(ring);
    }

    CC.scene.add(group);
    colossus = group;
  }

  function clearColossus() {
    if (colossus && CC && CC.scene) {
      CC.scene.remove(colossus);
      colossus = null;
      frostRings = [];
    }
  }

  function updateColossus(dt) {
    if (!colossus) return;
    var F = FROST.FLOOR;

    // Levitation kinematics
    colossus.position.y = F + 11 + Math.sin(elapsed * 1.2) * 1.5;
    colossus.position.x = Math.sin(elapsed * 0.4) * 3.5;

    // Rotate Blizzard Rings
    for (var r = 0; r < frostRings.length; r++) {
      var speed = (r + 1) * 0.75;
      frostRings[r].rotation.x += dt * speed;
      frostRings[r].rotation.y += dt * (speed * 0.6);
      frostRings[r].rotation.z += dt * (speed * 0.4);
    }

    // Blizzard pulse timer
    blizzardTimer -= dt;
    if (blizzardTimer <= 0) {
      blizzardTimer = 8.0 + Math.random() * 4.0;
      fireBlizzardPulse();
    }
  }

  function fireBlizzardPulse() {
    if (!colossus || !CC) return;
    CC.toast('THE CRYO-COLOSSUS unleashes an arctic flash freeze — absolute zero!');
    if (CC.playAudioChime) CC.playAudioChime(432); // 432Hz crystal resonance tone
  }

  function checkFrostMechanics(dt) {
    if (!CC || !CC.player) return;
    var p = CC.player.pos;
    var F = FROST.FLOOR;

    // 1. Glacial Core Leap Pad (Block 25)
    var bx = Math.floor(p.x), by = Math.floor(p.y - 0.5), bz = Math.floor(p.z);
    var bType = CC.world.get(bx, by, bz);
    vaultCooldown = Math.max(0, vaultCooldown - dt);
    if (bType === 25 && vaultCooldown <= 0) {
      vaultCooldown = 1.5;
      if (CC.player.vel) {
        CC.player.vel.y = 8.5; // High cryogenic vertical leap
      }
      CC.toast('Glacial Core kinetic launch — cryogenic vault leap!');
      if (CC.playAudioChime) CC.playAudioChime(648);
    }

    // 2. Cryo-Shard Harvesting (Block 26)
    var distToCenter = Math.sqrt(p.x * p.x + p.z * p.z);
    if (distToCenter > 16 && distToCenter < 24 && Math.abs(p.y - F) < 8.0) {
      cryoTimer += dt;
      if (cryoTimer > 3.0) {
        cryoTimer = 0;
        CC.toast('Cryo-Shard resonance harvested — +10 SpaceCash Hyperborean Gems!');
        if (CC.player && CC.player.addGems) CC.player.addGems(10);
        else if (CC.addGems) CC.addGems(10);
      }
    } else {
      cryoTimer = 0;
    }
  }

  // ----------------------------------------------------------
  // THE SOLARIS AETHERIUM (Phase 10)
  // ----------------------------------------------------------
  var SOLARIS = {
    FLOOR: -18,
    CEIL: 26,
    RADIUS: 28
  };
  var phoenix = null, flareTimer = 7.0, solarRings = [], solarWings = [];
  var solarHarvestTimer = 0, thermalVaultCooldown = 0;

  function generateSolaris() {
    var F = SOLARIS.FLOOR, R = SOLARIS.RADIUS;
    CC.world.spawn = [0, F + 2, -6];

    // 1. Central Solar Citadel Disc (Solar Prism + Solar Core + Gold Veins)
    for (var x = -R; x <= R; x++) {
      for (var z = -R; z <= R; z++) {
        var d = Math.sqrt(x * x + z * z);
        if (d <= R) {
          // Tiered concentric solar terraces
          var terrace = Math.floor((R - d) / 6);
          var topY = F + terrace;
          for (var y = F - 5; y <= topY; y++) {
            if (y === topY) {
              // Surface layer: Solar Prism with radiant Solar Core & Gold veins
              var r = Math.random();
              if (r < 0.18) set(x, y, z, 28);       // Solar Core leap emitter
              else if (r < 0.40) set(x, y, z, 2);   // Gold Vein
              else if (r < 0.50) set(x, y, z, 17);  // Solar Forge
              else set(x, y, z, 27);                // Solar Prism crystalline foundation
            } else {
              set(x, y, z, 27); // Solid Solar Prism
            }
          }
        }
      }
    }

    // 2. Circumferential Radiant Chasm with 4 Cardinal Sun-Light Bridges
    for (var a = 0; a < Math.PI * 2; a += 0.05) {
      var rx = Math.round(Math.cos(a) * 14.5);
      var rz = Math.round(Math.sin(a) * 14.5);
      // Carve chasm air pockets except at 4 cardinal radiant bridge points
      if (Math.abs(rx) > 2 && Math.abs(rz) > 2) {
        for (var cy = F - 4; cy <= F + 6; cy++) {
          set(rx, cy, rz, 0);
          set(rx + 1, cy, rz, 0);
        }
      } else {
        // Crystalline golden sun-bridge across radiant chasm
        for (var by = F; by <= F + 1; by++) {
          set(rx, by, rz, 28); // Solar Core bridge
        }
      }
    }

    // 3. Four Helios Shard Solar Obelisks on perimeter
    var obeliskOffsets = [[18, 0], [-18, 0], [0, 18], [0, -18]];
    for (var s = 0; s < obeliskOffsets.length; s++) {
      var sx = obeliskOffsets[s][0], sz = obeliskOffsets[s][1];
      for (var sy = 1; sy <= 7; sy++) {
        set(sx, F + sy, sz, 29); // Helios Shard spire
      }
      set(sx + 1, F + 1, sz, 29);
      set(sx - 1, F + 1, sz, 29);
      set(sx, F + 1, sz + 1, 29);
      set(sx, F + 1, sz - 1, 29);
    }

    // 4. Return Gate Pad at (0, -6)
    buildGatePad(0, F + 1, -6, 28);
    GATES.solaris_back.y = F + 1;

    // 5. Central High Solar Dais with Core Leap Pad at (0, 0)
    for (var dx = -2; dx <= 2; dx++) {
      for (var dz = -2; dz <= 2; dz++) {
        set(dx, F + 1, dz, 27);
      }
    }
    set(0, F + 1, 0, 28); // Central Solar Core Kinetic Emitter

    // Spawn Boss
    spawnPhoenix();
  }

  function spawnPhoenix() {
    clearPhoenix();
    var F = SOLARIS.FLOOR;
    var THREE = window.THREE;
    if (!THREE || !CC.scene) return;

    var group = new THREE.Group();
    group.position.set(0, F + 12, 14);

    // Phoenix Body: Faceted gold/sunfire core
    var bodyGeo = new THREE.BoxGeometry(3.5, 4.5, 4.0);
    var bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff5400,
      metalness: 0.85,
      roughness: 0.15,
      emissive: 0xffaa00,
      emissiveIntensity: 0.5
    });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    group.add(body);

    // Glowing Coronal Heart
    var heartGeo = new THREE.BoxGeometry(1.8, 2.2, 4.2);
    var heartMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    var heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(0, 0.2, 0);
    group.add(heart);

    // Phoenix Head & Solar Crest
    var headGeo = new THREE.BoxGeometry(2.2, 2.4, 2.8);
    var headMat = new THREE.MeshStandardMaterial({
      color: 0xff9900,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0xffcc00,
      emissiveIntensity: 0.4
    });
    var head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 3.6, 1.2);
    group.add(head);

    // Sharp Solar Beak
    var beakGeo = new THREE.ConeGeometry(0.7, 2.0, 4);
    var beakMat = new THREE.MeshBasicMaterial({ color: 0xffe600 });
    var beak = new THREE.Mesh(beakGeo, beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 3.2, 3.2);
    group.add(beak);

    // Radiant Solar Eyes
    var eyeGeo = new THREE.BoxGeometry(2.4, 0.4, 0.4);
    var eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 3.8, 2.2);
    group.add(eye);

    // Left and Right Solar Flapping Wings
    solarWings = [];
    var wingGeo = new THREE.BoxGeometry(6.5, 0.8, 3.0);
    var wingMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      metalness: 0.75,
      roughness: 0.2,
      emissive: 0xff7700,
      emissiveIntensity: 0.45
    });

    var leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-4.5, 0.8, 0);
    group.add(leftWing);
    solarWings.push(leftWing);

    var rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(4.5, 0.8, 0);
    group.add(rightWing);
    solarWings.push(rightWing);

    // Coronal Solar Flare Rings (3 concentric solar corona gyroscopes)
    solarRings = [];
    var ringMats = [
      new THREE.MeshBasicMaterial({ color: 0xffe600, wireframe: true }),
      new THREE.MeshBasicMaterial({ color: 0xff5400, wireframe: true }),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
    ];
    for (var r = 0; r < 3; r++) {
      var rGeo = new THREE.TorusGeometry(4.8 + r * 1.5, 0.14, 8, 32);
      var ring = new THREE.Mesh(rGeo, ringMats[r]);
      ring.rotation.x = Math.PI / 3 * r;
      ring.rotation.y = Math.PI / 4 * r;
      group.add(ring);
      solarRings.push(ring);
    }

    CC.scene.add(group);
    phoenix = group;
  }

  function clearPhoenix() {
    if (phoenix && CC && CC.scene) {
      CC.scene.remove(phoenix);
      phoenix = null;
      solarWings = [];
      solarRings = [];
    }
  }

  function updatePhoenix(dt) {
    if (!phoenix) return;
    var F = SOLARIS.FLOOR;

    // Levitation kinematics & soaring
    phoenix.position.y = F + 12 + Math.sin(elapsed * 1.6) * 1.8;
    phoenix.position.x = Math.sin(elapsed * 0.5) * 4.2;

    // Wing flapping kinematics
    if (solarWings.length === 2) {
      var flap = Math.sin(elapsed * 4.0) * 0.45;
      solarWings[0].rotation.z = flap;
      solarWings[1].rotation.z = -flap;
    }

    // Rotate Coronal Flare Rings
    for (var r = 0; r < solarRings.length; r++) {
      var speed = (r + 1) * 0.85;
      solarRings[r].rotation.x += dt * speed;
      solarRings[r].rotation.y += dt * (speed * 0.7);
      solarRings[r].rotation.z += dt * (speed * 0.5);
    }

    // Flare pulse timer
    flareTimer -= dt;
    if (flareTimer <= 0) {
      flareTimer = 7.5 + Math.random() * 3.5;
      fireSolarFlarePulse();
    }
  }

  function fireSolarFlarePulse() {
    if (!phoenix || !CC) return;
    CC.toast('THE HELIOS PHOENIX radiates a coronal solar flare — 528Hz harmonic resonance!');
    if (CC.playAudioChime) CC.playAudioChime(528); // 528Hz DNA/solar harmonic resonance tone
  }

  function checkSolarisMechanics(dt) {
    if (!CC || !CC.player) return;
    var p = CC.player.pos;
    var F = SOLARIS.FLOOR;

    // 1. Solar Core Kinetic Thermal Leap Pad (Block 28)
    var bx = Math.floor(p.x), by = Math.floor(p.y - 0.5), bz = Math.floor(p.z);
    var bType = CC.world.get(bx, by, bz);
    thermalVaultCooldown = Math.max(0, thermalVaultCooldown - dt);
    if (bType === 28 && thermalVaultCooldown <= 0) {
      thermalVaultCooldown = 1.5;
      if (CC.player.vel) {
        CC.player.vel.y = 9.2; // Radiant thermal updraft vault leap
      }
      CC.toast('Solar Core thermal convection — radiant aether leap!');
      if (CC.playAudioChime) CC.playAudioChime(792);
    }

    // 2. Helios Shard Harvesting (Block 29)
    var distToCenter = Math.sqrt(p.x * p.x + p.z * p.z);
    if (distToCenter > 15 && distToCenter < 24 && Math.abs(p.y - F) < 8.0) {
      solarHarvestTimer += dt;
      if (solarHarvestTimer > 3.0) {
        solarHarvestTimer = 0;
        CC.toast('Helios Shard resonance harvested — +12 SpaceCash Helios Sun-Gems!');
        if (CC.player && CC.player.addGems) CC.player.addGems(12);
        else if (CC.addGems) CC.addGems(12);
      }
    } else {
      solarHarvestTimer = 0;
    }
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
    clearPups(); clearDragon(); clearGolem(); clearSiren(); clearSphinx(); clearColossus(); clearPhoenix();
    current = dim;
    if (stash[dim]) {
      CC.world.blocks = stash[dim].blocks;
      CC.world.edits = stash[dim].edits;
      CC.world.locations = stash[dim].locations;
      CC.world.spawn = stash[dim].spawn;
      if (dim === 'geode') spawnPups(-14);
      if (dim === 'vitrine') spawnDragon();
      if (dim === 'crucible') spawnGolem();
      if (dim === 'abyss') spawnSiren();
      if (dim === 'singularity') spawnSphinx();
      if (dim === 'frost') spawnColossus();
      if (dim === 'solaris') spawnPhoenix();
    } else {
      CC.world.blocks = new Map();
      CC.world.edits = {};
      CC.world.locations = [];
      if (dim === 'geode') generateGeode();
      else if (dim === 'vitrine') generateVitrine();
      else if (dim === 'crucible') generateCrucible();
      else if (dim === 'abyss') generateAbyss();
      else if (dim === 'singularity') generateSingularity();
      else if (dim === 'frost') generateFrost();
      else if (dim === 'solaris') generateSolaris();
    }
    CC.buildAllChunks();
    CC.respawn();
    if (window.CosmosNPCs) window.CosmosNPCs.rebuild();
    if (window.CosmosSaucer && window.CosmosSaucer.setVisible)
      window.CosmosSaucer.setVisible(dim === 'over');
    CC.toast(dim === 'geode' ? 'THE GEODE — a prison of comfort. the pups are pleased.'
      : dim === 'vitrine' ? 'THE VITRINE — glass, vacuum, treasure. mind the dragon’s aim.'
      : dim === 'crucible' ? 'THE CRUCIBLE — the mantle core roars. Vulcanor watches the molten ley.'
      : dim === 'abyss' ? 'THE ABYSS — hadal crystal reef and deep smokers. The Leviathan Siren circles.'
      : dim === 'singularity' ? 'THE CHRONO-SINGULARITY — fractured tesseract suspended in void. The Chrono-Sphinx commands the flow.'
      : dim === 'frost' ? 'THE HYPERBOREAN FROST EXPANSE — glacial obsidian shelves and absolute zero. The Cryo-Colossus awakens.'
      : dim === 'solaris' ? 'THE SOLARIS AETHERIUM — radiant golden citadels and perpetual sunfire. The Helios Phoenix blazes.'
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
    if (current === 'crucible') {
      updateGolem(dt);
      checkCrucibleMechanics(dt);
      if (CC.player.pos.y < CRU.FLOOR - 24) {
        CC.toast('the mantle core claims what falls. you return to the surface.');
        switchTo('over');
      }
    }
    if (current === 'abyss') {
      updateSiren(dt);
      checkAbyssMechanics(dt);
      if (CC.player.pos.y < ABYSS.FLOOR - 22) {
        CC.toast('the hadal trench releases you. you surface back to the light.');
        switchTo('over');
      }
    }
    if (current === 'singularity') {
      updateSphinx(dt);
      checkSingularityMechanics(dt);
      if (CC.player.pos.y < SINGULARITY.FLOOR - 24) {
        CC.toast('the temporal fracture collapses. the timeline restores you to the surface.');
        switchTo('over');
      }
    }
    if (current === 'frost') {
      updateColossus(dt);
      checkFrostMechanics(dt);
      if (CC.player.pos.y < FROST.FLOOR - 24) {
        CC.toast('the hyperborean winds lift you. you return thawed to the surface.');
        switchTo('over');
      }
    }
    if (current === 'solaris') {
      updatePhoenix(dt);
      checkSolarisMechanics(dt);
      if (CC.player.pos.y < SOLARIS.FLOOR - 24) {
        CC.toast('the solar winds elevate you. you return bathed in light to the surface.');
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
