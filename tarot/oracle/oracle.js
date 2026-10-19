(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const ui = Object.fromEntries(['drawBtn', 'revealAllBtn', 'resetBtn', 'deckError', 'retryDeckBtn', 'readingStatus', 'reading', 'cardSearch', 'suitFilter', 'clearFilters', 'deckCount', 'noCards', 'deckGrid', 'cardDialog', 'closeDetail', 'detailArt', 'detailText', 'allowReversed'].map(id => [id, byId(id)]));
  const suits = ['Major Arcana', 'Crystals', 'Chalices', 'Lasers', 'Glyphs'];
  const positions = ['What do you carry?', 'What do you notice?', 'What could you explore?'];
  let deck = [];
  let reading = [];
  let generation = 0;
  let loadSequence = 0;
  let detailSequence = 0;
  let dialogOrigin = null;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function validateDeck(value) {
    if (value?.schema !== 'vorath.tarot.guidebook.v1' || !Array.isArray(value.cards) || value.cards.length !== 78) throw new Error('incomplete_deck');
    const ids = new Set();
    for (const card of value.cards) {
      if (!card || !/^[a-z0-9_]+$/.test(card.id) || ids.has(card.id) || !suits.includes(card.suit)) throw new Error('invalid_card');
      if (['name', 'upright', 'inverted'].some(key => typeof card[key] !== 'string' || !card[key].trim())) throw new Error('missing_meaning');
      if (card.image !== '/tarot/oracle/cards/' + card.id + '.webp' || !Number.isInteger(card.width) || !Number.isInteger(card.height) || card.width < 1 || card.height < 1) throw new Error('invalid_art');
      ids.add(card.id);
    }
    if (value.cards.filter(card => card.suit === 'Major Arcana').length !== 22 || suits.slice(1).some(suit => value.cards.filter(card => card.suit === suit).length !== 14)) throw new Error('incomplete_suits');
    return value.cards;
  }

  function spreadSize() {
    return document.querySelector('input[name="spread"]:checked').value === '3' ? 3 : 1;
  }

  function updateDrawLabel() {
    ui.drawBtn.textContent = spreadSize() === 3 ? 'Draw three cards' : 'Draw one card';
  }

  async function loadDeck() {
    const sequence = ++loadSequence;
    ui.drawBtn.disabled = true;
    ui.retryDeckBtn.disabled = true;
    ui.deckError.hidden = true;
    ui.readingStatus.textContent = 'Loading the complete deck…';
    ui.deckCount.textContent = 'Loading cards…';
    ui.deckGrid.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('/tarot/oracle/deck.json', {signal: controller.signal, cache: 'no-cache'});
      if (!response.ok) throw new Error('deck_response');
      const cards = validateDeck(await response.json());
      if (sequence !== loadSequence) return;
      deck = cards;
      renderLibrary();
      ui.drawBtn.disabled = false;
      ui.readingStatus.textContent = '78 cards in the deck. Choose a spread and draw.';
    } catch (_error) {
      if (sequence !== loadSequence) return;
      deck = [];
      ui.deckGrid.replaceChildren();
      ui.deckError.hidden = false;
      ui.readingStatus.textContent = 'The complete deck is unavailable. Use Retry deck to try again.';
      ui.deckCount.textContent = 'Cards could not be loaded.';
    } finally {
      window.clearTimeout(timer);
      if (sequence === loadSequence) {
        ui.retryDeckBtn.disabled = false;
        ui.deckGrid.removeAttribute('aria-busy');
      }
    }
  }

  // Rejection sampling avoids modulo bias; cards are removed from the pool after each choice.
  function randomInt(limit) {
    if (!window.crypto?.getRandomValues) throw new Error('random_unavailable');
    const boundary = 4294967296 - (4294967296 % limit);
    const value = new Uint32Array(1);
    do window.crypto.getRandomValues(value); while (value[0] >= boundary);
    return value[0] % limit;
  }

  function makeImage(card) {
    const image = element('img', 'card-art');
    image.alt = card.name + ' — full VORATH card artwork';
    image.width = card.width;
    image.height = card.height;
    return image;
  }

  function loadImage(card, retry = false) {
    const image = makeImage(card);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (error) {
          image.removeAttribute('src');
          reject(error);
        } else {
          resolve(image);
        }
      };
      const timer = window.setTimeout(() => finish(new Error('image_timeout')), 8000);
      image.onerror = () => finish(new Error('image_unavailable'));
      image.onload = async () => {
        try {
          if (image.decode) await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('image_not_decoded');
          finish();
        } catch (error) {
          finish(error);
        }
      };
      image.src = card.image + (retry ? '?retry=' + Date.now() : '');
    });
  }

  function addMeaning(container, title, text) {
    container.append(element('h4', '', title), element('p', 'meaning', text));
  }

  function detailsFor(card, reversed) {
    const content = element('div', 'reading-details');
    const title = element('h3', '', card.name);
    title.tabIndex = -1;
    content.append(title, element('p', 'orientation', reversed ? 'Reversed · Fracture' : 'Upright · Refraction'));
    if (card.subtitle) content.append(element('p', 'card-subtitle', card.subtitle));
    addMeaning(content, reversed ? 'Fracture' : 'Refraction', reversed ? card.inverted : card.upright);
    if (card.thread) content.append(element('p', 'thread', 'Thread · ' + card.thread));
    const more = element('details');
    more.append(element('summary', '', 'Read the other meaning'));
    addMeaning(more, reversed ? 'Refraction · upright' : 'Fracture · reversed', reversed ? card.upright : card.inverted);
    if (card.scripture) more.append(element('blockquote', '', card.scripture));
    content.append(more);
    return content;
  }

  function updateReadingStatus() {
    const revealed = reading.filter(entry => entry.revealed).length;
    const total = reading.length;
    ui.readingStatus.textContent = revealed === total
      ? (total === 1 ? 'Your card is revealed. Take a moment with its meaning.' : 'All three cards are revealed. Explore the connections in your own way.')
      : revealed + ' of ' + total + ' cards revealed. Choose a card to turn it over.';
    ui.revealAllBtn.hidden = total < 2 || revealed === total;
  }

  async function reveal(entry, focusTitle = true) {
    if (entry.revealed || entry.loading) return;
    entry.loading = true;
    entry.button.disabled = true;
    entry.button.setAttribute('aria-busy', 'true');
    entry.caption.textContent = 'Loading card artwork…';
    entry.error.hidden = true;
    try {
      const image = await loadImage(entry.card, entry.attempts > 0);
      if (entry.generation !== generation) return;
      entry.frame.replaceChildren(image);
      entry.revealed = true;
      entry.button.setAttribute('aria-label', entry.card.name + ', revealed');
      entry.caption.hidden = true;
      const content = detailsFor(entry.card, entry.reversed);
      entry.article.append(content);
      if (focusTitle) content.querySelector('h3').focus({preventScroll: true});
      updateReadingStatus();
    } catch (_error) {
      if (entry.generation !== generation) return;
      entry.error.hidden = false;
      entry.button.disabled = false;
      entry.caption.textContent = 'Retry this card image';
      entry.button.setAttribute('aria-label', 'Retry artwork for card ' + (entry.index + 1));
      ui.readingStatus.textContent = 'A card image could not load. Retry that card; your selection is preserved.';
    } finally {
      entry.attempts++;
      entry.loading = false;
      entry.button.removeAttribute('aria-busy');
    }
  }

  function draw() {
    if (deck.length !== 78) return;
    const pool = deck.slice();
    const chosen = [];
    try {
      for (let index = 0; index < spreadSize(); index++) {
        chosen.push({card: pool.splice(randomInt(pool.length), 1)[0], reversed: ui.allowReversed.checked && randomInt(2) === 1});
      }
    } catch (_error) {
      ui.readingStatus.textContent = 'This browser cannot choose cards securely. Try a current browser.';
      return;
    }
    generation++;
    ui.reading.replaceChildren();
    ui.reading.classList.toggle('one', chosen.length === 1);
    reading = chosen.map((choice, index) => {
      const article = element('article', 'reading-card');
      article.dataset.cardId = choice.card.id;
      article.dataset.reversed = String(choice.reversed);
      article.append(element('h3', 'position', chosen.length === 1 ? 'A single perspective' : positions[index]));
      const button = element('button', 'reveal-card');
      button.type = 'button';
      button.setAttribute('aria-label', 'Reveal card ' + (index + 1));
      const frame = element('span', 'art-frame');
      const back = element('span', 'card-back');
      back.setAttribute('aria-hidden', 'true');
      const caption = element('span', 'reveal-caption', 'Reveal card ' + (index + 1));
      frame.append(back);
      button.append(frame, caption);
      const error = element('p', 'reading-error', 'The artwork could not load. Retry the same card using the button above.');
      error.hidden = true;
      article.append(button, error);
      ui.reading.append(article);
      const entry = {...choice, article, button, frame, caption, error, index, generation, attempts: 0, loading: false, revealed: false};
      button.addEventListener('click', () => reveal(entry));
      return entry;
    });
    ui.resetBtn.disabled = false;
    updateReadingStatus();
    ui.reading.scrollIntoView({block: 'start', behavior: 'auto'});
  }

  function reset() {
    generation++;
    reading = [];
    ui.reading.replaceChildren();
    ui.reading.classList.remove('one');
    document.querySelector('input[name="spread"][value="1"]').checked = true;
    ui.allowReversed.checked = false;
    ui.revealAllBtn.hidden = true;
    ui.resetBtn.disabled = true;
    updateDrawLabel();
    ui.readingStatus.textContent = deck.length === 78 ? 'Reading reset. Choose a spread and draw again.' : 'The complete deck is unavailable. Use Retry deck to try again.';
  }

  function libraryEntry(card) {
    const article = element('article', 'deck-entry');
    article.dataset.cardId = card.id;
    const open = element('button', 'gallery-open');
    open.type = 'button';
    open.setAttribute('aria-label', 'Read ' + card.name);
    const frame = element('span', 'gallery-image-frame');
    const image = makeImage(card);
    image.className = 'gallery-image';
    image.loading = 'lazy';
    const failure = element('div', 'thumbnail-error');
    failure.hidden = true;
    failure.append(element('p', '', 'Artwork unavailable. You can still open the card’s meanings.'));
    const retry = element('button', 'button', 'Retry artwork');
    retry.type = 'button';
    failure.append(retry);
    image.addEventListener('error', () => { failure.hidden = false; image.hidden = true; });
    image.addEventListener('load', () => { failure.hidden = true; image.hidden = false; });
    image.src = card.image;
    retry.addEventListener('click', () => { failure.hidden = true; image.hidden = false; image.src = card.image + '?retry=' + Date.now(); });
    frame.append(image);
    open.append(frame, element('span', 'gallery-title', card.name), element('span', 'gallery-suit', card.suit));
    open.addEventListener('click', () => openDetail(card, open));
    article.append(open, failure);
    return article;
  }

  function renderLibrary() {
    const query = ui.cardSearch.value.trim().toLocaleLowerCase();
    const suit = ui.suitFilter.value;
    const cards = deck.filter(card => (!suit || card.suit === suit) && [card.name, card.subtitle, card.suit, card.upright, card.inverted].join(' ').toLocaleLowerCase().includes(query));
    ui.deckGrid.replaceChildren(...cards.map(libraryEntry));
    ui.deckCount.textContent = cards.length + ' of 78 cards' + (suit ? ' · ' + suit : '');
    ui.noCards.hidden = cards.length !== 0 || deck.length === 0;
  }

  async function detailImage(card, sequence, retry = false) {
    ui.detailArt.replaceChildren(element('p', 'status', 'Loading full card artwork…'));
    try {
      const image = await loadImage(card, retry);
      if (sequence !== detailSequence || !ui.cardDialog.open) return;
      ui.detailArt.replaceChildren(image);
    } catch (_error) {
      if (sequence !== detailSequence || !ui.cardDialog.open) return;
      const error = element('div', 'detail-retry');
      error.append(element('p', '', 'The full artwork could not load. The guidebook meanings remain available.'));
      const button = element('button', 'button', 'Retry full artwork');
      button.addEventListener('click', () => detailImage(card, sequence, true));
      error.append(button);
      ui.detailArt.replaceChildren(error);
    }
  }

  function openDetail(card, origin) {
    const sequence = ++detailSequence;
    dialogOrigin = origin;
    const title = element('h2', '', card.name);
    title.id = 'detailTitle';
    ui.detailText.replaceChildren(element('p', 'eyebrow', card.suit), title);
    if (card.subtitle) ui.detailText.append(element('p', 'card-subtitle', card.subtitle));
    if (card.thread) ui.detailText.append(element('p', 'thread', 'Thread · ' + card.thread));
    addMeaning(ui.detailText, 'Refraction · upright', card.upright);
    addMeaning(ui.detailText, 'Fracture · reversed', card.inverted);
    if (card.scripture) ui.detailText.append(element('blockquote', '', card.scripture));
    ui.cardDialog.showModal();
    ui.closeDetail.focus({preventScroll: true});
    detailImage(card, sequence);
  }

  ui.closeDetail.addEventListener('click', () => ui.cardDialog.close());
  ui.cardDialog.addEventListener('close', () => {
    detailSequence++;
    (dialogOrigin?.isConnected ? dialogOrigin : ui.cardSearch).focus({preventScroll: true});
  });
  ui.drawBtn.addEventListener('click', draw);
  ui.resetBtn.addEventListener('click', reset);
  ui.revealAllBtn.addEventListener('click', async () => {
    ui.revealAllBtn.disabled = true;
    await Promise.all(reading.map(entry => reveal(entry, false)));
    ui.revealAllBtn.disabled = false;
  });
  document.querySelectorAll('input[name="spread"]').forEach(input => input.addEventListener('change', updateDrawLabel));
  ui.retryDeckBtn.addEventListener('click', loadDeck);
  ui.cardSearch.addEventListener('input', () => { if (deck.length) renderLibrary(); });
  ui.suitFilter.addEventListener('change', () => { if (deck.length) renderLibrary(); });
  ui.clearFilters.addEventListener('click', () => {
    ui.cardSearch.value = '';
    ui.suitFilter.value = '';
    if (deck.length) renderLibrary();
    ui.cardSearch.focus();
  });
  loadDeck();
})();
