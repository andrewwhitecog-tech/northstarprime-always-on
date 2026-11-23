/* NorthStar Brick Alchemy — CAD Studio v2.2 Engine
 * Genuine LDraw-proportioned procedural 3D Brick & Mechanical CAD engine:
 * - 1 stud = 1.0 unit = 8.0 mm = 20 LDU | 1 plate = 0.4 unit = 3.2 mm = 8 LDU | 1 brick = 1.2 units = 9.6 mm = 24 LDU
 * - Procedural HDR softbox studio environment map (PMREMGenerator) + PCFSoftShadowMap + ACESFilmicToneMapping
 * - 25 sculpted placeable parts: beveled bricks/plates/tiles, round plates/tiles (6141/98138), 24-facet gems (30153),
 *   involute meshing gears (8T/12T/16T/24T/36T/40T) with spoked holes & cross-axle bores,
 *   perforated liftarms (7L/11L/15L), cruciform cross-axles (4L/6L/8L), friction pins (2780), and 45-deg slopes
 * - Orthographic/Perspective camera toggle, CAD views (Iso/Front/Top/Side), Studio/Edges/Wireframe/X-Ray modes
 * - Step-by-step Build Instructions sequencer, Raycast Part Inspector, Interactive Stud-Snap Builder (500-part cap)
 * - Real LDraw (.ldr/.mpd) IMPORT + Full 3x3 Matrix Export (with 0x2RRGGBB hex colors), XML-escaped BrickLink (.xml),
 *   quoted Rebrickable BOM (.csv), and HD PNG exports
 */
