(() => {
  'use strict';

  const STORAGE_KEY = 'nsp-v49-watch-listening-scores-v1';
  const state = {
    manifest: null,
    scores: {},
    selectedId: null,
    filter: 'all',
    search: ''
  };

  const $ = (id) => document.getElementById(id);

  function loadLocalScores() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.scores = saved.scores && typeof saved.scores === 'object' ? saved.scores : {};
      state.selectedId = saved.selectedId || null;
    } catch {
      state.scores = {};
    }
  }

  function saveLocalScores() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      schema: 'nsp.idc.v49_private_listener_scores.v1',
      savedAt: new Date().toISOString(),
      sourcePackageSha256: state.manifest.source.package_sha256,
      selectedId: state.selectedId,
      scores: state.scores
    }));
  }

  function scoreFor(id) {
    if (!state.scores[id]) {
      state.scores[id] = {
        clarity: null,
        character: null,
        landing: null,
        query: null,
        disposition: '',
        needsTableRead: false,
        needsRewrite: false,
        notes: '',
        updatedAt: null
      };
    }
    return state.scores[id];
  }

  function isComplete(track) {
    const score = state.scores[track.id];
    if (!score || !score.clarity || !score.character || !score.landing || !score.disposition) return false;
    if (track.query_ids.length && !score.query) return false;
    return true;
  }

  function filteredTracks() {
    const needle = state.search.trim().toLowerCase();
    return state.manifest.tracks.filter((track) => {
      const searchable = `${track.title} ${track.section} ${track.series} ${track.focus}`.toLowerCase();
      if (needle && !searchable.includes(needle)) return false;
      if (state.filter === 'unscored' && isComplete(track)) return false;
      if (state.filter === 'ab' && !track.pair_id) return false;
      if (state.filter === 'query' && !track.query_ids.length) return false;
      return true;
    });
  }

  function formatDuration(seconds) {
    const whole = Math.round(seconds);
    const minutes = Math.floor(whole / 60);
    return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
  }

  function shortTitle(track) {
    return track.title.replace(/^.*?—\s*/, '').replace(/[“”]/g, '');
  }

  function renderProgress() {
    const complete = state.manifest.tracks.filter(isComplete).length;
    $('progress-text').textContent = `${complete} / ${state.manifest.tracks.length}`;
    $('progress-fill').style.width = `${(complete / state.manifest.tracks.length) * 100}%`;
  }

  function renderTrackList() {
    const list = $('track-list');
    list.replaceChildren();
    const tracks = filteredTracks();
    tracks.forEach((track) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.trackId = track.id;
      button.classList.toggle('active', track.id === state.selectedId);
      button.classList.toggle('completed', isComplete(track));

      const order = document.createElement('span');
      order.className = 'queue-order';
      order.textContent = `Track ${String(track.order).padStart(2, '0')} · Rank ${track.rank}`;
      const title = document.createElement('span');
      title.className = 'queue-title';
      title.textContent = shortTitle(track);
      const meta = document.createElement('span');
      meta.className = 'queue-meta';
      meta.textContent = `${track.variant_label} · ${formatDuration(track.duration_seconds)}`;
      button.append(order, title, meta);
      button.addEventListener('click', () => selectTrack(track.id));
      item.append(button);
      list.append(item);
    });

    if (!tracks.length) {
      const empty = document.createElement('li');
      empty.className = 'queue-meta';
      empty.textContent = 'No tracks match this filter.';
      list.append(empty);
    }
    renderProgress();
  }

  function renderRatings(track, score) {
    const grid = $('rating-grid');
    grid.replaceChildren();
    state.manifest.rating_dimensions.forEach((dimension) => {
      const row = document.createElement('div');
      row.className = 'rating-row';
      const disabled = dimension.key === 'query' && !track.query_ids.length;
      row.classList.toggle('muted', disabled);

      const label = document.createElement('span');
      label.className = 'rating-label';
      label.textContent = disabled ? `${dimension.label} · not applicable` : dimension.label;
      row.append(label);

      for (let value = 1; value <= 5; value += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'rating-button';
        button.textContent = String(value);
        button.disabled = disabled;
        button.setAttribute('aria-label', `${dimension.label} ${value} of 5`);
        button.classList.toggle('selected', score[dimension.key] === value);
        button.addEventListener('click', () => {
          score[dimension.key] = value;
          commitScore(track, score);
        });
        row.append(button);
      }
      grid.append(row);
    });
  }

  function renderQueryCards(track) {
    const panel = $('query-panel');
    panel.hidden = !track.query_cards.length;
    $('query-ids').textContent = track.query_ids.join(' · ');
    const cards = $('query-cards');
    cards.replaceChildren();
    track.query_cards.forEach((card) => {
      const article = document.createElement('article');
      article.className = 'query-entry';
      const heading = document.createElement('h4');
      heading.textContent = card.id;
      const pre = document.createElement('pre');
      pre.textContent = card.text;
      article.append(heading, pre);
      cards.append(article);
    });
  }

  function renderSelectedTrack() {
    const track = state.manifest.tracks.find((item) => item.id === state.selectedId) || state.manifest.tracks[0];
    state.selectedId = track.id;
    const score = scoreFor(track.id);

    $('track-order').textContent = `Track ${String(track.order).padStart(2, '0')} · Watch rank ${track.rank} · ${formatDuration(track.duration_seconds)}`;
    $('track-variant').textContent = track.variant_label;
    $('track-title').textContent = track.title;
    $('track-section').textContent = track.section;
    $('track-focus').textContent = track.focus;
    $('audio-player').src = track.audio;
    $('transcript').textContent = track.transcript;

    const boundary = $('medical-boundary');
    boundary.hidden = !track.medical_boundary;
    boundary.textContent = track.medical_boundary ? state.manifest.medical_boundary : '';

    const paired = track.pair_id ? state.manifest.tracks.find((item) => item.pair_id === track.pair_id && item.id !== track.id) : null;
    $('pair-track').hidden = !paired;
    $('pair-track').textContent = paired ? `Compare ${paired.variant_label.toLowerCase()}` : '';
    $('pair-track').onclick = paired ? () => selectTrack(paired.id) : null;

    $('previous-track').disabled = track.order === 1;
    $('next-track').disabled = track.order === state.manifest.tracks.length;

    renderRatings(track, score);
    $('disposition').value = score.disposition;
    $('needs-table-read').checked = score.needsTableRead;
    $('needs-rewrite').checked = score.needsRewrite;
    $('listener-notes').value = score.notes;
    renderQueryCards(track);
    renderSaveState(track, score);
    renderTrackList();
  }

  function renderSaveState(track, score) {
    const label = $('save-state');
    const complete = isComplete(track);
    label.classList.toggle('complete', complete);
    if (complete) label.textContent = 'Scored locally';
    else if (score.updatedAt) label.textContent = 'Draft saved locally';
    else label.textContent = 'Not scored';
  }

  function commitScore(track, score) {
    score.updatedAt = new Date().toISOString();
    saveLocalScores();
    renderSelectedTrack();
  }

  function selectTrack(id) {
    const player = $('audio-player');
    player.pause();
    state.selectedId = id;
    saveLocalScores();
    renderSelectedTrack();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function moveTrack(delta) {
    const current = state.manifest.tracks.findIndex((track) => track.id === state.selectedId);
    const target = Math.max(0, Math.min(state.manifest.tracks.length - 1, current + delta));
    if (target !== current) selectTrack(state.manifest.tracks[target].id);
  }

  function download(name, type, content) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportPayload() {
    return {
      schema: 'nsp.idc.v49_private_listener_scores.v1',
      exportedAt: new Date().toISOString(),
      state: state.manifest.state,
      sourcePackageSha256: state.manifest.source.package_sha256,
      scores: state.scores
    };
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const headers = ['order','rank','version','script','section','clarity','character_distinction','comic_or_tension_landing','query_card_comprehension','disposition','needs_table_read','needs_rewrite_review','listener_notes','updated_at'];
    const rows = state.manifest.tracks.map((track) => {
      const score = state.scores[track.id] || {};
      return [track.order, track.rank, track.version, track.script, track.section, score.clarity, score.character, score.landing, score.query, score.disposition, score.needsTableRead, score.needsRewrite, score.notes, score.updatedAt].map(csvCell).join(',');
    });
    download('V49_PRIVATE_LISTENER_SCORES.csv', 'text/csv;charset=utf-8', `${headers.map(csvCell).join(',')}\n${rows.join('\n')}\n`);
    $('export-status').textContent = 'CSV export created locally.';
  }

  function exportJson() {
    download('V49_PRIVATE_LISTENER_SCORES.json', 'application/json', JSON.stringify(exportPayload(), null, 2));
    $('export-status').textContent = 'JSON export created locally.';
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(String(reader.result));
        if (payload.schema !== 'nsp.idc.v49_private_listener_scores.v1' || payload.sourcePackageSha256 !== state.manifest.source.package_sha256 || !payload.scores) {
          throw new Error('The file does not match this V49 score schema and source package.');
        }
        state.scores = payload.scores;
        saveLocalScores();
        renderSelectedTrack();
        $('export-status').textContent = 'Private scores restored from JSON.';
      } catch (error) {
        $('export-status').textContent = `Import rejected: ${error.message}`;
      }
    };
    reader.readAsText(file);
  }

  function bindControls() {
    $('search').addEventListener('input', (event) => {
      state.search = event.target.value;
      renderTrackList();
    });
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        state.filter = button.dataset.filter;
        document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('active', item === button));
        renderTrackList();
      });
    });
    $('previous-track').addEventListener('click', () => moveTrack(-1));
    $('next-track').addEventListener('click', () => moveTrack(1));
    $('disposition').addEventListener('change', (event) => {
      const track = state.manifest.tracks.find((item) => item.id === state.selectedId);
      const score = scoreFor(track.id);
      score.disposition = event.target.value;
      commitScore(track, score);
    });
    $('needs-table-read').addEventListener('change', (event) => {
      const track = state.manifest.tracks.find((item) => item.id === state.selectedId);
      const score = scoreFor(track.id);
      score.needsTableRead = event.target.checked;
      commitScore(track, score);
    });
    $('needs-rewrite').addEventListener('change', (event) => {
      const track = state.manifest.tracks.find((item) => item.id === state.selectedId);
      const score = scoreFor(track.id);
      score.needsRewrite = event.target.checked;
      commitScore(track, score);
    });
    $('listener-notes').addEventListener('input', (event) => {
      const track = state.manifest.tracks.find((item) => item.id === state.selectedId);
      const score = scoreFor(track.id);
      score.notes = event.target.value;
      score.updatedAt = new Date().toISOString();
      saveLocalScores();
      renderSaveState(track, score);
    });
    $('clear-track').addEventListener('click', () => {
      delete state.scores[state.selectedId];
      saveLocalScores();
      renderSelectedTrack();
      $('export-status').textContent = 'Current track score cleared locally.';
    });
    $('export-csv').addEventListener('click', exportCsv);
    $('export-json').addEventListener('click', exportJson);
    $('import-json').addEventListener('change', (event) => {
      if (event.target.files[0]) importJson(event.target.files[0]);
      event.target.value = '';
    });
    document.addEventListener('keydown', (event) => {
      const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      if (editing) return;
      if (event.key === 'ArrowLeft') moveTrack(-1);
      if (event.key === 'ArrowRight') moveTrack(1);
      if (event.code === 'Space') {
        event.preventDefault();
        const player = $('audio-player');
        if (player.paused) player.play().catch(() => {}); else player.pause();
      }
    });
  }

  async function boot() {
    try {
      const response = await fetch('data/listening_manifest.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
      state.manifest = await response.json();
      loadLocalScores();
      if (!state.manifest.tracks.some((track) => track.id === state.selectedId)) state.selectedId = state.manifest.tracks[0].id;
      bindControls();
      renderSelectedTrack();
    } catch (error) {
      $('track-title').textContent = 'Console failed to load';
      $('track-focus').textContent = error.message;
    }
  }

  boot();
})();
