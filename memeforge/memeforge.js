/* MemeForge Engine • High-Culture Psychonaut Canvas Renderer */
(() => {
  'use strict';

  // Master Template Registry
  const TEMPLATES = [
    {
      id: 'm01',
      title: 'Botanical Woodcut Alien Disclosure',
      category: 'high-culture',
      file: 'templates/meme_01_botanical_woodcut_alien_disclosure.svg',
      defaultTop: 'HISTORIANS CALL THEM ALLIES',
      defaultBottom: 'WE CALL THEM PLUG',
      footnote: '1542 Spagyric Woodcut // The NSP APOTHECARY',
      font: 'impact',
      badge: 'declassified'
    },
    {
      id: 'm02',
      title: 'Pepe Silvia Explaining Vorath',
      category: 'high-culture',
      file: 'templates/meme_02_me_explaining_vorath_50mg.svg',
      defaultTop: 'THERE IS NO CAROL IN HR!',
      defaultBottom: 'THERE IS ONLY BLAZIN\' BEAVER!',
      footnote: 'Department of Terpene Logistics // Evidence Board #420',
      font: 'impact',
      badge: 'declassified'
    },
    {
      id: 'm03',
      title: 'Creation of Adam Passing Blunt',
      category: 'high-culture',
      file: 'templates/meme_03_creation_of_adam_passing_blunt.svg',
      defaultTop: 'ON THE SEVENTH DAY',
      defaultBottom: 'HE SAID: PUFF PUFF PASS, ADAM',
      footnote: 'Sistine Chapel Fresco // Cascadia Solarium Corridor',
      font: 'cinzel',
      badge: 'nsp'
    },
    {
      id: 'm04',
      title: '90s CRT Consciousness Loading',
      category: 'high-culture',
      file: 'templates/meme_04_90s_game_loading_consciousness.svg',
      defaultTop: 'CONSCIOUSNESS LOADING: 77%',
      defaultBottom: 'β-MYRCENE ENHANCES BLOOD-BRAIN BARRIER',
      footnote: '16-BIT CARTRIDGE BOOT // PRESS START',
      font: 'mono',
      badge: 'singularity'
    },
    {
      id: 'm05',
      title: 'Declassified FBI Dossier',
      category: 'high-culture',
      file: 'templates/meme_05_declassified_fbi_dossier_cascadia.svg',
      defaultTop: 'TOP SECRET FBI REPORT',
      defaultBottom: 'UNDERCOVER AGENTS REFUSE TO LEAVE SOLARIUM',
      footnote: 'CLASSIFIED // LEVEL 4 SCIF CASCADIA 432HZ',
      font: 'mono',
      badge: 'declassified'
    },
    {
      id: 'm06',
      title: 'Terpene Boiling Point Singularity',
      category: 'high-culture',
      file: 'templates/meme_06_terpene_boiling_point_conspiracy.svg',
      defaultTop: 'YOU THINK IT\'S JUST WEED?',
      defaultBottom: '420°F SOLVENTLESS SINGULARITY',
      footnote: 'Molecular Fractionation Index // ISO 9001',
      font: 'cinzel',
      badge: 'void'
    },
    {
      id: 'm07',
      title: 'Portland Rain vs Solarium',
      category: 'cascadia',
      file: 'templates/meme_07_portland_rain_vs_twilight_solarium.svg',
      defaultTop: 'SEASONAL AFFECTIVE DISORDER',
      defaultBottom: 'MET ITS MATCH AT Cascadia Solarium Corridor',
      footnote: 'Pacific Northwest Winter Antidote',
      font: 'impact',
      badge: 'oregon'
    },
    {
      id: 'm08',
      title: 'Beaver Dam Hydraulic Dab Rig',
      category: 'cascadia',
      file: 'templates/meme_08_beaver_dam_hydraulic_dab_rig.svg',
      defaultTop: 'US PATENT BLUEPRINT #1888',
      defaultBottom: 'COLD WILLAMETTE SNOWMELT PERCOLATION',
      footnote: 'Castor Canadensis Fluid Dynamics',
      font: 'mono',
      badge: 'oregon'
    },
    {
      id: 'm09',
      title: 'Medieval Spagyric Alchemist',
      category: 'high-culture',
      file: 'templates/meme_09_medieval_alchemist_terpene_fractionation.svg',
      defaultTop: 'WHEN THE SPAGYRIC FRACTION HITS 315°F',
      defaultBottom: 'AND THE LIVE ROSIN TRANSMUTES',
      footnote: 'Philosophers Stone // Opus Magnum',
      font: 'cinzel',
      badge: 'void'
    },
    {
      id: 'm10',
      title: 'TriMet MAX Hyperspace Wormhole',
      category: 'cascadia',
      file: 'templates/meme_10_portland_transit_triqmet_wormhole.svg',
      defaultTop: 'BEAVERTON TRANSIT CENTER',
      defaultBottom: 'THE MOMENT THE RED LINE ENTERS HYPERSPACE',
      footnote: 'Interdimensional Transit District',
      font: 'impact',
      badge: 'oregon'
    },
    {
      id: 'm11',
      title: 'Homer Space Coyote Desert',
      category: 'simpsons',
      file: 'templates/meme_11_homer_space_coyote_desert_transcendence.svg',
      defaultTop: 'FIND YOUR SOUL MATE',
      defaultBottom: 'IN THE VORATH SOLARIUM',
      footnote: 'S08E09 // The Mysterious Voyage of Homer',
      font: 'impact',
      badge: 'singularity'
    },
    {
      id: 'm12',
      title: 'Rodin\'s Thinker Dab Contemplation',
      category: 'high-culture',
      file: 'templates/meme_12_the_thinker_rodin_dab_contemplation.svg',
      defaultTop: 'HE HAS BEEN SITTING LIKE THIS FOR 45 MINS',
      defaultBottom: 'WAITING FOR THE BANGER TO HIT 480°F',
      footnote: 'Musée Rodin Bronze // Paris 1904',
      font: 'cinzel',
      badge: 'nsp'
    },
    {
      id: 'm13',
      title: 'Ethnobotany Glandular Stalks',
      category: 'high-culture',
      file: 'templates/meme_13_ethnobotany_trichome_morphology.svg',
      defaultTop: 'WHEN YOUR BUDTENDER HAS AN MS IN ETHNOBOTANY',
      defaultBottom: 'AND TALKS 40 MINS ON CAPITATE-STALKED HEADS',
      footnote: 'Royal Botanical Society // Vol 14',
      font: 'cinzel',
      badge: 'nsp'
    },
    {
      id: 'm14',
      title: 'Pour-Over Coffee vs Terpene Dab',
      category: 'cascadia',
      file: 'templates/meme_14_pourover_coffee_vs_terpene_dab_ritual.svg',
      defaultTop: 'BOTH TAKE 20 MINUTES & $800 OF GLASS',
      defaultBottom: 'BOTH COMPLAIN ABOUT CITRUS TASTING NOTES',
      footnote: 'Pacific Northwest Dual Ritual Synthesis',
      font: 'impact',
      badge: 'oregon'
    },
    {
      id: 'm15',
      title: 'Flemish Audit 0.04g Rosin',
      category: 'high-culture',
      file: 'templates/meme_15_metaphysical_inventory_audit_hash_rosin.svg',
      defaultTop: 'ME AND SHIFT LEAD AT 2:14 AM',
      defaultBottom: 'RECONCILING 0.04g UNACCOUNTED VOID KUSH',
      footnote: 'Flemish Guild of Extractors // Antwerp 1622',
      font: 'cinzel',
      badge: 'void'
    },
    {
      id: 'm16',
      title: 'Victorian Medicinal Live Rosin',
      category: 'high-culture',
      file: 'templates/meme_16_victorian_patent_medicine_tonic.svg',
      defaultTop: 'YOUR GRANDFATHER\'S COUGH TONIC',
      defaultBottom: 'WAS JUST UNREGULATED 90u SOLVENTLESS LIVE ROSIN',
      footnote: 'Pure & Unadulterated // NSP Apothecary',
      font: 'cinzel',
      badge: 'nsp'
    },
    {
      id: 'm17',
      title: 'Oregon Trail Solventless Ego Death',
      category: 'cascadia',
      file: 'templates/meme_17_oregon_trail_solventless_terpenes.svg',
      defaultTop: 'YOU HAVE CHOSEN TO DAB VOID KUSH',
      defaultBottom: 'YOUR OXEN HAVE EXPERIENCED EGO DEATH',
      footnote: 'MEPC 1985 // Phosphor Green CRT',
      font: 'mono',
      badge: 'oregon'
    },
    {
      id: 'm18',
      title: 'Ancient Cuneiform Live Rosin',
      category: 'high-culture',
      file: 'templates/meme_18_ancient_cuneiform_tablet_live_rosin.svg',
      defaultTop: 'COMPLAINT OF NANNI TO EA-NASIR',
      defaultBottom: 'BRING SINGLE-SOURCE COLD CURE OR DEPART',
      footnote: 'Ur III Dynasty // 1750 BCE Live Rosin Invoice',
      font: 'cinzel',
      badge: 'nsp'
    },
    {
      id: 's01',
      title: 'Otto Mann Fingers',
      category: 'simpsons',
      file: 'templates/01_otto_fingers_raw.jpg',
      defaultTop: 'THEY CALL \'EM FINGERS...',
      defaultBottom: 'BUT I NEVER SEE \'EM FING. OH WAIT.',
      footnote: 'S13E16 // Weekend at Burnsie\'s',
      font: 'impact',
      badge: 'nsp'
    },
    {
      id: 's05',
      title: 'Hank Scorpio Live Rosin',
      category: 'simpsons',
      file: 'templates/05_scorpio_rosin_pockets_raw.jpg',
      defaultTop: 'WANT SOME FIRST-PRESS LIVE ROSIN?',
      defaultBottom: 'SORRY IT\'S NOT IN PACKETS',
      footnote: 'S08E02 // You Only Move Twice',
      font: 'impact',
      badge: 'void'
    },
    {
      id: 's06',
      title: 'Steamed Hams Rosin Vapor',
      category: 'simpsons',
      file: 'templates/06_steamed_hams_craft_rosin_raw.jpg',
      defaultTop: 'NO SUPERINTENDENT, IT\'S NOT SMOKE',
      defaultBottom: 'IT\'S VAPOR! FROM THE SOLVENTLESS ROSIN WE\'RE DABBING!',
      footnote: 'S07E21 // 22 Short Films About Springfield',
      font: 'impact',
      badge: 'void'
    },
    {
      id: 's08',
      title: 'Comic Book Guy Terpenes',
      category: 'simpsons',
      file: 'templates/08_comic_book_guy_terpenes_raw.jpg',
      defaultTop: 'WORST. TERPENE. PROFILE. EVER.',
      defaultBottom: 'I DEMAND SINGLE-SOURCE 90u COLD CURE!',
      footnote: 'S12E11 // Worst Episode Ever',
      font: 'impact',
      badge: 'nsp'
    },
    {
      id: 's11',
      title: 'Disco Stu Solventless',
      category: 'simpsons',
      file: 'templates/11_disco_stu_cold_cure_raw.jpg',
      defaultTop: 'DISCO STU DOESN\'T DAB DISTILLATE',
      defaultBottom: 'DISCO STU LIKES 73u SINGLE-SOURCE COLD CURE!',
      footnote: 'S07E13 // Two Bad Neighbors',
      font: 'impact',
      badge: 'void'
    },
    {
      id: 's12',
      title: 'Lionel Hutz Beaver Blunts',
      category: 'simpsons',
      file: 'templates/12_lionel_hutz_contingency_raw.jpg',
      defaultTop: 'WORKS ON CONTINGENCY? NO, MONEY DOWN!',
      defaultBottom: 'DO YOU TAKE DEBIT CARDS FOR BEAVER BLUNTS?',
      footnote: 'S07E18 // The Day the Violence Died',
      font: 'impact',
      badge: 'nsp'
    }
  ];

  // Badge SVGs map
  const BADGES = {
    declassified: 'badges/declassified.svg',
    nsp: 'badges/nsp_apothecary.svg',
    void: 'badges/void_kush.svg',
    oregon: 'badges/oregon_grown.svg',
    singularity: '../stickerforge/studio/vectors/sf_23_sphene_trichome_prism.svg',
    none: null
  };

  // State
  let currentTemplate = TEMPLATES[0];
  let loadedImage = new Image();
  let loadedBadgeImage = null;
  let activeFilter = 'none';

  // DOM Elements
  const canvas = document.getElementById('memeCanvas');
  const ctx = canvas.getContext('2d');
  const templateSelect = document.getElementById('templateSelect');
  const topTextInput = document.getElementById('topTextInput');
  const bottomTextInput = document.getElementById('bottomTextInput');
  const footnoteInput = document.getElementById('footnoteInput');
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeVal = document.getElementById('fontSizeVal');
  const badgeSelect = document.getElementById('badgeSelect');
  const badgePosSelect = document.getElementById('badgePosSelect');
  const fontBtns = document.querySelectorAll('.font-btn');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const downloadBtn = document.getElementById('downloadMemeBtn');
  const copyBtn = document.getElementById('copyMemeBtn');
  const customUploadInput = document.getElementById('customUploadInput');
  const galleryGrid = document.getElementById('memeGalleryGrid');
  const crtContainer = document.querySelector('.canvas-viewport');

  // Populate Template Dropdown
  function initTemplateSelect() {
    templateSelect.innerHTML = '';
    const groups = {
      'High-Culture Psychonaut Suite': TEMPLATES.filter(t => t.category === 'high-culture'),
      'Simpsons Frinkiac Dispensary Lane': TEMPLATES.filter(t => t.category === 'simpsons'),
      'Cascadia & Oregon Satire': TEMPLATES.filter(t => t.category === 'cascadia')
    };

    for (const [groupName, list] of Object.entries(groups)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = groupName;
      list.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.title;
        optgroup.appendChild(opt);
      });
      templateSelect.appendChild(optgroup);
    }
  }

  // Load Template Image
  function loadTemplate(tpl) {
    currentTemplate = tpl;
    templateSelect.value = tpl.id;
    topTextInput.value = tpl.defaultTop;
    bottomTextInput.value = tpl.defaultBottom;
    footnoteInput.value = tpl.footnote || '';
    badgeSelect.value = tpl.badge || 'none';

    // Set font button
    fontBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.font === (tpl.font || 'impact'));
    });

    loadedImage = new Image();
    loadedImage.crossOrigin = 'anonymous';
    loadedImage.onload = () => {
      canvas.width = loadedImage.naturalWidth || 800;
      canvas.height = loadedImage.naturalHeight || 800;
      loadBadgeAndRender();
    };
    loadedImage.src = tpl.file;
  }

  // Load Badge Image & Render
  function loadBadgeAndRender() {
    const badgeKey = badgeSelect.value;
    const badgeSrc = BADGES[badgeKey];
    if (badgeSrc) {
      loadedBadgeImage = new Image();
      loadedBadgeImage.crossOrigin = 'anonymous';
      loadedBadgeImage.onload = render;
      loadedBadgeImage.src = badgeSrc;
    } else {
      loadedBadgeImage = null;
      render();
    }
  }

  // Canvas Text Drawing with Auto-Wrap & Stroke
  function drawText(text, y, fontName, fontSize, isTop) {
    if (!text) return;
    text = text.trim();
    ctx.save();
    ctx.textAlign = 'center';

    let fontStr = '';
    if (fontName === 'impact') {
      fontStr = `900 ${fontSize}px Impact, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(4, fontSize * 0.12);
      ctx.lineJoin = 'miter';
      ctx.miterLimit = 2;
    } else if (fontName === 'cinzel') {
      fontStr = `900 ${fontSize * 0.85}px 'Cinzel', serif`;
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, fontSize * 0.08);
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur = 12;
    } else if (fontName === 'mono') {
      fontStr = `700 ${fontSize * 0.75}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#00f0ff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, fontSize * 0.08);
    } else {
      fontStr = `bold ${fontSize * 0.8}px Georgia, serif`;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, fontSize * 0.08);
    }

    ctx.font = fontStr;

    // Word Wrap
    const maxWidth = canvas.width * 0.92;
    const words = text.split(' ');
    let lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      if (ctx.measureText(testLine).width < maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);

    const lineHeight = fontSize * 1.08;
    let startY = y;
    if (!isTop) {
      startY = y - (lines.length - 1) * lineHeight;
    }

    lines.forEach((line, idx) => {
      const lineY = startY + idx * lineHeight;
      if (ctx.lineWidth > 0) ctx.strokeText(line, canvas.width / 2, lineY);
      ctx.fillText(line, canvas.width / 2, lineY);
    });

    ctx.restore();
  }

  // Main Render Loop
  function render() {
    if (!loadedImage.complete) return;

    // 1. Draw Base Image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);

    // 2. Draw Active Font
    const activeFontBtn = document.querySelector('.font-btn.active');
    const fontName = activeFontBtn ? activeFontBtn.dataset.font : 'impact';
    const baseFontSize = parseInt(fontSizeSlider.value, 10) * (canvas.width / 800);

    // 3. Draw Top Text
    drawText(topTextInput.value, baseFontSize * 1.15, fontName, baseFontSize, true);

    // 4. Draw Bottom Text
    drawText(bottomTextInput.value, canvas.height - (baseFontSize * 0.6), fontName, baseFontSize, false);

    // 5. Draw Footnote / Fine-print
    if (footnoteInput.value.trim()) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = `700 ${canvas.width * 0.019}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(footnoteInput.value.trim().toUpperCase(), canvas.width / 2, canvas.height - (canvas.width * 0.015));
      ctx.restore();
    }

    // 6. Draw Badge Overlay
    if (loadedBadgeImage && loadedBadgeImage.complete) {
      ctx.save();
      const badgeW = canvas.width * 0.28;
      const aspect = loadedBadgeImage.naturalHeight / (loadedBadgeImage.naturalWidth || 1);
      const badgeH = badgeW * aspect;
      const pos = badgePosSelect.value;
      let bx = 20, by = 20;

      if (pos === 'top-right') {
        bx = canvas.width - badgeW - 20;
        by = 20;
      } else if (pos === 'bottom-left') {
        bx = 20;
        by = canvas.height - badgeH - 35;
      } else if (pos === 'bottom-right') {
        bx = canvas.width - badgeW - 20;
        by = canvas.height - badgeH - 35;
      }

      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 15;
      ctx.drawImage(loadedBadgeImage, bx, by, badgeW, badgeH);
      ctx.restore();
    }

    // 7. Apply Canvas Filters if selected
    if (activeFilter === 'woodcut') {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = '#78350f';
      ctx.globalAlpha = 0.25;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (activeFilter === 'cyber') {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
      grad.addColorStop(1, 'rgba(255, 0, 128, 0.2)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }

  // Render Curated Gallery
  function renderGallery() {
    galleryGrid.innerHTML = '';
    TEMPLATES.forEach(t => {
      const card = document.createElement('div');
      card.className = 'meme-card';

      const thumb = document.createElement('div');
      thumb.className = 'meme-card-thumb';
      const img = document.createElement('img');
      img.src = t.file;
      img.alt = t.title;
      img.loading = 'lazy';
      thumb.appendChild(img);

      const info = document.createElement('div');
      info.className = 'meme-card-info';
      info.innerHTML = `
        <h3>${t.title}</h3>
        <p>"${t.defaultTop} — ${t.defaultBottom}"</p>
      `;

      const remixBtn = document.createElement('button');
      remixBtn.className = 'remix-btn';
      remixBtn.innerHTML = '⚡ Remix in Studio';
      remixBtn.addEventListener('click', () => {
        loadTemplate(t);
        window.scrollTo({ top: document.querySelector('.meme-studio').offsetTop - 80, behavior: 'smooth' });
      });

      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(remixBtn);
      galleryGrid.appendChild(card);
    });
  }

  // Event Listeners
  templateSelect.addEventListener('change', () => {
    const tpl = TEMPLATES.find(t => t.id === templateSelect.value);
    if (tpl) loadTemplate(tpl);
  });

  topTextInput.addEventListener('input', render);
  bottomTextInput.addEventListener('input', render);
  footnoteInput.addEventListener('input', render);
  badgePosSelect.addEventListener('change', render);
  badgeSelect.addEventListener('change', loadBadgeAndRender);

  fontSizeSlider.addEventListener('input', () => {
    fontSizeVal.textContent = fontSizeSlider.value;
    render();
  });

  fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fontBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render();
    });
  });

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      crtContainer.classList.toggle('crt-active', activeFilter === 'crt');
      render();
    });
  });

  // Custom File Upload
  if (customUploadInput) {
    customUploadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          loadedImage = new Image();
          loadedImage.onload = () => {
            canvas.width = loadedImage.naturalWidth || 800;
            canvas.height = loadedImage.naturalHeight || 800;
            loadBadgeAndRender();
          };
          loadedImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Download PNG
  downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `memeforge_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // Copy to Clipboard
  copyBtn.addEventListener('click', async () => {
    try {
      canvas.toBlob(async (blob) => {
        if (blob && navigator.clipboard && navigator.clipboard.write) {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          copyBtn.textContent = '✓ Copied to Clipboard!';
          setTimeout(() => { copyBtn.textContent = 'Copy Image'; }, 2000);
        } else {
          alert('Clipboard copy is not supported in this browser. Please use Download PNG.');
        }
      });
    } catch (_) {
      alert('Unable to copy image directly. Please use Download PNG.');
    }
  });

  // Initialize
  initTemplateSelect();
  renderGallery();
  loadTemplate(TEMPLATES[0]);

})();
