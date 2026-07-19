/* ============================================================
   CUBIC COSMOS · saucer.js — THE PRISM SAUCER
   A pilotable flying saucer parked at SIMUL CITY. Rainbow
   light-ring hull, dome cockpit, boost drive, laser torpedoes
   that shatter matter (blocks only — wardens are untouchable
   geometry; lasers pass through them politely).

   Controls (walk up + press F to board):
     WASD  steer (camera-relative)   SPACE rise   X descend
     SHIFT boost ("super fast")      CLICK fire laser torpedo
     F     dismount
   ============================================================ */
window.CosmosSaucer = (function () {
  'use strict';

  var CC = null, keys = null;
  var group = null, ring = [], ringLight = null, dome = null;
  var pos = null, vel = null;
  var active = false, near = false;
  var torpedoes = [];
  var BASE_SPEED = 22, BOOST_SPEED = 44, VERT_SPEED = 14;
  var PARK = { x: 44.5, y: 12.5, z: -27.5 };   // beside Simul City arcade row
  var elapsed = 0;

  function makeSaucer() {
    var g = new THREE.Group();
    var hullMat = new THREE.MeshStandardMaterial({ color: 0x141024, metalness: 0.7, roughness: 0.35 });
    var hull = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.1, 0.55, 24), hullMat);
    g.add(hull);
    var belly = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.1, 0.4, 24), hullMat);
    belly.position.y = -0.45; g.add(belly);
    var domeMat = new THREE.MeshStandardMaterial({
      color: 0x66e8ff, transparent: true, opacity: 0.35, metalness: 0.1, roughness: 0.05,
      emissive: 0x113344, emissiveIntensity: 0.6
    });
    dome = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.28; g.add(dome);
    // the rainbow ring — 14 emissive studs around the rim
    for (var i = 0; i < 14; i++) {
      var a = (i / 14) * Math.PI * 2;
      var stud = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ emissive: 0xffffff, emissiveIntensity: 2.2, color: 0x111111 }));
      stud.position.set(Math.cos(a) * 1.95, -0.1, Math.sin(a) * 1.95);
      stud.userData.phase = i / 14;
      ring.push(stud); g.add(stud);
    }
    ringLight = new THREE.PointLight(0xffffff, 1.4, 22);
    ringLight.position.y = -0.2; g.add(ringLight);
    return g;
  }

  function init(cc, keyMap) {
    CC = cc; keys = keyMap;
    pos = new THREE.Vector3(PARK.x, PARK.y, PARK.z);
    vel = new THREE.Vector3();
    group = makeSaucer();
    group.position.copy(pos);
    CC.scene.add(group);
  }

  function board() {
    active = true;
    vel.set(0, 0, 0);
    CC.toast('PRISM SAUCER online — SHIFT to boost, CLICK for torpedoes, F to dismount');
  }

  function dismount() {
    active = false;
    var p = CC.player;
    p.pos.set(pos.x, pos.y - 0.8, pos.z + 2.2);
    p.vel.set(0, 0, 0);
    CC.toast('You step back onto solid improbability.');
  }

  function toggleBoard() {
    if (active) { dismount(); return; }
    var p = CC.player.pos;
    if (p.distanceTo(pos) < 4.5) board();
  }

  function fire() {
    if (!active) return;
    var dir = new THREE.Vector3();
    CC.camera.getWorldDirection(dir);
    var mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshStandardMaterial({ emissive: 0xff2266, emissiveIntensity: 3.5, color: 0x220011 }));
    var light = new THREE.PointLight(0xff3366, 1.6, 10);
    mesh.add(light);
    mesh.position.copy(pos).addScaledVector(dir, 2.6);
    CC.scene.add(mesh);
    torpedoes.push({ mesh: mesh, dir: dir.clone(), life: 2.5, speed: 60 });
  }

  function detonate(t, bx, by, bz) {
    var w = CC.world;
    for (var x = bx - 1; x <= bx + 1; x++)
      for (var y = by - 1; y <= by + 1; y++)
        for (var z = bz - 1; z <= bz + 1; z++)
          if (Math.abs(x - bx) + Math.abs(y - by) + Math.abs(z - bz) <= 2 && w.get(x, y, z) !== 0)
            w.set(x, y, z, 0);
    CC.rebuildAround(bx, by, bz);
  }

  function updateTorpedoes(dt) {
    for (var i = torpedoes.length - 1; i >= 0; i--) {
      var t = torpedoes[i];
      t.life -= dt;
      var steps = 4;
      var hit = false;
      for (var s = 0; s < steps && !hit; s++) {
        t.mesh.position.addScaledVector(t.dir, (t.speed * dt) / steps);
        var bx = Math.floor(t.mesh.position.x),
            by = Math.floor(t.mesh.position.y),
            bz = Math.floor(t.mesh.position.z);
        if (CC.world.get(bx, by, bz) !== 0) { detonate(t, bx, by, bz); hit = true; }
      }
      if (hit || t.life <= 0) {
        CC.scene.remove(t.mesh);
        torpedoes.splice(i, 1);
      }
    }
  }

  function update(dt, playing) {
    elapsed += dt;
    // rainbow ring animation — always on, the beacon of Simul City
    for (var i = 0; i < ring.length; i++) {
      var hue = (elapsed * 0.25 + ring[i].userData.phase) % 1;
      ring[i].material.emissive.setHSL(hue, 1, 0.55);
    }
    ringLight.color.setHSL((elapsed * 0.25) % 1, 1, 0.6);
    group.rotation.y += dt * (active ? 1.6 : 0.3);
    group.position.copy(pos);
    group.position.y += Math.sin(elapsed * 1.7) * 0.08;   // idle hover

    updateTorpedoes(dt);
    if (!active || !playing) return;

    // flight
    var p = CC.player;
    var speed = keys['ShiftLeft'] || keys['ShiftRight'] ? BOOST_SPEED : BASE_SPEED;
    speed *= (CC.buffs && CC.buffs.saucerBoost) || 1;
    var fx = 0, fz = 0, fy = 0;
    if (keys['KeyW']) fz -= 1;
    if (keys['KeyS']) fz += 1;
    if (keys['KeyA']) fx -= 1;
    if (keys['KeyD']) fx += 1;
    if (keys['Space']) fy += 1;
    if (keys['KeyX']) fy -= 1;
    var sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    var wx = fx * cos - fz * sin, wz = fx * sin + fz * cos;
    var len = Math.hypot(wx, wz) || 1;
    vel.x += ((wx / len) * speed - vel.x) * Math.min(1, dt * 5);
    vel.z += ((wz / len) * speed - vel.z) * Math.min(1, dt * 5);
    vel.y += (fy * VERT_SPEED - vel.y) * Math.min(1, dt * 5);
    if (!fx && !fz) { vel.x *= 1 - Math.min(1, dt * 4); vel.z *= 1 - Math.min(1, dt * 4); }
    pos.addScaledVector(vel, dt);
    if (pos.y < -40) pos.y = -40;
    if (pos.y > 90) pos.y = 90;

    // cockpit camera
    p.pos.set(pos.x, pos.y + 0.4, pos.z);
    CC.camera.position.set(pos.x, pos.y + 1.0, pos.z);
    CC.camera.rotation.set(p.pitch, -p.yaw, 0, 'YXZ');
  }

  return {
    init: init, update: update, toggleBoard: toggleBoard, fire: fire,
    setVisible: function (v) { if (group) group.visible = v; },
    get active() { return active; }
  };
})();
