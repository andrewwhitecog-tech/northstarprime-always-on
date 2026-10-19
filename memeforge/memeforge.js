/* MemeForge Engine • High-Culture Psychonaut Image & Satire Studio */
(() => {
  'use strict';

  // Master Template Registry: 100% Genuine Canonical Vorath & NorthStar Reviewed Originals
  const TEMPLATES = [
    {
      id: 'v01',
      title: 'Obsidian Docket Chamber',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/apex_obsidian-be6223aae9c2aec6.webp',
      aspect: '2:3',
      description: 'The inner sanctum assembly around the suspended resonance coil in the subterranean docket.'
    },
    {
      id: 'v02',
      title: 'Dream Court: Cold Breath',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/dream-court-cold-breath-c3655d30f6d31cd0.webp',
      aspect: '16:9',
      description: 'The Great Wheel and prismatic crystals in the high mountain vault.'
    },
    {
      id: 'v03',
      title: 'The Fifth Circuit Sequence',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/apex_fifth_circuit-06ed28437ba0739b.webp',
      aspect: '2:3',
      description: 'Sovereign esoteric geometry and electromagnetic continuum.'
    },
    {
      id: 'v04',
      title: 'Map of Erased Places',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/apex_map_banner-47186f25a1de466b.webp',
      aspect: '2:1',
      description: 'The forgotten topography and cartographic anomalies of the outer perimeter.'
    },
    {
      id: 'v05',
      title: 'The Null Calendar',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/l02-06b71ef8334bbff4.webp',
      aspect: '2:3',
      description: 'Temporal coordination across non-standard celestial cycles.'
    },
    {
      id: 'v06',
      title: 'A Map of Erased Places (Alt)',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/l11-bca7c14473eeae9e.webp',
      aspect: '2:3',
      description: 'Detailed survey atlas of erased subterranean corridors.'
    },
    {
      id: 'v07',
      title: 'The Obituary Engine',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/apex_obituary-1e0ab4e9a8881291.webp',
      aspect: '2:3',
      description: 'The mechanical loom and sovereign archival memorial apparatus.'
    },
    {
      id: 'v08',
      title: 'School of Weather Observatory',
      category: 'Canonical Vorath Masterworks',
      file: '/static/art/reviewed/apex_20261019/apex_school_weather-2c996db30aa7b4ee.webp',
      aspect: '2:3',
      description: 'Atmospheric distillation and meteorological observatory.'
    }
  ];

  // State
  let currentTemplate = TEMPLATES[0];
  let loadedImage = new Image();
  let activeFilter = 'none';
  let activeAspect = 'native';
  let activeFit = 'cover';
  let zoomLevel = 1.0;
  let rotationDeg = 0;
  let isFlippedH = false;
  let brightnessVal = 0;
  let contrastVal = 0;
  let saturationVal = 0;

  // DOM Elements
  const canvas = document.getElementById('memeCanvas');
  const ctx = canvas.getContext('2d');
  const crtContainer = document.querySelector('.canvas-viewport');
  const templateSelect = document.getElementById('templateSelect');
  const customUploadInput = document.getElementById('customUploadInput');
  const downloadBtn = document.getElementById('downloadMemeBtn');
  const copyBtn = document.getElementById('copyMemeBtn');
  const resetBtn = document.getElementById('resetCompBtn');
  const galleryGrid = document.getElementById('memeGalleryGrid');
  const sceneNotesInput = document.getElementById('sceneNotesInput');
  const sceneNotesText = document.getElementById('sceneNotesText');
  const sceneNotesTitle = document.getElementById('sceneNotesTitle');
  const memeErrorMessage = document.getElementById('memeErrorMessage');
  const zoomSlider = document.getElementById('zoomSlider');
  const zoomVal = document.getElementById('zoomVal');
  const brightnessSlider = document.getElementById('brightnessSlider');
  const brightnessValDisplay = document.getElementById('brightnessVal');
  const contrastSlider = document.getElementById('contrastSlider');
  const contrastValDisplay = document.getElementById('contrastVal');
  const saturationSlider = document.getElementById('saturationSlider');
  const saturationValDisplay = document.getElementById('saturationVal');
  const aspectBtns = document.querySelectorAll('.aspect-btn');
  const fitBtns = document.querySelectorAll('.fit-btn');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const rotateBtn = document.getElementById('rotateBtn');
  const flipBtn = document.getElementById('flipBtn');

  // In-Page Status & Error Feedback
  function showError(msg) {
    if (memeErrorMessage) {
      memeErrorMessage.textContent = msg;
      memeErrorMessage.style.display = 'block';
    }
  }

  function clearError() {
    if (memeErrorMessage) {
      memeErrorMessage.textContent = '';
      memeErrorMessage.style.display = 'none';
    }
  }

  // Populate Template Dropdown
  function initTemplateSelect() {
    templateSelect.innerHTML = '';
    const categories = {};
    TEMPLATES.forEach(t => {
      if (!categories[t.category]) categories[t.category] = [];
      categories[t.category].push(t);
    });

    for (const [catName, list] of Object.entries(categories)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = catName;
      list.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.title;
        optgroup.appendChild(opt);
      });
      templateSelect.appendChild(optgroup);
    }
  }

  // Load Template Image (Preserves last valid decoded image on error)
  function loadTemplate(tpl) {
    if (!tpl) return;
    clearError();

    const candidate = new Image();
    candidate.crossOrigin = 'anonymous';
    candidate.onload = () => {
      clearError();
      loadedImage = candidate;
      currentTemplate = tpl;
      if (templateSelect) templateSelect.value = tpl.id;

      // Update DOM scene notes outside image
      if (sceneNotesInput) sceneNotesInput.value = tpl.description || '';
      if (sceneNotesTitle) sceneNotesTitle.textContent = tpl.title;
      if (sceneNotesText) sceneNotesText.textContent = tpl.description || '';

      render();
    };
    candidate.onerror = () => {
      showError(`Unable to load artwork "${tpl.title}". The previous valid artwork has been preserved.`);
      if (currentTemplate && templateSelect) {
        templateSelect.value = currentTemplate.id;
      }
    };
    candidate.src = tpl.file;
  }

  // Render Canvas Composition (Zero text painted into image bytes)
  function render() {
    if (!loadedImage || !loadedImage.complete) return;

    // Source native dimensions with safe high-resolution fallbacks
    const srcW = loadedImage.naturalWidth || 1024;
    const srcH = loadedImage.naturalHeight || 1536;

    // Compute target dimensions based on selected aspect ratio
    let targetW = srcW;
    let targetH = srcH;

    if (activeAspect === '1:1') {
      const side = Math.min(srcW, srcH);
      targetW = side;
      targetH = side;
    } else if (activeAspect === '16:9') {
      targetW = srcW;
      targetH = Math.round(srcW * (9 / 16));
    } else if (activeAspect === '4:3') {
      targetW = srcW;
      targetH = Math.round(srcW * (3 / 4));
    } else if (activeAspect === '9:16') {
      targetH = srcH;
      targetW = Math.round(srcH * (9 / 16));
    }

    // Account for 90/270 rotation in canvas dimensions
    const isRotatedQuarter = (rotationDeg === 90 || rotationDeg === 270);
    canvas.width = isRotatedQuarter ? targetH : targetW;
    canvas.height = isRotatedQuarter ? targetW : targetH;

    // Calculate un-stretched draw dimensions preserving authentic source aspect ratio
    let drawW = targetW;
    let drawH = targetH;

    if (activeAspect !== 'native') {
      const targetRatio = targetW / targetH;
      const srcRatio = srcW / srcH;

      if (activeFit === 'contain') {
        // Fit entire image inside target canvas (letterbox/pillarbox)
        if (srcRatio > targetRatio) {
          drawW = targetW;
          drawH = targetW / srcRatio;
        } else {
          drawH = targetH;
          drawW = targetH * srcRatio;
        }
      } else {
        // Default 'cover': crop to fill target canvas symmetrically preserving true geometry
        if (srcRatio > targetRatio) {
          // Source is wider than target: match height, crop width symmetrically
          drawH = targetH;
          drawW = targetH * srcRatio;
        } else {
          // Source is taller than target: match width, crop height symmetrically
          drawW = targetW;
          drawH = targetW / srcRatio;
        }
      }
    } else {
      drawW = srcW;
      drawH = srcH;
    }

    // Reset transform & clear (clean black void background for contain mode letterboxing)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#06080e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Set up canvas color tone filter
    const bFilter = 100 + brightnessVal;
    const cFilter = 100 + contrastVal;
    const sFilter = 100 + saturationVal;
    ctx.filter = `brightness(${bFilter}%) contrast(${cFilter}%) saturate(${sFilter}%)`;

    // Center origin and apply transformation pipeline
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    if (rotationDeg !== 0) ctx.rotate((rotationDeg * Math.PI) / 180);
    if (isFlippedH) ctx.scale(-1, 1);
    if (zoomLevel !== 1.0) ctx.scale(zoomLevel, zoomLevel);

    // Draw source image centered with true un-distorted proportions
    ctx.drawImage(loadedImage, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Reset filter for post-processing overlay passes
    ctx.filter = 'none';

    // Apply Aesthetic Creative Filters
    if (activeFilter === 'woodcut') {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = '#f3e8d2';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = '#78350f';
      ctx.globalAlpha = 0.35;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (activeFilter === 'cyber') {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.28)');
      grad.addColorStop(1, 'rgba(255, 0, 128, 0.28)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (activeFilter === 'monochrome') {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    } else if (activeFilter === 'crt') {
      // Subtle diegetic phosphor raster lines on canvas
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < canvas.height; y += 4) {
        ctx.fillRect(0, y, canvas.width, 2);
      }
      ctx.restore();
    }
  }

  // Render Curated Gallery Grid
  function renderGallery() {
    if (!galleryGrid) return;
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
        <span class="card-category-tag">${t.category}</span>
        <h3>${t.title}</h3>
        <p>${t.description}</p>
      `;

      const remixBtn = document.createElement('button');
      remixBtn.type = 'button';
      remixBtn.className = 'remix-btn';
      remixBtn.innerHTML = '✦ Load in Studio';
      remixBtn.addEventListener('click', () => {
        loadTemplate(t);
        const studioEl = document.querySelector('.meme-studio');
        if (studioEl) {
          window.scrollTo({ top: studioEl.offsetTop - 80, behavior: 'smooth' });
        }
      });

      card.appendChild(thumb);
      card.appendChild(info);
      card.appendChild(remixBtn);
      galleryGrid.appendChild(card);
    });
  }

  // Event Listeners: Template Selector
  if (templateSelect) {
    templateSelect.addEventListener('change', () => {
      const tpl = TEMPLATES.find(t => t.id === templateSelect.value);
      if (tpl) loadTemplate(tpl);
    });
  }

  // Event Listeners: Authored Scene Notes (DOM only, outside image)
  if (sceneNotesInput) {
    sceneNotesInput.addEventListener('input', () => {
      const val = sceneNotesInput.value.trim();
      if (sceneNotesText) {
        sceneNotesText.textContent = val || 'No additional scene notes authored.';
      }
    });
  }

  // Event Listeners: Aspect Ratio Framing
  aspectBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      aspectBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeAspect = btn.dataset.aspect || 'native';
      render();
    });
  });

  // Event Listeners: Proportion Fit Mode (Cover vs Contain)
  fitBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fitBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFit = btn.dataset.fit || 'cover';
      render();
    });
  });

  // Event Listeners: Zoom Slider
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      zoomLevel = parseFloat(zoomSlider.value) / 100;
      if (zoomVal) zoomVal.textContent = `${zoomSlider.value}%`;
      render();
    });
  }

  // Event Listeners: Rotation
  if (rotateBtn) {
    rotateBtn.addEventListener('click', () => {
      rotationDeg = (rotationDeg + 90) % 360;
      rotateBtn.textContent = `Rotate ${rotationDeg}°`;
      render();
    });
  }

  // Event Listeners: Horizontal Flip
  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      isFlippedH = !isFlippedH;
      flipBtn.classList.toggle('active', isFlippedH);
      render();
    });
  }

  // Event Listeners: Color Adjustments
  if (brightnessSlider) {
    brightnessSlider.addEventListener('input', () => {
      brightnessVal = parseInt(brightnessSlider.value, 10);
      if (brightnessValDisplay) brightnessValDisplay.textContent = brightnessVal > 0 ? `+${brightnessVal}` : brightnessVal;
      render();
    });
  }
  if (contrastSlider) {
    contrastSlider.addEventListener('input', () => {
      contrastVal = parseInt(contrastSlider.value, 10);
      if (contrastValDisplay) contrastValDisplay.textContent = contrastVal > 0 ? `+${contrastVal}` : contrastVal;
      render();
    });
  }
  if (saturationSlider) {
    saturationSlider.addEventListener('input', () => {
      saturationVal = parseInt(saturationSlider.value, 10);
      if (saturationValDisplay) saturationValDisplay.textContent = saturationVal > 0 ? `+${saturationVal}` : saturationVal;
      render();
    });
  }

  // Event Listeners: Aesthetic Filters
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'none';
      if (crtContainer) {
        crtContainer.classList.toggle('crt-active', activeFilter === 'crt');
      }
      render();
    });
  });

  // Event Listeners: Reset Composition
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeAspect = 'native';
      aspectBtns.forEach(b => b.classList.toggle('active', b.dataset.aspect === 'native'));
      zoomLevel = 1.0;
      if (zoomSlider) zoomSlider.value = '100';
      if (zoomVal) zoomVal.textContent = '100%';
      rotationDeg = 0;
      if (rotateBtn) rotateBtn.textContent = 'Rotate 0°';
      isFlippedH = false;
      if (flipBtn) flipBtn.classList.remove('active');
      brightnessVal = 0;
      if (brightnessSlider) brightnessSlider.value = '0';
      if (brightnessValDisplay) brightnessValDisplay.textContent = '0';
      contrastVal = 0;
      if (contrastSlider) contrastSlider.value = '0';
      if (contrastValDisplay) contrastValDisplay.textContent = '0';
      saturationVal = 0;
      if (saturationSlider) saturationSlider.value = '0';
      if (saturationValDisplay) saturationValDisplay.textContent = '0';
      activeFilter = 'none';
      filterBtns.forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
      activeFit = 'cover';
      fitBtns.forEach(b => b.classList.toggle('active', b.dataset.fit === 'cover'));
      if (crtContainer) crtContainer.classList.remove('crt-active');
      render();
    });
  }

  // Custom Local File Upload (Preserves last valid decoded image on error)
  if (customUploadInput) {
    customUploadInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      clearError();
      const reader = new FileReader();
      reader.onerror = () => {
        showError(`Failed to read file "${file.name}". The previous valid artwork has been preserved.`);
      };
      reader.onload = (event) => {
        const candidate = new Image();
        candidate.onload = () => {
          if (!candidate.naturalWidth || !candidate.naturalHeight) {
            showError(`Image "${file.name}" has zero dimensions or corrupt data. The previous valid artwork has been preserved.`);
            return;
          }
          clearError();
          loadedImage = candidate;
          currentTemplate = {
            id: 'custom_upload',
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: 'Local Upload',
            file: event.target.result,
            description: `Locally uploaded image: ${file.name} (${candidate.naturalWidth}x${candidate.naturalHeight})`
          };
          if (sceneNotesTitle) sceneNotesTitle.textContent = currentTemplate.title;
          if (sceneNotesInput) sceneNotesInput.value = currentTemplate.description;
          if (sceneNotesText) sceneNotesText.textContent = currentTemplate.description;
          render();
        };
        candidate.onerror = () => {
          showError(`Failed to decode image "${file.name}". The previous valid artwork has been preserved.`);
        };
        candidate.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // Download Decoded PNG
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      if (!canvas) return;
      if (canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          const cleanName = (currentTemplate.title || 'memeforge').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          link.download = `memeforge_${cleanName}_${Date.now()}.png`;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, 'image/png');
      } else {
        const link = document.createElement('a');
        link.download = `memeforge_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  }

  // Copy Image to Clipboard
  if (copyBtn) {
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
            alert('Clipboard image copying is not supported in this browser. Please use Download PNG.');
          }
        }, 'image/png');
      } catch (_) {
        alert('Unable to copy image directly. Please use Download PNG.');
      }
    });
  }

  // Initialization
  initTemplateSelect();
  renderGallery();
  loadTemplate(TEMPLATES[0]);

})();
