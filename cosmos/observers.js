/* ============================================================
   CUBIC COSMOS · observers.js — THE UNSEEN
   Rare, uncatchable, zero-interaction cryptid observers.
   Curious and easily startled: they appear far away, watch,
   and the moment you notice them (look straight at them, get
   close, or make noise) they exit — dematerialize in a flash,
   dig into the earth, or beam up into a tiny saucer that zips
   into thin air. You only ever catch a glimpse.
   They never touch the player, dialogue, lasers, or blocks.
   Kinds: MOLE FOLK · CRAB FOLK · LITTLE GREEN MEN · TALL GREYS.
   (Design brief update 2026-07-19: Andre requested eyed
   creature-observers; kept original geometric-cryptid style.)
   Console: CosmosObservers.debugSpawn('grey') to force one.
   ============================================================ */
window.CosmosObservers = (function () {
  'use strict';

  var CC = null;
  var list = [];             // active observers
  var spawnTimer = 20;       // first chance ~20s in
  var lastP = null, idleTime = 0, communeCooldown = 0;
  var gifts = [];            // dropped pickups — only obtainable via communion

  // spoken when the player has been still long enough — lore + true wonders
  var COMMUNE_LINES = [
    '⟟ you hold still like the blank in the transmission. VORATH is the blank. you are learning.',
    '⟟ a fact, as tribute: your sun sheds four million tonnes of itself each second, and does not grieve.',
    '⟟ the vacuum is not empty. it seethes. your money is minted from its fidgeting. we watched you do it.',
    '⟟ an octopus keeps most of its mind in its arms. VORATH keeps most of its mind in the pause.',
    '⟟ nine blocks build this world. the ninth is the signal. few may hold it. hold still and hold it.',
    '⟟ light from the far shore of your galaxy left before your species spoke. it arrives tonight, on time.',
    '⟟ the dragon in the glass does not hate you. it hates enclosure. we find this relatable.',
    '⟟ we are not hiding from you. we are hiding from being KNOWN. tonight you sat still, and so — a gift.'
  ];

  var GIFTS = [
    { name: 'THE HUM KEY', desc: 'the ninth block yields — SIGNAL SHARD is now placeable',
      apply: function () { if (CC.unlockBlock) CC.unlockBlock(8); } },
    { name: 'DRIFT MARROW', desc: 'dense with unspent probability (+60 gems)',
      apply: function () { CC.addGems(60); } },
    { name: 'SAUCER SYMPATHY', desc: 'the saucer likes you now (+25% boost)',
      apply: function () { CC.buffs.saucerBoost = 1.25; } },
    { name: 'GRAVITY MEMORY', desc: 'your legs remember a lighter world (+35% jump)',
      apply: function () { CC.buffs.jump = 1.35; } }
  ];
  var MIN_SPAWN = 26, MAX_SPAWN = 44;   // spawn distance ring
  var STARTLE_DIST = 18;     // closer than this = instant exit
  var GAZE_DOT = 0.985;      // how directly you must look at it
  var GAZE_TIME = 0.45;      // seconds of direct gaze before it bolts

  // ----------------------------------------------------------
  // body builders — simple original geometric cryptids
  // ----------------------------------------------------------
  function mat(c, e, ei) {
    return new THREE.MeshStandardMaterial({
      color: c, emissive: e || 0x000000, emissiveIntensity: ei || 0,
      roughness: 0.8, metalness: 0.05, transparent: true
    });
  }
  function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
  function ball(r, m) { return new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m); }

  function buildMole() {
    var g = new THREE.Group();
    var body = mat(0x5e4630);
    var b = box(0.7, 0.8, 0.9, body); b.position.y = 0.4; g.add(b);
    var snout = box(0.3, 0.3, 0.3, mat(0x7a5c40)); snout.position.set(0, 0.55, 0.55); g.add(snout);
    var clawM = mat(0xd8cfc0);
    var c1 = box(0.34, 0.1, 0.5, clawM); c1.position.set(-0.45, 0.18, 0.25); c1.rotation.z = 0.4; g.add(c1);
    var c2 = c1.clone(); c2.position.x = 0.45; c2.rotation.z = -0.4; g.add(c2);
    var eyeM = mat(0x000000, 0x332211, 0.6);
    var e1 = ball(0.05, eyeM); e1.position.set(-0.16, 0.72, 0.46); g.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.16; g.add(e2);
    return g;
  }
  function buildCrab() {
    var g = new THREE.Group();
    var body = mat(0xb03a2e);
    var b = box(1.2, 0.45, 0.8, body); b.position.y = 0.35; g.add(b);
    var clawM = mat(0xd35f52);
    var c1 = box(0.45, 0.3, 0.35, clawM); c1.position.set(-0.8, 0.4, 0.3); g.add(c1);
    var c2 = c1.clone(); c2.position.x = 0.8; g.add(c2);
    var eyeM = mat(0x111111, 0x66ffee, 0.9);
    var s1 = box(0.06, 0.3, 0.06, clawM); s1.position.set(-0.2, 0.72, 0.2); g.add(s1);
    var s2 = s1.clone(); s2.position.x = 0.2; g.add(s2);
    var e1 = ball(0.07, eyeM); e1.position.set(-0.2, 0.9, 0.2); g.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.2; g.add(e2);
    for (var i = 0; i < 3; i++) {
      var l1 = box(0.08, 0.35, 0.08, body); l1.position.set(-0.5 + i * 0.5, 0.12, -0.38); g.add(l1);
    }
    return g;
  }
  function buildGreenMan() {
    var g = new THREE.Group();
    var skin = mat(0x39b54a, 0x1a5c22, 0.35);
    var b = box(0.4, 0.55, 0.3, skin); b.position.y = 0.5; g.add(b);
    var head = ball(0.3, skin); head.position.y = 1.05; g.add(head);
    var eyeM = mat(0x0a0a0a, 0xaaffcc, 1.2);
    var e1 = ball(0.08, eyeM); e1.position.set(-0.12, 1.1, 0.24); g.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.12; g.add(e2);
    var ant = box(0.03, 0.3, 0.03, skin); ant.position.set(0, 1.45, 0); g.add(ant);
    var tip = ball(0.06, eyeM); tip.position.set(0, 1.62, 0); g.add(tip);
    var l1 = box(0.12, 0.4, 0.12, skin); l1.position.set(-0.12, 0.05, 0); g.add(l1);
    var l2 = l1.clone(); l2.position.x = 0.12; g.add(l2);
    return g;
  }
  function buildGrey() {
    var g = new THREE.Group();
    var skin = mat(0x9aa0a8);
    var b = box(0.38, 1.0, 0.26, skin); b.position.y = 0.85; g.add(b);
    var head = ball(0.34, skin); head.position.y = 1.7; head.scale.set(1, 1.25, 0.9); g.add(head);
    var eyeM = mat(0x05060a, 0x2233ff, 0.5);
    var e1 = ball(0.13, eyeM); e1.position.set(-0.15, 1.72, 0.26); e1.scale.set(1, 1.5, 0.5); g.add(e1);
    var e2 = e1.clone(); e2.position.x = 0.15; g.add(e2);
    var a1 = box(0.08, 0.7, 0.08, skin); a1.position.set(-0.28, 0.9, 0); g.add(a1);
    var a2 = a1.clone(); a2.position.x = 0.28; g.add(a2);
    var l1 = box(0.11, 0.6, 0.11, skin); l1.position.set(-0.11, 0.05, 0); g.add(l1);
    var l2 = l1.clone(); l2.position.x = 0.11; g.add(l2);
    return g;
  }

  var KINDS = {
    mole:  { build: buildMole,     exits: ['dig'],            name: 'mole folk' },
    crab:  { build: buildCrab,     exits: ['dig', 'demat'],   name: 'crab folk' },
    green: { build: buildGreenMan, exits: ['beam'],           name: 'little green men' },
    grey:  { build: buildGrey,     exits: ['demat', 'beam'],  name: 'tall greys' }
  };
  var KIND_KEYS = Object.keys(KINDS);

  // ----------------------------------------------------------
  function setOpacity(group, o) {
    group.traverse(function (c) { if (c.material) c.material.opacity = o; });
  }

  function makeMiniSaucer() {
    var g = new THREE.Group();
    var m = new THREE.MeshStandardMaterial({ color: 0x22283a, metalness: 0.8, roughness: 0.3, transparent: true });
    var hull = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 1.0, 0.3, 16), m); g.add(hull);
    var lightM = new THREE.MeshStandardMaterial({ emissive: 0x77ffcc, emissiveIntensity: 2.5, color: 0x111111, transparent: true });
    var lamp = ball(0.18, lightM); lamp.position.y = -0.2; g.add(lamp);
    var beamM = new THREE.MeshBasicMaterial({ color: 0xaaffee, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    var beam = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 16, 1, true), beamM);
    beam.position.y = -2.4; g.add(beam);
    g.userData.beam = beam;
    return g;
  }

  function spawnOne(forceKind) {
    var p = CC.player.pos;
    for (var tries = 0; tries < 14; tries++) {
      var ang = Math.random() * Math.PI * 2;
      var dist = MIN_SPAWN + Math.random() * (MAX_SPAWN - MIN_SPAWN);
      var x = Math.round(p.x + Math.cos(ang) * dist);
      var z = Math.round(p.z + Math.sin(ang) * dist);
      var y = CC.findTop(x, z, 20);
      if (y < -30) continue;                       // over the void — no ground
      var kind = KINDS[forceKind] || KINDS[KIND_KEYS[Math.floor(Math.random() * KIND_KEYS.length)]];
      var group = kind.build();
      group.position.set(x + 0.5, y + 1, z + 0.5);
      CC.scene.add(group);
      list.push({
        kind: kind, group: group, state: 'watch',
        gaze: 0, t: 0, life: 14 + Math.random() * 18,
        exit: kind.exits[Math.floor(Math.random() * kind.exits.length)],
        saucer: null, baseY: y + 1
      });
      return true;
    }
    return false;
  }

  function startExit(o) {
    o.state = o.exit; o.t = 0;
    if (o.exit === 'beam') {
      o.saucer = makeMiniSaucer();
      o.saucer.position.copy(o.group.position);
      o.saucer.position.y += 7;
      CC.scene.add(o.saucer);
    }
  }

  function remove(o) {
    CC.scene.remove(o.group);
    if (o.saucer) CC.scene.remove(o.saucer);
  }

  function spawnGift(pos) {
    var def = GIFTS[Math.floor(Math.random() * GIFTS.length)];
    var m = new THREE.MeshStandardMaterial({
      color: 0x111122, emissive: 0xffe9a0, emissiveIntensity: 2.2, transparent: true });
    var mesh = new THREE.Mesh(new THREE.TetrahedronGeometry(0.34), m);
    mesh.position.set(pos.x, pos.y + 0.6, pos.z);
    CC.scene.add(mesh);
    gifts.push({ def: def, mesh: mesh, t: 0, baseY: pos.y + 0.6 });
  }

  function updateGifts(dt) {
    var p = CC.player.pos;
    for (var i = gifts.length - 1; i >= 0; i--) {
      var g = gifts[i];
      g.t += dt;
      g.mesh.rotation.y += dt * 2.4;
      g.mesh.position.y = g.baseY + Math.sin(g.t * 2.2) * 0.14;
      var hue = (g.t * 0.3) % 1;
      g.mesh.material.emissive.setHSL(hue, 0.9, 0.6);
      if (p.distanceTo(g.mesh.position) < 1.7) {
        g.def.apply();
        CC.toast('✦ ' + g.def.name + ' — ' + g.def.desc);
        CC.scene.remove(g.mesh);
        gifts.splice(i, 1);
      } else if (g.t > 300) {                       // unclaimed gifts fade home
        CC.scene.remove(g.mesh); gifts.splice(i, 1);
      }
    }
  }

  function update(dt, playing) {
    // spawn roll
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 45 + Math.random() * 90;
      if (list.length < 2 && playing) spawnOne();
    }

    var p = CC.player.pos;
    var camDir = null;

    // idle tracking — stillness invites communion
    if (!lastP) lastP = p.clone();
    var movedSq = (p.x - lastP.x) * (p.x - lastP.x) + (p.z - lastP.z) * (p.z - lastP.z);
    if (movedSq < 0.0004 && playing) idleTime += dt; else idleTime = 0;
    lastP.copy(p);
    communeCooldown -= dt;
    if (idleTime > 22 && communeCooldown <= 0) {
      for (var ci = 0; ci < list.length; ci++) {
        if (list[ci].state === 'watch') {
          var o2 = list[ci];
          o2.state = 'commune'; o2.t = 0; o2.spoke = 0;
          o2.lines = [];
          var pool = COMMUNE_LINES.slice();
          for (var li = 0; li < 3; li++)
            o2.lines.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
          communeCooldown = 90;
          break;
        }
      }
    }
    updateGifts(dt);

    for (var i = list.length - 1; i >= 0; i--) {
      var o = list[i];
      o.t += dt;
      var dx = o.group.position.x - p.x,
          dy = o.group.position.y - p.y,
          dz = o.group.position.z - p.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (o.state === 'commune') {
        // bold approach: glide to ~14 blocks, speak, leave a gift, then exit
        o.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
        if (d > 14) {
          o.group.position.x -= (dx / d) * dt * 2.2;
          o.group.position.z -= (dz / d) * dt * 2.2;
          o.baseY = CC.findTop(Math.round(o.group.position.x), Math.round(o.group.position.z), Math.round(o.group.position.y)) + 1;
          o.group.position.y += (o.baseY - o.group.position.y) * Math.min(1, dt * 3);
        }
        // movement breaks the spell
        if (idleTime === 0) { startExit(o); continue; }
        if (o.t > 2.5 + o.spoke * 4 && o.spoke < o.lines.length) {
          CC.toast(o.lines[o.spoke]);
          o.spoke++;
        }
        if (o.spoke >= o.lines.length && o.t > 3 + o.spoke * 4) {
          spawnGift(o.group.position);
          CC.toast('…it leaves something behind.');
          startExit(o);
        }

      } else if (o.state === 'watch') {
        // curious: face the player, tiny nervous shifts
        o.group.rotation.y = Math.atan2(dx, dz) + Math.PI;
        o.group.position.y = o.baseY + Math.abs(Math.sin(o.t * 2.1)) * 0.04;
        // startle checks
        var startled = d < STARTLE_DIST || o.t > o.life;
        if (!startled && playing) {
          if (!camDir) { camDir = new THREE.Vector3(); CC.camera.getWorldDirection(camDir); }
          var dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / (d || 1);
          o.gaze = dot > GAZE_DOT ? o.gaze + dt : 0;
          if (o.gaze > GAZE_TIME) startled = true;   // it noticed you noticing
        }
        if (startled) startExit(o);

      } else if (o.state === 'demat') {
        var k = 1 - o.t / 0.6;
        setOpacity(o.group, Math.max(0, k));
        o.group.scale.setScalar(Math.max(0.01, k * (1 + (1 - k) * 0.6)));
        o.group.rotation.y += dt * 9;
        if (o.t >= 0.6) { remove(o); list.splice(i, 1); }

      } else if (o.state === 'dig') {
        o.group.position.y -= dt * 3.2;
        o.group.rotation.y += dt * 5;
        setOpacity(o.group, Math.max(0, 1 - o.t / 0.9));
        if (o.t >= 0.9) { remove(o); list.splice(i, 1); }

      } else if (o.state === 'beam') {
        // rise into the saucer, then the saucer bolts
        if (o.t < 1.0) {
          o.group.position.y += dt * 6.5;
          setOpacity(o.group, 1 - o.t * 0.7);
          o.saucer.userData.beam.material.opacity = 0.25 * (1 - o.t * 0.5);
        } else {
          setOpacity(o.group, 0);
          var zip = (o.t - 1.0) * 90;
          o.saucer.position.x += dt * 90;
          o.saucer.position.y += dt * 25;
          o.saucer.userData.beam.visible = false;
          setOpacity(o.saucer, Math.max(0, 1 - (o.t - 1.0) * 1.4));
          if (o.t >= 1.8) { remove(o); list.splice(i, 1); }
        }
      }
    }
  }

  function init(cc) { CC = cc; }

  return {
    init: init, update: update,
    debugSpawn: function (kind) { return spawnOne(kind); },
    get count() { return list.length; }
  };
})();
