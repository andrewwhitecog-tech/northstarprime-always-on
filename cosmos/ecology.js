/* ============================================================
   CUBIC COSMOS · ecology.js — THE DRIFT ECOLOGY (data + laws)
   Andre's twin invariants, enforced by validate():
     1. Every species has at least one natural predator.
     2. Every species has exactly one equal-opposite moral
        mirror (benevolent ↔ malevolent), and mirrors are
        symmetric.
   Global law: each mirror-pair predates ITS OWN opposite —
   the benevolent twin has the upper hand by day, the
   malevolent by night (day cycle already exists in main.js).
   The Equilibrist balances overgrowth; only cooperating
   opposites (lumen + gloom motes together) can consume it —
   the one act of predation that requires cooperation.
   All species are faceless geometric drift-forms per the
   original no-mob-likeness brief. Spawner lands in phase 2;
   this module is the canonical data + law layer.
   ============================================================ */
(typeof window !== 'undefined' ? window : globalThis).CosmosEcology = (function () {
  'use strict';

  var SPECIES = {
    lumen_mote: {
      name: 'LUMEN MOTE', align: 'benevolent', mirror: 'gloom_mote',
      form: 'thumb-sized glowing tetrahedron, warm white',
      habitat: 'everywhere; thickens near CIVIC LUMEN lights',
      role: 'pollinates glow — lights burn brighter where motes gather',
      eats: ['blight_hush'], eatenBy: ['gloom_mote', 'prism_strider'],
      dayAdvantage: true
    },
    gloom_mote: {
      name: 'GLOOM MOTE', align: 'malevolent', mirror: 'lumen_mote',
      form: 'thumb-sized light-drinking tetrahedron, void-dark',
      habitat: 'shadows, cave mouths, under the monorail',
      role: 'dims lights; a swarm can put out a lantern',
      eats: ['lumen_mote'], eatenBy: ['lumen_mote', 'prism_strider'],
      dayAdvantage: false
    },
    prism_strider: {
      name: 'PRISM STRIDER', align: 'benevolent', mirror: 'shard_stalker',
      form: 'tall stilt-legged prism, slow, chiming',
      habitat: 'crystal islands and garden slopes',
      role: 'grazes mote-swarms of BOTH kinds; polishes crystals as it walks',
      eats: ['lumen_mote', 'gloom_mote'], eatenBy: ['shard_stalker'],
      dayAdvantage: true
    },
    shard_stalker: {
      name: 'SHARD STALKER', align: 'malevolent', mirror: 'prism_strider',
      form: 'low angular hunter of broken-glass geometry',
      habitat: 'ruins, pyramid shadows',
      role: 'cracks crystals; hunts striders by their chime',
      eats: ['prism_strider'], eatenBy: ['prism_strider', 'aurora_ray'],
      dayAdvantage: false
    },
    aurora_ray: {
      name: 'AURORA RAY', align: 'benevolent', mirror: 'static_wraith',
      form: 'broad silent sky-manta of layered aurora ribbon',
      habitat: 'high sky, monorail altitude and above',
      role: 'seeds the aurora; dives to shatter stalkers with light-lances',
      eats: ['static_wraith', 'shard_stalker'], eatenBy: ['static_wraith'],
      dayAdvantage: true
    },
    static_wraith: {
      name: 'STATIC WRAITH', align: 'malevolent', mirror: 'aurora_ray',
      form: 'crackling sheet of grey interference, no fixed outline',
      habitat: 'night sky; drawn to signal and screens',
      role: 'eats signal; swarms can ground a ray and drain harvest-hums',
      eats: ['aurora_ray', 'harvest_hum'], eatenBy: ['aurora_ray'],
      dayAdvantage: false
    },
    spring_tender: {
      name: 'SPRING TENDER', align: 'benevolent', mirror: 'drought_knot',
      form: 'clear fluid column that stands in wells, catching light',
      habitat: 'the village well, city fountains',
      role: 'keeps water sweet; dissolves knots by day',
      eats: ['drought_knot'], eatenBy: ['drought_knot'],
      dayAdvantage: true
    },
    drought_knot: {
      name: 'DROUGHT KNOT', align: 'malevolent', mirror: 'spring_tender',
      form: 'dry tangled root-geometry that clogs water',
      habitat: 'wells and channels, by night',
      role: 'strangles springs; drinks tenders when the sun is down',
      eats: ['spring_tender'], eatenBy: ['spring_tender'],
      dayAdvantage: false
    },
    harvest_hum: {
      name: 'HARVEST HUM', align: 'benevolent', mirror: 'blight_hush',
      form: 'fist-sized humming orb, faint gold, always in D',
      habitat: 'farm rows — village fields, city terraces',
      role: 'pollinates crops; the hum is why the foliage glows',
      eats: ['blight_hush'], eatenBy: ['blight_hush', 'static_wraith'],
      dayAdvantage: true
    },
    blight_hush: {
      name: 'BLIGHT HUSH', align: 'malevolent', mirror: 'harvest_hum',
      form: 'a patch of moving silence, visible as absence',
      habitat: 'field edges at night',
      role: 'silences crops — hushed foliage stops glowing and withers',
      eats: ['harvest_hum'], eatenBy: ['harvest_hum', 'lumen_mote'],
      dayAdvantage: false
    },
    equilibrist: {
      name: 'THE EQUILIBRIST', align: 'neutral', mirror: 'equilibrist',
      form: 'rare slow leviathan — a rotating ring of nine grey prisms',
      habitat: 'drifts between islands; appears when any population overgrows',
      role: 'the balancer — culls whichever species swarms beyond its bounds',
      eats: ['lumen_mote', 'gloom_mote', 'prism_strider', 'shard_stalker',
             'aurora_ray', 'static_wraith', 'spring_tender', 'drought_knot',
             'harvest_hum', 'blight_hush'],
      eatenBy: ['lumen_mote+gloom_mote'],   // ONLY cooperating opposites can consume it
      dayAdvantage: null,
      note: 'self-mirrored: balance is its own equal opposite. Its sole ' +
            'predator is cooperation between enemies — the city\'s founding ' +
            'law, written into nature.'
    }
  };

  // ----------------------------------------------------------
  // invariant validation — run in node: node -e "..." or console
  // ----------------------------------------------------------
  function validate() {
    var errs = [];
    var keys = Object.keys(SPECIES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i], s = SPECIES[k];
      // invariant 1: at least one natural predator
      if (!s.eatenBy || !s.eatenBy.length)
        errs.push(k + ': no natural predator');
      // predator references must resolve (compound "a+b" = cooperative pair)
      for (var p = 0; p < (s.eatenBy || []).length; p++) {
        var parts = s.eatenBy[p].split('+');
        for (var q = 0; q < parts.length; q++)
          if (!SPECIES[parts[q]]) errs.push(k + ': unknown predator ' + parts[q]);
      }
      // invariant 2: exactly one symmetric moral mirror
      if (!s.mirror || !SPECIES[s.mirror]) {
        errs.push(k + ': missing mirror');
      } else if (SPECIES[s.mirror].mirror !== k) {
        errs.push(k + ': mirror not symmetric');
      } else if (k !== s.mirror) {
        var a = s.align, b = SPECIES[s.mirror].align;
        var ok = (a === 'benevolent' && b === 'malevolent') ||
                 (a === 'malevolent' && b === 'benevolent');
        if (!ok) errs.push(k + ': mirror alignments not opposite (' + a + '/' + b + ')');
      }
      // food links resolve
      for (var e = 0; e < (s.eats || []).length; e++)
        if (!SPECIES[s.eats[e]]) errs.push(k + ': unknown prey ' + s.eats[e]);
    }
    return errs;
  }

  return { SPECIES: SPECIES, validate: validate };
})();
if (typeof module !== 'undefined' && module.exports)
  module.exports = (typeof window !== 'undefined' ? window : globalThis).CosmosEcology;
