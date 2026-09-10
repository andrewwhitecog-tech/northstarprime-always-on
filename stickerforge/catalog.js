/* One catalog, three views. All artwork remains available without JavaScript. */
(() => {
  'use strict';
  const cards = [...document.querySelectorAll('.card')];
  const search = document.querySelector('#search');
  const collection = document.querySelector('#collection');
  const count = document.querySelector('#results');
  const more = document.querySelector('#more');
  const empty = document.querySelector('#empty');
  const dialog = document.querySelector('#detail');
  const views = [...document.querySelectorAll('[data-view-choice]')];
  let limit = 36, matches = cards, active = -1, opener;
  const params = new URLSearchParams(location.search);
  search.value = params.get('q') || '';
  if ([...collection.options].some(o => o.value === params.get('collection'))) collection.value = params.get('collection');
  function syncUrl() {
    const url = new URL(location.href);
    for (const [key, value] of [['q', search.value.trim()], ['collection', collection.value], ['view', document.body.dataset.view === 'shop' ? '' : document.body.dataset.view]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }
  function apply() {
    const words = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    matches = cards.filter(card => (!collection.value || card.dataset.collection === collection.value) && words.every(word => card.dataset.search.includes(word)));
    const visible = new Set(matches.slice(0, limit));
    cards.forEach(card => card.hidden = !visible.has(card));
    count.textContent = `${Math.min(limit, matches.length)} of ${matches.length} stickers${matches.length !== cards.length ? ` · ${cards.length} in the full catalog` : ''}`;
    more.hidden = matches.length <= limit;
    more.textContent = `Show ${Math.min(36, matches.length - limit)} more stickers`;
    empty.hidden = matches.length !== 0;
    document.querySelector('#clear').hidden = !search.value && !collection.value;
    syncUrl();
  }
  function setView(view) {
    document.body.dataset.view = ['shop', 'compact', 'gallery'].includes(view) ? view : 'shop';
    views.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.viewChoice === document.body.dataset.view)));
    syncUrl();
  }
  views.forEach(button => button.addEventListener('click', () => setView(button.dataset.viewChoice)));
  search.addEventListener('input', () => { limit = 36; apply(); });
  collection.addEventListener('change', () => { limit = 36; apply(); });
  more.addEventListener('click', () => { const nextCard = matches[limit]; limit += 36; apply(); nextCard?.querySelector('.preview').focus({preventScroll:true}); });
  function clear() { search.value = ''; collection.value = ''; limit = 36; apply(); search.focus(); }
  document.querySelector('#clear').addEventListener('click', clear);
  document.querySelector('#empty-clear').addEventListener('click', clear);
  function show(card) {
    active = matches.indexOf(card);
    const img = dialog.querySelector('img');
    img.src = card.dataset.original; img.alt = card.querySelector('h2').textContent;
    dialog.querySelector('#detail-name').textContent = img.alt;
    dialog.querySelector('#detail-collection').textContent = card.querySelector('.collection').textContent;
    dialog.querySelector('#detail-description').textContent = card.dataset.description;
    dialog.querySelector('#detail-full').href = card.dataset.original;
    dialog.querySelector('#detail-order').href = card.querySelector('.order-link').href;
    dialog.querySelector('#detail-position').textContent = `${active + 1} of ${matches.length}`;
    dialog.querySelector('#detail-prev').disabled = active <= 0;
    dialog.querySelector('#detail-next').disabled = active >= matches.length - 1;
    if (!dialog.open) dialog.showModal();
  }
  cards.forEach(card => card.querySelector('.preview').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !dialog.showModal) return;
    event.preventDefault(); opener = event.currentTarget; show(card);
  }));
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.querySelector('img').removeAttribute('src'); opener?.focus({preventScroll:true}); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  const move = delta => { if (matches[active + delta]) show(matches[active + delta]); };
  dialog.querySelector('#detail-prev').addEventListener('click', () => move(-1));
  dialog.querySelector('#detail-next').addEventListener('click', () => move(1));
  dialog.addEventListener('keydown', event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); } });
  setView(params.get('view')); apply();
})();
