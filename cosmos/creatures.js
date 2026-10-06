/* ============================================================
   CUBIC COSMOS · creatures.js — LIVE DRIFT ECOLOGY (Phase 3)
   - Dynamic procedural geometric forms with glowing shaders
   - Full 10-species complement matching ecology.js
   - Boid flocking (separation, alignment, cohesion)
   - Predator/prey ecological pursuit and evasion
   - Diurnal/nocturnal behavior shifts (day vs night advantage)
   - Majestic Boss Encounters: The Equilibrist & The Geyser Warden
   ============================================================ */
(typeof window !== 'undefined' ? window : globalThis).CosmosCreatures = (function () {
  'use strict';

  var CC = null;
  var scene = null;
  var root = null;
  var creatures = [];
  var bossCreatures = [];
  var t = 0;
  var bossSpawned = false;

  // Species mappings matching ecology.js canonical species
  var KINDS = [
    { sp: 'lumen_mote',    color: 0xfff3d6, shape: 'tetra',   s: 0.35, glow: 2.0, n: 8, home: 'roam' },
    { sp: 'gloom_mote',    color: 0x4a3b68, shape: 'tetra',   s: 0.35, glow: 0.6, n: 6, home: 'shadows' },
    { sp: 'prism_strider', color: 0x4df2cc, shape: 'cone',    s: 1.4,  glow: 1.5, n: 4, home: 'islands' },
    { sp: 'shard_stalker', color: 0xe03858, shape: 'prism',   s: 1.2,  glow: 1.3, n: 3, home: 'ruins' },
    { sp: 'aurora_ray',    color: 0x50f0ff, shape: 'manta',   s: 2.6,  glow: 1.8, n: 3, home: 'sky' },
    { sp: 'static_wraith', color: 0x8a99ad, shape: 'wraith',  s: 1.8,  glow: 1.1, n: 3, home: 'sky_night' },
    { sp: 'spring_tender', color: 0x38bdf8, shape: 'column',  s: 1.1,  glow: 1.7, n: 3, home: 'fountains' },
    { sp: 'drought_knot',  color: 0xb45309, shape: 'knot',    s: 1.0,  glow: 0.9, n: 3, home: 'caves' },
    { sp: 'harvest_hum',   color: 0xfacc15, shape: 'orb',     s: 0.55, glow: 2.2, n: 5, home: 'fields' },
    { sp: 'blight_hush',   color: 0x1e1b4b, shape: 'void_orb',s: 0.6,  glow: 0.4, n: 4, home: 'field_edges' }
  ];

  var HOMES = {
    roam:        function () { return [rand(-40, 40), 12 + rand(0, 10), rand(-40, 40)]; },
    shadows:     function () { return [rand(-30, 30), 4 + rand(0, 5),   rand(-30, 30)]; },
    islands:     function () { return [rand(-35, 35), 11 + rand(0, 6),  rand(-35, 35)]; },
    ruins:       function () { return [rand(20, 60), 6 + rand(0, 5),    rand(-40, 0)]; },
    sky:         function () { return [rand(-70, 70), 34 + rand(0, 20), rand(-70, 70)]; },
    sky_night:   function () { return [rand(-60, 60), 28 + rand(0, 18), rand(-60, 60)]; },
    fountains:   function () { return [-10 + rand(-8, 8), 6 + rand(0, 3), -10 + rand(-8, 8)]; },
    caves:       function () { return [rand(-50, 50), 3 + rand(0, 4),   rand(-50, 50)]; },
    fields:      function () { return [-40 + rand(-15, 15), 6 + rand(0, 3), 40 + rand(-15, 15)]; },
    field_edges: function () { return [-45 + rand(-18, 18), 5 + rand(0, 4), 45 + rand(-18, 18)]; },
    geyser:      function () { return [96 + rand(-12, 12), 10 + rand(0, 5), -64 + rand(-12, 12)]; }
  };

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }

  function mat(color, glow) {
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: glow,
      roughness: 0.35,
      metalness: 0.25,
      transparent: true,
      opacity: 0.92
    });
  }

  function makeForm(k) {
    var g = new THREE.Group();
    var m = mat(k.color, k.glow);
    var geo;

    switch (k.shape) {
      case 'tetra':
        geo = new THREE.TetrahedronGeometry(k.s);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(k.s * 0.35, k.s * 1.6, 6);
        break;
      case 'prism':
        geo = new THREE.CylinderGeometry(k.s * 0.4, k.s * 0.5, k.s * 1.2, 5);
        break;
      case 'manta':
        geo = new THREE.BoxGeometry(k.s * 1.8, k.s * 0.14, k.s * 1.1);
        break;
      case 'wraith':
        geo = new THREE.TorusGeometry(k.s * 0.8, k.s * 0.25, 6, 12);
        break;
      case 'column':
        geo = new THREE.CylinderGeometry(k.s * 0.25, k.s * 0.25, k.s * 1.8, 8);
        break;
      case 'knot':
        geo = new THREE.TorusKnotGeometry(k.s * 0.5, k.s * 0.18, 24, 6);
        break;
      case 'orb':
      case 'void_orb':
        geo = new THREE.IcosahedronGeometry(k.s, 1);
        break;
      default:
        geo = new THREE.OctahedronGeometry(k.s);
    }

    var mesh = new THREE.Mesh(geo, m);
    g.add(mesh);

    if (k.glow > 1.6 && k.s >= 0.5) {
      var pl = new THREE.PointLight(k.color, 0.75, 14);
      g.add(pl);
    }

    if (window.VorathFamily3D && typeof window.VorathFamily3D.decorate === 'function') {
      try {
        window.VorathFamily3D.decorate(g, k.s, true);
      } catch (e) {
        // gracefully continue without decoration
      }
    }

    return g;
  }

  // ----------------------------------------------------------
  // Boss Entities: The Equilibrist & The Geyser Warden
  // ----------------------------------------------------------
  function createEquilibrist() {
    var boss = new THREE.Group();
    boss.name = 'boss-equilibrist';

    var ringRadius = 8;
    var prismCount = 9;
    var bossMat = mat(0xa0a5b5, 1.9);

    for (var i = 0; i < prismCount; i++) {
      var angle = (i / prismCount) * Math.PI * 2;
      var pGeo = new THREE.ConeGeometry(0.8, 2.8, 5);
      var pMesh = new THREE.Mesh(pGeo, bossMat);
      pMesh.position.set(Math.cos(angle) * ringRadius, 0, Math.sin(angle) * ringRadius);
      pMesh.rotation.z = Math.PI / 2;
      pMesh.rotation.y = -angle;
      boss.add(pMesh);
    }

    // Core pulsing crystal
    var coreGeo = new THREE.OctahedronGeometry(2.2);
    var coreMat = mat(0xffffff, 2.5);
    var core = new THREE.Mesh(coreGeo, coreMat);
    boss.add(core);

    var light = new THREE.PointLight(0xd4d8e8, 2.2, 35);
    boss.add(light);

    boss.position.set(0, 38, 0);
    return {
      g: boss,
      kind: 'equilibrist',
      hp: 100,
      center: [0, 38, 0],
      radius: 20,
      speed: 0.18,
      update: function (dt, t) {
        boss.rotation.y += dt * 0.45;
        boss.rotation.x = Math.sin(t * 0.5) * 0.2;
        boss.position.y = 38 + Math.sin(t * 0.7) * 4.0;
        core.rotation.y -= dt * 0.8;
      }
    };
  }

  function createGeyserWarden() {
    var boss = new THREE.Group();
    boss.name = 'boss-geyser-warden';

    var bodyMat = mat(0xff6b2b, 2.2);
    var geo = new THREE.DodecahedronGeometry(3.2);
    var mainMesh = new THREE.Mesh(geo, bodyMat);
    boss.add(mainMesh);

    // Orbiting magma shards
    var shards = [];
    var shardMat = mat(0xffa23a, 2.8);
    for (var i = 0; i < 6; i++) {
      var sGeo = new THREE.TetrahedronGeometry(0.9);
      var sMesh = new THREE.Mesh(sGeo, shardMat);
      boss.add(sMesh);
      shards.push(sMesh);
    }

    var light = new THREE.PointLight(0xff5500, 2.8, 30);
    boss.add(light);

    boss.position.set(96, 14, -64);
    return {
      g: boss,
      kind: 'geyser_warden',
      hp: 150,
      center: [96, 14, -64],
      radius: 12,
      speed: 0.35,
      update: function (dt, t) {
        boss.rotation.y += dt * 0.6;
        mainMesh.rotation.x += dt * 0.3;
        for (var i = 0; i < shards.length; i++) {
          var ang = (i / shards.length) * Math.PI * 2 + t * 1.4;
          shards[i].position.set(Math.cos(ang) * 5.2, Math.sin(t * 2 + i) * 1.5, Math.sin(ang) * 5.2);
          shards[i].rotation.y += dt * 2.0;
        }
      }
    };
  }

  // ----------------------------------------------------------
  // Lifecycle API
  // ----------------------------------------------------------
  function init(cc) {
    CC = cc;
    scene = cc.scene;
    creatures = [];
    bossCreatures = [];
    t = 0;
    bossSpawned = false;

    root = new THREE.Group();
    root.name = 'cosmos-creatures';
    scene.add(root);

    // Populate normal drift ecology
    for (var i = 0; i < KINDS.length; i++) {
      var k = KINDS[i];
      for (var j = 0; j < k.n; j++) {
        var home = (HOMES[k.home] || HOMES.roam)();
        var g = makeForm(k);
        g.position.set(home[0], home[1], home[2]);
        root.add(g);
        creatures.push({
          g: g,
          k: k,
          home: home,
          ph: Math.random() * Math.PI * 2,
          sp: 0.35 + Math.random() * 0.45,
          r: 3 + Math.random() * 6,
          vel: new THREE.Vector3()
        });
      }
    }

    // Spawn Boss Entities
    spawnBosses();
  }

  function spawnBosses() {
    if (bossSpawned) return;
    bossSpawned = true;

    var eq = createEquilibrist();
    root.add(eq.g);
    bossCreatures.push(eq);

    var gw = createGeyserWarden();
    root.add(gw.g);
    bossCreatures.push(gw);
  }

  function update(dt, active, dayFraction) {
    if (!root) return;
    root.visible = active !== false;
    if (!root.visible) return;

    if (!dt || dt > 0.2) dt = 0.016;
    t += dt;

    var SP = (window.CosmosEcology && window.CosmosEcology.SPECIES) ? window.CosmosEcology.SPECIES : null;
    var isDay = dayFraction !== undefined ? (dayFraction >= 0.25 && dayFraction <= 0.75) : true;

    // Update normal creatures
    for (var i = 0; i < creatures.length; i++) {
      var c = creatures[i];
      var h = c.home;
      var tt = t * c.sp + c.ph;

      // Base orbital waypoint
      var tx = h[0] + Math.cos(tt) * c.r;
      var ty = h[1] + Math.sin(tt * 1.5) * 1.4;
      var tz = h[2] + Math.sin(tt) * c.r;

      // Ecological Laws & Boid Flocking
      var me = (SP && c.k.sp) ? SP[c.k.sp] : null;
      var steerX = 0;
      var steerZ = 0;
      var neighbors = 0;

      for (var j = 0; j < creatures.length; j++) {
        if (i === j) continue;
        var o = creatures[j];
        var dx = o.g.position.x - c.g.position.x;
        var dz = o.g.position.z - c.g.position.z;
        var distSq = dx * dx + dz * dz;

        if (distSq > 324 || distSq < 0.04) continue; // within 18m radius
        var dist = Math.sqrt(distSq);

        // 1. Separation from close peers
        if (dist < 2.5) {
          steerX -= (dx / dist) * 1.8;
          steerZ -= (dz / dist) * 1.8;
          neighbors++;
        }

        // 2. Cohesion with same species
        if (o.k.sp === c.k.sp && dist < 10) {
          steerX += (dx / dist) * 0.4;
          steerZ += (dz / dist) * 0.4;
          neighbors++;
        }

        // 3. Ecological Predation & Evasion
        if (me) {
          var advantageMult = (me.dayAdvantage === isDay) ? 1.4 : 0.7;

          // Chase prey
          if (me.eats && me.eats.indexOf(o.k.sp) >= 0) {
            steerX += (dx / dist) * 2.5 * advantageMult;
            steerZ += (dz / dist) * 2.5 * advantageMult;
            neighbors++;
          }
          // Evasion from predator
          if (me.eatenBy && me.eatenBy.indexOf(o.k.sp) >= 0) {
            steerX -= (dx / dist) * 3.2;
            steerZ -= (dz / dist) * 3.2;
            neighbors++;
          }
        }
      }

      if (neighbors > 0) {
        tx += steerX;
        tz += steerZ;
      }

      var ease = Math.min(1.0, dt * 1.6);
      c.g.position.x += (tx - c.g.position.x) * ease;
      c.g.position.y += (ty - c.g.position.y) * ease;
      c.g.position.z += (tz - c.g.position.z) * ease;

      c.g.rotation.y += dt * 0.7;
      c.g.rotation.x = Math.sin(tt) * 0.35;
    }

    // Update Boss Entities
    for (var b = 0; b < bossCreatures.length; b++) {
      bossCreatures[b].update(dt, t);
    }
  }

  return {
    init: init,
    update: update,
    spawnBosses: spawnBosses,
    count: function () {
      return creatures.length + bossCreatures.length;
    },
    getBosses: function () {
      return bossCreatures;
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (typeof window !== 'undefined' ? window : globalThis).CosmosCreatures;
}
