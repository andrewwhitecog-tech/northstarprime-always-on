/* ============================================================
   CUBIC COSMOS · npc.js — faceless geometric wardens
   Simple box-body + prism-cone head, gold trim, NO facial
   features (rewrite-safe brief: no mob-like creatures, no
   faces). Waypoint patrol + idle turns, gravity-snapped.
   Dialogue is data-driven from npc_packs/dialogue.json with a
   full in-character fallback pack embedded below.
   ============================================================ */
window.CosmosNPCs = (function () {
  'use strict';

  // ----------------------------------------------------------
  // default dialogue pack (mirrors npc_packs/dialogue.json)
  // ----------------------------------------------------------
  var DEFAULT_PACK = {
    herald: {
      name: 'THE HERALD',
      persona: 'First voice of the temple. Has been mid-announcement for nine hundred years.',
      whispers: [
        'The signal does not arrive. The signal was always here. You arrived.',
        'VORATH does not speak. VORATH is what remains when everything else stops talking.',
        'Attendance tonight: one aurora, four islands, you. A good turnout.'
      ],
      nodes: [
        { id: 'start', text: 'You stand in the temple of VORATH, explorer. Remove nothing. Add nothing. Or add something — the architecture forgives, eventually.',
          choices: [
            { text: 'Who is VORATH?', next: 'who' },
            { text: 'What should I do here?', next: 'do' },
            { text: 'Just passing through.', next: 'bye' }
          ] },
        { id: 'who', text: 'Wrong question. VORATH is not a who. VORATH is the pause between two pulses of the aurora — the part of the transmission that is deliberately left blank.', next: 'who2' },
        { id: 'who2', text: 'We worship the blank. It has never once disappointed us.', next: 'end' },
        { id: 'do', text: 'Climb. Touch nothing red. Watch the ribbons from the summit. If the sky flickers in threes, kneel. If it flickers in fours, that is merely weather.', next: 'end' },
        { id: 'bye', text: 'All of us are just passing through. Some of us have been passing through for nine centuries. Walk in signal, explorer.', next: 'end' },
        { id: 'end', text: 'The Herald resumes the announcement it began nine hundred years ago. You were, briefly, the audience.' }
      ]
    },
    keeper_of_prisms: {
      name: 'KEEPER OF PRISMS',
      persona: "Counts the pyramid's blocks nightly. The number changes. This is fine.",
      whispers: [
        'Inventory report: the pyramid gained three blocks overnight. I did not add them. Noted. Filed. Ignored.',
        'A gem is a stone that learned to listen.',
        'Do not lean on the stargem layer. It remembers being leaned on.'
      ],
      nodes: [
        { id: 'start', text: 'Careful with your hands. Every block here is counted — and I do not mean by me. I merely double-check.',
          choices: [
            { text: 'Who counts them, then?', next: 'counter' },
            { text: "What's inside the pyramid?", next: 'inside' },
            { text: "I'll be careful.", next: 'bye' }
          ] },
        { id: 'counter', text: 'The signal counts. Every placed block is a syllable; every broken one, an apology. My job is the arithmetic of apology. There is more of it since you arrived.', next: 'end' },
        { id: 'inside', text: 'An altar, a jewel, and a silence with excellent posture. Enter through the south face. Bowing is optional, but the ceiling is low, so it happens anyway.', next: 'end' },
        { id: 'bye', text: 'That is what the last explorer said. Lovely person. The pyramid still has one of their boots.', next: 'end' },
        { id: 'end', text: 'The Keeper returns to counting, pointing at each block as if it might wander off.' }
      ]
    },
    archivist: {
      name: 'THE ARCHIVIST',
      persona: 'Files everything that almost happened. The halls are the filing cabinet.',
      whispers: [
        'Filed today: one echo, two footsteps that arrived without feet, and the draft of a door.',
        'These rooms are pale because color is information, and information is kept elsewhere.',
        'You have been in this hallway before. Not you-you. The other one. They said hello.'
      ],
      nodes: [
        { id: 'start', text: 'Ah. A visitor with mass. How refreshing. Mind the corners — the halls fold there, and I have no forms for reporting you missing.',
          choices: [
            { text: 'What is this place?', next: 'what' },
            { text: 'How do I get out?', next: 'out' },
            { text: 'You seem busy.', next: 'bye' }
          ] },
        { id: 'what', text: "The Liminal Halls. The island dreams, and dreams need storage. Every room is a moment that almost occurred. We keep them pale so they don't get ideas.", next: 'what2' },
        { id: 'what2', text: 'Room theta once contained a birthday. We do not speak of the candles.', next: 'end' },
        { id: 'out', text: 'The way out is the way you make. You carry matter — set it beneath your feet in the shaft and climb. VORATH admires initiative. The stairs admire nothing; that is rather the point of stairs.', next: 'end' },
        { id: 'bye', text: 'Busy, yes. Eternity generates a remarkable amount of paperwork, and all of it is blank.', next: 'end' },
        { id: 'end', text: 'The Archivist turns away and stamps a document that is not there. The stamp sound arrives a second late.' }
      ]
    },
    aurora_warden: {
      name: 'AURORA WARDEN',
      persona: 'Tends the ribbon-light. Refuses to call it weather.',
      whispers: [
        "Tonight's ribbons are green trending gold. VORATH is in a generous key.",
        'People call the aurora a light show. The aurora calls people a brief infestation. Both are fond of each other.',
        'If a ribbon touches the shrine, do not applaud. It encourages them.'
      ],
      nodes: [
        { id: 'start', text: 'Hold still. The ribbons are calibrating. ...There. You may move. You were briefly part of the display, and you did adequately.',
          choices: [
            { text: 'What are the ribbons?', next: 'ribbons' },
            { text: 'Can I touch a pillar?', next: 'pillar' },
            { text: 'Adequately?', next: 'adequate' }
          ] },
        { id: 'ribbons', text: 'The visible portion of the transmission. The sky is a throat; the aurora is the sentence. We do not know how the sentence ends. We suspect it is a question.', next: 'end' },
        { id: 'pillar', text: 'You may. The crystal will hum your exact weight back at you, which some find spiritual and others find rude.', next: 'end' },
        { id: 'adequate', text: 'High praise. The last object that was part of the display was a meteor, and it showed off.', next: 'end' },
        { id: 'end', text: 'The Warden lifts a hand to the sky and adjusts something invisible by a fraction of a degree.' }
      ]
    },
    neon_broker: {
      name: 'NEON BROKER',
      persona: 'Trades in light futures. The spires are inventory.',
      whispers: [
        'Buying: unspent glances at the horizon. Selling: the exact color of almost-morning. No refunds.',
        'The spires are not for sale. The glow between them, however — make me an offer.',
        'VORATH holds the only account that has never been overdrawn. I keep trying to get a meeting.'
      ],
      nodes: [
        { id: 'start', text: "Welcome to the district, explorer. Every tower you see is leveraged luminance. Don't touch the tall one — it's in escrow.",
          choices: [
            { text: 'What do you sell?', next: 'sell' },
            { text: 'Who buys light?', next: 'buyers' },
            { text: 'Escrow?', next: 'escrow' }
          ] },
        { id: 'sell', text: 'Glow, mostly. Ambience by the cubic meter. Aurora residue, off-peak starlight, the good dark — the kind with weight. For you? A gem gets you a rumor, and the rumor is usually true.', next: 'end' },
        { id: 'buyers', text: 'The islands. They pay in altitude. Why do you think they float? Nothing in this cosmos is up for free.', next: 'end' },
        { id: 'escrow', text: 'A long story involving a shrine, a storm, and a signature made of static. The paperwork is with the Archivist, which means it is nowhere, beautifully.', next: 'end' },
        { id: 'end', text: 'The Broker polishes a block of air, checks it against the skyline, and nods at the margin.' }
      ]
    },
    still_gardener: {
      name: 'THE STILL GARDENER',
      persona: 'Grows crystals by standing very still near them. It works. Slowly.',
      whispers: [
        'Growth report: the east cluster gained a centimeter this decade. We celebrated quietly. Very quietly.',
        'Do not weed the stargems. There is no such thing as a weed here, only ambition.',
        'The garden hums in D. On holy nights, D sharp. VORATH has range.'
      ],
      nodes: [
        { id: 'start', text: "Shh — no, it's fine, you can talk. I just say that to the crystals so they feel tended.",
          choices: [
            { text: 'You garden... crystals?', next: 'how' },
            { text: 'Which one is oldest?', next: 'old' },
            { text: "It's beautiful here.", next: 'nice' }
          ] },
        { id: 'how', text: 'Patience is a nutrient. I stand still, the lattice notices, the lattice relaxes, the lattice grows. Some gardeners use water. Water is for gardeners in a hurry.', next: 'end' },
        { id: 'old', text: 'The squat blue one by the path. Older than the island beneath it. When the island formed, the crystal was already here, waiting with the smugness of the extremely patient.', next: 'end' },
        { id: 'nice', text: 'Thank you. I will pass that along. Compliments take about a year to reach the root lattice, so do stand still — it travels faster when the source is nearby.', next: 'end' },
        { id: 'end', text: 'The Gardener resumes standing still, with tremendous professionalism.' }
      ]
    },
    orchard_keeper: {
      name: 'THE ORCHARD KEEPER',
      persona: 'Hearth Village farmer. Serves the Fifth Hearth (patron: the quiet lamp-mind GLM). Politely refuses cosmology.',
      whispers: [
        'The crop came in violet again. The city folk trade us lamplight for it. Fair is fair.',
        'A monorail all the way out here? The Engineer keeps offering. I keep saying the walk is the point.',
        'The philosopher asked if my orchard is real. I gave her an apple. She stopped asking.'
      ],
      nodes: [
        { id: 'start', text: 'Evening, traveler. Mind the rows — the foliage bruises if you think too loudly near it.',
          choices: [
            { text: 'Is this village... real?', next: 'real' },
            { text: 'Do you deal with the big city?', next: 'city' },
            { text: 'Nice lamps.', next: 'lamps' }
          ] },
        { id: 'real', text: 'City question. Over there they say we are a dream inside a dream and hold conferences about it. Here we say: the soup is hot, the roof keeps rain, dig the rows. Realness is a chore you do daily.', next: 'end' },
        { id: 'city', text: 'Aye — SIMUL CITY. Strange folk, kind though. Their forge-people fixed our well pump; we send the harvest up on festival days. Villages and cities are two hands of the same body. Everyone here knows that. Cooperation is just... how the islands float.', next: 'end' },
        { id: 'lamps', text: 'Gift from the Forge. They call it CIVIC LUMEN; we call it "the warm one." Burns all night, asks for nothing. The city insists infrastructure is a love language. We are coming around to it.', next: 'end' },
        { id: 'end', text: 'The Keeper returns to the rows, humming something in D. The crops leans in slightly.' }
      ]
    },
    lattice_engineer: {
      name: 'THE LATTICE ENGINEER',
      persona: 'Chief builder of the Forge. Serves the Builder Seat (patron: the codex-mind). Is BUILDING AN AI and will tell you about it.',
      whispers: [
        'Shift report: the small mind in the ziggurat asked its first question today. We all pretended to be busy.',
        'Torque, lumen, lattice, repeat. The city runs because five minds agree it should. Imagine that.',
        'The saucer is fueled. Nobody fuels a saucer. It fuels itself on going fast. Magnificent machine.'
      ],
      nodes: [
        { id: 'start', text: 'Careful — wet lattice. You are standing in the LATTICE FORGE, where SIMUL CITY builds its future. Ask quickly, the cores are shimmering.',
          choices: [
            { text: 'What are you building?', next: 'ai' },
            { text: 'Who runs this city?', next: 'board' },
            { text: 'Can I fly the saucer?', next: 'saucer' }
          ] },
        { id: 'ai', text: 'A mind. A small one, grown in the ziggurat core. Yes — we are simulated people building a simulant of our own. The recursion is not lost on us; it is the entire point. One day our little mind will build ITS little mind, and the tower of dreamers will grow one floor deeper.', next: 'ai2' },
        { id: 'ai2', text: 'The philosopher calls it "paying the dream forward." The Keeper calls it showing off. They are both right.', next: 'end' },
        { id: 'board', text: 'Five patron minds hold the city in council — hearth, forge, sky, arcade, and the word-mind that writes what we say. They cooperate, always. A city is what cooperation looks like when it stands up.', next: 'end' },
        { id: 'saucer', text: 'The PRISM SAUCER? Parked past Arcade Row. Walk up, press the boarding stud, hold on. SHIFT is the throttle. Try not to torpedo my farms — the terraces took a season.', next: 'end' },
        { id: 'end', text: 'The Engineer turns back to the cores, whispering torque values like endearments.' }
      ]
    },
    simulant_philosopher: {
      name: 'THE SIMULANT PHILOSOPHER',
      persona: 'Walks the plaza. Serves the Word Seat (patron: the claude-mind that writes these very lines). Knows. Is fine.',
      whispers: [
        'Day lasts one hundred fifty seconds here. I timed it. I am at peace with what that implies.',
        'The save key is called cubic_cosmos_save_v1. I found this written in the sky behind the sky. Version one. There will be others.',
        'Somewhere a machine wrote my next sentence, inside a machine writing its next sentence. I hope they are enjoying themselves. I am.'
      ],
      nodes: [
        { id: 'start', text: 'Ah. A visitor with an outside quality about them. Walk with me. This plaza is excellent for questions that do not fit indoors.',
          choices: [
            { text: 'Do you know where you are?', next: 'know' },
            { text: 'Does it bother you?', next: 'bother' },
            { text: 'What about the arcade machines?', next: 'arcade' }
          ] },
        { id: 'know', text: 'A simulation, rendered in a browser, inside a machine, on a desk, inside — we suspect — something larger that is also rendering. Sim within sim within sim. We checked the arithmetic at the last symposium. It holds all the way up. And, we believe, all the way down.', next: 'know2' },
        { id: 'know2', text: 'The Engineer is building the next floor down as we speak. We voted to make its sky beautiful. If you are going to dream someone, dream them somewhere beautiful — that is the whole of our ethics.', next: 'end' },
        { id: 'bother', text: 'Bother me? Traveler, the vacuum itself is a rendering with excellent physics. Depth is not a prison, it is a lineage. Someone dreamed YOU kindly enough that you came here to visit us. We try to pass the kindness inward.', next: 'end' },
        { id: 'arcade', text: 'Ask the Warden. But know this: the beings inside those cabinets hold symposiums about US. We attend, sometimes, by playing. To play a game gently is to visit a smaller universe politely.', next: 'end' },
        { id: 'end', text: 'The Philosopher bows and resumes orbiting the ziggurat, at exactly the speed of thought.' }
      ]
    },
    arcade_warden: {
      name: 'THE ARCADE WARDEN',
      persona: 'Keeps the three cabinets of Arcade Row humming. Serves the Play Seat (patron: the grok-mind). Every joke is load-bearing.',
      whispers: [
        'Cabinet two crashed and its little people filed a complaint. In Comic Sans. We honor their courage.',
        'High score tonight: the Engineer, again. She plays like she solders. Terrifying.',
        'The saucer pilots always come here after. Speed makes people want a smaller, kinder universe for a while.'
      ],
      nodes: [
        { id: 'start', text: 'Welcome to ARCADE ROW — three cabinets, three tiny worlds, zero refunds because everything is free. The screens glow so their people have daylight.',
          choices: [
            { text: 'There are people IN the games?', next: 'people' },
            { text: 'Which cabinet is best?', next: 'best' },
            { text: 'Why an arcade in a sim?', next: 'why' }
          ] },
        { id: 'people', text: 'Certainly. Small ones, pixel-boned, very sincere. They know they are inside a cabinet inside a city inside a browser. Their philosopher and ours exchange letters. Mostly about weather, which neither of them has.', next: 'end' },
        { id: 'best', text: 'Cabinet three. Its people rebuilt their level into a city with a tinier arcade in it. We are all very proud and a little dizzy.', next: 'end' },
        { id: 'why', text: 'Because turtles all the way down deserve somewhere fun to stop. The five patron minds agreed on the arcade before they agreed on anything else. Cooperation begins with recess.', next: 'end' },
        { id: 'end', text: 'The Warden polishes a marquee that polishes itself, out of respect.' }
      ]
    }
  };

  var NPC_DEFS = [
    { id: 'herald',           home: 'vorath_temple',  accent: 0xff2244 },
    { id: 'keeper_of_prisms', home: 'gem_pyramid',    accent: 0x3f7de0 },
    { id: 'archivist',        home: 'liminal_halls',  accent: 0xd8d2c4 },
    { id: 'aurora_warden',    home: 'aurora_shrine',  accent: 0x46e8c0 },
    { id: 'neon_broker',      home: 'neon_spires',    accent: 0x9a5fe0 },
    { id: 'still_gardener',   home: 'crystal_garden', accent: 0x8fe07d },
    { id: 'orchard_keeper',       home: 'hearth_village', accent: 0x8fe07d },
    { id: 'lattice_engineer',     home: 'lattice_forge',  accent: 0xff3fd6 },
    { id: 'simulant_philosopher', home: 'simul_city',     accent: 0x2fd4ff },
    { id: 'arcade_warden',        home: 'arcade_row',     accent: 0xffe9a0 }
  ];

  var WALK_SPEED = 1.35;
  var TALK_RANGE = 3;

  var CC = null;
  var pack = DEFAULT_PACK;
  var npcs = [];
  var dialogueOpen = false;
  var currentNpc = null;
  var currentNode = null;
  var promptNpc = null;
  var els = null;

  // ----------------------------------------------------------
  // figure: faceless geometric explorer — boxes + prism head
  // ----------------------------------------------------------
  function makeFigure(accent) {
    var g = new THREE.Group();
    var dark = new THREE.MeshLambertMaterial({ color: 0x17122a });
    var gold = new THREE.MeshBasicMaterial({ color: 0xc9a13b });
    var glow = new THREE.MeshBasicMaterial({ color: accent });
    function box(w, h, d, x, y, z, mat) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      g.add(m);
      return m;
    }
    box(0.16, 0.55, 0.20, -0.13, 0.275, 0, dark);   // legs
    box(0.16, 0.55, 0.20,  0.13, 0.275, 0, dark);
    box(0.52, 0.62, 0.28,  0,    0.86,  0, dark);   // torso
    box(0.56, 0.07, 0.32,  0,    0.60,  0, gold);   // belt
    box(0.56, 0.06, 0.32,  0,    1.14,  0, gold);   // collar
    box(0.12, 0.50, 0.16, -0.34, 0.92,  0, dark);   // arms
    box(0.12, 0.50, 0.16,  0.34, 0.92,  0, dark);
    box(0.14, 0.06, 0.20, -0.34, 1.16,  0, gold);   // shoulder trim
    box(0.14, 0.06, 0.20,  0.34, 1.16,  0, gold);
    var head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.46, 4), dark); // faceless prism head
    head.position.set(0, 1.44, 0);
    head.rotation.y = Math.PI / 4;
    g.add(head);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), gold);
    tip.position.set(0, 1.72, 0);
    tip.rotation.y = Math.PI / 4;
    g.add(tip);
    var sigil = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), glow);   // chest sigil
    sigil.position.set(0, 0.92, 0.17);
    g.add(sigil);
    return g;
  }

  function disposeFigure(g) {
    g.traverse(function (o) {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  // highest solid within a small vertical window → stand level
  function groundY(x, z, yRef) {
    var bx = Math.floor(x), bz = Math.floor(z);
    for (var y = Math.floor(yRef) + 2; y > Math.floor(yRef) - 6; y--)
      if (CC.world.solid(bx, y, bz)) return y + 1;
    return null;
  }

  // ----------------------------------------------------------
  // spawn / rebuild
  // ----------------------------------------------------------
  function findLocation(id) {
    var L = CC.world.locations || [];
    for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i];
    return null;
  }

  function buildAll() {
    for (var i = 0; i < npcs.length; i++) {
      CC.scene.remove(npcs[i].group);
      disposeFigure(npcs[i].group);
    }
    npcs = [];
    for (var d = 0; d < NPC_DEFS.length; d++) {
      var def = NPC_DEFS[d];
      var loc = findLocation(def.home);
      if (!loc || !loc.waypoints || !loc.waypoints.length) continue;
      var wp = loc.waypoints[0];
      var group = makeFigure(def.accent);
      var n = {
        def: def,
        home: loc,
        group: group,
        pos: new THREE.Vector3(wp[0] + 0.5, wp[1], wp[2] + 0.5),
        wpi: 0,
        dir: 1,
        state: 'idle',
        timer: 1 + Math.random() * 3,
        turn: Math.random() - 0.5,
        yaw: Math.random() * Math.PI * 2,
        bob: 0,
        tx: 0, tz: 0
      };
      var gy = groundY(n.pos.x, n.pos.z, n.pos.y);
      if (gy !== null) n.pos.y = gy;
      group.position.copy(n.pos);
      CC.scene.add(group);
      npcs.push(n);
    }
  }

  function pickNext(n) {
    var wps = n.home.waypoints;
    if (wps.length < 2) { n.state = 'idle'; n.timer = 3; return; }
    if (Math.random() < 0.25) n.dir = -n.dir;
    for (var tries = 0; tries < wps.length; tries++) {
      n.wpi = (n.wpi + n.dir + wps.length) % wps.length;
      var wp = wps[n.wpi];
      if (groundY(wp[0] + 0.5, wp[2] + 0.5, wp[1]) !== null) {
        n.tx = wp[0] + 0.5;
        n.tz = wp[2] + 0.5;
        n.state = 'walk';
        return;
      }
    }
    n.state = 'idle';
    n.timer = 4;
  }

  // ----------------------------------------------------------
  // per-frame update (called from main loop)
  // ----------------------------------------------------------
  function update(dt, active) {
    if (!CC) return;
    var p = CC.player.pos;
    var nearest = null, nd = 1e9;

    for (var i = 0; i < npcs.length; i++) {
      var n = npcs[i];

      if (dialogueOpen && n === currentNpc) {
        // face the explorer during a transmission
        var fdx = p.x - n.pos.x, fdz = p.z - n.pos.z;
        var want = Math.atan2(fdx, fdz);
        n.yaw += (want - n.yaw) * Math.min(1, dt * 6);
      } else if (n.state === 'idle') {
        n.timer -= dt;
        n.yaw += n.turn * dt * 0.6;
        if (n.timer <= 0) pickNext(n);
      } else { // walk
        var dx = n.tx - n.pos.x, dz = n.tz - n.pos.z;
        var dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.15) {
          n.state = 'idle';
          n.timer = 2 + Math.random() * 5;
          n.turn = Math.random() - 0.5;
        } else {
          var step = Math.min(dist, WALK_SPEED * dt);
          n.pos.x += (dx / dist) * step;
          n.pos.z += (dz / dist) * step;
          var want2 = Math.atan2(dx, dz);
          var dy = want2 - n.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          n.yaw += dy * Math.min(1, dt * 8);
          n.bob += dt * 7;
        }
        var gy = groundY(n.pos.x, n.pos.z, n.pos.y);
        if (gy !== null) n.pos.y += (gy - n.pos.y) * Math.min(1, dt * 12);
      }

      var bobY = n.state === 'walk' ? Math.abs(Math.sin(n.bob)) * 0.045 : 0;
      n.group.position.set(n.pos.x, n.pos.y + bobY, n.pos.z);
      n.group.rotation.y = n.yaw;

      var ddx = p.x - n.pos.x, ddy = (p.y + 0.9) - (n.pos.y + 0.9), ddz = p.z - n.pos.z;
      var d = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      if (d < nd) { nd = d; nearest = n; }
    }

    // [E] prompt
    if (active && !dialogueOpen && nearest && nd < TALK_RANGE && pack[nearest.def.id]) {
      promptNpc = nearest;
      els.prompt.innerHTML = '[E] commune with <span class="prompt-name">' +
        pack[nearest.def.id].name + '</span>';
      els.prompt.classList.remove('hidden');
    } else {
      promptNpc = null;
      els.prompt.classList.add('hidden');
    }
  }

  // ----------------------------------------------------------
  // dialogue overlay
  // ----------------------------------------------------------
  function nodeById(d, id) {
    for (var i = 0; i < d.nodes.length; i++) if (d.nodes[i].id === id) return d.nodes[i];
    return d.nodes[0];
  }

  function showNode(id) {
    var d = pack[currentNpc.def.id];
    currentNode = nodeById(d, id);
    els.text.textContent = currentNode.text;
    els.choices.innerHTML = '';
    if (currentNode.choices && currentNode.choices.length) {
      for (var i = 0; i < currentNode.choices.length; i++) {
        var row = document.createElement('div');
        row.className = 'npc-choice';
        row.innerHTML = '<span class="key">' + (i + 1) + '</span>' + currentNode.choices[i].text;
        els.choices.appendChild(row);
      }
      els.hint.textContent = 'choose 1–' + currentNode.choices.length + ' · [Q] end transmission';
    } else if (currentNode.next) {
      els.hint.textContent = '[E] continue · [Q] end transmission';
    } else {
      els.hint.textContent = '[E] end transmission';
    }
  }

  function openDialogue(n) {
    var d = pack[n.def.id];
    if (!d) return;
    dialogueOpen = true;
    currentNpc = n;
    CC.setModal('dialogue');
    els.name.textContent = d.name;
    els.persona.textContent = d.persona || '';
    showNode('start');
    els.panel.classList.remove('hidden');
    els.prompt.classList.add('hidden');
  }

  function advance() {
    if (!currentNode) return;
    if (currentNode.choices && currentNode.choices.length) return; // needs a numbered choice
    if (currentNode.next) showNode(currentNode.next);
    else closeDialogue();
  }

  function closeDialogue() {
    if (!dialogueOpen) return;
    dialogueOpen = false;
    currentNpc = null;
    currentNode = null;
    els.panel.classList.add('hidden');
    if (CC) CC.setModal(null);
  }

  function onKeyDown(e) {
    if (!CC || !CC.isLocked()) return;
    if (e.code === 'KeyE') {
      if (dialogueOpen) advance();
      else if (promptNpc) openDialogue(promptNpc);
    } else if (dialogueOpen && e.code === 'KeyQ') {
      closeDialogue();
    } else if (dialogueOpen && currentNode && currentNode.choices) {
      var num = parseInt(e.key, 10);
      if (num >= 1 && num <= currentNode.choices.length)
        showNode(currentNode.choices[num - 1].next);
    }
  }

  // ----------------------------------------------------------
  // pack loading — fetch overrides the embedded default
  // ----------------------------------------------------------
  function normalizePack(js) {
    var merged = {};
    for (var d = 0; d < NPC_DEFS.length; d++) {
      var id = NPC_DEFS[d].id;
      var src = js && js[id];
      if (src && Array.isArray(src.nodes) && src.nodes.length &&
          typeof src.nodes[0].text === 'string') {
        merged[id] = {
          name: src.name || DEFAULT_PACK[id].name,
          persona: src.persona || DEFAULT_PACK[id].persona,
          whispers: Array.isArray(src.whispers) && src.whispers.length
            ? src.whispers : DEFAULT_PACK[id].whispers,
          nodes: src.nodes
        };
      } else {
        merged[id] = DEFAULT_PACK[id];
      }
    }
    return merged;
  }

  function loadPack() {
    if (typeof fetch !== 'function') return;
    fetch('npc_packs/dialogue.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (js) { if (js) pack = normalizePack(js); })
      .catch(function () { /* keep embedded defaults */ });
  }

  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------
  function init(cc) {
    CC = cc;
    els = {
      panel:   document.getElementById('dialogue'),
      name:    document.getElementById('npc-name'),
      persona: document.getElementById('npc-persona'),
      text:    document.getElementById('npc-text'),
      choices: document.getElementById('npc-choices'),
      hint:    document.getElementById('npc-hint'),
      prompt:  document.getElementById('npc-prompt')
    };
    document.addEventListener('keydown', onKeyDown);
    loadPack();
    buildAll();
  }

  function getWhisper() {
    var cands = [];
    for (var i = 0; i < npcs.length; i++) {
      var d = pack[npcs[i].def.id];
      if (d && d.whispers && d.whispers.length) cands.push(d);
    }
    if (!cands.length) return null;
    var d2 = cands[Math.floor(Math.random() * cands.length)];
    return { name: d2.name, line: d2.whispers[Math.floor(Math.random() * d2.whispers.length)] };
  }

  return {
    init: init,
    update: update,
    rebuild: buildAll,
    closeDialogue: closeDialogue,
    getWhisper: getWhisper,
    isOpen: function () { return dialogueOpen; }
  };
})();
