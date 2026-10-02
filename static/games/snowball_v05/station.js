/* NorthStar IDG learning cabinets, original shared runtime, September 2026. */
'use strict';
window.Station = (() => {
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let storageOK = true;
  function read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' && !Array.isArray(v) ? v : fallback; } catch { return fallback; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { storageOK = false; if ($('storage-warning')) $('storage-warning').textContent = 'Session only: this browser cannot save progress.'; } }
  const saved = read('nsp_learning_preferences_v05', {});
  const prefs = {sound:saved.sound === true, calm:typeof saved.calm === 'boolean' ? saved.calm : matchMedia('(prefers-reduced-motion: reduce)').matches, three:saved.three !== false};
  let paused = false, audio, visual, onRetry, game, padPrevious = [], lastPad = 0;
  function tone(good = true) {
    if (!prefs.sound || paused) return;
    try {
      audio ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(()=>{});
      const osc = audio.createOscillator(), gain = audio.createGain(), now = audio.currentTime;
      osc.type = 'sine'; osc.frequency.setValueAtTime(good ? 480 : 150, now); osc.frequency.exponentialRampToValueAtTime(good ? 760 : 90, now + .13);
      gain.gain.setValueAtTime(.04, now); gain.gain.exponentialRampToValueAtTime(.0001, now + .2);
      osc.connect(gain); gain.connect(audio.destination); osc.start(); osc.stop(now + .21);
    } catch { $('audio').textContent = 'Audio unavailable'; }
  }
  function syncPrefs() {
    document.body.classList.toggle('calm', prefs.calm);
    $('audio').textContent = prefs.sound ? 'Sound on' : 'Sound off'; $('audio').setAttribute('aria-pressed', String(prefs.sound));
    $('motion').textContent = prefs.calm ? 'Motion quiet' : 'Motion on'; $('motion').setAttribute('aria-pressed', String(prefs.calm));
    $('quality').textContent = prefs.three ? 'Detail 3D' : 'Detail 2D'; $('quality').setAttribute('aria-pressed', String(prefs.three));
    write('nsp_learning_preferences_v05', prefs); visual?.settings();
  }
  function pause(value = !paused) {
    paused = value; $('pause').textContent = paused ? 'Resume' : 'Pause';
    if (paused && !$('pause-dialog').open) $('pause-dialog').showModal();
    if (!paused && $('pause-dialog').open) $('pause-dialog').close();
    visual?.settings();
  }
  function mount(config, retry) {
    game = config; onRetry = retry; document.title = `${config.name} · ${config.subtitle} | NorthStar IDG`;
    document.documentElement.style.setProperty('--accent', config.accent);
    document.body.innerHTML = `<div class="wrap"><header class="topbar"><a class="brand" href="../index.html"><b>NSP</b> IDG / LEARNING ARCADE</a><nav class="tools" aria-label="Game settings"><button id="pause">Pause</button><button id="audio">Sound off</button><button id="motion">Motion on</button><button id="quality">Detail 3D</button><button id="retry">Restart run</button></nav></header>
    <section class="hero"><div><div class="eyebrow">VORATH / ${esc(config.subtitle)}</div><h1>${esc(config.name)}</h1><p>${esc(config.description)}</p><div class="identity">${esc(config.lead)} / ${esc(config.role)}</div></div><div class="visuals"><div class="cast-card"><div id="cast-portrait" class="cast-portrait" role="img"></div><div class="cast-label"><span id="cast-allegiance">VORATH FAMILY / ALLY</span><b id="cast-name"></b></div></div><div class="scene" id="scene" aria-label="${esc(config.scene)}"><div class="scene-label">${esc(config.scene)}</div><div class="scene-bottom"><span>LOOMWHEEL</span><span id="scene-status">AWAITING INPUT</span></div></div></div></section>
    <section class="statusbar" aria-label="Run status"><div class="stat"><span id="stat-label-0"></span><b id="stat-0"></b></div><div class="stat"><span id="stat-label-1"></span><b id="stat-1"></b></div><div class="stat"><span id="stat-label-2"></span><b id="stat-2"></b></div></section>
    <div id="storage-warning" class="storage-warning" role="status"></div><main class="workspace"><section id="work" class="panel" aria-label="Interactive workbench"></section><aside class="panel mission"><div class="eyebrow" id="mission-kicker">CURRENT OBJECTIVE</div><h2 id="mission-title"></h2><p id="brief" class="brief"></p><div class="progress" id="progress" aria-label="Campaign progress"></div><div id="feedback" class="feedback" role="status" aria-live="polite"></div><button id="advance" class="primary next" hidden>Continue</button><details class="controls-note"><summary>Controls & learning notes</summary><p>Mouse or touch: select a control. Keyboard: Tab to focus, Enter or Space to activate. P or Escape pauses. Controller: D-pad moves focus, A activates, Start pauses. Restart begins at the first challenge; saved bests remain.</p><p>${esc(config.note)}</p></details></aside></main>
    <footer class="footer"><a href="../index.html">← LEARNING ARCADE</a><span>ORIGINAL NORTHSTAR / SAVES IN THIS BROWSER</span></footer></div>
    <dialog id="pause-dialog" aria-labelledby="pause-title"><h2 id="pause-title">Signal held.</h2><p>The workbench is paused. Your current challenge stays in place.</p><button id="resume" class="primary">Return to play</button></dialog>`;
    $('pause').onclick = () => pause(); $('resume').onclick = () => pause(false);
    $('pause-dialog').addEventListener('cancel', e => {e.preventDefault(); pause(false);});
    $('audio').onclick = () => {prefs.sound = !prefs.sound; syncPrefs(); tone();};
    $('motion').onclick = () => {prefs.calm = !prefs.calm; syncPrefs();};
    $('quality').onclick = () => {prefs.three = !prefs.three; syncPrefs();};
    $('retry').onclick = () => {if (!paused) {onRetry(); tone();}};
    document.addEventListener('keydown', e => {
      if (paused && e.key === 'Tab') {e.preventDefault(); $('resume').focus(); return;}
      if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {e.preventDefault(); if (!e.repeat) pause();}
    });
    document.addEventListener('visibilitychange', () => {if (document.hidden) pause(true);});
    visual = window.createLearningScene?.(config.kind, $('scene'), () => ({...prefs,paused}));
    syncPrefs(); pollPad();
  }
  function pollPad(t = 0) {
    // Edge activation prevents a held A button answering the following question.
    let pad; try {pad = Array.from(navigator.getGamepads?.() || []).find(p => p?.connected);} catch {}
    if (pad && t - lastPad > 70) {
      lastPad = t; const b = pad.buttons.map(v => v.pressed), edge = i => b[i] && !padPrevious[i];
      if (edge(9)) pause();
      const scope = paused ? $('pause-dialog') : document;
      const nodes = [...scope.querySelectorAll('button:not(:disabled),a[href],summary')].filter(n => n.getClientRects().length && !n.hidden);
      if (edge(12) || edge(14) || edge(13) || edge(15)) {
        const delta = edge(12) || edge(14) ? -1 : 1, index = nodes.indexOf(document.activeElement);
        nodes[(index + delta + nodes.length) % nodes.length]?.focus();
      }
      if (edge(0) && nodes.includes(document.activeElement)) document.activeElement.click();
      padPrevious = b;
    } else if (!pad) padPrevious = [];
    requestAnimationFrame(pollPad);
  }
  function stats(values) { values.forEach(([label, value], i) => {$(`stat-label-${i}`).textContent = label; $(`stat-${i}`).textContent = value;}); }
  function mission(title, brief, total, done, current) {
    $('mission-title').textContent = title; $('brief').textContent = brief;
    $('progress').innerHTML = Array.from({length:total}, (_,i)=>`<i class="${done.includes(i)?'done':i===current?'current':''}"></i>`).join('');
    $('progress').setAttribute('aria-label', `${done.length} of ${total} completed`);
  }
  function feedback(title, detail, good = null) {
    const index = {router:0,query:1,shell:2}[game.kind], enemies=['Snare Cantor','Seal Warden','Choir Regent'];
    const hostile = good === false, name = hostile ? enemies[index] : game.lead;
    $('cast-portrait').style.backgroundPosition = `${index*50}% ${hostile?100:0}%`;
    $('cast-portrait').setAttribute('aria-label', `${name}, ${hostile?'hostile The Unmade · Severed Choir opponent':'VORATH family ally'}, rainbow crystal, gold guilloche and obsidian regalia`);
    $('cast-portrait').dataset.allegiance = hostile ? 'hostile' : 'ally';
    $('cast-name').textContent = name; $('cast-allegiance').textContent = hostile ? 'THE UNMADE / HOSTILE' : 'VORATH FAMILY / ALLY';
    $('cast-allegiance').style.color = hostile ? 'var(--bad)' : 'var(--gold)';
    $('feedback').className = 'feedback' + (good === true ? ' good' : good === false ? ' bad' : '');
    $('feedback').innerHTML = `<strong>${esc(title)}</strong>${esc(detail)}`;
    if (good !== null) {tone(good); visual?.signal(good); $('scene-status').textContent = good ? 'SIGNAL ACCEPTED' : 'CHECK THE PATH';}
  }
  function advance(label, action) {
    $('advance').hidden = !action; $('advance').textContent = label;
    $('advance').onclick = () => {if (!paused) action?.();};
  }
  function table(cols, rows, caption = '') {
    return `<div class="table-scroll"><table>${caption?`<caption>${esc(caption)}</caption>`:''}<thead><tr>${cols.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  return {$,esc,read,write,mount,stats,mission,feedback,advance,table,tone,prefs,pause,get paused(){return paused;},get audioState(){return audio?.state || 'unstarted';},get storageOK(){return storageOK;},get renderState(){return visual?.state() || {mode:'2D',frames:0};}};
})();
