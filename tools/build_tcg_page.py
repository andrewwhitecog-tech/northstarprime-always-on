#!/usr/bin/env python3
"""Build the production NorthStar Prime TCG 3D Holographic Card Binder page."""

import json
import re
from pathlib import Path

NSP_ROOT = Path(__file__).resolve().parents[1]
TCG_SRC = Path(r"F:\NORTHSTAR_OS\MASTER_ASSETS\02_TRADING_CARDS_TCG")

with open(TCG_SRC / "index.html", encoding="utf-8") as f:
    src_content = f.read()

m = re.search(r"const cardsData = (\[.*?\]);", src_content)
if not m:
    raise ValueError("Missing cardsData in master TCG index")
cards_data = json.loads(m.group(1))

# Update relative paths to point to /tcg/assets/cards/{code}.webp
for c in cards_data:
    c["rel_path"] = f"/tcg/assets/cards/{c['code']}.webp"

cards_json = json.dumps(cards_data, ensure_ascii=False)

html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NorthStar Sovereign TCG // 3D Holographic Card Binder</title>
  <meta name="description" content="Official NorthStar Prime Sovereign Trading Card Game (TCG) 3D Holographic Card Binder and Deckbuilder sandbox featuring 71 master cards across 7 archetypes.">
  <link rel="canonical" href="https://northstarprime.net/tcg/">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <style>
    :root {{
      --bg: #07090e;
      --panel-bg: #0d121d;
      --card-bg: rgba(18, 24, 38, 0.9);
      --border: rgba(0, 240, 255, 0.2);
      --cyan: #00f0ff;
      --emerald: #00ff88;
      --amber: #f59e0b;
      --purple: #c084fc;
      --gold: #fbbf24;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --glow: rgba(0, 240, 255, 0.4);
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(0, 255, 136, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(0, 240, 255, 0.05) 0%, transparent 40%),
        radial-gradient(circle at 50% 50%, rgba(192, 132, 252, 0.03) 0%, transparent 50%),
        linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 100% 100%, 32px 32px, 32px 32px;
    }}

    header {{
      background: rgba(13, 18, 31, 0.95);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }}

    .brand-group {{
      display: flex;
      align-items: center;
      gap: 14px;
    }}

    .brand-logo {{
      width: 42px;
      height: 42px;
      background: linear-gradient(135deg, var(--amber), #b45309);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }}

    .brand-title h1 {{
      font-size: 1.25rem;
      font-weight: 900;
      letter-spacing: 1px;
      background: linear-gradient(90deg, #fff, #7dd3fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}

    .brand-title p {{
      font-family: monospace;
      font-size: 0.72rem;
      color: var(--amber);
      letter-spacing: 1px;
    }}

    .nav-actions {{
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }}

    .nav-btn {{
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border);
      color: #fff;
      padding: 7px 14px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 600;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }}

    .nav-btn:hover {{
      background: var(--cyan);
      color: #000;
      box-shadow: 0 0 12px var(--glow);
      border-color: var(--cyan);
    }}

    .nav-btn-highlight {{
      background: linear-gradient(135deg, #059669, #10b981);
      border: none;
    }}
    .nav-btn-highlight:hover {{
      background: linear-gradient(135deg, #047857, #059669);
      color: #fff;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.5);
    }}

    /* DECKBUILDER STATUS BAR */
    .deck-bar {{
      background: rgba(10, 14, 24, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding: 10px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      flex-wrap: wrap;
      gap: 10px;
    }}

    .deck-counter {{
      display: flex;
      align-items: center;
      gap: 16px;
      font-family: monospace;
    }}

    .counter-badge {{
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: var(--cyan);
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 700;
    }}

    /* FILTER BAR */
    .filter-bar {{
      max-width: 1400px;
      margin: 20px auto 0;
      padding: 0 24px;
      width: 100%;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }}

    .search-box {{
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: #fff;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 0.85rem;
      min-width: 240px;
      outline: none;
    }}
    .search-box:focus {{
      border-color: var(--cyan);
      box-shadow: 0 0 10px var(--glow);
    }}

    .filter-tag {{
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: var(--text-muted);
      padding: 7px 14px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }}

    .filter-tag:hover, .filter-tag.active {{
      background: rgba(0, 240, 255, 0.15);
      color: #fff;
      border-color: var(--cyan);
      box-shadow: 0 0 10px var(--glow);
    }}

    /* 3D BINDER GRID */
    .binder-container {{
      max-width: 1400px;
      margin: 24px auto;
      padding: 0 24px 60px;
      width: 100%;
    }}

    .binder-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 28px;
      perspective: 1200px;
    }}

    /* 3D CARD WRAPPER */
    .card-3d-wrap {{
      position: relative;
      border-radius: 12px;
      transition: transform 0.15s ease-out, box-shadow 0.2s;
      transform-style: preserve-3d;
      cursor: pointer;
      background: rgba(14, 18, 28, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }}

    .card-3d-wrap:hover {{
      border-color: var(--cyan);
      box-shadow: 0 16px 36px rgba(0, 240, 255, 0.25);
      z-index: 10;
    }}

    .card-viewport {{
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 2.5 / 3.5;
      background: #000;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.8);
    }}

    .card-image {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.2s;
    }}

    /* HOLOGRAPHIC FOIL SHINE SHADER */
    .card-holo-foil {{
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), 
        rgba(255, 255, 255, 0.5) 0%, 
        rgba(255, 0, 128, 0.3) 25%, 
        rgba(0, 240, 255, 0.3) 50%, 
        rgba(255, 215, 0, 0.25) 75%, 
        transparent 100%);
      mix-blend-mode: color-dodge;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }}

    .card-3d-wrap:hover .card-holo-foil {{
      opacity: 0.75;
    }}

    .card-spec-strip {{
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.72rem;
      font-family: monospace;
    }}

    .card-code {{
      color: var(--cyan);
      font-weight: 700;
    }}

    .card-rarity {{
      color: var(--amber);
      font-weight: 600;
    }}

    .card-name {{
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }}

    .card-archetype {{
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}

    .card-btn-strip {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 4px;
    }}

    .btn-action {{
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.15);
      background: rgba(255, 255, 255, 0.05);
      color: #fff;
      transition: all 0.2s;
      text-align: center;
    }}

    .btn-action:hover {{
      background: var(--cyan);
      color: #000;
      border-color: var(--cyan);
    }}

    .btn-add-deck {{
      border-color: rgba(16, 185, 129, 0.4);
      color: #34d399;
    }}
    .btn-add-deck:hover {{
      background: var(--emerald);
      color: #000;
    }}

    /* LIGHTBOX MODAL */
    .modal {{
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(14px);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }}

    .modal.active {{ display: flex; }}

    .modal-content {{
      background: var(--panel-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 880px;
      width: 100%;
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 28px;
      padding: 28px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.9);
      position: relative;
    }}

    @media (max-width: 768px) {{
      .modal-content {{ grid-template-columns: 1fr; }}
    }}

    .modal-card-view {{
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 12px 36px rgba(0, 240, 255, 0.3);
      border: 1px solid rgba(0, 240, 255, 0.4);
    }}

    .modal-card-view img {{
      width: 100%;
      height: auto;
      display: block;
    }}

    .modal-details {{
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 16px;
    }}

    .modal-close {{
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-weight: 800;
    }}
    .modal-close:hover {{
      background: #ef4444;
      border-color: #ef4444;
    }}
  </style>
</head>
<body>

  <header>
    <div class="brand-group">
      <div class="brand-logo">✦</div>
      <div class="brand-title">
        <h1>NorthStar Sovereign TCG</h1>
        <p>OFFICIAL 3D HOLOGRAPHIC CARD BINDER &amp; DECKBUILDER // 71 MASTER CARDS</p>
      </div>
    </div>
    <div class="nav-actions">
      <a href="/manga/" class="nav-btn">Duel Zexal Manga &rarr;</a>
      <a href="/comics/" class="nav-btn">Comics Vault &rarr;</a>
      <a href="/" class="nav-btn">&larr; Home</a>
    </div>
  </header>

  <div class="deck-bar">
    <div class="deck-counter">
      <span>ACTIVE DECK BUILDER:</span>
      <span class="counter-badge" id="main-deck-count">Main Deck: 0 / 40</span>
      <span class="counter-badge" style="color:var(--purple); border-color:var(--purple); background:rgba(192,132,252,0.12);" id="extra-deck-count">Extra Deck: 0 / 15</span>
    </div>
    <div style="display:flex; gap:8px;">
      <button class="nav-btn" onclick="clearDeck()">Clear Deck</button>
      <button class="nav-btn" style="border-color:var(--emerald); color:var(--emerald);" onclick="exportDeck()">Export Decklist</button>
    </div>
  </div>

  <div class="filter-bar">
    <input type="text" class="search-box" id="search-input" placeholder="Search cards by name or code..." oninput="filterCards()">
    <button class="filter-tag active" onclick="setCategory('all', this)">All Cards (71)</button>
    <button class="filter-tag" onclick="setCategory('hiphop', this)">Hip-Hop &amp; Trap</button>
    <button class="filter-tag" onclick="setCategory('metal', this)">Rock &amp; Metal</button>
    <button class="filter-tag" onclick="setCategory('edm', this)">EDM &amp; Bass</button>
    <button class="filter-tag" onclick="setCategory('occult', this)">Occult &amp; Esoteric</button>
    <button class="filter-tag" onclick="setCategory('egypt', this)">Ancient Egyptian</button>
    <button class="filter-tag" onclick="setCategory('sports', this)">Alt Sports &amp; Art</button>
    <button class="filter-tag" onclick="setCategory('outlaws', this)">Outlaws &amp; Cults</button>
  </div>

  <main class="binder-container">
    <div class="binder-grid" id="card-grid">
      <!-- Injected via JavaScript -->
    </div>
  </main>

  <!-- LIGHTBOX MODAL -->
  <div class="modal" id="card-modal" onclick="closeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeModal()">✕</button>
      <div class="modal-card-view">
        <img id="modal-img" src="" alt="Card Inspect">
      </div>
      <div class="modal-details">
        <div>
          <span style="font-family:monospace; color:var(--cyan); font-size:0.8rem;" id="modal-code">NSP-EN001</span>
          <h2 style="font-size:1.6rem; color:#fff; margin:6px 0;" id="modal-title">Card Title</h2>
          <p style="color:var(--amber); font-weight:700; font-size:0.9rem;" id="modal-rarity">Secret Rare</p>
          <p style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-top:2px;" id="modal-archetype">Archetype</p>
          <div style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:14px; margin-top:16px; font-size:0.88rem; line-height:1.5; color:#cbd5e1;" id="modal-effect">
            Card effects and flavor text calibrated for NorthStar Sovereign tournament format.
          </div>
        </div>
        <div style="display:flex; gap:10px;">
          <button class="nav-btn nav-btn-highlight" style="flex:1; justify-content:center; padding:10px;" id="modal-add-btn" onclick="addCurrentModalToDeck()">+ Add Card to Deck</button>
        </div>
      </div>
    </div>
  </div>

  <script>
    const cardsData = {cards_json};
    let activeCategory = 'all';
    let userDeck = [];
    let currentModalCard = null;

    // Web Audio Sound Synthesis for Card Hologram & Flip
    let audioCtx = null;
    function playCardChime() {{
      try {{
        if (!audioCtx) {{
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }}
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      }} catch(e) {{}}
    }}

    function renderCards() {{
      const grid = document.getElementById('card-grid');
      grid.innerHTML = '';
      const query = document.getElementById('search-input').value.toLowerCase();

      const filtered = cardsData.filter(c => {{
        const matchCat = (activeCategory === 'all' || c.tag === activeCategory);
        const matchQuery = (c.title.toLowerCase().includes(query) || c.code.toLowerCase().includes(query) || c.archetype.toLowerCase().includes(query));
        return matchCat && matchQuery;
      }});

      filtered.forEach(c => {{
        const wrap = document.createElement('div');
        wrap.className = 'card-3d-wrap';
        
        wrap.onmousemove = (e) => {{
          const rect = wrap.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const rotateX = ((y - centerY) / centerY) * -12;
          const rotateY = ((x - centerX) / centerX) * 12;

          wrap.style.transform = `perspective(1000px) rotateX(${{rotateX}}deg) rotateY(${{rotateY}}deg) scale3d(1.03, 1.03, 1.03)`;
          
          const foil = wrap.querySelector('.card-holo-foil');
          if (foil) {{
            foil.style.setProperty('--mouse-x', `${{(x / rect.width) * 100}}%`);
            foil.style.setProperty('--mouse-y', `${{(y / rect.height) * 100}}%`);
          }}
        }};

        wrap.onmouseleave = () => {{
          wrap.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        }};

        wrap.innerHTML = `
          <div class="card-viewport" onclick="openModal('${{c.code}}')">
            <img src="${{c.rel_path}}" class="card-image" alt="${{c.title}}" loading="lazy">
            <div class="card-holo-foil"></div>
          </div>
          <div class="card-spec-strip">
            <span class="card-code">${{c.code}}</span>
            <span class="card-rarity">${{'★'.repeat(c.stars)}} ${{c.rarity}}</span>
          </div>
          <div class="card-name" title="${{c.title}}">${{c.title}}</div>
          <div class="card-archetype">${{c.tag_label}}</div>
          <div class="card-btn-strip">
            <button class="btn-action" onclick="openModal('${{c.code}}')">Inspect</button>
            <button class="btn-action btn-add-deck" onclick="addToDeck('${{c.code}}')">+ Deck</button>
          </div>
        `;
        grid.appendChild(wrap);
      }});
    }}

    function setCategory(cat, btn) {{
      activeCategory = cat;
      document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCards();
    }}

    function filterCards() {{
      renderCards();
    }}

    function openModal(code) {{
      const c = cardsData.find(item => item.code === code);
      if (!c) return;
      currentModalCard = c;
      document.getElementById('modal-img').src = c.rel_path;
      document.getElementById('modal-code').innerText = c.code;
      document.getElementById('modal-title').innerText = c.title;
      document.getElementById('modal-rarity').innerText = `★ ${{c.rarity}} (${{'★'.repeat(c.stars)}})`;
      document.getElementById('modal-archetype').innerText = `${{c.archetype}} // ${{c.tag_label}}`;
      document.getElementById('modal-effect').innerText = `Official playable card in the NorthStar Sovereign Format. Synergy: Compatible with ${{c.tag_label}} archetype structures and Xyz Overlay Network summoning.`;
      
      playCardChime();
      document.getElementById('card-modal').classList.add('active');
    }}

    function closeModal() {{
      document.getElementById('card-modal').classList.remove('active');
    }}

    function addToDeck(code) {{
      if (userDeck.length >= 60) {{
        alert('Deck is at maximum capacity (60 cards)!');
        return;
      }}
      const c = cardsData.find(item => item.code === code);
      if (c) {{
        userDeck.push(c);
        playCardChime();
        updateDeckCounter();
      }}
    }}

    function addCurrentModalToDeck() {{
      if (currentModalCard) {{
        addToDeck(currentModalCard.code);
        closeModal();
      }}
    }}

    function updateDeckCounter() {{
      document.getElementById('main-deck-count').innerText = `Main Deck: ${{userDeck.length}} / 40`;
    }}

    function clearDeck() {{
      userDeck = [];
      updateDeckCounter();
    }}

    function exportDeck() {{
      if (userDeck.length === 0) {{
        alert('Your deck is currently empty. Add cards by clicking "+ Deck" on any card!');
        return;
      }}
      const text = userDeck.map(c => `${{c.code}} - ${{c.title}} (${{c.tag_label}})`).join('\\n');
      const blob = new Blob([text], {{ type: 'text/plain' }});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NorthStar_Sovereign_Decklist.txt';
      a.click();
    }}

    // Initial Render
    renderCards();
  </script>
</body>
</html>
"""

output_path = NSP_ROOT / "tcg" / "index.html"
output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text(html_content, encoding="utf-8")
print(f"TCG page generated: {output_path} ({output_path.stat().st_size} bytes)")