(function (global) {
  "use strict";

  const STUD = 1.0;
  const PLATE = 0.4;
  const BRICK = 1.2;
  const SEAM = 0.024;
  const STUD_R = 0.295;
  const STUD_H = 0.21;
  const MAX_CUSTOM_PARTS = 500;
  const MAX_IMPORT_PARTS = 2500;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

  // Official Rebrickable / LDraw Color Palette (color_id -> physical properties)
  const LDRAW_COLORS = {
    0:   { id: 0,   bl: 11,  name: "Black",              hex: "#10141c", trans: false, metal: false },
    1:   { id: 1,   bl: 7,   name: "Blue",               hex: "#0055BF", trans: false, metal: false },
    2:   { id: 2,   bl: 6,   name: "Green",              hex: "#237841", trans: false, metal: false },
    4:   { id: 4,   bl: 5,   name: "Red",                hex: "#C91A09", trans: false, metal: false },
    14:  { id: 14,  bl: 3,   name: "Yellow",             hex: "#F2CD37", trans: false, metal: false },
    15:  { id: 15,  bl: 1,   name: "White",              hex: "#F4F6FA", trans: false, metal: false },
    71:  { id: 71,  bl: 86,  name: "Light Bluish Gray",  hex: "#A0A5A9", trans: false, metal: false },
    72:  { id: 72,  bl: 85,  name: "Dark Bluish Gray",   hex: "#595D60", trans: false, metal: false },
    297: { id: 297, bl: 115, name: "Pearl Gold",         hex: "#D6A13C", trans: false, metal: true  },
    383: { id: 383, bl: 22,  name: "Chrome Silver",      hex: "#DCE2EC", trans: false, metal: true  },
    33:  { id: 33,  bl: 14,  name: "Trans-Dark Blue",    hex: "#0A38D8", trans: true,  metal: false },
    34:  { id: 34,  bl: 20,  name: "Trans-Green",        hex: "#1FD168", trans: true,  metal: false },
    35:  { id: 35,  bl: 108, name: "Trans-Bright Green", hex: "#50FF90", trans: true,  metal: false },
    36:  { id: 36,  bl: 17,  name: "Trans-Red",          hex: "#E62222", trans: true,  metal: false },
    41:  { id: 41,  bl: 15,  name: "Trans-Light Blue",   hex: "#45E3FF", trans: true,  metal: false },
    45:  { id: 45,  bl: 50,  name: "Trans-Dark Pink",    hex: "#F048A8", trans: true,  metal: false },
    46:  { id: 46,  bl: 19,  name: "Trans-Yellow",       hex: "#FFE138", trans: true,  metal: false },
    47:  { id: 47,  bl: 12,  name: "Trans-Clear",        hex: "#E8F6FF", trans: true,  metal: false },
    52:  { id: 52,  bl: 51,  name: "Trans-Purple",       hex: "#A855F7", trans: true,  metal: false },
    57:  { id: 57,  bl: 18,  name: "Trans-Neon Orange",  hex: "#FF7B1C", trans: true,  metal: false },
    143: { id: 143, bl: 74,  name: "Trans-Medium Blue",  hex: "#2B9BFF", trans: true,  metal: false }
  };

  // Interactive Sandbox Placeable Catalog (25 sculpted LDraw parts)
  const BUILDER_PARTS = [
    { key: "brick_2x4",  partNum: "3001",  name: "Brick 2 x 4",              kind: "brick",   sx: 2, plates: 3, sz: 4, grams: 2.32 },
    { key: "brick_2x2",  partNum: "3003",  name: "Brick 2 x 2",              kind: "brick",   sx: 2, plates: 3, sz: 2, grams: 1.15 },
    { key: "brick_1x2",  partNum: "3004",  name: "Brick 1 x 2",              kind: "brick",   sx: 1, plates: 3, sz: 2, grams: 0.78 },
    { key: "brick_1x1",  partNum: "3005",  name: "Brick 1 x 1",              kind: "brick",   sx: 1, plates: 3, sz: 1, grams: 0.43 },
    { key: "plate_2x4",  partNum: "3020",  name: "Plate 2 x 4",              kind: "brick",   sx: 2, plates: 1, sz: 4, grams: 1.08 },
    { key: "plate_2x2",  partNum: "3022",  name: "Plate 2 x 2",              kind: "brick",   sx: 2, plates: 1, sz: 2, grams: 0.57 },
    { key: "plate_1x2",  partNum: "3023",  name: "Plate 1 x 2",              kind: "brick",   sx: 1, plates: 1, sz: 2, grams: 0.30 },
    { key: "plate_1x1",  partNum: "3024",  name: "Plate 1 x 1",              kind: "brick",   sx: 1, plates: 1, sz: 1, grams: 0.17 },
    { key: "tile_1x2",   partNum: "3069b", name: "Tile 1 x 2 Smooth",        kind: "brick",   sx: 1, plates: 1, sz: 2, smoothTop: true, grams: 0.28 },
    { key: "slope_2x2",  partNum: "3039",  name: "Slope 45 deg 2 x 2",       kind: "slope",   sx: 2, plates: 3, sz: 2, grams: 1.02 },
    { key: "slope_1x2",  partNum: "3040",  name: "Slope 45 deg 1 x 2",       kind: "slope",   sx: 1, plates: 3, sz: 2, grams: 0.56 },
    { key: "plate_r1",   partNum: "6141",  name: "Plate Round 1 x 1",        kind: "rplate",  sx: 1, plates: 1, sz: 1, grams: 0.16 },
    { key: "tile_r1",    partNum: "98138", name: "Tile Round 1 x 1",         kind: "rtile",   sx: 1, plates: 1, sz: 1, grams: 0.14 },
    { key: "gem_1x1",    partNum: "30153", name: "Rock 1 x 1 Crystal Gem",   kind: "gem",     sx: 1, plates: 3, sz: 1, grams: 0.31 },
    { key: "gear_8",     partNum: "3647",  name: "Gear 8 Tooth",             kind: "gear",    teeth: 8,  sx: 1, plates: 2, sz: 1, grams: 0.28 },
    { key: "gear_12",    partNum: "32270", name: "Gear 12 Tooth Bevel",      kind: "gear",    teeth: 12, sx: 2, plates: 2, sz: 2, grams: 0.45 },
    { key: "gear_16",    partNum: "94925", name: "Gear 16 Tooth",            kind: "gear",    teeth: 16, sx: 2, plates: 2, sz: 2, grams: 0.68 },
    { key: "gear_24",    partNum: "3648",  name: "Gear 24 Tooth",            kind: "gear",    teeth: 24, sx: 3, plates: 2, sz: 3, grams: 1.38 },
    { key: "gear_36",    partNum: "32498", name: "Gear 36 Tooth Double",     kind: "gear",    teeth: 36, sx: 5, plates: 2, sz: 5, grams: 2.42 },
    { key: "gear_40",    partNum: "3649",  name: "Gear 40 Tooth",            kind: "gear",    teeth: 40, sx: 5, plates: 2, sz: 5, grams: 3.15 },
    { key: "liftarm_7",  partNum: "32524", name: "Liftarm Thick 7L",         kind: "liftarm", len: 7,  sx: 7,  plates: 2, sz: 1, grams: 1.85 },
    { key: "liftarm_11", partNum: "32525", name: "Liftarm Thick 11L",        kind: "liftarm", len: 11, sx: 11, plates: 2, sz: 1, grams: 2.95 },
    { key: "liftarm_15", partNum: "32278", name: "Liftarm Thick 15L",        kind: "liftarm", len: 15, sx: 15, plates: 2, sz: 1, grams: 4.10 },
    { key: "axle_6",     partNum: "3706",  name: "Cross-Axle 6L",            kind: "axle",    len: 6,  sx: 1,  plates: 1, sz: 6, grams: 0.72 },
    { key: "pin_fric",   partNum: "2780",  name: "Friction Pin w/ Ridges",   kind: "pin",     sx: 1,  plates: 1, sz: 1, grams: 0.21 }
  ];

  // LDraw .dat -> procedural CAD geometry spec lookup for real .ldr / .mpd import
  const LDRAW_PART_SPECS = (function () {
    const map = {};
    BUILDER_PARTS.forEach(p => { map[p.partNum.toLowerCase()] = p; });
    const extras = [
      { partNum: "3002",  name: "Brick 2 x 3",        kind: "brick", sx: 2, plates: 3, sz: 3, grams: 1.72 },
      { partNum: "3008",  name: "Brick 1 x 8",        kind: "brick", sx: 1, plates: 3, sz: 8, grams: 3.10 },
      { partNum: "3009",  name: "Brick 1 x 6",        kind: "brick", sx: 1, plates: 3, sz: 6, grams: 2.34 },
      { partNum: "3010",  name: "Brick 1 x 4",        kind: "brick", sx: 1, plates: 3, sz: 4, grams: 1.56 },
      { partNum: "3622",  name: "Brick 1 x 3",        kind: "brick", sx: 1, plates: 3, sz: 3, grams: 1.18 },
      { partNum: "3021",  name: "Plate 2 x 3",        kind: "brick", sx: 2, plates: 1, sz: 3, grams: 0.82 },
      { partNum: "3666",  name: "Plate 1 x 6",        kind: "brick", sx: 1, plates: 1, sz: 6, grams: 0.85 },
      { partNum: "3710",  name: "Plate 1 x 4",        kind: "brick", sx: 1, plates: 1, sz: 4, grams: 0.56 },
      { partNum: "3069",  name: "Tile 1 x 2 Smooth",  kind: "brick", sx: 1, plates: 1, sz: 2, smoothTop: true, grams: 0.28 },
      { partNum: "3070",  name: "Tile 1 x 1 Smooth",  kind: "brick", sx: 1, plates: 1, sz: 1, smoothTop: true, grams: 0.14 },
      { partNum: "3070b", name: "Tile 1 x 1 Smooth",  kind: "brick", sx: 1, plates: 1, sz: 1, smoothTop: true, grams: 0.14 },
      { partNum: "3068b", name: "Tile 2 x 2 Smooth",  kind: "brick", sx: 2, plates: 1, sz: 2, smoothTop: true, grams: 0.48 },
      { partNum: "3040b", name: "Slope 45 deg 1 x 2", kind: "slope", sx: 1, plates: 3, sz: 2, grams: 0.56 },
      { partNum: "4073",  name: "Plate Round 1 x 1",  kind: "rplate", sx: 1, plates: 1, sz: 1, grams: 0.16 },
      { partNum: "3705",  name: "Cross-Axle 4L",      kind: "axle",  len: 4, sx: 1, plates: 1, sz: 4, grams: 0.48 },
      { partNum: "3707",  name: "Cross-Axle 8L",      kind: "axle",  len: 8, sx: 1, plates: 1, sz: 8, grams: 0.96 },
      { partNum: "32062", name: "Cross-Axle 2L",      kind: "axle",  len: 2, sx: 1, plates: 1, sz: 2, grams: 0.25 }
    ];
    extras.forEach(p => { map[p.partNum.toLowerCase()] = p; });
    return map;
  })();

  const SAMPLE_LDRAW_GEARBOX = [
    "0 NorthStar 3-Stage Compound GBC Gearbox Sample",
    "0 Name: northstar_sample_gbc_gearbox.ldr",
    "0 Author: NorthStar Brick Alchemy CAD Studio v2.1",
    "0 // Step 1: Dark Slate Plinth & Rail Base",
    "1 72 -80 -12 -40 1 0 0 0 1 0 0 0 1 3001.dat",
    "1 72 0 -12 -40 1 0 0 0 1 0 0 0 1 3001.dat",
    "1 72 80 -12 -40 1 0 0 0 1 0 0 0 1 3001.dat",
    "1 72 -80 -12 40 1 0 0 0 1 0 0 0 1 3001.dat",
    "1 72 0 -12 40 1 0 0 0 1 0 0 0 1 3001.dat",
    "1 72 80 -12 40 1 0 0 0 1 0 0 0 1 3001.dat",
    "0 STEP",
    "0 // Step 2: Perforated Liftarm Bearing Towers",
    "1 0 -90 -64 -40 0 -1 0 1 0 0 0 0 1 32524.dat",
    "1 0 90 -64 -40 0 -1 0 1 0 0 0 0 1 32524.dat",
    "1 0 -90 -64 40 0 -1 0 1 0 0 0 0 1 32524.dat",
    "1 0 90 -64 40 0 -1 0 1 0 0 0 0 1 32524.dat",
    "1 71 0 -44 -40 1 0 0 0 1 0 0 0 1 32525.dat",
    "1 71 0 -44 40 1 0 0 0 1 0 0 0 1 32525.dat",
    "0 STEP",
    "0 // Step 3: Cross-Axles & Meshing Brass/Cyan Reduction Gear Train",
    "1 0 -60 -84 0 1 0 0 0 1 0 0 0 1 3706.dat",
    "1 0 -20 -84 0 1 0 0 0 1 0 0 0 1 3706.dat",
    "1 0 40 -84 0 1 0 0 0 1 0 0 0 1 3706.dat",
    "1 297 -60 -84 0 1 0 0 0 1 0 0 0 1 3647.dat",
    "1 297 -20 -84 0 1 0 0 0 1 0 0 0 1 3648.dat",
    "1 383 40 -84 0 1 0 0 0 1 0 0 0 1 3649.dat",
    "0 STEP",
    "0 // Step 4: Backlit Crystal Beacon Caps & Sloped Shrouds",
    "1 41 -90 -138 -40 1 0 0 0 1 0 0 0 1 30153.dat",
    "1 35 90 -138 -40 1 0 0 0 1 0 0 0 1 30153.dat",
    "1 45 -90 -138 40 1 0 0 0 1 0 0 0 1 30153.dat",
    "1 57 90 -138 40 1 0 0 0 1 0 0 0 1 30153.dat",
    "1 297 -40 -28 0 1 0 0 0 1 0 0 0 1 3039.dat",
    "1 297 40 -28 0 0 0 -1 0 1 0 1 0 0 3039.dat",
    "0 NOFILE"
  ].join("\r\n");

  const BUILDER_SWATCH_IDS = [0, 72, 71, 297, 1, 4, 15, 35, 41, 52, 57, 45];

  function colorFromHexNearest(hexStr, isTrans) {
    if (!hexStr) return LDRAW_COLORS[71];
    const clean = String(hexStr).replace("#", "").trim();
    if (clean.length !== 6) return LDRAW_COLORS[isTrans ? 41 : 71];
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    let best = LDRAW_COLORS[isTrans ? 41 : 71];
    let bestD = Infinity;
    const keys = Object.keys(LDRAW_COLORS);
    for (let i = 0; i < keys.length; i++) {
      const c = LDRAW_COLORS[keys[i]];
      if (Boolean(isTrans) !== Boolean(c.trans)) continue;
      const ch = c.hex.replace("#", "");
      const dr = r - parseInt(ch.slice(0, 2), 16);
      const dg = g - parseInt(ch.slice(2, 4), 16);
      const db = b - parseInt(ch.slice(4, 6), 16);
      const d = dr * dr + dg * dg + db * db;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  function createBrickCADEngine(options) {
    const container = options.container;
    const canvas = options.canvas;
    const fallbackCanvas = options.fallbackCanvas;
    const onTelemetry = options.onTelemetry || function () {};
    const onPartSelected = options.onPartSelected || function () {};
    const onStepChange = options.onStepChange || function () {};
    const onToolChange = options.onToolChange || function () {};
    const onRenderModeChange = options.onRenderModeChange || function () {};
    const onImportComplete = options.onImportComplete || function () {};
    const onStatusMessage = options.onStatusMessage || function () {};
    const reducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer = null;
    let scene = null;
    let perspCam = null;
    let orthoCam = null;
    let activeCam = null;
    let projectionMode = "persp";
    let renderMode = "studio"; // studio | edges | wireframe | xray
    let activeTool = "inspect"; // inspect | place | erase
    let useFallback2D = false;

    let envMapTex = null;
    let stageGroup = null;
    let machineGroup = null;
    let customGroup = null;
    let clutterGroup = null;
    let ballsGroup = null;
    let selectionBox = null;
    let ghostMesh = null;
    let floorPlane = null;
    let backlightLight = null;

    // Assembly state (Single Source of Truth for rendering, steps, inspection, BOM, LDraw, BrickLink)
    let partRecords = [];
    let customRecords = [];
    let partIdSeq = 1;
    let gearsList = [];
    let movingLinkages = [];
    let gbcBalls = [];
    let stepDescriptions = [];
    let currentStep = 5;
    let maxStep = 5;
    let stepPlayActive = false;
    let stepPlayTimer = 0;

    // Builder state
    let builderPartKey = "brick_2x4";
    let builderColorId = 297;
    let builderRotY = 0;

    // Camera orbit + pan target
    let camTarget = { x: 0, y: 2.2, z: 0 };
    let camSpherical = { radius: 22.5, theta: 0.62, phi: 1.06 };
    let targetSpherical = null;
    let targetLook = null;
    let autoOrbit = true;
    let isPointerDown = false;
    let pointerButton = 0;
    let pointerMoved = false;
    let prevPointer = { x: 0, y: 0 };

    // Controls mirrored from host studio
    let driveRPM = 120;
    let explodeAmt = 0;
    let separatioAmt = 0.85;
    let colorMode = "authentic";
    let currentBlueprint = null;
    let currentPalette = [];

    // Geometry & material caches
    const geoCache = new Map();
    const edgeGeoCache = new WeakMap();
    const matCache = new Map();
    const raycaster = typeof THREE !== "undefined" ? new THREE.Raycaster() : null;
    const pointerNDC = typeof THREE !== "undefined" ? new THREE.Vector2() : null;
    const edgeMatStudio = typeof THREE !== "undefined"
      ? new THREE.LineBasicMaterial({ color: 0x2fe4ff, transparent: true, opacity: 0.42 })
      : null;

    // --- PROCEDURAL HDR STUDIO ENVIRONMENT MAP ---
    function buildStudioEnvMap(rend) {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 256;
      const ctx = c.getContext("2d");

      // Deep twilight studio dome gradient
      const bg = ctx.createLinearGradient(0, 0, 0, 256);
      bg.addColorStop(0.0, "#1c2a4d");
      bg.addColorStop(0.35, "#15203b");
      bg.addColorStop(0.52, "#0c1124");
      bg.addColorStop(1.0, "#050712");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, 512, 256);

      // Overhead crisp white softbox strip (creates authentic ABS brick specular highlights)
      const topBox = ctx.createRadialGradient(256, 36, 10, 256, 36, 170);
      topBox.addColorStop(0, "rgba(255,255,255,0.98)");
      topBox.addColorStop(0.45, "rgba(225,242,255,0.68)");
      topBox.addColorStop(1, "rgba(225,242,255,0)");
      ctx.fillStyle = topBox;
      ctx.fillRect(40, 0, 432, 110);

      // Warm amber/gold key softbox on right
      const keyBox = ctx.createRadialGradient(388, 104, 8, 388, 104, 92);
      keyBox.addColorStop(0, "rgba(255,232,175,0.95)");
      keyBox.addColorStop(0.5, "rgba(245,196,81,0.45)");
      keyBox.addColorStop(1, "rgba(245,196,81,0)");
      ctx.fillStyle = keyBox;
      ctx.fillRect(280, 12, 220, 180);

      // Cool cyan rim softbox on left
      const rimBox = ctx.createRadialGradient(112, 108, 8, 112, 108, 96);
      rimBox.addColorStop(0, "rgba(130,240,255,0.92)");
      rimBox.addColorStop(0.5, "rgba(47,228,255,0.40)");
      rimBox.addColorStop(1, "rgba(47,228,255,0)");
      ctx.fillStyle = rimBox;
      ctx.fillRect(10, 14, 210, 185);

      // Violet subtle back accent
      const backBox = ctx.createRadialGradient(256, 134, 6, 256, 134, 64);
      backBox.addColorStop(0, "rgba(195,140,255,0.65)");
      backBox.addColorStop(1, "rgba(182,120,255,0)");
      ctx.fillStyle = backBox;
      ctx.fillRect(175, 70, 165, 125);

      const tex = new THREE.CanvasTexture(c);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(rend);
      pmrem.compileEquirectangularShader();
      const rt = pmrem.fromEquirectangular(tex);
      tex.dispose();
      pmrem.dispose();
      return rt.texture;
    }

    // --- PROCEDURAL CAD ARCHITECTURAL WORKBENCH MAT TEXTURE ---
    function buildCadGridTexture() {
      const size = 1024;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");

      // Matte architectural dark navy-slate surface with subtle radial vignette
      const grad = ctx.createRadialGradient(size / 2, size / 2, 40, size / 2, size / 2, size * 0.56);
      grad.addColorStop(0, "#141d38");
      grad.addColorStop(0.65, "#0d1328");
      grad.addColorStop(1, "#070a16");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      const studs = 32;
      const step = size / studs;

      // Minor 1-stud (8.0 mm) grid lines
      ctx.strokeStyle = "rgba(75, 195, 255, 0.14)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= studs; i++) {
        const p = Math.round(i * step) + 0.5;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
      }

      // Major 4-stud (32.0 mm) grid lines
      ctx.strokeStyle = "rgba(47, 228, 255, 0.30)";
      ctx.lineWidth = 1.6;
      for (let i = 0; i <= studs; i += 4) {
        const p = Math.round(i * step) + 0.5;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(size, p); ctx.stroke();
      }

      // Golden center crosshairs & 16-stud calibration frame
      ctx.strokeStyle = "rgba(245, 196, 81, 0.45)";
      ctx.lineWidth = 2;
      ctx.strokeRect(step * 8, step * 8, step * 16, step * 16);

      ctx.strokeStyle = "rgba(245, 196, 81, 0.32)";
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(size / 2, step * 2); ctx.lineTo(size / 2, size - step * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(step * 2, size / 2); ctx.lineTo(size - step * 2, size / 2); ctx.stroke();

      // Subtle stud calibration dots at major intersections
      ctx.fillStyle = "rgba(245, 196, 81, 0.55)";
      for (let x = 4; x < studs; x += 4) {
        for (let z = 4; z < studs; z += 4) {
          ctx.beginPath();
          ctx.arc(x * step, z * step, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const tex = new THREE.CanvasTexture(c);
      tex.anisotropy = 8;
      if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }

    // --- PBR MATERIAL FACTORY ---
    function getBrickMaterial(colorObj, extraEmissive) {
      const cObj = typeof colorObj === "number" ? (LDRAW_COLORS[colorObj] || LDRAW_COLORS[71]) : colorObj;
      const modeKey = `${cObj.id}_${cObj.hex}_${cObj.trans ? 1 : 0}_${cObj.metal ? 1 : 0}_${cObj.flatFacets ? 1 : 0}_${extraEmissive ? 1 : 0}_${renderMode}`;
      if (matCache.has(modeKey)) return matCache.get(modeKey);

      const baseCol = new THREE.Color(cObj.hex);
      const isWire = renderMode === "wireframe";
      const isXray = renderMode === "xray";

      let mat;
      if (isXray) {
        mat = new THREE.MeshPhysicalMaterial({
          color: baseCol,
          roughness: 0.25,
          metalness: cObj.metal ? 0.5 : 0.05,
          transparent: true,
          opacity: cObj.metal ? 0.85 : (cObj.trans ? 0.55 : 0.22),
          depthWrite: cObj.metal,
          wireframe: false
        });
      } else if (cObj.metal) {
        mat = new THREE.MeshPhysicalMaterial({
          color: baseCol,
          metalness: 0.86,
          roughness: 0.20,
          clearcoat: 0.65,
          clearcoatRoughness: 0.12,
          envMapIntensity: 1.75,
          emissive: extraEmissive ? baseCol.clone().multiplyScalar(0.16) : new THREE.Color(0x000000),
          wireframe: isWire
        });
      } else if (cObj.trans) {
        const jewelCol = baseCol.clone().offsetHSL(0, 0.12, -0.07);
        mat = new THREE.MeshPhysicalMaterial({
          color: jewelCol,
          metalness: 0.04,
          roughness: 0.06,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          transparent: true,
          opacity: extraEmissive ? 0.88 : 0.78,
          envMapIntensity: 1.45,
          emissive: jewelCol.clone().multiplyScalar(extraEmissive ? 0.30 : 0.14),
          flatShading: Boolean(cObj.flatFacets),
          wireframe: isWire
        });
      } else {
        // Authentic glossy injection-molded ABS plastic
        mat = new THREE.MeshPhysicalMaterial({
          color: baseCol,
          metalness: 0.02,
          roughness: 0.18,
          clearcoat: 0.90,
          clearcoatRoughness: 0.09,
          envMapIntensity: 1.25,
          wireframe: isWire
        });
      }
      matCache.set(modeKey, mat);
      return mat;
    }

    // --- SCULPTED GEOMETRY FACTORIES (CACHED) ---
    function getRoundedRectShape(w, d, r) {
      const s = new THREE.Shape();
      const hw = w / 2, hd = d / 2;
      const cr = Math.min(r, hw * 0.45, hd * 0.45);
      s.moveTo(-hw + cr, -hd);
      s.lineTo(hw - cr, -hd);
      s.quadraticCurveTo(hw, -hd, hw, -hd + cr);
      s.lineTo(hw, hd - cr);
      s.quadraticCurveTo(hw, hd, hw - cr, hd);
      s.lineTo(-hw + cr, hd);
      s.quadraticCurveTo(-hw, hd, -hw, hd - cr);
      s.lineTo(-hw, -hd + cr);
      s.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);
      return s;
    }

    function getBeveledBodyGeo(sx, plates, sz) {
      const key = `body_${sx}_${plates}_${sz}`;
      if (geoCache.has(key)) return geoCache.get(key);
      const w = sx * STUD - SEAM * 2;
      const h = plates * PLATE - 0.012;
      const d = sz * STUD - SEAM * 2;
      const bevel = 0.032;
      const shape = getRoundedRectShape(w - bevel * 2, d - bevel * 2, 0.045);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.05, h - bevel * 2),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2
      });
      geo.rotateX(-Math.PI / 2);
      geo.center();
      geoCache.set(key, geo);
      return geo;
    }

    function getStudGeo() {
      const key = "stud_beveled";
      if (geoCache.has(key)) return geoCache.get(key);
      // Chamfered lathe stud profile for authentic highlight rim
      const pts = [
        new THREE.Vector2(STUD_R, 0),
        new THREE.Vector2(STUD_R, STUD_H * 0.78),
        new THREE.Vector2(STUD_R * 0.87, STUD_H),
        new THREE.Vector2(STUD_R * 0.56, STUD_H),
        new THREE.Vector2(STUD_R * 0.52, STUD_H * 0.90),
        new THREE.Vector2(0.001, STUD_H * 0.90)
      ];
      const geo = new THREE.LatheGeometry(pts, 18);
      geoCache.set(key, geo);
      return geo;
    }

    function getRoundTileGeo() {
      const key = "rtile_98138";
      if (geoCache.has(key)) return geoCache.get(key);
      const r = 0.468;
      const h = PLATE - 0.02;
      const pts = [
        new THREE.Vector2(r * 0.92, 0),
        new THREE.Vector2(r, 0.04),
        new THREE.Vector2(r, h * 0.72),
        new THREE.Vector2(r * 0.85, h),
        new THREE.Vector2(0.001, h)
      ];
      const geo = new THREE.LatheGeometry(pts, 22);
      geo.translate(0, -h / 2, 0);
      geoCache.set(key, geo);
      return geo;
    }

    function getCrystalGemGeo() {
      const key = "gem_30153_faceted";
      if (geoCache.has(key)) return geoCache.get(key);
      // Sharp diamond-cut hexagonal crystal prism (authentic 30153 jewel silhouette)
      const pts = [
        new THREE.Vector2(0.14, -0.48),
        new THREE.Vector2(0.18, -0.14),
        new THREE.Vector2(0.42, 0.14),
        new THREE.Vector2(0.28, 0.44),
        new THREE.Vector2(0.001, 0.60)
      ];
      const geo = new THREE.LatheGeometry(pts, 6);
      geo.computeVertexNormals();
      geoCache.set(key, geo);
      return geo;
    }

    function getSlopeGeo(sx, plates, sz) {
      const key = `slope_${sx}_${plates}_${sz}`;
      if (geoCache.has(key)) return geoCache.get(key);
      const w = sx * STUD - SEAM * 2;
      const h = plates * PLATE - 0.012;
      const d = sz * STUD - SEAM * 2;
      const bevel = 0.024;
      // Side profile in XY extruded along X (width)
      const s = new THREE.Shape();
      const hd = d / 2 - bevel;
      const hh = h / 2 - bevel;
      s.moveTo(-hd, -hh);
      s.lineTo(hd, -hh);
      s.lineTo(hd, -hh + PLATE * 0.65);
      s.lineTo(-hd + STUD * 0.86, hh);
      s.lineTo(-hd, hh);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, {
        depth: Math.max(0.1, w - bevel * 2),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel,
        bevelSegments: 2
      });
      geo.rotateY(Math.PI / 2);
      geo.center();
      geoCache.set(key, geo);
      return geo;
    }

    function getInvoluteGearGeo(teeth, thickness) {
      const thick = thickness || 0.48;
      const key = `gear_${teeth}_${thick.toFixed(2)}`;
      if (geoCache.has(key)) return geoCache.get(key);

      // Exact LEGO Technic Module m = 1.0 mm -> Pitch Diameter = teeth mm = teeth / 8 studs -> Pitch Radius = teeth / 16 studs
      const pitchR = teeth / 16.0;
      const outerR = pitchR + 0.125;
      const rootR = Math.max(0.34, pitchR - 0.145);

      const shape = new THREE.Shape();
      const step = (Math.PI * 2) / teeth;
      for (let i = 0; i < teeth; i++) {
        const a0 = i * step;
        const a1 = a0 + step * 0.18;
        const a2 = a0 + step * 0.34;
        const a3 = a0 + step * 0.54;
        const a4 = a0 + step * 0.70;
        const pts = [
          [Math.cos(a0) * rootR, Math.sin(a0) * rootR],
          [Math.cos(a1) * rootR, Math.sin(a1) * rootR],
          [Math.cos(a2) * outerR, Math.sin(a2) * outerR],
          [Math.cos(a3) * outerR, Math.sin(a3) * outerR],
          [Math.cos(a4) * rootR, Math.sin(a4) * rootR]
        ];
        if (i === 0) shape.moveTo(pts[0][0], pts[0][1]);
        else shape.lineTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k++) shape.lineTo(pts[k][0], pts[k][1]);
      }
      shape.closePath();

      // Authentic cruciform Technic "+" cross-axle bore in center
      const axArm = 0.255;
      const axHalfW = 0.088;
      const axleHole = new THREE.Path();
      axleHole.moveTo(-axHalfW, -axArm);
      axleHole.lineTo(axHalfW, -axArm);
      axleHole.lineTo(axHalfW, -axHalfW);
      axleHole.lineTo(axArm, -axHalfW);
      axleHole.lineTo(axArm, axHalfW);
      axleHole.lineTo(axHalfW, axHalfW);
      axleHole.lineTo(axHalfW, axArm);
      axleHole.lineTo(-axHalfW, axArm);
      axleHole.lineTo(-axHalfW, axHalfW);
      axleHole.lineTo(-axArm, axHalfW);
      axleHole.lineTo(-axArm, -axHalfW);
      axleHole.lineTo(-axHalfW, -axHalfW);
      axleHole.closePath();
      shape.holes.push(axleHole);

      // Authentic circular Technic lightening / pin holes on gears >= 24T
      if (teeth >= 24) {
        const holeCount = teeth >= 36 ? 6 : 4;
        const holeRingR = pitchR * 0.56;
        const holeRad = teeth >= 36 ? 0.27 : 0.22;
        for (let h = 0; h < holeCount; h++) {
          const ha = (h / holeCount) * Math.PI * 2 + Math.PI / holeCount;
          const p = new THREE.Path();
          p.absarc(Math.cos(ha) * holeRingR, Math.sin(ha) * holeRingR, holeRad, 0, Math.PI * 2, true);
          shape.holes.push(p);
        }
      }

      const bevel = 0.032;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.12, thick - bevel * 2),
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: 0.022,
        bevelSegments: 2
      });
      geo.center();
      geoCache.set(key, geo);
      return geo;
    }

    function getTechnicLiftarmGeo(lengthStuds) {
      const key = `liftarm_${lengthStuds}`;
      if (geoCache.has(key)) return geoCache.get(key);
      const span = Math.max(1, lengthStuds - 1) * STUD;
      const halfSpan = span / 2;
      const r = 0.46;
      const shape = new THREE.Shape();
      shape.absarc(-halfSpan, 0, r, Math.PI / 2, Math.PI * 1.5, false);
      shape.absarc(halfSpan, 0, r, -Math.PI / 2, Math.PI / 2, false);
      shape.closePath();

      // Genuine punched circular Technic pinholes every 1.0 stud!
      for (let i = 0; i < lengthStuds; i++) {
        const hx = -halfSpan + i * STUD;
        const hole = new THREE.Path();
        hole.absarc(hx, 0, 0.255, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }

      const thick = 0.78;
      const bevel = 0.04;
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: thick - bevel * 2,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: 0.028,
        bevelSegments: 2
      });
      geo.center();
      geoCache.set(key, geo);
      return geo;
    }

    function getCrossAxleGeo(lengthStuds) {
      const key = `axle_${lengthStuds.toFixed(1)}`;
      if (geoCache.has(key)) return geoCache.get(key);
      const a = 0.235;
      const w = 0.078;
      const shape = new THREE.Shape();
      shape.moveTo(-w, -a); shape.lineTo(w, -a); shape.lineTo(w, -w);
      shape.lineTo(a, -w); shape.lineTo(a, w); shape.lineTo(w, w);
      shape.lineTo(w, a); shape.lineTo(-w, a); shape.lineTo(-w, w);
      shape.lineTo(-a, w); shape.lineTo(-a, -w); shape.lineTo(-w, -w);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.4, lengthStuds * STUD),
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.018,
        bevelSegments: 1
      });
      geo.center();
      geoCache.set(key, geo);
      return geo;
    }

    function getPinGeo() {
      const key = "technic_pin_2780";
      if (geoCache.has(key)) return geoCache.get(key);
      const pts = [
        new THREE.Vector2(0.20, -0.58),
        new THREE.Vector2(0.245, -0.52),
        new THREE.Vector2(0.245, -0.06),
        new THREE.Vector2(0.32, -0.04),
        new THREE.Vector2(0.32, 0.04),
        new THREE.Vector2(0.245, 0.06),
        new THREE.Vector2(0.245, 0.52),
        new THREE.Vector2(0.20, 0.58)
      ];
      const geo = new THREE.LatheGeometry(pts, 14);
      geo.rotateX(Math.PI / 2);
      geoCache.set(key, geo);
      return geo;
    }

    function attachEdgeOverlay(parentMesh, geometry) {
      let edges = edgeGeoCache.get(geometry);
      if (!edges) {
        edges = new THREE.EdgesGeometry(geometry, 28);
        edgeGeoCache.set(geometry, edges);
      }
      const line = new THREE.LineSegments(edges, edgeMatStudio);
      line.name = "__cad_edges__";
      line.visible = (renderMode === "edges");
      parentMesh.add(line);
    }

    // --- PART RECORD BUILDER (Single Source of Truth!) ---
    function registerPart(opts) {
      const cObj = typeof opts.color === "number" ? (LDRAW_COLORS[opts.color] || LDRAW_COLORS[71]) : opts.color;
      const group = new THREE.Group();
      const mat = getBrickMaterial(cObj, Boolean(opts.backlit));

      let heightWorld = (opts.plates || 3) * PLATE;
      let dimsStuds = [opts.sx || 1, opts.plates || 3, opts.sz || 1];

      if (opts.kind === "brick") {
        const geo = getBeveledBodyGeo(opts.sx, opts.plates, opts.sz);
        const body = new THREE.Mesh(geo, mat);
        body.castShadow = true;
        body.receiveShadow = true;
        attachEdgeOverlay(body, geo);
        group.add(body);
        if (!opts.smoothTop) {
          const studGeo = getStudGeo();
          const topY = (opts.plates * PLATE) / 2 - 0.01;
          for (let ix = 0; ix < opts.sx; ix++) {
            for (let iz = 0; iz < opts.sz; iz++) {
              const sMesh = new THREE.Mesh(studGeo, mat);
              sMesh.position.set(
                (ix - (opts.sx - 1) / 2) * STUD,
                topY,
                (iz - (opts.sz - 1) / 2) * STUD
              );
              sMesh.castShadow = true;
              sMesh.receiveShadow = true;
              group.add(sMesh);
            }
          }
        }
      } else if (opts.kind === "rplate") {
        const geo = getRoundTileGeo();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        attachEdgeOverlay(mesh, geo);
        group.add(mesh);
        const sMesh = new THREE.Mesh(getStudGeo(), mat);
        sMesh.position.set(0, PLATE / 2 - 0.01, 0);
        sMesh.castShadow = true;
        group.add(sMesh);
        heightWorld = PLATE;
        dimsStuds = [1, 1, 1];
      } else if (opts.kind === "rtile") {
        const geo = getRoundTileGeo();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        attachEdgeOverlay(mesh, geo);
        group.add(mesh);
        heightWorld = PLATE;
        dimsStuds = [1, 1, 1];
      } else if (opts.kind === "gem") {
        const geo = getCrystalGemGeo();
        const gemMat = getBrickMaterial({ ...cObj, flatFacets: true }, Boolean(opts.backlit));
        const mesh = new THREE.Mesh(geo, gemMat);
        mesh.castShadow = true;
        attachEdgeOverlay(mesh, geo);
        group.add(mesh);
        heightWorld = BRICK;
        dimsStuds = [1, 3, 1];
      } else if (opts.kind === "slope") {
        const geo = getSlopeGeo(opts.sx, opts.plates, opts.sz);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        attachEdgeOverlay(mesh, geo);
        group.add(mesh);
        // Back row studs on top of slope
        const studGeo = getStudGeo();
        const topY = (opts.plates * PLATE) / 2 - 0.01;
        for (let ix = 0; ix < opts.sx; ix++) {
          const sMesh = new THREE.Mesh(studGeo, mat);
          sMesh.position.set((ix - (opts.sx - 1) / 2) * STUD, topY, -(opts.sz - 1) * 0.5 * STUD);
          group.add(sMesh);
        }
      } else if (opts.kind === "gear") {
        const geo = getInvoluteGearGeo(opts.teeth || 24, opts.thickness || 0.48);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        attachEdgeOverlay(mesh, geo);
        const hubR = Math.min(0.55, (opts.teeth || 24) / 36 + 0.18);
        const hubGeo = new THREE.CylinderGeometry(hubR, hubR, (opts.thickness || 0.48) + 0.14, 18);
        hubGeo.rotateX(Math.PI / 2);
        const hub = new THREE.Mesh(hubGeo, mat);
        const gearSpinWrap = new THREE.Group();
        gearSpinWrap.add(mesh, hub);
        if (opts.axis === "y") gearSpinWrap.rotation.x = Math.PI / 2;
        else if (opts.axis === "x") gearSpinWrap.rotation.y = Math.PI / 2;
        group.add(gearSpinWrap);
        const dStud = Math.max(1, Math.round((opts.teeth || 24) / 8));
        dimsStuds = [dStud, 2, dStud];
        heightWorld = dStud * STUD;
      } else if (opts.kind === "liftarm") {
        const geo = getTechnicLiftarmGeo(opts.len || 7);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        attachEdgeOverlay(mesh, geo);
        group.add(mesh);
        dimsStuds = [opts.len || 7, 2, 1];
        heightWorld = 0.92;
      } else if (opts.kind === "axle") {
        const geo = getCrossAxleGeo(opts.len || 6);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        group.add(mesh);
        if (opts.axis === "x") group.rotation.y = Math.PI / 2;
        else if (opts.axis === "y") group.rotation.x = Math.PI / 2;
        dimsStuds = [1, 1, opts.len || 6];
        heightWorld = 0.5;
      } else if (opts.kind === "pin") {
        const geo = getPinGeo();
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
        dimsStuds = [1, 1, 1];
        heightWorld = 0.5;
      }

      group.position.set(opts.x || 0, opts.y || 0, opts.z || 0);
      if (opts.rotEuler) {
        group.rotation.copy(opts.rotEuler);
      } else {
        if (opts.rotX) group.rotation.x += opts.rotX;
        if (opts.rotY) group.rotation.y += opts.rotY;
        if (opts.rotZ) group.rotation.z += opts.rotZ;
      }

      const rec = {
        id: partIdSeq++,
        partNum: opts.partNum || "3001",
        partName: opts.partName || "Brick 2 x 4",
        ldrawFile: opts.ldrawFile || `${opts.partNum || "3001"}.dat`,
        kind: opts.kind,
        colorObj: cObj,
        backlit: Boolean(opts.backlit),
        step: opts.step || 1,
        layer: opts.layer != null ? opts.layer : Math.max(0, (opts.step || 1) - 1),
        role: opts.role || "structural",
        x: opts.x || 0,
        y: opts.y || 0,
        z: opts.z || 0,
        rotY: opts.rotEuler ? opts.rotEuler.y : (opts.rotY || 0),
        ldrawMatrix: Array.isArray(opts.ldrawMatrix) && opts.ldrawMatrix.length === 9 ? opts.ldrawMatrix.slice() : null,
        dimsStuds,
        heightWorld,
        grams: opts.grams || (dimsStuds[0] * dimsStuds[1] * dimsStuds[2] * 0.14),
        mesh: group,
        isCustom: Boolean(opts.isCustom)
      };

      group.userData.partRecord = rec;
      group.userData.basePosY = rec.y;
      group.userData.layer = rec.layer;
      group.traverse(ch => { ch.userData.partRecord = rec; });

      if (opts.parent) opts.parent.add(group);
      else if (opts.isCustom) customGroup.add(group);
      else machineGroup.add(group);

      if (opts.isCustom) customRecords.push(rec);
      else partRecords.push(rec);

      return rec;
    }

    function paletteColorAt(idx, preferTrans) {
      if (colorMode === "provenance") {
        const prov = preferTrans ? [41, 35, 52, 57] : [297, 1, 4, 72];
        return LDRAW_COLORS[prov[idx % prov.length]];
      }
      if (currentPalette && currentPalette.length) {
        const filt = currentPalette.filter(c => Boolean(c.trans) === Boolean(preferTrans));
        const src = filt.length ? filt[idx % filt.length] : currentPalette[idx % currentPalette.length];
        return colorFromHexNearest(src.hex, preferTrans);
      }
      const def = preferTrans ? [41, 35, 52, 57, 46] : [0, 72, 71, 297, 1];
      return LDRAW_COLORS[def[idx % def.length]];
    }

    // --- CLEAR & BUILD ASSEMBLIES ---
    function clearAssembly() {
      partRecords = [];
      gearsList = [];
      movingLinkages = [];
      gbcBalls = [];
      if (selectionBox) selectionBox.visible = false;
      onPartSelected(null);
      while (machineGroup.children.length) machineGroup.remove(machineGroup.children[0]);
      while (ballsGroup.children.length) ballsGroup.remove(ballsGroup.children[0]);
      while (clutterGroup.children.length) clutterGroup.remove(clutterGroup.children[0]);
    }

    function buildArdentilaterumEyeAssembly() {
      stepDescriptions = [
        "Step 1/5: Obsidian & Pearl-Gold Gothic Lantern Plinth (3020, 3001, 3039)",
        "Step 2/5: Matte-Black Leading Frame & 5V LED Diffuser Backplane (3024, 3005)",
        "Step 3/5: Beholder's Prism Eye Stained-Glass Mandala (98138 Round Tiles + 30153 Gems)",
        "Step 4/5: Concentric Meshing 40T & 24T Brass Iris Gears on Cross-Axles (3649, 3648, 3707)",
        "Step 5/5: Cathedral Arch Crown & Refracting Prism Finials (3039, 30153)"
      ];

      // STEP 1: Architectural stepped plinth resting cleanly on workbench (y = 0)
      for (let ix = -5; ix <= 5; ix += 2) {
        registerPart({ kind: "brick", partNum: "3020", partName: "Plate 2 x 4", sx: 2, plates: 1, sz: 4, color: 0, x: ix, y: PLATE * 0.5, z: 0, step: 1, layer: 0, role: "plinth_base" });
      }
      for (let ix = -4; ix <= 4; ix += 2) {
        registerPart({ kind: "brick", partNum: "3003", partName: "Brick 2 x 2", sx: 2, plates: 3, sz: 2, color: 72, x: ix, y: PLATE + BRICK * 0.5, z: 0, step: 1, layer: 0.4, role: "plinth_core" });
      }
      // Corner gold accent slopes
      [-5.5, 5.5].forEach(sx => {
        registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 297, x: sx, y: PLATE + BRICK * 0.5, z: 0, rotY: sx < 0 ? -Math.PI / 2 : Math.PI / 2, step: 1, layer: 0.5, role: "ornamental_trim" });
      });
      // Top plinth gold sill
      for (let ix = -4; ix <= 4; ix += 2) {
        registerPart({ kind: "brick", partNum: "3023", partName: "Plate 1 x 2", sx: 2, plates: 1, sz: 1, color: 297, x: ix, y: PLATE + BRICK + PLATE * 0.5, z: 1.0, step: 1, layer: 0.8, role: "ornamental_sill" });
      }

      const eyeCenterY = 8.4;
      const gridN = 13; // 13x13 crisp rose window mosaic
      const half = (gridN - 1) / 2;

      // STEP 2: Structural black leading backing pillars + backlit LED diffuser glow core
      registerPart({ kind: "brick", partNum: "3005", partName: "Brick 1 x 1", sx: 1, plates: 3, sz: 1, color: 0, x: -6.5, y: 2.6, z: 0, step: 2, layer: 1, role: "leading_pillar" });
      registerPart({ kind: "brick", partNum: "3005", partName: "Brick 1 x 1", sx: 1, plates: 3, sz: 1, color: 0, x: 6.5, y: 2.6, z: 0, step: 2, layer: 1, role: "leading_pillar" });
      // Backlit inner LED panel glow light
      if (backlightLight) {
        backlightLight.position.set(0, eyeCenterY, -2.4);
        backlightLight.intensity = 2.8;
        backlightLight.color.setHex(0x40ffaa);
      }

      // STEP 2 & 3: Stained-glass Beholder's Prism Eye rose window (real BOM part 98138 + 3024 leading)
      for (let gx = 0; gx < gridN; gx++) {
        for (let gy = 0; gy < gridN; gy++) {
          const dx = gx - half;
          const dy = gy - half;
          const dist = Math.hypot(dx, dy);
          if (dist > 6.35) continue;

          const px = dx * 0.96;
          const py = eyeCenterY + dy * 0.96;
          const ang = Math.atan2(dy, dx);

          // Determine authentic Ardentilaterum palette cell
          let isLeading = false;
          let colId = 41;
          let isBacklit = true;

          if (dist > 5.45) {
            // Outer obsidian & gold gothic rose frame
            isLeading = true;
            colId = ((gx + gy) % 3 === 0) ? 297 : 0;
            isBacklit = false;
          } else if (Math.abs(dx) < 0.72 && Math.abs(dy) < 2.25) {
            // Vertical obsidian slit pupil
            isLeading = true;
            colId = 0;
            isBacklit = false;
          } else if (dist < 2.55) {
            // Luminous emerald + bright green Beholder Iris
            colId = (dist < 1.55) ? 35 : 34;
          } else if (dist < 3.15) {
            // Pearl gold iris bezel ring
            isLeading = true;
            colId = 297;
            isBacklit = false;
          } else {
            // Prismatic radial stained-glass cathedral petals
            const sector = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 8) % 8;
            const spoke = Math.abs(Math.sin(ang * 4)) < 0.14;
            if (spoke) {
              isLeading = true;
              colId = 0;
              isBacklit = false;
            } else {
              const petalCols = [41, 143, 52, 45, 57, 46, 35, 33];
              colId = petalCols[sector];
            }
          }

          if (isLeading) {
            registerPart({
              kind: "brick", partNum: "3024", partName: "Plate 1 x 1",
              sx: 1, plates: 1, sz: 1, color: colId,
              x: px, y: py, z: 0.0, rotX: Math.PI / 2, smoothTop: true,
              step: 2, layer: 1.5, role: "structural_leading"
            });
          } else {
            registerPart({
              kind: "rtile", partNum: "98138", partName: "Tile Round 1 x 1",
              color: colId, backlit: isBacklit,
              x: px, y: py, z: 0.24, rotX: Math.PI / 2,
              step: 3, layer: 2.4, role: "stained_glass_cell"
            });
          }
        }
      }

      // 8 corner 24-facet light-pipe crystal gems (30153) framing the mandala
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
        registerPart({
          kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Jewel 24-Facet",
          color: k % 2 === 0 ? 47 : 41, backlit: true,
          x: Math.cos(a) * 6.0, y: eyeCenterY + Math.sin(a) * 6.0, z: 0.55,
          rotZ: a - Math.PI / 2,
          step: 3, layer: 2.8, role: "light_pipe_gem"
        });
      }

      // STEP 4: Real meshing concentric brass gears (40T main iris + two 24T drive pinions at EXACT C=(40+24)/16 = 4.0 studs? Offset neatly at perimeter!)
      // Flanking meshing gear pair on left & right of the shrine!
      const gMain = registerPart({
        kind: "gear", partNum: "3649", partName: "Technic Gear 40 Tooth",
        teeth: 40, thickness: 0.48, axis: "z", color: 297,
        x: 0, y: eyeCenterY, z: -0.78,
        step: 4, layer: 3.4, role: "iris_ring_gear"
      });
      gMain.mesh.userData.axis = "z";
      gMain.mesh.userData.ratio = 0.45;
      gearsList.push(gMain.mesh);

      // Left & Right meshing 24T brass driver gears: C = (40 + 24)/16 = 4.0 studs from center?
      // Place them at lower flanks (dist = 4.0 from center? No, 40T pitchR=2.5, 24T pitchR=1.5 -> C=4.0!)
      const meshDist = (40 + 24) / 16.0; // exact 4.0 studs!
      [
        { ang: -Math.PI * 0.78, dir: -1, col: 297 },
        { ang: -Math.PI * 0.22, dir: -1, col: 297 }
      ].forEach((side, idx) => {
        const gx = Math.cos(side.ang) * meshDist;
        const gy = eyeCenterY + Math.sin(side.ang) * meshDist;
        const gPinion = registerPart({
          kind: "gear", partNum: "3648", partName: "Technic Gear 24 Tooth",
          teeth: 24, thickness: 0.48, axis: "z", color: side.col,
          x: gx, y: gy, z: -0.78, rotZ: Math.PI / 24,
          step: 4, layer: 3.4, role: "iris_drive_pinion"
        });
        gPinion.mesh.userData.axis = "z";
        gPinion.mesh.userData.ratio = -0.45 * (40 / 24);
        gearsList.push(gPinion.mesh);

        // Cross-axle supporting each pinion
        registerPart({
          kind: "axle", partNum: "3706", partName: "Technic Axle 6L",
          len: 3.2, axis: "z", color: 72,
          x: gx, y: gy, z: -0.85,
          step: 4, layer: 3.4, role: "drive_axle"
        });

        // Perforated support liftarm connecting pinion axle down to plinth
        registerPart({
          kind: "liftarm", partNum: "32524", partName: "Technic Liftarm Thick 7L",
          len: 7, color: 72,
          x: gx * 1.15, y: 3.6, z: -1.45,
          rotZ: idx === 0 ? 1.28 : -1.28,
          step: 4, layer: 3.2, role: "structural_strut"
        });
      });

      // Lower front meshing showcase pair: 16T + 24T at exact C = (16+24)/16 = 2.50 studs!
      const gFrontA = registerPart({
        kind: "gear", partNum: "94925", partName: "Technic Gear 16 Tooth",
        teeth: 16, thickness: 0.48, axis: "z", color: 383,
        x: -1.25, y: 2.35, z: 1.25,
        step: 4, layer: 3.6, role: "front_escapement_driver"
      });
      gFrontA.mesh.userData.axis = "z";
      gFrontA.mesh.userData.ratio = 1.5;
      gearsList.push(gFrontA.mesh);

      const gFrontB = registerPart({
        kind: "gear", partNum: "3648", partName: "Technic Gear 24 Tooth",
        teeth: 24, thickness: 0.48, axis: "z", color: 297,
        x: 1.25, y: 2.35, z: 1.25, rotZ: Math.PI / 24,
        step: 4, layer: 3.6, role: "front_escapement_driven"
      });
      gFrontB.mesh.userData.axis = "z";
      gFrontB.mesh.userData.ratio = -1.0;
      gearsList.push(gFrontB.mesh);

      [-1.25, 1.25].forEach(ax => {
        registerPart({ kind: "axle", partNum: "3705", partName: "Technic Axle 4L", len: 2.4, axis: "z", color: 0, x: ax, y: 2.35, z: 0.9, step: 4, layer: 3.6, role: "escapement_axle" });
      });

      // STEP 5: Gothic lantern finial crown & refracting spire crystal
      registerPart({ kind: "brick", partNum: "3004", partName: "Brick 1 x 2", sx: 2, plates: 3, sz: 2, color: 0, x: 0, y: eyeCenterY + 6.45, z: 0, step: 5, layer: 4.5, role: "crown_pedestal" });
      registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 297, x: -1.6, y: eyeCenterY + 6.25, z: 0, rotY: -Math.PI / 2, step: 5, layer: 4.5, role: "crown_arch" });
      registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 297, x: 1.6, y: eyeCenterY + 6.25, z: 0, rotY: Math.PI / 2, step: 5, layer: 4.5, role: "crown_arch" });
      registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Jewel 24-Facet", color: 35, backlit: true, x: 0, y: eyeCenterY + 7.65, z: 0, step: 5, layer: 5.0, role: "crown_beacon" });
    }

    function buildGbcSorterAssembly() {
      stepDescriptions = [
        "Step 1/5: 16x12 Modular GBC Base Deck & Framing Plates (3020, 3001)",
        "Step 2/5: Perforated Technic Liftarm Gantry Towers & Pins (32525, 32524, 2780)",
        "Step 3/5: Mathematically Meshing 8T-24T-16T-40T Compound Gear Train (3647, 3648, 94925, 3649)",
        "Step 4/5: Dual-Rail Sloped Translucent Ball Track & Gravity Sieve (3039, 3004, 98138)",
        "Step 5/5: Illuminated Crystal Cavern Portal Archway & Ball Hopper (30153, 3003)"
      ];

      if (backlightLight) { backlightLight.position.set(0, 5.5, 2.5); backlightLight.intensity = 1.6; backlightLight.color.setHex(0x2fe4ff); }

      // STEP 1: Solid interlocking GBC base deck
      for (let ix = -6; ix <= 6; ix += 2) {
        for (let iz = -4; iz <= 4; iz += 4) {
          registerPart({
            kind: "brick", partNum: "3020", partName: "Plate 2 x 4",
            sx: 2, plates: 1, sz: 4,
            color: (Math.abs(ix) === 6) ? 0 : 72,
            x: ix, y: PLATE * 0.5, z: iz,
            step: 1, layer: 0, role: "gbc_baseplate"
          });
        }
      }
      // Corner gold alignment tiles (48x48 standard reference)
      [[-6, -5], [6, -5], [-6, 5], [6, 5]].forEach(([cx, cz]) => {
        registerPart({ kind: "rtile", partNum: "98138", partName: "Tile Round 1 x 1", color: 297, x: cx, y: PLATE * 1.5, z: cz, step: 1, layer: 0.3, role: "gbc_datum_marker" });
      });

      // STEP 2: Vertical Technic liftarm gearbox frame + horizontal tie beams + friction pins
      [-2.2, 2.2].forEach(zSide => {
        [-3.5, 1.5, 4.5].forEach(xPost => {
          registerPart({
            kind: "liftarm", partNum: "32524", partName: "Technic Liftarm Thick 7L",
            len: 7, color: 72,
            x: xPost, y: 3.6, z: zSide, rotZ: Math.PI / 2,
            step: 2, layer: 1.0, role: "gearbox_column"
          });
        });
        registerPart({
          kind: "liftarm", partNum: "32525", partName: "Technic Liftarm Thick 11L",
          len: 11, color: paletteColorAt(0, false),
          x: 0.5, y: 1.1, z: zSide,
          step: 2, layer: 1.1, role: "chassis_rail"
        });
        registerPart({
          kind: "liftarm", partNum: "32525", partName: "Technic Liftarm Thick 11L",
          len: 11, color: 71,
          x: 0.5, y: 6.1, z: zSide,
          step: 2, layer: 1.3, role: "upper_gantry_rail"
        });
        [-3.5, 1.5, 4.5].forEach(xp => {
          registerPart({ kind: "pin", partNum: "2780", partName: "Technic Pin with Friction", color: 0, x: xp, y: 1.1, z: zSide, step: 2, layer: 1.2, role: "structural_pin" });
          registerPart({ kind: "pin", partNum: "2780", partName: "Technic Pin with Friction", color: 1, x: xp, y: 6.1, z: zSide, step: 2, layer: 1.4, role: "structural_pin" });
        });
      });

      // STEP 3: Mathematically exact meshing compound gear train!
      // Stage 1: 8T (x = -3.5, y = 3.1) meshes with 24T at C = (8+24)/16 = 2.0 -> x = -1.5, y = 3.1
      // Stage 2: 16T on same shaft (x = -1.5, y = 3.1, z offset) meshes with 40T at C = (16+40)/16 = 3.5 -> x = +2.0, y = 3.1!
      const g1 = registerPart({ kind: "gear", partNum: "3647", partName: "Technic Gear 8 Tooth", teeth: 8, axis: "z", color: 71, x: -3.5, y: 3.4, z: 0.7, step: 3, layer: 2.0, role: "stage1_driver_8t" });
      g1.mesh.userData.axis = "z"; g1.mesh.userData.ratio = 3.0; gearsList.push(g1.mesh);

      const g2 = registerPart({ kind: "gear", partNum: "3648", partName: "Technic Gear 24 Tooth", teeth: 24, axis: "z", color: 297, x: -1.5, y: 3.4, z: 0.7, rotZ: Math.PI / 24, step: 3, layer: 2.0, role: "stage1_driven_24t" });
      g2.mesh.userData.axis = "z"; g2.mesh.userData.ratio = -1.0; gearsList.push(g2.mesh);

      const g3 = registerPart({ kind: "gear", partNum: "94925", partName: "Technic Gear 16 Tooth", teeth: 16, axis: "z", color: 383, x: -1.5, y: 3.4, z: -0.5, step: 3, layer: 2.2, role: "stage2_driver_16t" });
      g3.mesh.userData.axis = "z"; g3.mesh.userData.ratio = -1.0; gearsList.push(g3.mesh);

      const g4 = registerPart({ kind: "gear", partNum: "3649", partName: "Technic Gear 40 Tooth", teeth: 40, axis: "z", color: 297, x: 2.0, y: 3.4, z: -0.5, rotZ: Math.PI / 40, step: 3, layer: 2.2, role: "gbc_lifter_wheel_40t" });
      g4.mesh.userData.axis = "z"; g4.mesh.userData.ratio = 16 / 40; gearsList.push(g4.mesh);

      // Cross-axles through all three gear shafts
      [-3.5, -1.5, 2.0].forEach(ax => {
        registerPart({ kind: "axle", partNum: "3707", partName: "Technic Axle 8L", len: 5.8, axis: "z", color: 0, x: ax, y: 3.4, z: 0, step: 3, layer: 2.1, role: "gearbox_shaft" });
      });

      // STEP 4: Inclined dual-rail translucent gravity ball chute
      for (let k = 0; k < 6; k++) {
        const bx = 4.0 - k * 1.85;
        const by = 5.4 - k * 0.42;
        registerPart({
          kind: "brick", partNum: "3004", partName: "Brick 1 x 2",
          sx: 2, plates: 1, sz: 1, color: k % 2 === 0 ? 41 : 143, backlit: true,
          x: bx, y: by, z: -1.1, rotZ: 0.22,
          step: 4, layer: 3.0, role: "ball_track_rail"
        });
        registerPart({
          kind: "brick", partNum: "3004", partName: "Brick 1 x 2",
          sx: 2, plates: 1, sz: 1, color: k % 2 === 0 ? 57 : 46, backlit: true,
          x: bx, y: by, z: -2.0, rotZ: 0.22,
          step: 4, layer: 3.0, role: "ball_track_rail"
        });
      }

      // STEP 5: Illuminated Crystal Cavern Portal Archway over the GBC lifter
      [-4.5, 4.5].forEach(ax => {
        for (let h = 0; h < 4; h++) {
          registerPart({
            kind: "brick", partNum: "3003", partName: "Brick 2 x 2",
            sx: 2, plates: 3, sz: 2, color: h % 2 === 0 ? 0 : 72,
            x: ax, y: PLATE + BRICK * (0.5 + h), z: -3.2,
            step: 5, layer: 4.0, role: "portal_pillar"
          });
        }
        registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Crystal Gem", color: ax < 0 ? 35 : 41, backlit: true, x: ax, y: 6.4, z: -3.2, step: 5, layer: 4.4, role: "portal_crystal" });
      });
      for (let ix = -3; ix <= 3; ix += 2) {
        registerPart({ kind: "brick", partNum: "3001", partName: "Brick 2 x 4", sx: 2, plates: 3, sz: 2, color: ix === 0 ? 52 : 33, backlit: true, x: ix, y: 6.6, z: -3.2, step: 5, layer: 4.5, role: "portal_lintel" });
      }
      registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Crystal Gem", color: 45, backlit: true, x: 0, y: 7.9, z: -3.2, step: 5, layer: 4.8, role: "keystone_crystal" });

      // Animated GBC Spheres riding the 40T scoop wheel & rolling down the chute
      const ballCols = [0x2fe4ff, 0xf5c451, 0x34e89e, 0xff7b1c, 0xb678ff, 0xf048a8];
      for (let b = 0; b < 6; b++) {
        const bMat = new THREE.MeshPhysicalMaterial({ color: ballCols[b], roughness: 0.08, metalness: 0.15, clearcoat: 1.0, emissive: new THREE.Color(ballCols[b]).multiplyScalar(0.28) });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 20), bMat);
        ball.castShadow = true;
        ball.userData = { phase: (b / 6) * Math.PI * 2 };
        ballsGroup.add(ball);
        gbcBalls.push(ball);
      }
    }

    function buildWalkingHexapodAssembly() {
      stepDescriptions = [
        "Step 1/4: Twin 15L Perforated Technic Spine Chassis & Crankshaft (32278, 3707)",
        "Step 2/4: Meshing 16T & 24T Central Drive Reduction Gears (94925, 3648)",
        "Step 3/4: Six Articulated Klann Walking Legs with Liftarm Linkages (32524, 2780, 3040)",
        "Step 4/4: Armored Slope Carapace & Translucent Crystal Sensor Canopy (3039, 30153, 98138)"
      ];

      if (backlightLight) { backlightLight.position.set(0, 6.0, 0); backlightLight.intensity = 1.5; backlightLight.color.setHex(0x50ff90); }

      const bodyY = 4.2;
      // STEP 1: Perforated chassis frame
      [-1.5, 1.5].forEach(zSide => {
        registerPart({ kind: "liftarm", partNum: "32278", partName: "Technic Liftarm Thick 15L", len: 15, color: 0, x: 0, y: bodyY, z: zSide, step: 1, layer: 0, role: "chassis_spine" });
        registerPart({ kind: "liftarm", partNum: "32525", partName: "Technic Liftarm Thick 11L", len: 11, color: 72, x: 0, y: bodyY + 1.1, z: zSide, step: 1, layer: 0.3, role: "upper_spine" });
      });
      registerPart({ kind: "axle", partNum: "3707", partName: "Technic Axle 8L", len: 12.5, axis: "x", color: 71, x: 0, y: bodyY, z: 0, step: 1, layer: 0.2, role: "main_crankshaft" });

      // STEP 2: Meshing central reduction gears (16T + 24T, exact C = 2.5 studs along X)
      const gd = registerPart({ kind: "gear", partNum: "94925", partName: "Technic Gear 16 Tooth", teeth: 16, axis: "z", color: 297, x: -1.25, y: bodyY + 0.5, z: 0, step: 2, layer: 1.0, role: "hexapod_driver_16t" });
      gd.mesh.userData.axis = "z"; gd.mesh.userData.ratio = 1.5; gearsList.push(gd.mesh);

      const gn = registerPart({ kind: "gear", partNum: "3648", partName: "Technic Gear 24 Tooth", teeth: 24, axis: "z", color: 383, x: 1.25, y: bodyY + 0.5, z: 0, rotZ: Math.PI / 24, step: 2, layer: 1.0, role: "hexapod_crank_24t" });
      gn.mesh.userData.axis = "z"; gn.mesh.userData.ratio = -1.0; gearsList.push(gn.mesh);

      // STEP 3: Six articulated Klann walking legs (3 port, 3 starboard, alternating 180-deg tripod gait!)
      [-4.2, 0, 4.2].forEach((xHip, legIdx) => {
        [-1, 1].forEach(side => {
          const legGroup = new THREE.Group();
          legGroup.position.set(xHip, bodyY, side * 1.9);
          const phase = ((legIdx % 2 === 0) ? 0 : Math.PI) + (side > 0 ? Math.PI : 0);
          legGroup.userData = { type: "leg", side, phase, basePosY: bodyY, layer: 2.0 };
          machineGroup.add(legGroup);

          // Upper femur liftarm (locked cleanly from hip z=0 to knee z=side*4.1)
          registerPart({ kind: "liftarm", partNum: "32524", partName: "Technic Liftarm Thick 7L", len: 7, color: 297, x: 0, y: -0.25, z: side * 2.1, rotY: Math.PI / 2, rotX: side * 0.16, parent: legGroup, step: 3, layer: 2.0, role: "klann_femur" });
          // Knee friction pin locked right at the femur-tibia intersection
          registerPart({ kind: "pin", partNum: "2780", partName: "Technic Pin with Friction", color: 1, x: 0, y: -0.68, z: side * 4.35, parent: legGroup, step: 3, layer: 2.1, role: "knee_joint_pin" });
          // Lower tibia liftarm descending cleanly from knee pin down to foot pad
          registerPart({ kind: "liftarm", partNum: "32524", partName: "Technic Liftarm Thick 7L", len: 7, color: 72, x: 0, y: -2.35, z: side * 4.65, rotY: Math.PI / 2, rotZ: Math.PI / 2 - side * 0.14, parent: legGroup, step: 3, layer: 2.2, role: "klann_tibia" });
          // Armored slope foot pad seated cleanly under tibia end
          registerPart({ kind: "slope", partNum: "3040", partName: "Slope 45 deg 1 x 2", sx: 1, plates: 3, sz: 2, color: 0, x: 0, y: -3.75, z: side * 4.95, rotY: side > 0 ? 0 : Math.PI, parent: legGroup, step: 3, layer: 2.3, role: "foot_pad" });

          movingLinkages.push(legGroup);
        });
      });

      // STEP 4: Armored carapace & glowing translucent optical canopy
      for (let ix = -4; ix <= 4; ix += 2) {
        registerPart({ kind: "brick", partNum: "3001", partName: "Brick 2 x 4", sx: 2, plates: 3, sz: 4, color: ix === 0 ? 1 : 0, x: ix, y: bodyY + 2.1, z: 0, step: 4, layer: 3.0, role: "carapace_hull" });
        registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 72, x: ix, y: bodyY + 3.1, z: -1.4, rotY: Math.PI, step: 4, layer: 3.2, role: "dorsal_armor" });
        registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 72, x: ix, y: bodyY + 3.1, z: 1.4, rotY: 0, step: 4, layer: 3.2, role: "dorsal_armor" });
      }
      // Forward glowing Beholder sensor visor & translucent crystal dorsal spine
      registerPart({ kind: "rtile", partNum: "98138", partName: "Tile Round 1 x 1", color: 35, backlit: true, x: 5.3, y: bodyY + 2.1, z: 0, rotZ: -Math.PI / 2, step: 4, layer: 3.5, role: "optical_sensor_eye" });
      [-2.5, 0, 2.5].forEach((gx, idx) => {
        registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Crystal Gem", color: [41, 35, 52][idx], backlit: true, x: gx, y: bodyY + 4.3, z: 0, step: 4, layer: 3.6, role: "sensor_crystal" });
      });
    }

    function buildPlanetaryOrreryAssembly() {
      stepDescriptions = [
        "Step 1/4: Stepped Obsidian & Pearl-Gold Astrolabe Pedestal (3020, 3003, 3039)",
        "Step 2/4: Coaxial 40T Sun Ring Gear & Central Vertical Axle Column (3649, 3707)",
        "Step 3/4: Triple Epicyclic Liftarm Cantilevers & Meshing 16T Planet Gears (32524, 94925)",
        "Step 4/4: Luminous Translucent Crystal Worlds & Solar Core Beacon (30153, 98138)"
      ];

      if (backlightLight) { backlightLight.position.set(0, 6.2, 0); backlightLight.intensity = 2.4; backlightLight.color.setHex(0xf5c451); }

      // STEP 1: Octagonal stepped base plinth
      for (let ix = -4; ix <= 4; ix += 2) {
        for (let iz = -4; iz <= 4; iz += 2) {
          if (Math.hypot(ix, iz) > 5.2) continue;
          registerPart({ kind: "brick", partNum: "3022", partName: "Plate 2 x 2", sx: 2, plates: 1, sz: 2, color: (Math.hypot(ix, iz) > 3.5) ? 0 : 72, x: ix, y: PLATE * 0.5, z: iz, step: 1, layer: 0, role: "astrolabe_base" });
        }
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 297, x: Math.cos(a) * 3.2, y: PLATE + BRICK * 0.5, z: Math.sin(a) * 3.2, rotY: -a + Math.PI / 2, step: 1, layer: 0.4, role: "pedestal_buttress" });
      }
      registerPart({ kind: "brick", partNum: "3003", partName: "Brick 2 x 2", sx: 2, plates: 3, sz: 2, color: 0, x: 0, y: PLATE + BRICK * 0.5, z: 0, step: 1, layer: 0.4, role: "turntable_tower" });
      registerPart({ kind: "brick", partNum: "3003", partName: "Brick 2 x 2", sx: 2, plates: 3, sz: 2, color: 72, x: 0, y: PLATE + BRICK * 1.5, z: 0, step: 1, layer: 0.6, role: "turntable_tower" });

      // STEP 2: Central 40T horizontal sun gear + axle column
      const sunGear = registerPart({ kind: "gear", partNum: "3649", partName: "Technic Gear 40 Tooth", teeth: 40, axis: "y", color: 297, x: 0, y: 3.4, z: 0, step: 2, layer: 1.2, role: "sun_ring_gear_40t" });
      sunGear.mesh.userData.axis = "y"; sunGear.mesh.userData.ratio = 0.55; gearsList.push(sunGear.mesh);

      registerPart({ kind: "axle", partNum: "3707", partName: "Technic Axle 8L", len: 7.5, axis: "y", color: 383, x: 0, y: 4.2, z: 0, step: 2, layer: 1.4, role: "solar_spindle" });

      // STEP 3 & 4: Three orbiting epicyclic cantilever arms + meshing 16T gears (C = (40+16)/16 = 3.5 studs!) + crystal worlds
      const planetCols = [41, 35, 52];
      const planetRadii = [3.5, 4.8, 6.2];
      const armHeights = [3.4, 4.9, 6.3];
      for (let i = 0; i < 3; i++) {
        const orb = new THREE.Group();
        orb.rotation.y = (i / 3) * Math.PI * 2;
        orb.userData = { type: "orbit", speed: (i % 2 === 0 ? 1 : -0.75) * (1.25 - i * 0.25), basePosY: 0, layer: 2.0 + i * 0.4 };
        machineGroup.add(orb);

        const r = planetRadii[i];
        const hy = armHeights[i];
        registerPart({ kind: "liftarm", partNum: "32524", partName: "Technic Liftarm Thick 7L", len: 7, color: i === 1 ? 297 : 72, x: r * 0.5, y: hy - 0.55, z: 0, rotX: Math.PI / 2, parent: orb, step: 3, layer: 2.0 + i * 0.3, role: "orrery_cantilever" });

        const pg = registerPart({ kind: "gear", partNum: "94925", partName: "Technic Gear 16 Tooth", teeth: 16, axis: "y", color: i === 0 ? 383 : 297, x: r, y: hy, z: 0, parent: orb, step: 3, layer: 2.2 + i * 0.3, role: "epicyclic_planet_gear" });
        pg.mesh.userData.axis = "y"; pg.mesh.userData.ratio = -1.8; gearsList.push(pg.mesh);

        // Crystal planet assembly atop gear
        registerPart({ kind: "brick", partNum: "3005", partName: "Brick 1 x 1", sx: 1, plates: 3, sz: 1, color: planetCols[i], backlit: true, x: r, y: hy + 0.9, z: 0, parent: orb, step: 4, layer: 3.0 + i * 0.3, role: "crystal_planet_core" });
        registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Crystal Gem", color: planetCols[i], backlit: true, x: r, y: hy + 2.0, z: 0, parent: orb, step: 4, layer: 3.2 + i * 0.3, role: "crystal_planet_crown" });
        registerPart({ kind: "rtile", partNum: "98138", partName: "Tile Round 1 x 1", color: 46, backlit: true, x: r, y: hy + 0.28, z: 0, parent: orb, step: 4, layer: 3.1 + i * 0.3, role: "orbital_collar" });

        movingLinkages.push(orb);
      }

      // Central Solar Core Crystal Crown
      registerPart({ kind: "brick", partNum: "3003", partName: "Brick 2 x 2", sx: 2, plates: 3, sz: 2, color: 46, backlit: true, x: 0, y: 7.4, z: 0, step: 4, layer: 3.8, role: "solar_core_cube" });
      registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Crystal Gem", color: 57, backlit: true, x: 0, y: 8.7, z: 0, step: 4, layer: 4.0, role: "solar_core_prism" });
    }

    function buildHarmonicCamOrGantryAssembly(mType) {
      stepDescriptions = [
        "Step 1/4: Structural Base Platform & Technic Frame Rails (3020, 32525)",
        "Step 2/4: Meshing 8T-24T-16T Camshaft Reduction Gearbox (3647, 3648, 94925, 3707)",
        "Step 3/4: Phase-Shifted Kinetic Actuator Columns & Linkages (32524, 3003)",
        "Step 4/4: Translucent Harmonic Prism Crown & Signal Optics (30153, 98138)"
      ];

      if (backlightLight) { backlightLight.position.set(0, 5.5, 2.5); backlightLight.intensity = 1.8; backlightLight.color.setHex(0xb678ff); }

      for (let ix = -6; ix <= 6; ix += 2) {
        registerPart({ kind: "brick", partNum: "3020", partName: "Plate 2 x 4", sx: 2, plates: 1, sz: 4, color: ix % 4 === 0 ? 0 : 72, x: ix, y: PLATE * 0.5, z: 0, step: 1, layer: 0, role: "loom_base" });
      }
      [-1.8, 1.8].forEach(zSide => {
        registerPart({ kind: "liftarm", partNum: "32278", partName: "Technic Liftarm Thick 15L", len: 15, color: 72, x: 0, y: 2.2, z: zSide, step: 1, layer: 0.4, role: "camshaft_frame" });
      });
      registerPart({ kind: "axle", partNum: "3707", partName: "Technic Axle 8L", len: 14.2, axis: "x", color: 0, x: 0, y: 2.2, z: 0, step: 2, layer: 1.0, role: "helical_camshaft" });

      // Meshing end drive gears (8T + 24T at exact C = 2.0 studs)
      const g1 = registerPart({ kind: "gear", partNum: "3647", partName: "Technic Gear 8 Tooth", teeth: 8, axis: "x", color: 383, x: -7.5, y: 4.2, z: 0, step: 2, layer: 1.1, role: "cam_driver_8t" });
      g1.mesh.userData.axis = "x"; g1.mesh.userData.ratio = 3.0; gearsList.push(g1.mesh);

      const g2 = registerPart({ kind: "gear", partNum: "3648", partName: "Technic Gear 24 Tooth", teeth: 24, axis: "x", color: 297, x: -7.5, y: 2.2, z: 0, rotX: Math.PI / 24, step: 2, layer: 1.1, role: "cam_driven_24t" });
      g2.mesh.userData.axis = "x"; g2.mesh.userData.ratio = -1.0; gearsList.push(g2.mesh);

      const waveCols = [41, 143, 35, 46, 57, 45, 52, 33, 41];
      for (let i = 0; i < 9; i++) {
        const px = -5.6 + i * 1.4;
        const colGroup = new THREE.Group();
        colGroup.position.set(px, 4.4, 0);
        colGroup.userData = { type: "wave_bar", phase: i * 0.62, basePosY: 4.4, layer: 2.2 };
        machineGroup.add(colGroup);

        registerPart({ kind: "brick", partNum: "3005", partName: "Brick 1 x 1", sx: 1, plates: 3, sz: 1, color: 71, x: 0, y: -1.1, z: 0, parent: colGroup, step: 3, layer: 2.0, role: "cam_follower_rod" });
        registerPart({ kind: "brick", partNum: "3003", partName: "Brick 2 x 2", sx: 1, plates: 3, sz: 2, color: waveCols[i], backlit: true, x: 0, y: 0.2, z: 0, parent: colGroup, step: 4, layer: 2.8, role: "harmonic_prism_block" });
        registerPart({ kind: "gem", partNum: "30153", partName: "Rock 1 x 1 Crystal Gem", color: waveCols[i], backlit: true, x: 0, y: 1.4, z: 0, parent: colGroup, step: 4, layer: 3.1, role: "harmonic_crystal_tip" });
        movingLinkages.push(colGroup);
      }

      if (mType === "swing_wing") {
        [-1, 1].forEach(side => {
          const wing = new THREE.Group();
          wing.position.set(0, 4.2, side * 2.2);
          wing.userData = { type: "wing", side, basePosY: 4.2, layer: 2.5 };
          machineGroup.add(wing);
          registerPart({ kind: "liftarm", partNum: "32525", partName: "Technic Liftarm Thick 11L", len: 11, color: 297, x: 0, y: 0, z: side * 3.8, rotY: Math.PI / 2, parent: wing, step: 3, layer: 2.5, role: "swing_wing_spar" });
          registerPart({ kind: "slope", partNum: "3039", partName: "Slope 45 deg 2 x 2", sx: 2, plates: 3, sz: 2, color: 41, backlit: true, x: 0, y: 0.6, z: side * 5.2, parent: wing, step: 4, layer: 2.8, role: "wing_fairing" });
          movingLinkages.push(wing);
        });
      }
    }

    function buildClutterPieces() {
      // Subtle artistic brick scatter around outer edge controlled by Separatio slider
      const cols = [0, 297, 41, 35, 52, 57, 71, 4];
      for (let i = 0; i < 34; i++) {
        const isNoise = i < 16;
        const a = (i / 34) * Math.PI * 2 + 0.3;
        const r = 8.6 + (i % 4) * 0.95;
        const mat = isNoise
          ? new THREE.MeshPhysicalMaterial({ color: 0xb678ff, metalness: 0.9, roughness: 0.22 })
          : getBrickMaterial(LDRAW_COLORS[cols[i % cols.length]], false);
        const geo = isNoise ? new THREE.OctahedronGeometry(0.32, 0) : getBeveledBodyGeo(1, 3, 2);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(Math.cos(a) * r, 0.55, Math.sin(a) * r);
        m.rotation.set(isNoise ? i : 0, a, 0);
        m.castShadow = true;
        m.userData = { isNoise };
        clutterGroup.add(m);
      }
    }

    function applyStepVisibility() {
      const all = partRecords;
      let visibleCount = 0;
      for (let i = 0; i < all.length; i++) {
        const vis = all[i].step <= currentStep;
        all[i].mesh.visible = vis;
        if (vis) visibleCount++;
      }
      onStepChange({
        currentStep,
        maxStep,
        visibleParts: visibleCount + customRecords.length,
        totalParts: all.length + customRecords.length,
        description: stepDescriptions[Math.min(stepDescriptions.length - 1, Math.max(0, currentStep - 1))] || `Step ${currentStep}/${maxStep}`,
        isPlaying: stepPlayActive
      });
    }

    function computeAndEmitTelemetry() {
      const all = partRecords.concat(customRecords);
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      let grams = 0;
      const lotMap = new Set();

      for (let i = 0; i < all.length; i++) {
        const r = all[i];
        const hx = (r.dimsStuds[0] * STUD) / 2;
        const hy = r.heightWorld / 2;
        const hz = (r.dimsStuds[2] * STUD) / 2;
        minX = Math.min(minX, r.x - hx); maxX = Math.max(maxX, r.x + hx);
        minY = Math.min(minY, r.y - hy); maxY = Math.max(maxY, r.y + hy);
        minZ = Math.min(minZ, r.z - hz); maxZ = Math.max(maxZ, r.z + hz);
        grams += r.grams || 0.6;
        lotMap.add(`${r.partNum}_${r.colorObj.id}`);
      }
      if (!all.length) { minX = maxX = minY = maxY = minZ = maxZ = 0; }
      const wS = Math.max(1, Math.round(maxX - minX));
      const dS = Math.max(1, Math.round(maxZ - minZ));
      const hPlates = Math.max(1, Math.round((maxY - minY) / PLATE));
      const hS = +(hPlates * 0.4).toFixed(1);

      onTelemetry({
        partCount: all.length,
        customCount: customRecords.length,
        uniqueLots: lotMap.size,
        studsW: wS,
        studsD: dS,
        studsH: hS,
        platesH: hPlates,
        mmW: Math.round(wS * 8.0),
        mmD: Math.round(dS * 8.0),
        mmH: Math.round(hPlates * 3.2),
        grams: +grams.toFixed(1),
        projection: projectionMode,
        renderMode,
        tool: activeTool
      });
    }

    function rebuildScene(blueprint, palette) {
      if (blueprint) currentBlueprint = blueprint;
      if (palette) currentPalette = palette;
      if (useFallback2D || !scene || !currentBlueprint) return;

      clearAssembly();
      const mType = currentBlueprint.mechanism_type;
      if (mType === "ardentilaterum_eye") {
        buildArdentilaterumEyeAssembly();
        maxStep = 5;
        camTarget = { x: 0, y: 7.9, z: 0 };
        camSpherical = { radius: 26.2, theta: 0.24, phi: 1.38 };
      } else if (mType === "gbc_sorter") {
        buildGbcSorterAssembly();
        maxStep = 5;
        camTarget = { x: 0, y: 3.6, z: -0.6 };
        camSpherical = { radius: 22.0, theta: 0.62, phi: 1.06 };
      } else if (mType === "walking_hexapod") {
        buildWalkingHexapodAssembly();
        maxStep = 4;
        camTarget = { x: 0, y: 3.8, z: 0 };
        camSpherical = { radius: 21.5, theta: 0.68, phi: 1.04 };
      } else if (mType === "planetary_orrery") {
        buildPlanetaryOrreryAssembly();
        maxStep = 4;
        camTarget = { x: 0, y: 4.5, z: 0 };
        camSpherical = { radius: 21.0, theta: 0.55, phi: 1.02 };
      } else {
        buildHarmonicCamOrGantryAssembly(mType);
        maxStep = 4;
        camTarget = { x: 0, y: 3.8, z: 0 };
        camSpherical = { radius: 21.5, theta: 0.52, phi: 1.08 };
      }

      buildClutterPieces();
      currentStep = maxStep;
      stepPlayActive = false;
      updateCameraPos();
      applyStepVisibility();
      computeAndEmitTelemetry();
    }

    // --- REAL LDRAW (.LDR / .MPD) IMPORTER ---
    function parseLDrawColor(token) {
      const raw = String(token || "").trim();
      const hexMatch = /^0x2([0-9a-f]{6})$/i.exec(raw);
      if (hexMatch) {
        const hexUpper = hexMatch[1].toUpperCase();
        return {
          id: 16,
          bl: 0,
          name: `Custom #${hexUpper}`,
          hex: `#${hexUpper}`,
          trans: false,
          metal: false,
          ldrawColorToken: `0x2${hexUpper}`
        };
      }
      const cid = parseInt(raw, 10);
      if (Number.isFinite(cid) && LDRAW_COLORS[cid]) return LDRAW_COLORS[cid];
      return LDRAW_COLORS[71];
    }

    function importLDrawText(ldrText, sourceName) {
      if (useFallback2D || !scene) {
        return { ok: false, error: "WebGL 3D viewport unavailable" };
      }
      const rawText = String(ldrText || "");
      if (rawText.length > MAX_IMPORT_BYTES) {
        const msg = `LDraw file exceeds ${Math.round(MAX_IMPORT_BYTES / (1024 * 1024))} MB safety limit.`;
        onStatusMessage(msg);
        return { ok: false, error: msg };
      }
      const rawLines = rawText.split(/\r?\n/);
      let modelTitle = String(sourceName || "Imported LDraw Model")
        .replace(/^.*[\\/]/, "")
        .replace(/\.(ldr|mpd|dat|txt)$/i, "")
        .replace(/[\r\n]+/g, " ")
        .trim() || "Imported LDraw Model";

      const parsed = [];
      let stepIdx = 1;
      let sawFileHeader = false;
      let truncated = false;
      const stepNotes = {};

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i].trim();
        if (!line) continue;
        if (line.startsWith("0")) {
          const rest = line.slice(1).trim();
          const upper = rest.toUpperCase();
          if (upper.startsWith("FILE ")) {
            if (sawFileHeader && parsed.length > 0) break; // stop after main MPD model
            sawFileHeader = true;
            const fn = rest.slice(5).trim().replace(/\.(ldr|mpd|dat|txt)$/i, "");
            if (fn) modelTitle = fn;
          } else if (upper === "STEP") {
            stepIdx += 1;
          } else if (upper.startsWith("// STEP") || upper.startsWith("// BUILD STEP")) {
            stepNotes[stepIdx] = rest.replace(/^\/\/\s*/, "").trim();
          } else if (parsed.length === 0 && i === 0 && rest && !upper.startsWith("NAME:") && !upper.startsWith("AUTHOR:") && !upper.startsWith("!")) {
            modelTitle = rest.replace(/[\r\n]+/g, " ").trim();
          }
          continue;
        }
        if (!line.startsWith("1 ")) continue;
        const toks = line.split(/\s+/);
        if (toks.length < 15) continue;
        const colorToken = toks[1];
        const lx = parseFloat(toks[2]);
        const ly = parseFloat(toks[3]);
        const lz = parseFloat(toks[4]);
        const matVals = toks.slice(5, 14).map(parseFloat);
        if (![lx, ly, lz].every(Number.isFinite) || !matVals.every(Number.isFinite)) continue;

        if (parsed.length >= MAX_IMPORT_PARTS) {
          truncated = true;
          break;
        }
        const rawDat = toks.slice(14).join(" ").trim();
        const cleanFile = rawDat.replace(/^.*[\\/]/, "");
        const partNum = cleanFile.replace(/\.dat$/i, "") || "3001";
        parsed.push({
          colorObj: parseLDrawColor(colorToken),
          x: lx / 20.0,
          y: -ly / 20.0,
          z: lz / 20.0,
          m: matVals,
          partNum,
          ldrawFile: cleanFile.toLowerCase().endsWith(".dat") ? cleanFile : `${partNum}.dat`,
          step: stepIdx
        });
      }

      if (!parsed.length) {
        onStatusMessage("No valid LDraw Type-1 part lines found in file.");
        return { ok: false, error: "No valid LDraw Type-1 part lines found." };
      }

      // Auto-center X/Z around workbench origin and lift Y flush onto studio floor (minY >= 0)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i];
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
      }
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const liftY = Math.max(0, 0.6 - minY);

      clearAssembly();
      currentBlueprint = {
        id: "ldr_" + modelTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 36),
        name: modelTitle,
        mechanism_type: "ldraw_import",
        principle: "Imported LDraw (.ldr) CAD Assembly"
      };

      let mappedCount = 0;
      let proxyCount = 0;
      let actualMaxStep = 1;

      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i];
        actualMaxStep = Math.max(actualMaxStep, p.step);
        const spec = LDRAW_PART_SPECS[p.partNum.toLowerCase()] || null;
        if (spec) mappedCount += 1;
        else proxyCount += 1;

        const cObj = p.colorObj || LDRAW_COLORS[71];
        // Convert LDraw 3x3 rotation matrix (row-major a b c / d e f / g h i) to Three.js Euler
        // Accounting for LDraw -Y up -> Three.js +Y up similarity transform S * M * S where S = diag(1, -1, 1)
        const [a, b, c, d, e, f, g, h, k] = p.m;
        const m4 = new THREE.Matrix4().set(
          a, -b, c, 0,
          -d, e, -f, 0,
          g, -h, k, 0,
          0, 0, 0, 1
        );
        const rotOnly = new THREE.Matrix4().extractRotation(m4);
        const rotEuler = new THREE.Euler().setFromRotationMatrix(rotOnly, "YXZ");

        const recOpts = {
          kind: spec ? spec.kind : "brick",
          partNum: p.partNum,
          ldrawFile: p.ldrawFile,
          partName: spec ? spec.name : `LDraw Part ${p.partNum}`,
          sx: spec ? spec.sx : 1,
          plates: spec ? spec.plates : 3,
          sz: spec ? spec.sz : 1,
          smoothTop: spec ? Boolean(spec.smoothTop) : false,
          teeth: spec ? spec.teeth : undefined,
          len: spec ? spec.len : undefined,
          color: cObj,
          backlit: Boolean(cObj.trans),
          x: +(p.x - cx).toFixed(3),
          y: +(p.y + liftY).toFixed(3),
          z: +(p.z - cz).toFixed(3),
          rotEuler,
          ldrawMatrix: p.m,
          step: p.step,
          layer: Math.max(0, p.step - 1),
          role: spec ? "ldraw_mapped" : "ldraw_proxy",
          grams: spec ? spec.grams : 0.48
        };
        registerPart(recOpts);
      }

      maxStep = actualMaxStep;
      currentStep = maxStep;
      stepPlayActive = false;
      stepDescriptions = [];
      for (let s = 1; s <= maxStep; s++) {
        stepDescriptions.push(stepNotes[s] || `Step ${s}/${maxStep}: Imported LDraw sub-assembly`);
      }

      const span = Math.max(10, maxX - minX, maxZ - minZ, (maxY - minY) * 1.4);
      camTarget = { x: 0, y: Math.max(2.0, (maxY - minY + liftY) * 0.45), z: 0 };
      camSpherical = { radius: Math.min(44, Math.max(14, span * 1.75)), theta: 0.65, phi: 1.04 };
      targetSpherical = null;
      targetLook = null;

      updateCameraPos();
      applyStepVisibility();
      computeAndEmitTelemetry();

      const summary = {
        ok: true,
        name: modelTitle,
        partCount: parsed.length,
        steps: maxStep,
        mappedCount,
        proxyCount,
        truncated
      };
      onImportComplete(summary);
      return summary;
    }

    function loadSampleLDraw() {
      return importLDrawText(SAMPLE_LDRAW_GEARBOX, "NorthStar 3-Stage Compound GBC Gearbox Sample.ldr");
    }

    // --- CAMERA & VIEW CONTROLS ---
    function updateCameraPos() {
      if (!perspCam || !orthoCam) return;
      const sinP = Math.sin(camSpherical.phi);
      const x = camTarget.x + camSpherical.radius * sinP * Math.sin(camSpherical.theta);
      const y = camTarget.y + camSpherical.radius * Math.cos(camSpherical.phi);
      const z = camTarget.z + camSpherical.radius * sinP * Math.cos(camSpherical.theta);
      perspCam.position.set(x, y, z);
      perspCam.lookAt(camTarget.x, camTarget.y, camTarget.z);

      const w = container.clientWidth || 640;
      const h = container.clientHeight || 460;
      const aspect = w / Math.max(1, h);
      const frustum = camSpherical.radius * 0.44;
      orthoCam.left = -frustum * aspect;
      orthoCam.right = frustum * aspect;
      orthoCam.top = frustum;
      orthoCam.bottom = -frustum;
      orthoCam.position.set(x, y, z);
      orthoCam.lookAt(camTarget.x, camTarget.y, camTarget.z);
      orthoCam.updateProjectionMatrix();
    }

    function setView(preset) {
      autoOrbit = false;
      const cy = currentBlueprint && currentBlueprint.mechanism_type === "ardentilaterum_eye" ? 7.4 : 3.8;
      targetLook = { x: 0, y: cy, z: 0 };
      if (preset === "iso") {
        targetSpherical = { radius: 22.0, theta: 0.65, phi: 1.04 };
      } else if (preset === "front") {
        targetSpherical = { radius: 21.5, theta: 0.0, phi: Math.PI / 2 - 0.03 };
      } else if (preset === "side") {
        targetSpherical = { radius: 21.5, theta: Math.PI / 2, phi: Math.PI / 2 - 0.03 };
      } else if (preset === "top") {
        targetSpherical = { radius: 23.0, theta: 0.0, phi: 0.14 };
      } else if (preset === "closeup") {
        targetSpherical = { radius: 13.5, theta: 0.25, phi: 1.24 };
      }
    }

    function setProjection(mode) {
      projectionMode = (mode === "ortho") ? "ortho" : "persp";
      activeCam = projectionMode === "ortho" ? orthoCam : perspCam;
      updateCameraPos();
      computeAndEmitTelemetry();
    }

    function setRenderMode(mode) {
      if (!["studio", "edges", "wireframe", "xray"].includes(mode)) return;
      renderMode = mode;
      matCache.clear();
      const all = partRecords.concat(customRecords);
      for (let i = 0; i < all.length; i++) {
        const r = all[i];
        const newMat = getBrickMaterial(r.colorObj, r.backlit);
        r.mesh.traverse(ch => {
          if (ch.isMesh) ch.material = newMat;
          if (ch.name === "__cad_edges__") ch.visible = (renderMode === "edges");
        });
      }
      onRenderModeChange(renderMode);
      computeAndEmitTelemetry();
    }

    // --- INTERACTIVE BUILDER & RAYCAST INSPECTOR ---
    function buildGhostMesh() {
      if (!scene) return;
      if (ghostMesh) { scene.remove(ghostMesh); ghostMesh = null; }
      const spec = BUILDER_PARTS.find(p => p.key === builderPartKey) || BUILDER_PARTS[0];
      const cObj = LDRAW_COLORS[builderColorId] || LDRAW_COLORS[297];
      const gMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(cObj.hex),
        transparent: true,
        opacity: 0.52,
        roughness: 0.2,
        emissive: new THREE.Color(0x2fe4ff).multiplyScalar(0.25)
      });
      let geo;
      if (spec.kind === "brick") geo = getBeveledBodyGeo(spec.sx, spec.plates, spec.sz);
      else if (spec.kind === "slope") geo = getSlopeGeo(spec.sx, spec.plates, spec.sz);
      else if (spec.kind === "rtile" || spec.kind === "rplate") geo = getRoundTileGeo();
      else if (spec.kind === "gem") geo = getCrystalGemGeo();
      else if (spec.kind === "gear") geo = getInvoluteGearGeo(spec.teeth || 24, 0.48);
      else if (spec.kind === "axle") geo = getCrossAxleGeo(spec.len || 6);
      else if (spec.kind === "pin") geo = getPinGeo();
      else geo = getTechnicLiftarmGeo(spec.len || 7);

      ghostMesh = new THREE.Mesh(geo, gMat);
      ghostMesh.rotation.y = builderRotY;
      ghostMesh.visible = false;
      scene.add(ghostMesh);
    }

    function setTool(tool) {
      activeTool = tool;
      if (ghostMesh) ghostMesh.visible = false;
      if (activeTool === "place") buildGhostMesh();
      if (canvas) canvas.style.cursor = activeTool === "place" ? "crosshair" : (activeTool === "erase" ? "not-allowed" : "grab");
      onToolChange({ tool: activeTool, partKey: builderPartKey, colorId: builderColorId, rotDeg: Math.round((builderRotY * 180) / Math.PI) % 360 });
      computeAndEmitTelemetry();
    }

    function setBuilderPart(partKey) {
      builderPartKey = partKey;
      if (activeTool === "place") buildGhostMesh();
      onToolChange({ tool: activeTool, partKey: builderPartKey, colorId: builderColorId, rotDeg: Math.round((builderRotY * 180) / Math.PI) % 360 });
    }

    function setBuilderColor(colorId) {
      builderColorId = Number(colorId);
      if (activeTool === "place") buildGhostMesh();
      onToolChange({ tool: activeTool, partKey: builderPartKey, colorId: builderColorId, rotDeg: Math.round((builderRotY * 180) / Math.PI) % 360 });
    }

    function rotateBuilderPart() {
      builderRotY = (builderRotY + Math.PI / 2) % (Math.PI * 2);
      if (ghostMesh) ghostMesh.rotation.y = builderRotY;
      onToolChange({ tool: activeTool, partKey: builderPartKey, colorId: builderColorId, rotDeg: Math.round((builderRotY * 180) / Math.PI) % 360 });
    }

    function undoCustomPart() {
      const last = customRecords.pop();
      if (!last) return false;
      if (last.mesh && last.mesh.parent) last.mesh.parent.remove(last.mesh);
      if (selectionBox) selectionBox.visible = false;
      applyStepVisibility();
      computeAndEmitTelemetry();
      return true;
    }

    function clearCustomParts() {
      while (customRecords.length) {
        const r = customRecords.pop();
        if (r.mesh && r.mesh.parent) r.mesh.parent.remove(r.mesh);
      }
      if (selectionBox) selectionBox.visible = false;
      applyStepVisibility();
      computeAndEmitTelemetry();
    }

    function computeSnapPoint(ev) {
      if (!raycaster || !activeCam) return null;
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, activeCam);

      const spec = BUILDER_PARTS.find(p => p.key === builderPartKey) || BUILDER_PARTS[0];
      const hWorld = (spec.plates || 3) * PLATE;

      // Check existing bricks first so user can stack cleanly onto any top surface (clamped to 32x32x24 workbench)
      const targets = [machineGroup, customGroup];
      const hits = raycaster.intersectObjects(targets, true).filter(h => h.object.isMesh && h.object.visible);
      if (hits.length) {
        const hit = hits[0];
        const pt = hit.point;
        const n = hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
        const sx = Math.max(-16, Math.min(16, Math.round(pt.x + n.x * 0.45)));
        const sz = Math.max(-16, Math.min(16, Math.round(pt.z + n.z * 0.45)));
        const baseY = Math.max(0, Math.min(24 * STUD, Math.round((pt.y + Math.max(0, n.y) * 0.05) / PLATE) * PLATE));
        return { x: sx, y: baseY + hWorld / 2, z: sz };
      }

      if (floorPlane) {
        const fHits = raycaster.intersectObject(floorPlane, false);
        if (fHits.length) {
          const p = fHits[0].point;
          const sx = Math.max(-16, Math.min(16, Math.round(p.x)));
          const sz = Math.max(-16, Math.min(16, Math.round(p.z)));
          return { x: sx, y: hWorld / 2, z: sz };
        }
      }
      return null;
    }

    function handleViewportClick(ev) {
      if (!raycaster || !activeCam) return;
      const rect = canvas.getBoundingClientRect();
      pointerNDC.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, activeCam);

      if (activeTool === "place") {
        if (customRecords.length >= MAX_CUSTOM_PARTS) {
          onStatusMessage(`Workbench limit reached (${MAX_CUSTOM_PARTS} placed parts). Undo or Clear Placed to add more.`);
          return;
        }
        const snap = computeSnapPoint(ev);
        if (!snap) return;
        const spec = BUILDER_PARTS.find(p => p.key === builderPartKey) || BUILDER_PARTS[0];
        const cObj = LDRAW_COLORS[builderColorId] || LDRAW_COLORS[297];
        const rec = registerPart({
          kind: spec.kind,
          partNum: spec.partNum,
          partName: spec.name,
          sx: spec.sx,
          plates: spec.plates,
          sz: spec.sz,
          smoothTop: Boolean(spec.smoothTop),
          teeth: spec.teeth,
          len: spec.len,
          color: cObj,
          backlit: cObj.trans,
          x: snap.x,
          y: snap.y,
          z: snap.z,
          rotY: builderRotY,
          step: maxStep,
          layer: maxStep,
          role: "custom_user_part",
          grams: spec.grams,
          isCustom: true
        });
        selectPartRecord(rec);
        applyStepVisibility();
        computeAndEmitTelemetry();
        return;
      }

      const hits = raycaster.intersectObjects([machineGroup, customGroup], true).filter(h => h.object.isMesh && h.object.visible);
      if (!hits.length) {
        if (selectionBox) selectionBox.visible = false;
        onPartSelected(null);
        return;
      }
      const rec = hits[0].object.userData.partRecord;
      if (!rec) return;

      if (activeTool === "erase") {
        if (rec.isCustom) {
          customRecords = customRecords.filter(x => x.id !== rec.id);
        } else {
          partRecords = partRecords.filter(x => x.id !== rec.id);
        }
        if (rec.mesh && rec.mesh.parent) rec.mesh.parent.remove(rec.mesh);
        if (selectionBox) selectionBox.visible = false;
        onPartSelected(null);
        applyStepVisibility();
        computeAndEmitTelemetry();
        return;
      }

      selectPartRecord(rec);
    }

    function selectPartRecord(rec) {
      if (!rec || !rec.mesh) return;
      if (selectionBox) {
        selectionBox.setFromObject(rec.mesh);
        selectionBox.visible = true;
      }
      onPartSelected({
        id: rec.id,
        partNum: rec.partNum,
        partName: rec.partName,
        ldrawFile: rec.ldrawFile,
        colorId: rec.colorObj.id,
        colorName: rec.colorObj.name,
        hex: rec.colorObj.hex,
        step: rec.step,
        role: rec.role,
        studX: +rec.x.toFixed(2),
        studY: +(rec.y / PLATE).toFixed(1),
        studZ: +rec.z.toFixed(2),
        lduX: Math.round(rec.x * 20),
        lduY: Math.round(-rec.y * 20),
        lduZ: Math.round(rec.z * 20),
        isCustom: rec.isCustom
      });
    }

    // --- REAL INDUSTRY-STANDARD CAD EXPORTERS ---
    function csvField(val) {
      return `"${String(val == null ? "" : val).replace(/"/g, '""')}"`;
    }

    function escapeXml(val) {
      return String(val == null ? "" : val)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
    }

    function formatLDrawMatrix(rec) {
      if (Array.isArray(rec.ldrawMatrix) && rec.ldrawMatrix.length === 9 && rec.ldrawMatrix.every(Number.isFinite)) {
        return rec.ldrawMatrix.map(v => (+v).toFixed(4)).join(" ");
      }
      if (typeof THREE !== "undefined" && rec.mesh && rec.mesh.rotation) {
        const m4 = new THREE.Matrix4().makeRotationFromEuler(rec.mesh.rotation);
        const e = m4.elements;
        // Convert Three.js +Y-up column-major matrix back to LDraw -Y-up row-major via S * R * S
        const vals = [e[0], -e[4], e[8], -e[1], e[5], -e[9], e[2], -e[6], e[10]];
        return vals.map(v => (Math.abs(v) < 1e-6 ? 0 : v).toFixed(4)).join(" ");
      }
      const c = Math.cos(rec.rotY || 0);
      const s = Math.sin(rec.rotY || 0);
      return `${c.toFixed(4)} 0 ${s.toFixed(4)} 0 1 0 ${(-s).toFixed(4)} 0 ${c.toFixed(4)}`;
    }

    function generateLDrawText() {
      const rawTitle = currentBlueprint ? currentBlueprint.name : "Brick Alchemy Assembly";
      const title = String(rawTitle || "Brick Alchemy Assembly").replace(/[\r\n]+/g, " ").trim() || "Brick Alchemy Assembly";
      const all = partRecords.concat(customRecords);
      const byStep = new Map();
      for (let i = 0; i < all.length; i++) {
        const s = all[i].step || 1;
        if (!byStep.has(s)) byStep.set(s, []);
        byStep.get(s).push(all[i]);
      }
      const lines = [
        `0 ${title}`,
        `0 Name: ${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.ldr`,
        "0 Author: NorthStar Brick Alchemy CAD Studio v2.2 (northstarprime.net/brick-alchemy/studio/)",
        "0 !LDRAW_ORG Unofficial_Model",
        "0 BFC CERTIFY CCW",
        ""
      ];
      const steps = Array.from(byStep.keys()).sort((a, b) => a - b);
      for (let si = 0; si < steps.length; si++) {
        const st = steps[si];
        if (si > 0) lines.push("0 STEP");
        lines.push(`0 // Build Step ${st}`);
        const list = byStep.get(st);
        for (let i = 0; i < list.length; i++) {
          const r = list[i];
          const lx = (r.x * 20).toFixed(2);
          const ly = (-r.y * 20).toFixed(2);
          const lz = (r.z * 20).toFixed(2);
          const m = formatLDrawMatrix(r);
          const colTok = r.colorObj.ldrawColorToken || r.colorObj.id;
          lines.push(`1 ${colTok} ${lx} ${ly} ${lz} ${m} ${r.ldrawFile}`);
        }
      }
      lines.push("0 NOFILE");
      return lines.join("\r\n") + "\r\n";
    }

    function generateBrickLinkXML() {
      const all = partRecords.concat(customRecords);
      const counts = new Map();
      for (let i = 0; i < all.length; i++) {
        const r = all[i];
        const key = `${r.partNum}|${r.colorObj.bl}`;
        const cur = counts.get(key) || { partNum: r.partNum, blColor: r.colorObj.bl, qty: 0 };
        cur.qty += 1;
        counts.set(key, cur);
      }
      const lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<INVENTORY>"];
      counts.forEach(item => {
        lines.push("  <ITEM>");
        lines.push("    <ITEMTYPE>P</ITEMTYPE>");
        lines.push(`    <ITEMID>${escapeXml(item.partNum)}</ITEMID>`);
        lines.push(`    <COLOR>${escapeXml(item.blColor)}</COLOR>`);
        lines.push(`    <MINQTY>${item.qty}</MINQTY>`);
        lines.push("  </ITEM>");
      });
      lines.push("</INVENTORY>");
      return lines.join("\n") + "\n";
    }

    function generateRebrickableCSV() {
      const all = partRecords.concat(customRecords);
      const counts = new Map();
      for (let i = 0; i < all.length; i++) {
        const r = all[i];
        const key = `${r.partNum}|${r.colorObj.id}`;
        const cur = counts.get(key) || { partNum: r.partNum, colorId: r.colorObj.id, partName: r.partName, colorName: r.colorObj.name, qty: 0 };
        cur.qty += 1;
        counts.set(key, cur);
      }
      const lines = ["Part,Color,Quantity,PartName,ColorName"];
      counts.forEach(item => {
        lines.push(`${csvField(item.partNum)},${item.colorId},${item.qty},${csvField(item.partName)},${csvField(item.colorName)}`);
      });
      return lines.join("\n") + "\n";
    }

    function triggerDownload(filename, content, mime) {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    }

    function exportLDraw() {
      const slug = (currentBlueprint ? currentBlueprint.id : "brick_alchemy").replace(/[^a-z0-9_-]/gi, "_");
      triggerDownload(`NorthStar_${slug}.ldr`, generateLDrawText(), "text/plain;charset=utf-8");
    }

    function exportBrickLinkXML() {
      const slug = (currentBlueprint ? currentBlueprint.id : "brick_alchemy").replace(/[^a-z0-9_-]/gi, "_");
      triggerDownload(`NorthStar_${slug}_BrickLink.xml`, generateBrickLinkXML(), "application/xml;charset=utf-8");
    }

    function exportRebrickableCSV() {
      const slug = (currentBlueprint ? currentBlueprint.id : "brick_alchemy").replace(/[^a-z0-9_-]/gi, "_");
      triggerDownload(`NorthStar_${slug}_BOM.csv`, generateRebrickableCSV(), "text/csv;charset=utf-8");
    }

    function exportSnapshotPNG() {
      if (!renderer || !scene || !activeCam) return;
      renderer.render(scene, activeCam);
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `NorthStar_BrickCAD_${Date.now()}.png`;
      a.click();
    }

    // --- 2D FALLBACK RENDERER (ZERO CONSOLE/PAGE ERRORS IF WEBGL DISABLED) ---
    function startFallback2D() {
      useFallback2D = true;
      canvas.style.display = "none";
      fallbackCanvas.style.display = "block";
      const ctx = fallbackCanvas.getContext("2d");
      function draw() {
        const w = container.clientWidth || 640;
        const h = container.clientHeight || 460;
        if (fallbackCanvas.width !== w || fallbackCanvas.height !== h) {
          fallbackCanvas.width = w;
          fallbackCanvas.height = h;
        }
        const t = reducedMotion ? 0 : performance.now() * 0.001;
        const speed = reducedMotion ? 0 : (driveRPM / 60) * 1.4;
        ctx.fillStyle = "#090d1e";
        ctx.fillRect(0, 0, w, h);
        // CAD blueprint grid
        ctx.strokeStyle = "rgba(47,228,255,0.12)";
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 28) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
        for (let y = 0; y < h; y += 28) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
        const gears = [
          { x: w * 0.35, y: h * 0.54, r: 62, teeth: 24, col: "#d6a13c", dir: 1 },
          { x: w * 0.35 + 102, y: h * 0.54, r: 42, teeth: 16, col: "#2fe4ff", dir: -1.5 },
          { x: w * 0.35 + 186, y: h * 0.54 - 28, r: 54, teeth: 20, col: "#34e89e", dir: 1.2 }
        ];
        gears.forEach(g => {
          ctx.save();
          ctx.translate(g.x, g.y);
          ctx.rotate(t * speed * g.dir);
          ctx.strokeStyle = g.col;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(0, 0, g.r * 0.78, 0, Math.PI * 2); ctx.stroke();
          for (let i = 0; i < g.teeth; i++) {
            ctx.save();
            ctx.rotate((i / g.teeth) * Math.PI * 2);
            ctx.fillStyle = g.col;
            ctx.fillRect(g.r * 0.76, -4, g.r * 0.24, 8);
            ctx.restore();
          }
          ctx.restore();
        });
        if (!reducedMotion) {
          requestAnimationFrame(draw);
        }
      }
      draw();
      if (reducedMotion) {
        window.addEventListener("resize", draw);
      }
    }

    // --- INIT THREE.JS CAD STUDIO ---
    function init() {
      try {
        if (typeof THREE === "undefined") throw new Error("Three.js unavailable");
        const probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") || probe.getContext("webgl") || probe.getContext("experimental-webgl");
        if (!gl) throw new Error("WebGL context unavailable");

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setSize(container.clientWidth || 640, container.clientHeight || 400);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;
      } catch (err) {
        startFallback2D();
        return;
      }

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x090e1f);
      scene.fog = new THREE.FogExp2(0x090e1f, 0.0115);

      // Procedural HDR studio reflection environment
      try {
        envMapTex = buildStudioEnvMap(renderer);
        scene.environment = envMapTex;
      } catch (e) { /* graceful fallback if PMREM unavailable */ }

      const w = container.clientWidth || 640;
      const h = container.clientHeight || 400;
      perspCam = new THREE.PerspectiveCamera(40, w / Math.max(1, h), 0.1, 400);
      orthoCam = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 400);
      activeCam = perspCam;

      // Studio 3-point + backlit lighting rig
      scene.add(new THREE.HemisphereLight(0xcbe2ff, 0x182038, 0.65));

      const keyLight = new THREE.DirectionalLight(0xfff5e0, 1.28);
      keyLight.position.set(16, 26, 18);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 70;
      const sd = 18;
      keyLight.shadow.camera.left = -sd; keyLight.shadow.camera.right = sd;
      keyLight.shadow.camera.top = sd; keyLight.shadow.camera.bottom = -sd;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0x45e3ff, 0.95);
      rimLight.position.set(-18, 14, -14);
      scene.add(rimLight);

      const fillLight = new THREE.PointLight(0xd6a13c, 0.75, 50);
      fillLight.position.set(14, 7, -12);
      scene.add(fillLight);

      backlightLight = new THREE.PointLight(0x40ffaa, 2.2, 34);
      backlightLight.position.set(0, 7.5, -2.5);
      scene.add(backlightLight);

      // Studio CAD Workbench Stage (with real stud-pitched grid & soft shadow receiver)
      stageGroup = new THREE.Group();
      const gridTex = buildCadGridTexture();
      floorPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(32, 32),
        new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.58, metalness: 0.18 })
      );
      floorPlane.rotation.x = -Math.PI / 2;
      floorPlane.position.y = 0;
      floorPlane.receiveShadow = true;
      stageGroup.add(floorPlane);

      // Subtle architectural outer ring frame around the 32x32 stud studio pad
      const padBorder = new THREE.Mesh(
        new THREE.BoxGeometry(32.5, 0.36, 32.5),
        new THREE.MeshStandardMaterial({ color: 0x0b1022, roughness: 0.42, metalness: 0.55 })
      );
      padBorder.position.y = -0.20;
      padBorder.receiveShadow = true;
      stageGroup.add(padBorder);
      scene.add(stageGroup);

      machineGroup = new THREE.Group();
      customGroup = new THREE.Group();
      clutterGroup = new THREE.Group();
      ballsGroup = new THREE.Group();
      scene.add(machineGroup, customGroup, clutterGroup, ballsGroup);

      selectionBox = new THREE.BoxHelper(new THREE.Object3D(), 0xf5c451);
      selectionBox.visible = false;
      scene.add(selectionBox);

      // Pointer & keyboard controls (Orbit, Pan, Zoom, Click-Inspect, Snap-Place)
      canvas.addEventListener("contextmenu", e => e.preventDefault());
      canvas.addEventListener("pointerdown", e => {
        isPointerDown = true;
        pointerButton = e.button;
        pointerMoved = false;
        prevPointer = { x: e.clientX, y: e.clientY };
        targetSpherical = null;
        targetLook = null;
      });
      window.addEventListener("pointerup", e => {
        if (isPointerDown && !pointerMoved && e.target === canvas && pointerButton === 0) {
          handleViewportClick(e);
        }
        isPointerDown = false;
      });
      window.addEventListener("pointermove", e => {
        if (activeTool === "place" && ghostMesh && e.target === canvas && !isPointerDown) {
          const snap = computeSnapPoint(e);
          if (snap) {
            ghostMesh.position.set(snap.x, snap.y, snap.z);
            ghostMesh.visible = true;
          } else {
            ghostMesh.visible = false;
          }
        }
        if (!isPointerDown) return;
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) pointerMoved = true;
        prevPointer = { x: e.clientX, y: e.clientY };

        autoOrbit = false;
        if (pointerButton === 2 || e.shiftKey) {
          // Pan camera target cleanly in camera screen plane
          const panScale = camSpherical.radius * 0.0014;
          const rightX = Math.cos(camSpherical.theta);
          const rightZ = -Math.sin(camSpherical.theta);
          camTarget.x -= dx * panScale * rightX;
          camTarget.z -= dx * panScale * rightZ;
          camTarget.y = Math.max(0.5, Math.min(18, camTarget.y + dy * panScale));
        } else {
          camSpherical.theta -= dx * 0.007;
          camSpherical.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.03, camSpherical.phi - dy * 0.007));
        }
        updateCameraPos();
      });
      canvas.addEventListener("wheel", e => {
        e.preventDefault();
        targetSpherical = null;
        camSpherical.radius = Math.max(8, Math.min(48, camSpherical.radius + e.deltaY * 0.018));
        updateCameraPos();
      }, { passive: false });

      window.addEventListener("keydown", e => {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA")) return;
        if (e.key === "r" || e.key === "R") {
          if (activeTool === "place") rotateBuilderPart();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
          if (customRecords.length) { e.preventDefault(); undoCustomPart(); }
        }
      });

      window.addEventListener("resize", resize);
      animate();
    }

    function resize() {
      if (useFallback2D || !renderer || !perspCam) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 460;
      if (w === 0 || h === 0) return;
      perspCam.aspect = w / h;
      perspCam.updateProjectionMatrix();
      renderer.setSize(w, h);
      updateCameraPos();
    }

    let lastTime = performance.now();

    function animate() {
      requestAnimationFrame(animate);
      if (useFallback2D || !renderer || !scene || !activeCam) return;

      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) * 0.001);
      lastTime = now;
      const t = now * 0.001;

      // Smooth camera preset interpolation
      if (targetSpherical && targetLook) {
        const k = Math.min(1, dt * 7.5);
        camSpherical.radius += (targetSpherical.radius - camSpherical.radius) * k;
        camSpherical.theta += (targetSpherical.theta - camSpherical.theta) * k;
        camSpherical.phi += (targetSpherical.phi - camSpherical.phi) * k;
        camTarget.x += (targetLook.x - camTarget.x) * k;
        camTarget.y += (targetLook.y - camTarget.y) * k;
        camTarget.z += (targetLook.z - camTarget.z) * k;
        updateCameraPos();
        if (Math.abs(targetSpherical.radius - camSpherical.radius) < 0.05 && Math.abs(targetSpherical.theta - camSpherical.theta) < 0.01) {
          targetSpherical = null;
          targetLook = null;
        }
      } else if (autoOrbit && !isPointerDown && !reducedMotion) {
        camSpherical.theta += 0.0038;
        updateCameraPos();
      }

      // Step-by-step Auto-Build playback
      if (stepPlayActive) {
        stepPlayTimer += dt;
        if (stepPlayTimer >= 1.15) {
          stepPlayTimer = 0;
          if (currentStep < maxStep) {
            currentStep++;
            applyStepVisibility();
          } else {
            stepPlayActive = false;
            applyStepVisibility();
          }
        }
      }

      // Real kinematic drive animation
      const speedMult = reducedMotion ? 0 : (driveRPM / 120);
      const baseOmega = 0.032 * speedMult;
      const drivePhase = t * 2.8 * speedMult;

      for (let i = 0; i < gearsList.length; i++) {
        const g = gearsList[i];
        const ax = g.userData.axis || "z";
        const r = g.userData.ratio || 1.0;
        if (ax === "z") g.rotation.z += baseOmega * r;
        else if (ax === "y") g.rotation.y += baseOmega * r;
        else g.rotation.x += baseOmega * r;
      }

      for (let i = 0; i < movingLinkages.length; i++) {
        const m = movingLinkages[i];
        const u = m.userData;
        if (u.type === "orbit") {
          m.rotation.y += baseOmega * u.speed;
        } else if (u.type === "leg") {
          m.rotation.x = Math.sin(drivePhase + u.phase) * 0.24 * u.side;
          m.position.y = u.basePosY + Math.max(0, Math.cos(drivePhase + u.phase)) * 0.55 + (u.layer * explodeAmt * 1.4);
        } else if (u.type === "wave_bar") {
          m.position.y = u.basePosY + Math.sin(drivePhase + u.phase) * 0.95 + (u.layer * explodeAmt * 1.4);
        } else if (u.type === "wing") {
          m.rotation.y = Math.sin(drivePhase * 0.5) * 0.36 * u.side;
        }
      }

      // GBC Balls following 40T scoop wheel & sloped track
      for (let i = 0; i < gbcBalls.length; i++) {
        const ball = gbcBalls[i];
        const p = (t * (0.55 * speedMult) + ball.userData.phase) % (Math.PI * 2);
        const u = p / (Math.PI * 2);
        if (u < 0.45) {
          const ang = -Math.PI * 0.5 + (u / 0.45) * Math.PI;
          ball.position.set(2.0 + Math.cos(ang) * 2.35, 3.4 + Math.sin(ang) * 2.35, -1.55);
        } else {
          const s = (u - 0.45) / 0.55;
          ball.position.set(4.0 - s * 9.6, 5.75 - s * 2.3, -1.55);
        }
      }

      // Exploded CAD assembly layer separation
      for (let i = 0; i < partRecords.length; i++) {
        const r = partRecords[i];
        if (r.mesh.parent === machineGroup) {
          r.mesh.position.y = r.y + r.layer * explodeAmt * 1.45;
        }
      }

      // Separatio scatter filter
      for (let i = 0; i < clutterGroup.children.length; i++) {
        const ch = clutterGroup.children[i];
        const thr = i / clutterGroup.children.length;
        if (ch.userData.isNoise) ch.visible = thr >= separatioAmt;
        else ch.position.y = 0.48 + separatioAmt * 0.45 + Math.sin(t * 2 + i) * 0.08;
      }

      if (selectionBox && selectionBox.visible) selectionBox.update();
      renderer.render(scene, activeCam);
    }

    return {
      init,
      rebuildScene,
      importLDrawText,
      loadSampleLDraw,
      setView,
      setProjection,
      setRenderMode,
      setTool,
      setBuilderPart,
      setBuilderColor,
      rotateBuilderPart,
      undoCustomPart,
      clearCustomParts,
      setBuildStep(s) {
        currentStep = Math.max(1, Math.min(maxStep, Number(s) || 1));
        stepPlayActive = false;
        applyStepVisibility();
      },
      stepDelta(d) {
        currentStep = Math.max(1, Math.min(maxStep, currentStep + d));
        stepPlayActive = false;
        applyStepVisibility();
      },
      toggleStepPlay() {
        if (!stepPlayActive) {
          if (currentStep >= maxStep) currentStep = 1;
          stepPlayActive = true;
          stepPlayTimer = 0;
        } else {
          stepPlayActive = false;
        }
        applyStepVisibility();
      },
      setAutoOrbit(val) { autoOrbit = Boolean(val); return autoOrbit; },
      getAutoOrbit() { return autoOrbit; },
      setControls(opts) {
        if (typeof opts.rpm === "number") driveRPM = opts.rpm;
        if (typeof opts.explode === "number") explodeAmt = opts.explode;
        if (typeof opts.separatio === "number") separatioAmt = opts.separatio;
        if (typeof opts.colorMode === "string") colorMode = opts.colorMode;
      },
      setCameraDirect(r, th, ph, ty) {
        autoOrbit = false;
        targetSpherical = null;
        targetLook = null;
        if (typeof r === "number") camSpherical.radius = r;
        if (typeof th === "number") camSpherical.theta = th;
        if (typeof ph === "number") camSpherical.phi = ph;
        if (typeof ty === "number") camTarget.y = ty;
        updateCameraPos();
      },
      exportLDraw,
      exportBrickLinkXML,
      exportRebrickableCSV,
      exportSnapshotPNG,
      generateLDrawText,
      generateBrickLinkXML,
      generateRebrickableCSV,
      getState() {
        return {
          partCount: partRecords.length + customRecords.length,
          customCount: customRecords.length,
          currentStep,
          maxStep,
          projectionMode,
          renderMode,
          activeTool,
          useFallback2D
        };
      },
      BUILDER_PARTS,
      BUILDER_SWATCH_IDS,
      LDRAW_COLORS,
      MAX_CUSTOM_PARTS,
      MAX_IMPORT_PARTS,
      MAX_IMPORT_BYTES
    };
  }

  global.BrickCAD = {
    createEngine: createBrickCADEngine,
    BUILDER_PARTS,
    BUILDER_SWATCH_IDS,
    LDRAW_COLORS,
    MAX_CUSTOM_PARTS,
    MAX_IMPORT_PARTS,
    MAX_IMPORT_BYTES
  };
})(window);
