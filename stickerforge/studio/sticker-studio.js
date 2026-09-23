/* StickerForge Studio • Interactive Slap & Customizer Engine */
(() => {
  'use strict';

  // Vector Originals (25 Canonical Masterworks)
  const VECTOR_ORIGINALS = [
    { id: 'vec_blazin_beaver', name: "Blazin' Beaver Mascot Crest", file: 'vectors/blazin_beaver_holographic_crest.svg', collection: 'Holographic Vectors' },
    { id: 'vec_nsp_apothecary', name: 'NorthStar Apothecary Botanical Seal', file: 'vectors/nsp_apothecary_botanical_seal.svg', collection: 'Holographic Vectors' },
    { id: 'vec_cyberpunk_skull', name: 'Cyberpunk 90s Holographic Skull', file: 'vectors/cyberpunk_90s_holographic_skull.svg', collection: 'Holographic Vectors' },
    { id: 'vec_galactic_license', name: 'Galactic Federation Dispensary License', file: 'vectors/galactic_federation_dispensary_license.svg', collection: 'Holographic Vectors' },
    { id: 'vec_keep_on_grass', name: 'Keep On The Grass Oregon Sign', file: 'vectors/keep_on_the_grass_oregon_park_sign.svg', collection: 'Holographic Vectors' },
    { id: 'vec_merkaba', name: 'Merkaba Starlight Sacred Seal', file: 'vectors/merkaba_starlight_sacred_seal.svg', collection: 'Holographic Vectors' },
    { id: 'vec_astral_eye', name: 'Psychonaut Astral Projection Eye', file: 'vectors/psychonaut_astral_projection_eye.svg', collection: 'Holographic Vectors' },
    { id: 'vec_mycelial_roots', name: 'Mycelial Root Network', file: 'vectors/sf_11_mycelial_root_network.svg', collection: 'Holographic Vectors' },
    { id: 'vec_terpene_flask', name: 'Terpene Alchemical Flask', file: 'vectors/sf_12_terpene_alchemical_flask.svg', collection: 'Holographic Vectors' },
    { id: 'vec_sasquatch', name: 'Kicking It With Sasquatch', file: 'vectors/sf_13_kicking_it_with_sasquatch.svg', collection: 'Holographic Vectors' },
    { id: 'vec_multnomah', name: 'Multnomah Mist Portal', file: 'vectors/sf_14_multnomah_mist_portal.svg', collection: 'Holographic Vectors' },
    { id: 'vec_vorath_badge', name: 'Uncle Vorath Detective Badge', file: 'vectors/sf_15_uncle_vorath_detective_badge.svg', collection: 'Holographic Vectors' },
    { id: 'vec_clackamas_salmon', name: 'Salmon of the Clackamas', file: 'vectors/sf_16_salmon_of_the_clackamas.svg', collection: 'Holographic Vectors' },
    { id: 'vec_truffle_hunter', name: 'Oregon Truffle Hunter', file: 'vectors/sf_17_oregon_truffle_hunter.svg', collection: 'Holographic Vectors' },
    { id: 'vec_starlight_alembic', name: 'Starlight Alchemical Alembic', file: 'vectors/sf_18_starlight_alchemical_alembic.svg', collection: 'Holographic Vectors' },
    { id: 'vec_mount_hood', name: 'Mount Hood Solarium Silhouette', file: 'vectors/sf_19_mount_hood_solarium_silhouette.svg', collection: 'Holographic Vectors' },
    { id: 'vec_cascadia_biophilic', name: 'Cascadia Biophilic Seal', file: 'vectors/sf_20_cascadia_biophilic_seal.svg', collection: 'Holographic Vectors' },
    { id: 'vec_basalt_hexagon', name: 'Columbia River Basalt Hexagon', file: 'vectors/sf_21_columbia_river_basalt_hexagon.svg', collection: 'Holographic Vectors' },
    { id: 'vec_coastal_fog', name: 'Oregon Coastal Fog Solarium', file: 'vectors/sf_22_oregon_coastal_fog_solarium.svg', collection: 'Holographic Vectors' },
    { id: 'vec_sphene_prism', name: 'Sphene Trichome Prism', file: 'vectors/sf_23_sphene_trichome_prism.svg', collection: 'Holographic Vectors' },
    { id: 'vec_blue_dab_rig', name: 'Electric Blue Dab Rig', file: 'vectors/sf_24_electric_blue_dab_rig.svg', collection: 'Holographic Vectors' },
    { id: 'vec_vault_key', name: 'Solarium Vault Key', file: 'vectors/sf_25_solarium_vault_key.svg', collection: 'Holographic Vectors' },
    { id: 'vec_soundwave_432', name: 'Solfeggio 432Hz Soundwave Badge', file: 'vectors/solfeggio_432hz_soundwave_badge.svg', collection: 'Holographic Vectors' },
    { id: 'vec_terpene_wheel', name: 'Terpene Wheel of Life', file: 'vectors/terpene_wheel_of_life.svg', collection: 'Holographic Vectors' },
    { id: 'vec_vorath_geometry', name: 'Vorath Grey Alien Sacred Geometry', file: 'vectors/vorath_grey_alien_sacred_geometry.svg', collection: 'Holographic Vectors' }
  ];

  // Audio synthesizer for slap tactile feedback
  let audioCtx = null;
  function playSlapSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } catch (_) {}
  }

  // State
  let catalogStickers = [...VECTOR_ORIGINALS];
  let placedStickers = [];
  let selectedSticker = null;
  let highestZ = 10;
  let activeCollection = 'all';

  // DOM Elements
  const slapStage = document.getElementById('slapStage');
  const stickerTray = document.getElementById('stickerTray');
  const searchInput = document.getElementById('traySearch');
  const filterPills = document.getElementById('filterPills');
  const surfaceBtns = document.querySelectorAll('.surface-btn');
  const tabBtns = document.querySelectorAll('.sidebar-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Selected sticker control inputs
  const sizeSlider = document.getElementById('stickerSizeSlider');
  const rotateSlider = document.getElementById('stickerRotateSlider');
  const opacitySlider = document.getElementById('stickerOpacitySlider');
  const styleBtns = document.querySelectorAll('.style-btn');
  const holoToggle = document.getElementById('holoToggle');
  const bringFrontBtn = document.getElementById('bringFrontBtn');
  const sendBackBtn = document.getElementById('sendBackBtn');
  const duplicateBtn = document.getElementById('duplicateBtn');
  const deleteBtn = document.getElementById('deleteBtn');

  // Surface Switcher
  surfaceBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      surfaceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      slapStage.setAttribute('data-surface', btn.dataset.surface);
    });
  });

  // Sidebar Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.hidden = true);
      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.hidden = false;
    });
  });

  // Load Main Catalog Stickers from JSON
  async function loadCatalog() {
    try {
      const res = await fetch('../catalog.json');
      if (res.ok) {
        const data = await res.json();
        const items = data.items.map(i => ({
          id: i.id,
          name: i.name,
          file: '../' + i.preview_file,
          original: i.image,
          collection: i.collection,
          collection_id: i.collection_id
        }));
        catalogStickers = [...VECTOR_ORIGINALS, ...items];
        renderFilterPills();
        renderTray();
      }
    } catch (e) {
      renderFilterPills();
      renderTray();
    }
  }

  // Render Collection Filter Pills
  function renderFilterPills() {
    const collections = ['all', 'Holographic Vectors', ...new Set(catalogStickers.map(s => s.collection))].filter(Boolean);
    filterPills.innerHTML = '';
    collections.slice(0, 12).forEach(c => {
      const btn = document.createElement('button');
      btn.className = `pill-filter-btn ${activeCollection === c ? 'active' : ''}`;
      btn.textContent = c === 'all' ? 'All Stickers' : c;
      btn.addEventListener('click', () => {
        activeCollection = c;
        document.querySelectorAll('.pill-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTray();
      });
      filterPills.appendChild(btn);
    });
  }

  // Render Sticker Tray
  function renderTray() {
    const q = searchInput.value.toLowerCase().trim();
    const filtered = catalogStickers.filter(s => {
      const matchCol = activeCollection === 'all' || s.collection === activeCollection;
      const matchQuery = !q || s.name.toLowerCase().includes(q) || (s.collection && s.collection.toLowerCase().includes(q));
      return matchCol && matchQuery;
    });

    stickerTray.innerHTML = '';
    filtered.slice(0, 72).forEach(item => {
      const div = document.createElement('div');
      div.className = 'tray-sticker-item';
      div.title = `${item.name} (${item.collection})`;
      const img = document.createElement('img');
      img.src = item.file;
      img.alt = item.name;
      img.loading = 'lazy';
      div.appendChild(img);
      div.addEventListener('click', () => slapSticker(item));
      stickerTray.appendChild(div);
    });
  }

  searchInput.addEventListener('input', renderTray);

  // Slap Sticker onto Canvas
  function slapSticker(item, customOptions = {}) {
    playSlapSound();
    highestZ += 1;

    const stickerEl = document.createElement('div');
    stickerEl.className = `placed-sticker ${customOptions.dieCut || 'die-cut-white'}`;
    stickerEl.style.zIndex = highestZ;

    const size = customOptions.size || 140;
    stickerEl.style.width = `${size}px`;
    stickerEl.style.height = `${size}px`;

    // Center offset with slight organic jitter
    const stageRect = slapStage.getBoundingClientRect();
    const jitterX = (Math.random() - 0.5) * 60;
    const jitterY = (Math.random() - 0.5) * 60;
    const x = customOptions.x !== undefined ? customOptions.x : (stageRect.width / 2) - (size / 2) + jitterX;
    const y = customOptions.y !== undefined ? customOptions.y : (stageRect.height / 2) - (size / 2) + jitterY;
    const rot = customOptions.rotation !== undefined ? customOptions.rotation : (Math.random() - 0.5) * 24;

    const stickerData = {
      el: stickerEl,
      item: item,
      x: Math.max(10, x),
      y: Math.max(10, y),
      size: size,
      rotation: rot,
      opacity: customOptions.opacity !== undefined ? customOptions.opacity : 1,
      dieCut: customOptions.dieCut || 'die-cut-white',
      holo: customOptions.holo !== undefined ? customOptions.holo : true
    };

    const img = document.createElement('img');
    img.src = item.file;
    img.alt = item.name;
    img.draggable = false;
    stickerEl.appendChild(img);

    // Holographic sheen layer
    if (stickerData.holo) {
      const holo = document.createElement('div');
      holo.className = 'holo-foil-overlay';
      stickerEl.appendChild(holo);
    }

    // Gizmo handles
    const rotateHandle = document.createElement('div');
    rotateHandle.className = 'gizmo-handle gizmo-rotate';
    rotateHandle.title = 'Rotate';

    const scaleHandle = document.createElement('div');
    scaleHandle.className = 'gizmo-handle gizmo-scale-br';
    scaleHandle.title = 'Scale';

    const deleteHandle = document.createElement('div');
    deleteHandle.className = 'gizmo-handle gizmo-delete';
    deleteHandle.innerHTML = '&times;';
    deleteHandle.title = 'Delete';

    stickerEl.appendChild(rotateHandle);
    stickerEl.appendChild(scaleHandle);
    stickerEl.appendChild(deleteHandle);

    slapStage.appendChild(stickerEl);
    placedStickers.push(stickerData);

    updateTransform(stickerData);
    selectSticker(stickerData);
    initGizmoListeners(stickerData, rotateHandle, scaleHandle, deleteHandle);
  }

  function updateTransform(data) {
    data.el.style.transform = `translate(${data.x}px, ${data.y}px) rotate(${data.rotation}deg)`;
    data.el.style.width = `${data.size}px`;
    data.el.style.height = `${data.size}px`;
    data.el.style.opacity = data.opacity;
  }

  // Select Sticker
  function selectSticker(data) {
    placedStickers.forEach(s => s.el.classList.remove('selected'));
    selectedSticker = data;
    if (data) {
      data.el.classList.add('selected');
      // Sync sidebar sliders
      if (sizeSlider) sizeSlider.value = data.size;
      if (rotateSlider) rotateSlider.value = Math.round(data.rotation);
      if (opacitySlider) opacitySlider.value = Math.round(data.opacity * 100);
      if (holoToggle) holoToggle.checked = data.holo;
      styleBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.style === data.dieCut);
      });
      // Switch to controls tab
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.hidden = true);
      const editTab = document.querySelector('[data-tab="tabEdit"]');
      if (editTab) editTab.classList.add('active');
      const editPane = document.getElementById('tabEdit');
      if (editPane) editPane.hidden = false;
    }
  }

  // Click on stage background deselects
  slapStage.addEventListener('pointerdown', (e) => {
    if (e.target === slapStage) {
      selectSticker(null);
    }
  });

  // Gizmo & Drag Interaction Engine
  function initGizmoListeners(data, rotateHandle, scaleHandle, deleteHandle) {
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialX = 0;
    let initialY = 0;

    data.el.addEventListener('pointerdown', (e) => {
      if (e.target === rotateHandle || e.target === scaleHandle || e.target === deleteHandle) return;
      selectSticker(data);
      highestZ += 1;
      data.el.style.zIndex = highestZ;

      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialX = data.x;
      initialY = data.y;
      data.el.setPointerCapture(e.pointerId);
      e.stopPropagation();
    });

    data.el.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      data.x = initialX + dx;
      data.y = initialY + dy;
      updateTransform(data);
    });

    const stopDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        try { data.el.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };
    data.el.addEventListener('pointerup', stopDrag);
    data.el.addEventListener('pointercancel', stopDrag);

    // Delete Handle
    deleteHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      data.el.remove();
      placedStickers = placedStickers.filter(s => s !== data);
      if (selectedSticker === data) selectSticker(null);
    });

    // Rotate Handle
    let isRotating = false;
    rotateHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isRotating = true;
      rotateHandle.setPointerCapture(e.pointerId);
      const rect = data.el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const onRotateMove = (moveEvent) => {
        if (!isRotating) return;
        const rad = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX);
        data.rotation = rad * (180 / Math.PI) + 90;
        updateTransform(data);
        if (rotateSlider) rotateSlider.value = Math.round(data.rotation);
      };

      const onRotateEnd = (upEvent) => {
        isRotating = false;
        try { rotateHandle.releasePointerCapture(upEvent.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', onRotateMove);
        window.removeEventListener('pointerup', onRotateEnd);
      };

      window.addEventListener('pointermove', onRotateMove);
      window.addEventListener('pointerup', onRotateEnd);
    });

    // Scale Handle
    let isScaling = false;
    let initialSize = 0;
    let scaleStartX = 0;
    scaleHandle.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      isScaling = true;
      scaleHandle.setPointerCapture(e.pointerId);
      initialSize = data.size;
      scaleStartX = e.clientX;

      const onScaleMove = (moveEvent) => {
        if (!isScaling) return;
        const delta = (moveEvent.clientX - scaleStartX) * 1.5;
        data.size = Math.max(50, Math.min(450, initialSize + delta));
        updateTransform(data);
        if (sizeSlider) sizeSlider.value = Math.round(data.size);
      };

      const onScaleEnd = (upEvent) => {
        isScaling = false;
        try { scaleHandle.releasePointerCapture(upEvent.pointerId); } catch (_) {}
        window.removeEventListener('pointermove', onScaleMove);
        window.removeEventListener('pointerup', onScaleEnd);
      };

      window.addEventListener('pointermove', onScaleMove);
      window.addEventListener('pointerup', onScaleEnd);
    });
  }

  // Selected Sticker Sliders
  if (sizeSlider) {
    sizeSlider.addEventListener('input', () => {
      if (selectedSticker) {
        selectedSticker.size = parseInt(sizeSlider.value, 10);
        updateTransform(selectedSticker);
      }
    });
  }

  if (rotateSlider) {
    rotateSlider.addEventListener('input', () => {
      if (selectedSticker) {
        selectedSticker.rotation = parseInt(rotateSlider.value, 10);
        updateTransform(selectedSticker);
      }
    });
  }

  if (opacitySlider) {
    opacitySlider.addEventListener('input', () => {
      if (selectedSticker) {
        selectedSticker.opacity = parseInt(opacitySlider.value, 10) / 100;
        updateTransform(selectedSticker);
      }
    });
  }

  styleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!selectedSticker) return;
      styleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSticker.dieCut = btn.dataset.style;
      selectedSticker.el.className = `placed-sticker selected ${btn.dataset.style}`;
    });
  });

  if (holoToggle) {
    holoToggle.addEventListener('change', () => {
      if (!selectedSticker) return;
      selectedSticker.holo = holoToggle.checked;
      const existingHolo = selectedSticker.el.querySelector('.holo-foil-overlay');
      if (holoToggle.checked && !existingHolo) {
        const holo = document.createElement('div');
        holo.className = 'holo-foil-overlay';
        selectedSticker.el.appendChild(holo);
      } else if (!holoToggle.checked && existingHolo) {
        existingHolo.remove();
      }
    });
  }

  if (bringFrontBtn) {
    bringFrontBtn.addEventListener('click', () => {
      if (selectedSticker) {
        highestZ += 1;
        selectedSticker.el.style.zIndex = highestZ;
      }
    });
  }

  if (sendBackBtn) {
    sendBackBtn.addEventListener('click', () => {
      if (selectedSticker) {
        selectedSticker.el.style.zIndex = 1;
      }
    });
  }

  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', () => {
      if (selectedSticker) {
        slapSticker(selectedSticker.item, {
          size: selectedSticker.size,
          dieCut: selectedSticker.dieCut,
          holo: selectedSticker.holo
        });
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (selectedSticker) {
        selectedSticker.el.remove();
        placedStickers = placedStickers.filter(s => s !== selectedSticker);
        selectSticker(null);
      }
    });
  }

  // Auto-Slap Bomb (Random 6 Curated Stickers)
  const autoBombBtn = document.getElementById('autoBombBtn');
  if (autoBombBtn) {
    autoBombBtn.addEventListener('click', () => {
      if (!catalogStickers || catalogStickers.length === 0) return;
      const stageRect = slapStage.getBoundingClientRect();
      const maxX = Math.max(30, stageRect.width - 180);
      const maxY = Math.max(30, stageRect.height - 180);
      const count = 6;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          const randItem = catalogStickers[Math.floor(Math.random() * catalogStickers.length)];
          const rx = Math.floor(Math.random() * maxX) + 15;
          const ry = Math.floor(Math.random() * maxY) + 15;
          const rSize = Math.floor(100 + Math.random() * 70);
          const rRot = Math.floor((Math.random() - 0.5) * 48);
          const rStyles = ['die-cut-white', 'die-cut-gold', 'die-cut-holographic'];
          const rStyle = rStyles[Math.floor(Math.random() * rStyles.length)];
          slapSticker(randItem, {
            x: rx,
            y: ry,
            size: rSize,
            rotation: rRot,
            dieCut: rStyle,
            holo: Math.random() > 0.3
          });
        }, i * 90);
      }
    });
  }

  // Dynamic Cursor Specular Foil Reflection
  slapStage.addEventListener('pointermove', (e) => {
    const rect = slapStage.getBoundingClientRect();
    const px = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const py = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    document.querySelectorAll('.holo-foil-overlay').forEach(el => {
      el.style.backgroundPosition = `${px}% ${py}%`;
    });
  });

  // Clear Surface Button
  const clearSurfaceBtn = document.getElementById('clearSurfaceBtn');
  if (clearSurfaceBtn) {
    clearSurfaceBtn.addEventListener('click', () => {
      if (placedStickers.length === 0) return;
      if (confirm('Clear all stickers from this surface?')) {
        placedStickers.forEach(s => s.el.remove());
        placedStickers = [];
        selectSticker(null);
      }
    });
  }

  // Custom Text Badge Creator
  const addTextBadgeBtn = document.getElementById('addTextBadgeBtn');
  const badgeTextInput = document.getElementById('badgeTextInput');
  const badgeShapeSelect = document.getElementById('badgeShapeSelect');
  const badgeColorSelect = document.getElementById('badgeColorSelect');

  if (addTextBadgeBtn) {
    addTextBadgeBtn.addEventListener('click', () => {
      const text = badgeTextInput.value.trim();
      if (!text) return;
      const shape = badgeShapeSelect.value;
      const color = badgeColorSelect.value;

      // Generate SVG badge Data URI
      let shapeSvg = '';
      if (shape === 'pill') {
        shapeSvg = `<rect x="5" y="5" width="230" height="70" rx="35" fill="${color}" stroke="#fff" stroke-width="4"/>`;
      } else if (shape === 'banner') {
        shapeSvg = `<polygon points="10,10 230,10 215,40 230,70 10,70 25,40" fill="${color}" stroke="#fbbf24" stroke-width="4"/>`;
      } else {
        shapeSvg = `<polygon points="30,10 210,10 230,40 210,70 30,70 10,40" fill="${color}" stroke="#00f0ff" stroke-width="4"/>`;
      }

      const svgData = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80">
          ${shapeSvg}
          <text x="50%" y="54%" font-family="Impact, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="2">
            ${text.toUpperCase()}
          </text>
        </svg>
      `;

      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      slapSticker({
        id: 'custom_badge_' + Date.now(),
        name: text,
        file: url,
        collection: 'Custom Text Badges'
      }, { size: 160, dieCut: 'die-cut-white', holo: false });

      badgeTextInput.value = '';
    });
  }

  // Order Custom Pack Button
  const orderPackBtn = document.getElementById('orderPackBtn');
  if (orderPackBtn) {
    orderPackBtn.addEventListener('click', () => {
      if (placedStickers.length === 0) {
        alert('Slap at least one sticker on the surface before requesting a custom pack!');
        return;
      }
      const stickerNames = placedStickers.map((s, idx) => `${idx + 1}. ${s.item.name} (${s.dieCut.replace('die-cut-', '')})`).join('%0A');
      const subject = encodeURIComponent('Custom StickerForge Slap Pack Order');
      const body = encodeURIComponent(`Hi NorthStar Team,\n\nI built a custom sticker layout in StickerForge Studio and would like to order a physical sticker pack with these stickers:\n\n${decodeURIComponent(stickerNames)}\n\nSurface layout: ${slapStage.getAttribute('data-surface')}\nTotal stickers: ${placedStickers.length}\n\nPlease confirm pricing, shipping, and turnaround!`);
      window.location.href = `/contact/?subject=${subject}&body=${body}`;
    });
  }

  // Export Canvas as PNG
  const downloadPngBtn = document.getElementById('downloadPngBtn');
  if (downloadPngBtn) {
    downloadPngBtn.addEventListener('click', async () => {
      selectSticker(null);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const rect = slapStage.getBoundingClientRect();

      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.scale(2, 2);

      // Draw background
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Render stage border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, rect.width - 20, rect.height - 20);

      // Draw stickers
      for (const s of placedStickers) {
        try {
          const img = s.el.querySelector('img');
          if (img && img.complete) {
            ctx.save();
            ctx.translate(s.x + s.size / 2, s.y + s.size / 2);
            ctx.rotate((s.rotation * Math.PI) / 180);
            ctx.globalAlpha = s.opacity;
            ctx.drawImage(img, -s.size / 2, -s.size / 2, s.size, s.size);
            ctx.restore();
          }
        } catch (_) {}
      }

      const link = document.createElement('a');
      link.download = `stickerforge_setup_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  // Pre-populate with 3 aesthetic starter stickers
  loadCatalog().then(() => {
    setTimeout(() => {
      if (placedStickers.length === 0 && catalogStickers.length >= 3) {
        slapSticker(catalogStickers[0], { size: 160, dieCut: 'die-cut-holographic' });
        slapSticker(catalogStickers[1], { size: 130, dieCut: 'die-cut-gold' });
        slapSticker(catalogStickers[4], { size: 140, dieCut: 'die-cut-white' });
      }
    }, 400);
  });

})();
