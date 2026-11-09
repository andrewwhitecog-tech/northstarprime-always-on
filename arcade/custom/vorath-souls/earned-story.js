(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./journey.js'));
  else root.VorathEarnedStory = factory(root.VorathJourney);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (progress) {
  'use strict';
  const signal = Object.freeze({
    href: 'https://northstarprime.net/404.html',
    label: 'Signal Lost',
    disclosure: 'Optional VORATH fiction · free to explore · no purchase needed.'
  });
  // The existing bank advances only when a passage is carved. No separate unlock
  // flag, score threshold, storage key, navigation, or mutation of journey state.
  function available(journey) {
    if (!progress || progress.VERSION !== 1 || typeof progress.validate !== 'function') return null;
    const bank = progress.validate(journey && journey.bank);
    return bank && bank.cleared >= 1 ? signal : null;
  }
  return Object.freeze({ signal: available });
});
