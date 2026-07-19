/* ============================================================
   CUBIC COSMOS — a NorthStar Prime transmission
   Original cubic-cosmos survival myth. No borrowed game IP.
   Black-gold obsidian · gem islands · aurora signal sky ·
   red-core creation jewel · faceless explorer.
   ============================================================ */
(function () {
  'use strict';

  // ------------------------------------------------------------
  // Constants & block registry (all ORIGINAL matter types)
  // ------------------------------------------------------------
  var SAVE_KEY = 'cubic_cosmos_save_v1';
  var CHUNK = 16;
  var DAY_LENGTH = 150;          // seconds per full cycle
  var REACH = 7;                 // block interaction range
  var GRAVITY = 22;
  var MOVE_SPEED = 5.4;
  var JUMP_SPEED = 7.6;
  var VOID_Y = -60;

  var AIR = 0;
  var BLOCKS = {
    1: { name: 'OBSIDIAN',       color: 0x1a1426, glow: false, jitter: 0.10 },
    2: { name: 'GOLD VEIN',      color: 0x8a6d1f, glow: false, jitter: 0.22 },
    3: { name: 'AURORA CRYSTAL', color: 0x46e8c0, glow: true,  jitter: 0.10 },
    4: { name: 'STARGEM',        color: 0x3f7de0, glow: true,  jitter: 0.14 },
    5: { name: 'PRISM TRUNK',    color: 0x5c4a2e, glow: false, jitter: 0.12 },
    6: { name: 'CRYSTAL FOLIAGE',color: 0x9a5fe0, glow: true,  jitter: 0.16 },
    7: { name: 'CREATION JEWEL', color: 0xff2244, glow: true,  jitter: 0.06 },
    8: { name: 'SIGNAL SHARD',   color: 0xffe9a0, glow: true,  jitter: 0.00 }, // hidden VORATH shard
    9: { name: 'LIMINAL STONE',  color: 0xd8d2c4, glow: false, jitter: 0.05 }, // pale maze matter
    10:{ name: 'NEON PANE',      color: 0x2fd4ff, glow: true,  jitter: 0.04 }, // city windows/screens
    11:{ name: 'CIVIC LUMEN',    color: 0xfff3c8, glow: true,  jitter: 0.02 }, // street/working lights
    12:{ name: 'MACHINE CORE',   color: 0xff3fd6, glow: true,  jitter: 0.30 }, // factory machinery (shimmers)
    13:{ name: 'VOID GLASS',     color: 0xbfe8f2, glow: true,  jitter: 0.02 }, // the Vitrine's shell
    14:{ name: 'TREASURE CHEST', color: 0xc98a2e, glow: true,  jitter: 0.18 }  // wreck loot (break to claim)
  };
  var SELECTABLE = [1, 2, 3, 4, 5, 6, 7];

  // ------------------------------------------------------------
  // Seeded RNG + value noise
  // ------------------------------------------------------------
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(x, y, seed) {
    var h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y, seed) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    var c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    var u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm2(x, y, seed) {
    return noise2(x, y, seed) * 0.6 + noise2(x * 2.1, y * 2.1, seed + 7) * 0.3 +
           noise2(x * 4.3, y * 4.3, seed + 13) * 0.1;
  }

  // ------------------------------------------------------------
  // World: sparse voxel store + procedural floating islands
  // ------------------------------------------------------------
  var world = {
    blocks: new Map(),          // "x,y,z" -> type
    edits: {},                  // player deltas for persistence
    seed: 0,
    islands: [],                // [{x,y,z,R,main}] recorded at gen time
    locations: [],              // named structure locations (structures.js)
    spawn: { x: 0.5, y: 12, z: 6.5 },
    key: function (x, y, z) { return x + ',' + y + ',' + z; },
    get: function (x, y, z) { return this.blocks.get(this.key(x, y, z)) || AIR; },
    set: function (x, y, z, t) {
      var k = this.key(x, y, z);
      if (t === AIR) this.blocks.delete(k); else this.blocks.set(k, t);
    },
    solid: function (x, y, z) { return this.get(x, y, z) !== AIR; }
  };

  function genTree(cx, cy, cz, rnd) {
    var h = 3 + Math.floor(rnd() * 2);
    for (var i = 0; i < h; i++) world.set(cx, cy + i, cz, 5);
    // luminous geometric canopy: octahedral diamond of foliage
    var top = cy + h;
    for (var dx = -2; dx <= 2; dx++)
      for (var dy = -2; dy <= 2; dy++)
        for (var dz = -2; dz <= 2; dz++) {
          var m = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
          if (m <= 2 && !(dx === 0 && dz === 0 && dy < 0)) {
            if (world.get(cx + dx, top + dy, cz + dz) === AIR)
              world.set(cx + dx, top + dy, cz + dz, 6);
          }
        }
  }

  function genIsland(cx, cy, cz, R, rnd, main) {
    var s = world.seed & 0xffff;
    var treeSpots = [];
    for (var x = -R; x <= R; x++) {
      for (var z = -R; z <= R; z++) {
        var wx = cx + x, wz = cz + z;
        var d = Math.sqrt(x * x + z * z) / R;
        if (d > 1) continue;
        var edge = 1 - d;
        var surf = fbm2(wx * 0.09, wz * 0.09, s);
        var topY = cy + Math.floor(surf * 4 * edge + edge * 2);
        var depth = Math.floor(Math.pow(edge, 1.4) * (5 + fbm2(wx * 0.15, wz * 0.15, s + 31) * 6)) + 1;
        for (var y = topY; y > topY - depth; y--) {
          var t = 1; // obsidian body
          var r = hash2(wx * 3 + y, wz * 3 - y, s + 77);
          if (y === topY) {
            if (r < 0.10) t = 2;            // surface gold veins
            else if (r < 0.135) t = 4;      // exposed stargem
          } else {
            if (r < 0.06) t = 2;
            else if (r < 0.10) t = 4;
          }
          world.set(wx, y, wz, t);
        }
        // aurora crystal spires on some rims
        if (edge < 0.35 && edge > 0.12 && hash2(wx, wz, s + 91) < 0.05) {
          var hh = 1 + Math.floor(hash2(wz, wx, s + 92) * 3);
          for (var yy = 1; yy <= hh; yy++) world.set(wx, topY + yy, wz, 3);
        }
        if (edge > 0.45 && hash2(wx, wz, s + 55) < (main ? 0.012 : 0.02))
          treeSpots.push([wx, topY + 1, wz]);
      }
    }
    for (var i = 0; i < treeSpots.length && i < (main ? 5 : 2); i++)
      genTree(treeSpots[i][0], treeSpots[i][1], treeSpots[i][2], rnd);
  }

  function genJewelSpire(cx, cy, cz) {
    // red-core creation jewel: gold-veined plinth, obsidian collar, glowing heart
    var y;
    for (y = 0; y < 3; y++) {
      world.set(cx, cy + y, cz, 2);
      world.set(cx + 1, cy + y, cz, 1); world.set(cx - 1, cy + y, cz, 1);
      world.set(cx, cy + y, cz + 1, 1); world.set(cx, cy + y, cz - 1, 1);
    }
    for (var dx = -1; dx <= 1; dx++)
      for (var dy = 0; dy <= 2; dy++)
        for (var dz = -1; dz <= 1; dz++) {
          var m = Math.abs(dx) + Math.abs(dy - 1) + Math.abs(dz);
          if (m <= 1) world.set(cx + dx, cy + 3 + dy, cz + dz, 7);
        }
    world.set(cx, cy + 6, cz, 3);
  }

  function generateWorld(seed) {
    world.blocks.clear();
    world.seed = seed;
    world.islands = [];
    world.locations = [];
    var rnd = mulberry32(seed);

    // main island with the creation jewel at its heart — a proper homeland
    genIsland(0, 8, 0, 22, rnd, true);
    world.islands.push({ x: 0, y: 8, z: 0, R: 22, main: true });
    genJewelSpire(0, findTop(0, 0, 8) + 1, 0);

    // satellite gem islands, ringed around the core
    var n = 6 + Math.floor(rnd() * 2);
    for (var i = 0; i < n; i++) {
      var ang = (i / n) * Math.PI * 2 + rnd() * 0.9;
      var dist = 36 + rnd() * 18;
      var ix = Math.round(Math.cos(ang) * dist);
      var iz = Math.round(Math.sin(ang) * dist);
      var iy = 6 + Math.floor(rnd() * 14);
      var iR = 6 + Math.floor(rnd() * 4);
      genIsland(ix, iy, iz, iR, rnd, false);
      world.islands.push({ x: ix, y: iy, z: iz, R: iR, main: false });
    }

    // frontier ring — far scattered islands worth sailing to
    var f = 9 + Math.floor(rnd() * 3);
    for (var j = 0; j < f; j++) {
      var fang = (j / f) * Math.PI * 2 + rnd() * 1.2;
      var fdist = 62 + rnd() * 38;
      var fx2 = Math.round(Math.cos(fang) * fdist);
      var fz2 = Math.round(Math.sin(fang) * fdist);
      // keep clear of the village (-40,40) and city (44,-38) plots
      if (Math.hypot(fx2 + 40, fz2 - 40) < 16 || Math.hypot(fx2 - 44, fz2 + 38) < 20) continue;
      var fy2 = 2 + Math.floor(rnd() * 24);
      var fR2 = 5 + Math.floor(rnd() * 8);
      genIsland(fx2, fy2, fz2, fR2, rnd, false);
      world.islands.push({ x: fx2, y: fy2, z: fz2, R: fR2, main: false });
    }

    // three haven islands — big empty canvases for building
    var HAVENS = [[-85, 10, -20, 15], [70, 14, 62, 16], [15, 4, 95, 14]];
    for (var h2 = 0; h2 < HAVENS.length; h2++) {
      var hv = HAVENS[h2];
      genIsland(hv[0], hv[1], hv[2], hv[3], rnd, false);
      world.islands.push({ x: hv[0], y: hv[1], z: hv[2], R: hv[3], main: false });
    }

    // hidden VORATH signal shard, buried in the main island
    var sa = rnd() * Math.PI * 2, sd = 5 + rnd() * 6;
    var sx = Math.round(Math.cos(sa) * sd), sz = Math.round(Math.sin(sa) * sd);
    var st = findTop(sx, sz, 8);
    if (st > VOID_Y) world.set(sx, st - 2, sz, 8);

    // phase-2 monuments: temple, pyramid, shrine, halls, spires,
    // garden — deterministic from the same seed
    if (window.CosmosStructures)
      world.locations = window.CosmosStructures.generate(world, seed, { findTop: findTop });

    // spawn on the main island, offset from the jewel
    var spx = 5, spz = 5;
    var spy = findTop(spx, spz, 8);
    world.spawn = { x: spx + 0.5, y: spy + 1.2, z: spz + 0.5 };
  }

  function findTop(x, z, guess) {
    for (var y = guess + 14; y > -20; y--) if (world.solid(x, y, z)) return y;
    return guess;
  }

  // ------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------
  function saveGame() {
    if (window.CosmosDimensions && window.CosmosDimensions.current !== 'over') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ seed: world.seed, edits: world.edits, gems: gems }));
    } catch (e) { /* storage full or blocked — realm remains ephemeral */ }
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (typeof data.seed !== 'number') return null;
      return data;
    } catch (e) { return null; }
  }
  function applyEdits() {
    for (var k in world.edits) {
      var p = k.split(',');
      world.set(+p[0], +p[1], +p[2], world.edits[k]);
    }
  }
  var saveTimer = null;
  function queueSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveGame, 600);
  }

  // ------------------------------------------------------------
  // three.js scene
  // ------------------------------------------------------------
  var canvas = document.getElementById('scene');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070512, 70, 300);

  var camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 600);

  var ambient = new THREE.AmbientLight(0x404060, 1.1);
  scene.add(ambient);
  var sun = new THREE.DirectionalLight(0xfff2d0, 0.9);
  sun.position.set(40, 80, 25);
  scene.add(sun);
  var coreLight = new THREE.PointLight(0xff2244, 1.6, 40, 1.6);
  coreLight.position.set(0, 16, 0);
  scene.add(coreLight);

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ------------------------------------------------------------
  // Aurora signal sky dome (custom shader)
  // ------------------------------------------------------------
  var skyUniforms = {
    uTime:  { value: 0 },
    uDay:   { value: 0 },  // 0 = deep night, 1 = bright phase
    uStorm: { value: 0 },  // aurora storm intensity (events.js)
    uTrip:  { value: 0 }   // prism drift day intensity (tripday.js)
  };
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: skyUniforms,
    vertexShader: [
      'varying vec3 vDir;',
      'void main() {',
      '  vDir = normalize(position);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vDir;',
      'uniform float uTime;',
      'uniform float uDay;',
      'uniform float uStorm;',
      'uniform float uTrip;',
      'float hash(vec3 p) {',
      '  p = fract(p * vec3(443.897, 441.423, 437.195));',
      '  p += dot(p, p.yzx + 19.19);',
      '  return fract((p.x + p.y) * p.z);',
      '}',
      'void main() {',
      '  vec3 d = normalize(vDir);',
      '  float h = d.y;',
      // base cosmic gradient (night) -> brightened (day)
      '  vec3 nightLo = vec3(0.05, 0.03, 0.10);',
      '  vec3 nightHi = vec3(0.01, 0.01, 0.05);',
      '  vec3 dayLo   = vec3(0.18, 0.12, 0.30);',
      '  vec3 dayHi   = vec3(0.05, 0.09, 0.22);',
      '  vec3 lo = mix(nightLo, dayLo, uDay);',
      '  vec3 hi = mix(nightHi, dayHi, uDay);',
      '  vec3 col = mix(lo, hi, smoothstep(-0.1, 0.8, h));',
      // cubic stars: quantized direction cells, fade by day
      '  vec3 cell = floor(d * 90.0);',
      '  float star = step(0.994, hash(cell));',
      '  float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 1.0) * 40.0);',
      '  col += star * tw * (1.0 - uDay * 0.75) * vec3(0.9, 0.95, 1.0);',
      // aurora signal bands: flowing ribbons above the horizon
      '  float az = atan(d.z, d.x);',
      '  float band = 0.0;',
      '  for (int i = 0; i < 3; i++) {',
      '    float fi = float(i);',
      '    float center = 0.28 + fi * 0.16 + 0.06 * sin(az * (2.0 + fi) + uTime * (0.22 + fi * 0.07));',
      '    float w = 0.045 + 0.02 * sin(az * 5.0 - uTime * 0.3 + fi * 2.1);',
      '    band += exp(-pow((h - center) / w, 2.0)) * (0.55 + 0.45 * sin(az * 3.0 + uTime * 0.5 + fi));',
      '  }',
      '  band = clamp(band * (1.0 + uStorm * 1.4), 0.0, 1.6 + uStorm);',
      '  float huePhase = az * 0.8 + uTime * 0.15;',
      '  vec3 auroraCol = vec3(0.5 + 0.5 * sin(huePhase),',
      '                        0.5 + 0.5 * sin(huePhase + 2.094),',
      '                        0.5 + 0.5 * sin(huePhase + 4.188));',
      '  auroraCol = mix(vec3(0.2, 1.0, 0.7), auroraCol, 0.55);',
      '  col += band * auroraCol * (0.35 + 0.25 * uDay + 0.5 * uStorm) * smoothstep(0.02, 0.2, h);',
      // faint gold horizon ring — the NorthStar signal line
      '  col += vec3(0.83, 0.69, 0.22) * exp(-pow(h / 0.035, 2.0)) * 0.16;',
      // PRISM DRIFT DAY — rainbow cotton-candy sky (tripday.js drives uTrip)
      '  float candyPhase = uTime * 0.35 + az * 2.0 + h * 6.0 + 2.5 * sin(h * 3.0 + uTime * 0.2);',
      '  vec3 candy = vec3(0.5 + 0.5 * sin(candyPhase),',
      '                    0.5 + 0.5 * sin(candyPhase + 2.094),',
      '                    0.5 + 0.5 * sin(candyPhase + 4.188));',
      '  candy = mix(vec3(0.98, 0.80, 0.92), candy, 0.55);',
      '  float fluff = 0.75 + 0.25 * sin(az * 7.0 + uTime * 0.5) * sin(h * 11.0 - uTime * 0.4);',
      '  col = mix(col, candy * fluff, clamp(uTrip, 0.0, 1.0) * 0.85);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  var sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), skyMat);
  scene.add(sky);

  // ------------------------------------------------------------
  // Chunk mesher: merged BufferGeometry per chunk, vertex colors.
  // Two meshes per chunk: lit (lambert) and glow (unlit basic).
  // ------------------------------------------------------------
  var FACES = [
    { dir: [-1, 0, 0], corners: [[0,1,0],[0,0,0],[0,1,1],[0,0,1]], shade: 0.72 },
    { dir: [ 1, 0, 0], corners: [[1,1,1],[1,0,1],[1,1,0],[1,0,0]], shade: 0.72 },
    { dir: [ 0,-1, 0], corners: [[1,0,1],[0,0,1],[1,0,0],[0,0,0]], shade: 0.55 },
    { dir: [ 0, 1, 0], corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]], shade: 1.00 },
    { dir: [ 0, 0,-1], corners: [[1,0,0],[0,0,0],[1,1,0],[0,1,0]], shade: 0.82 },
    { dir: [ 0, 0, 1], corners: [[0,0,1],[1,0,1],[0,1,1],[1,1,1]], shade: 0.82 }
  ];
  var litMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  var glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  var chunkMeshes = new Map();  // "cx,cy,cz" -> { lit, glow }
  var tmpColor = new THREE.Color();

  function chunkKey(cx, cy, cz) { return cx + ',' + cy + ',' + cz; }
  function chunkOf(v) { return Math.floor(v / CHUNK); }

  function buildChunk(cx, cy, cz) {
    var key = chunkKey(cx, cy, cz);
    var old = chunkMeshes.get(key);
    if (old) {
      scene.remove(old.lit); scene.remove(old.glow);
      old.lit.geometry.dispose(); old.glow.geometry.dispose();
      chunkMeshes.delete(key);
    }
    var lit = { pos: [], nrm: [], col: [], idx: [] };
    var glow = { pos: [], nrm: [], col: [], idx: [] };
    var x0 = cx * CHUNK, y0 = cy * CHUNK, z0 = cz * CHUNK;

    for (var x = x0; x < x0 + CHUNK; x++)
      for (var y = y0; y < y0 + CHUNK; y++)
        for (var z = z0; z < z0 + CHUNK; z++) {
          var t = world.get(x, y, z);
          if (t === AIR) continue;
          var def = BLOCKS[t];
          var buf = def.glow ? glow : lit;
          var jit = 1 + (hash2(x * 7 + y, z * 7 - y, 999) - 0.5) * def.jitter * 2;
          tmpColor.setHex(def.color);
          for (var f = 0; f < 6; f++) {
            var face = FACES[f];
            if (world.solid(x + face.dir[0], y + face.dir[1], z + face.dir[2])) continue;
            var base = buf.pos.length / 3;
            var shade = def.glow ? (0.85 + face.shade * 0.15) : face.shade;
            for (var c = 0; c < 4; c++) {
              var cr = face.corners[c];
              buf.pos.push(x + cr[0], y + cr[1], z + cr[2]);
              buf.nrm.push(face.dir[0], face.dir[1], face.dir[2]);
              buf.col.push(tmpColor.r * shade * jit, tmpColor.g * shade * jit, tmpColor.b * shade * jit);
            }
            buf.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }

    function makeMesh(buf, mat) {
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(buf.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(buf.nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(buf.col, 3));
      g.setIndex(buf.idx);
      var m = new THREE.Mesh(g, mat);
      m.frustumCulled = true;
      return m;
    }
    if (lit.pos.length === 0 && glow.pos.length === 0) return;
    var entry = { lit: makeMesh(lit, litMat), glow: makeMesh(glow, glowMat) };
    scene.add(entry.lit); scene.add(entry.glow);
    chunkMeshes.set(key, entry);
  }

  function buildAllChunks() {
    // clear old meshes
    chunkMeshes.forEach(function (e) {
      scene.remove(e.lit); scene.remove(e.glow);
      e.lit.geometry.dispose(); e.glow.geometry.dispose();
    });
    chunkMeshes.clear();
    var set = new Set();
    world.blocks.forEach(function (t, k) {
      var p = k.split(',');
      set.add(chunkKey(chunkOf(+p[0]), chunkOf(+p[1]), chunkOf(+p[2])));
    });
    set.forEach(function (ck) {
      var p = ck.split(',');
      buildChunk(+p[0], +p[1], +p[2]);
    });
  }

  function rebuildAround(x, y, z) {
    var cx = chunkOf(x), cy = chunkOf(y), cz = chunkOf(z);
    var seen = new Set();
    for (var dx = -1; dx <= 1; dx++)
      for (var dy = -1; dy <= 1; dy++)
        for (var dz = -1; dz <= 1; dz++) {
          var nx = chunkOf(x + dx), ny = chunkOf(y + dy), nz = chunkOf(z + dz);
          var k = chunkKey(nx, ny, nz);
          if (!seen.has(k)) { seen.add(k); buildChunk(nx, ny, nz); }
        }
    void cx; void cy; void cz;
  }

  // ------------------------------------------------------------
  // Player: faceless explorer (first-person, so unseen by design)
  // ------------------------------------------------------------
  var player = {
    pos: new THREE.Vector3(0.5, 14, 6.5),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0,
    onGround: false,
    halfW: 0.3, height: 1.8, eye: 1.62
  };
  var keys = {};
  var selected = 1;
  var signal = 100;
  var gems = 0;               // trivia rewards (persisted)
  var locked = false;
  var started = false;

  function respawn() {
    player.pos.set(world.spawn.x, world.spawn.y, world.spawn.z);
    player.vel.set(0, 0, 0);
  }

  function collideAxis(axis, delta) {
    if (delta === 0) return;
    player.pos[axis] += delta;
    var minX = Math.floor(player.pos.x - player.halfW);
    var maxX = Math.floor(player.pos.x + player.halfW);
    var minY = Math.floor(player.pos.y);
    var maxY = Math.floor(player.pos.y + player.height);
    var minZ = Math.floor(player.pos.z - player.halfW);
    var maxZ = Math.floor(player.pos.z + player.halfW);
    for (var x = minX; x <= maxX; x++)
      for (var y = minY; y <= maxY; y++)
        for (var z = minZ; z <= maxZ; z++) {
          if (!world.solid(x, y, z)) continue;
          if (axis === 'x') {
            player.pos.x = delta > 0 ? x - player.halfW - 0.001 : x + 1 + player.halfW + 0.001;
            player.vel.x = 0;
          } else if (axis === 'z') {
            player.pos.z = delta > 0 ? z - player.halfW - 0.001 : z + 1 + player.halfW + 0.001;
            player.vel.z = 0;
          } else {
            if (delta > 0) {
              player.pos.y = y - player.height - 0.001;
            } else {
              player.pos.y = y + 1 + 0.001;
              player.onGround = true;
            }
            player.vel.y = 0;
          }
          return;
        }
  }

  function updatePlayer(dt) {
    var fx = 0, fz = 0;
    if (keys['KeyW']) fz -= 1;
    if (keys['KeyS']) fz += 1;
    if (keys['KeyA']) fx -= 1;
    if (keys['KeyD']) fx += 1;
    var len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    var sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    var vx = (fx * cos - fz * sin) * MOVE_SPEED;
    var vz = (fx * sin + fz * cos) * MOVE_SPEED;
    player.vel.x = vx;
    player.vel.z = vz;
    if (keys['Space'] && player.onGround) {
      player.vel.y = JUMP_SPEED * ((CC.buffs && CC.buffs.jump) || 1);
      player.onGround = false;
    }
    player.vel.y -= GRAVITY * (window.CosmosTrip ? window.CosmosTrip.gravityScale() : 1) * dt;
    if (player.vel.y < -40) player.vel.y = -40;

    player.onGround = false;
    collideAxis('y', player.vel.y * dt);
    collideAxis('x', player.vel.x * dt);
    collideAxis('z', player.vel.z * dt);

    if (player.pos.y < VOID_Y) {
      signal = Math.max(0, signal - 25);
      toast(signal > 0 ? 'the void tasted you — signal weakened' : 'signal lost… the jewel pulls you back');
      if (signal <= 0) signal = 100;
      respawn();
    }

    camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(-player.yaw);
    camera.rotateX(player.pitch);
  }

  // ------------------------------------------------------------
  // Voxel raycast (Amanatides & Woo DDA)
  // ------------------------------------------------------------
  function raycast() {
    var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    var ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
    var x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    var stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    var tDX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    var tDY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    var tDZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    var tX = dir.x !== 0 ? (dir.x > 0 ? (x + 1 - ox) : (ox - x)) * tDX : Infinity;
    var tY = dir.y !== 0 ? (dir.y > 0 ? (y + 1 - oy) : (oy - y)) * tDY : Infinity;
    var tZ = dir.z !== 0 ? (dir.z > 0 ? (z + 1 - oz) : (oz - z)) * tDZ : Infinity;
    var nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= REACH) {
      if (world.solid(x, y, z))
        return { x: x, y: y, z: z, nx: nx, ny: ny, nz: nz };
      if (tX < tY && tX < tZ) {
        x += stepX; t = tX; tX += tDX; nx = -stepX; ny = 0; nz = 0;
      } else if (tY < tZ) {
        y += stepY; t = tY; tY += tDY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tZ; tZ += tDZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    return null;
  }

  // highlight wireframe on aimed block
  var hiliteGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
  var hilite = new THREE.LineSegments(
    new THREE.EdgesGeometry(hiliteGeo),
    new THREE.LineBasicMaterial({ color: 0xd4af37, transparent: true, opacity: 0.85 })
  );
  hilite.visible = false;
  scene.add(hilite);

  function editBlock(hit, place) {
    if (!hit) return;
    if (place) {
      var px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
      // don't place inside the explorer
      var inX = px + 1 > player.pos.x - player.halfW && px < player.pos.x + player.halfW;
      var inY = py + 1 > player.pos.y && py < player.pos.y + player.height;
      var inZ = pz + 1 > player.pos.z - player.halfW && pz < player.pos.z + player.halfW;
      if (inX && inY && inZ) return;
      if (world.get(px, py, pz) !== AIR) return;
      world.set(px, py, pz, selected);
      world.edits[world.key(px, py, pz)] = selected;
      rebuildAround(px, py, pz);
    } else {
      var t = world.get(hit.x, hit.y, hit.z);
      if (t === 8) {
        toast('◆ VORATH ACKNOWLEDGES — the shard sings through the aurora ◆');
        console.log('%c◆ VORATH signal shard recovered. The convergence hums. ◆',
          'color:#ffe9a0;background:#0a0618;padding:4px 10px;letter-spacing:2px;');
        signal = 100;
      } else if (t === 7) {
        toast('the creation jewel resists — its core is older than you');
        return;
      } else if (t === 14) {
        var loot = 8 + Math.floor(Math.random() * 18);
        CC.addGems(loot);
        toast('treasure! +' + loot + ' gems from the wreck');
      }
      world.set(hit.x, hit.y, hit.z, AIR);
      world.edits[world.key(hit.x, hit.y, hit.z)] = AIR;
      rebuildAround(hit.x, hit.y, hit.z);
    }
    queueSave();
  }

  // ------------------------------------------------------------
  // UI: title / pause / selector / signal / toast
  // ------------------------------------------------------------
  var elTitle = document.getElementById('title');
  var elPause = document.getElementById('pause');
  var elHud = document.getElementById('hud');
  var elSignal = document.getElementById('signal-fill');
  var elSelector = document.getElementById('selector');
  var elToast = document.getElementById('toast');
  var elGems = document.getElementById('gem-count');
  var toastTimer = null;

  function updateGems() { if (elGems) elGems.textContent = gems; }

  function toast(msg) {
    elToast.textContent = msg;
    elToast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { elToast.classList.remove('show'); }, 3200);
  }

  function buildSelector() {
    elSelector.innerHTML = '';
    SELECTABLE.forEach(function (id, i) {
      var def = BLOCKS[id];
      var d = document.createElement('div');
      d.className = 'swatch' + (id === selected ? ' sel' : '');
      d.dataset.block = id;
      var c = new THREE.Color(def.color);
      var css = 'rgb(' + Math.round(c.r * 255) + ',' + Math.round(c.g * 255) + ',' + Math.round(c.b * 255) + ')';
      d.style.background = def.glow
        ? 'radial-gradient(circle at 35% 35%, #fff8, ' + css + ')'
        : 'linear-gradient(135deg, ' + css + ', #000c)';
      if (def.glow) d.style.boxShadow = '0 0 12px ' + css;
      d.innerHTML = '<span class="num">' + (i + 1) + '</span><span class="swatch-name">' + def.name + '</span>';
      elSelector.appendChild(d);
    });
  }
  function selectBlock(id) {
    selected = id;
    var kids = elSelector.children;
    for (var i = 0; i < kids.length; i++)
      kids[i].classList.toggle('sel', +kids[i].dataset.block === id);
  }

  function newRealm() {
    var seed = (Math.random() * 0xffffffff) >>> 0;
    world.edits = {};
    generateWorld(seed);
    buildAllChunks();
    respawn();
    if (window.CosmosNPCs) window.CosmosNPCs.rebuild();
    saveGame();
    toast('a new realm crystallizes — seed ' + seed.toString(16));
  }

  document.getElementById('btn-enter').addEventListener('click', function () {
    started = true;
    elTitle.classList.add('hidden');
    elHud.classList.remove('hidden');
    canvas.requestPointerLock();
  });
  document.getElementById('btn-resume').addEventListener('click', function () {
    elPause.classList.add('hidden');
    canvas.requestPointerLock();
  });
  document.getElementById('btn-newrealm').addEventListener('click', newRealm);
  document.getElementById('btn-newrealm2').addEventListener('click', newRealm);

  document.addEventListener('pointerlockchange', function () {
    locked = document.pointerLockElement === canvas;
    if (!locked && started) {
      if (window.CosmosNPCs) window.CosmosNPCs.closeDialogue();
      if (window.CosmosEvents) window.CosmosEvents.closeTrivia();
      elPause.classList.remove('hidden');
    } else if (locked) {
      elPause.classList.add('hidden');
    }
  });

  document.addEventListener('mousemove', function (e) {
    if (!locked) return;
    player.yaw += e.movementX * 0.0024;
    player.pitch -= e.movementY * 0.0024;
    var lim = Math.PI / 2 - 0.01;
    if (player.pitch > lim) player.pitch = lim;
    if (player.pitch < -lim) player.pitch = -lim;
  });

  document.addEventListener('mousedown', function (e) {
    if (!locked || CC.modal) return;
    if (window.CosmosSaucer && window.CosmosSaucer.active) {
      if (e.button === 0) window.CosmosSaucer.fire();
      return;
    }
    var hit = raycast();
    if (e.button === 0) editBlock(hit, false);
    else if (e.button === 2) editBlock(hit, true);
  });
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  document.addEventListener('keydown', function (e) {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (CC.modal) return; // dialogue / trivia own the number keys
    if (e.code === 'KeyF' && locked && window.CosmosSaucer)
      window.CosmosSaucer.toggleBoard();
    var num = parseInt(e.key, 10);
    if (num >= 1 && num <= SELECTABLE.length) selectBlock(SELECTABLE[num - 1]);
  });
  document.addEventListener('keyup', function (e) { keys[e.code] = false; });

  document.addEventListener('wheel', function (e) {
    if (!locked || CC.modal) return;
    var i = SELECTABLE.indexOf(selected);
    i = (i + (e.deltaY > 0 ? 1 : -1) + SELECTABLE.length) % SELECTABLE.length;
    selectBlock(SELECTABLE[i]);
  });

  // ------------------------------------------------------------
  // Bridge for phase-2 modules (structures / npc / events)
  // ------------------------------------------------------------
  var dayValue = 0;
  var phaseValue = 0;
  var CC = {
    world: world, scene: scene, camera: camera, player: player,
    BLOCKS: BLOCKS, toast: toast, findTop: findTop,
    rebuildAround: rebuildAround, skyUniforms: skyUniforms, glowMat: glowMat,
    litMat: litMat, getPhase: function () { return phaseValue; },
    buildAllChunks: buildAllChunks, respawn: respawn, buffs: {},
    unlockBlock: function (id) {
      if (BLOCKS[id] && SELECTABLE.indexOf(id) < 0) { SELECTABLE.push(id); buildSelector(); }
    },
    modal: null,                                   // 'dialogue' | 'trivia' | null
    setModal: function (m) { CC.modal = m; },
    getSignal: function () { return signal; },
    setSignal: function (v) { signal = Math.max(0, Math.min(100, v)); },
    getDay: function () { return dayValue; },
    isLocked: function () { return locked && started; },
    getGems: function () { return gems; },
    addGems: function (n) { gems = Math.max(0, gems + n); updateGems(); queueSave(); },
    queueSave: queueSave
  };
  window.CC = CC;

  // ------------------------------------------------------------
  // Boot: load or generate realm
  // ------------------------------------------------------------
  var save = loadSave();
  if (save) {
    generateWorld(save.seed);
    world.edits = save.edits || {};
    gems = save.gems || 0;
    applyEdits();
  } else {
    generateWorld((Math.random() * 0xffffffff) >>> 0);
    saveGame();
  }
  buildAllChunks();
  respawn();
  buildSelector();
  updateGems();
  if (window.CosmosNPCs) window.CosmosNPCs.init(CC);
  if (window.CosmosEvents) window.CosmosEvents.init(CC);
  if (window.CosmosSaucer) window.CosmosSaucer.init(CC, keys);
  if (window.CosmosTrip) window.CosmosTrip.init(CC);
  if (window.CosmosObservers) window.CosmosObservers.init(CC);
  if (window.CosmosDimensions) window.CosmosDimensions.init(CC);

  console.log('%cCUBIC COSMOS · NorthStar Prime transmission online',
    'color:#d4af37;background:#0a0618;padding:4px 10px;letter-spacing:2px;');
  console.log('%c…a faint VORATH signal rides aurora band 7. A shard lies buried near the jewel.',
    'color:#46e8c0;font-style:italic;');

  // ------------------------------------------------------------
  // Main loop: day cycle, aurora, physics, render
  // ------------------------------------------------------------
  var clock = new THREE.Clock();
  var elapsed = 0;
  var fogColor = new THREE.Color();
  var nightFog = new THREE.Color(0x070512);
  var dayFog = new THREE.Color(0x1a1438);

  function animate() {
    requestAnimationFrame(animate);
    var dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    // day cycle
    var phase = (elapsed % DAY_LENGTH) / DAY_LENGTH;         // 0..1
    var day = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);     // 0 night → 1 day
    dayValue = day;
    phaseValue = phase;
    if (window.CosmosTrip) window.CosmosTrip.update(dt);
    skyUniforms.uTime.value = elapsed;
    skyUniforms.uDay.value = day;
    sun.intensity = 0.25 + day * 0.85;
    ambient.intensity = 0.75 + day * 0.6;
    fogColor.copy(nightFog).lerp(dayFog, day);
    scene.fog.color.copy(fogColor);
    coreLight.intensity = 1.2 + Math.sin(elapsed * 2.2) * 0.35;

    var flying = window.CosmosSaucer && window.CosmosSaucer.active;
    if (started && locked && !CC.modal && !flying) updatePlayer(dt);
    if (window.CosmosSaucer) window.CosmosSaucer.update(dt, started && locked && !CC.modal);
    sky.position.copy(camera.position);

    // phase-2 systems: wardens + event director
    if (window.CosmosNPCs) window.CosmosNPCs.update(dt, started && locked && !CC.modal);
    if (window.CosmosEvents) window.CosmosEvents.update(dt, day, started && locked);
    if (window.CosmosObservers) window.CosmosObservers.update(dt, started && locked && !CC.modal);
    if (window.CosmosDimensions) window.CosmosDimensions.update(dt, started && locked && !CC.modal);

    // aimed-block highlight
    if (started && locked && !CC.modal) {
      var hit = raycast();
      if (hit) {
        hilite.visible = true;
        hilite.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else hilite.visible = false;
    } else hilite.visible = false;

    // signal integrity: fades in deep night, recharges by day / near the jewel
    if (started) {
      var nearJewel = player.pos.length() < 12;
      signal += (day > 0.35 || nearJewel ? 2.2 : -0.7) * dt;
      signal = Math.max(5, Math.min(100, signal));
      elSignal.style.width = signal + '%';
      elSignal.style.filter = signal < 30 ? 'hue-rotate(-35deg) saturate(1.4)' : 'none';
    }

    renderer.render(scene, camera);
  }
  animate();
})();
