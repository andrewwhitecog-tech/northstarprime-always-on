(function () {
  if (document.querySelector('.story-spine')) return;
  var hero = document.querySelector('.terrarium-hero');
  var deck = document.querySelector('.chamber-deck');
  if (!hero || !deck) return;
  var spine = document.createElement('ol');
  spine.className = 'story-spine';
  spine.setAttribute('aria-label', 'Theseus containment arc');
  spine.innerHTML = [
    '<li><strong>Observe.</strong> Watts-7 lights the Theseus glass — watch the colony breathe before you touch a dial.</li>',
    '<li><strong>Contain.</strong> Scrambler fields lock the lattice; 3D xenobiology gives pressure a face.</li>',
    '<li><strong>Dive the trench.</strong> Channer Sonar paints the black with echoes — life answers in clicks and blooms.</li>',
    '<li><strong>Blindsight.</strong> Protocol strips the comfort of sight; the colony still moves.</li>',
    '<li><strong>Reef shallows.</strong> Vorathic Reef Tank opens the warm end of the family — luminous, intimate, and still not tame.</li>'
  ].join('');
  hero.insertAdjacentElement('afterend', spine);

  if (!deck.querySelector('a[href*="vorathic-reef-tank"]')) {
    var reef = document.createElement('a');
    reef.href = '/arcade/custom/vorathic-reef-tank/';
    reef.className = 'chamber-pill';
    reef.innerHTML = 'Chamber V: Vorathic Reef Tank &rarr;';
    var neon = deck.querySelector('a[href*="neon-district"]');
    if (neon) deck.insertBefore(reef, neon);
    else deck.appendChild(reef);
  }
  if (!document.querySelector('.chamber-return-note')) {
    var note = document.createElement('p');
    note.className = 'chamber-return-note';
    note.innerHTML = '<strong>Chamber return:</strong> Arcade cabinets open in their own bay — use Terrarium in the site header or return here via <a href="/digital-terrarium/">/digital-terrarium/</a> to switch chambers.';
    deck.insertAdjacentElement('afterend', note);
  }
  if (!document.querySelector('.chamber-legend')) {
    var legend = document.createElement('div');
    legend.className = 'chamber-legend';
    legend.setAttribute('aria-label', 'Chamber legend');
    legend.innerHTML = '<span class="primary">I v6 Deep-Field Lab · II v7 3D Containment · V Vorathic Reef — primary family</span><span class="archive">III Channer Trench · IV Blindsight — archive / protocol</span>';
    var after = document.querySelector('.chamber-return-note') || deck;
    after.insertAdjacentElement('afterend', legend);
  }
})();
