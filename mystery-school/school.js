/* Field notes live only in this page; nothing is stored or sent. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fields = ['observation', 'interpretation', 'next-attention'];
  const steps = ['Observe', 'Imagine', 'Return'];
  let currentStep = 0;

  function showStep(index) {
    currentStep = index;
    $('practice-welcome').hidden = true;
    $('practice-complete').hidden = true;
    $('practice-active').hidden = false;
    steps.forEach((_, step) => { $(`practice-step-${step}`).hidden = step !== index; });
    $('step-count').textContent = `${index + 1} of 3`;
    $('step-name').textContent = steps[index];
    $('practice-back').hidden = index === 0;
    $('practice-next').textContent = ['Next: imagine →', 'Next: return →', 'Finish this experience →'][index];
    $('practice-status').textContent = '';
    if (index === 2) {
      $('observation-review').textContent = $('observation').value.trim() || 'Held in mind. No written note needed.';
      $('interpretation-review').textContent = $('interpretation').value.trim() || 'Held in mind. No written note needed.';
    }
    $(`step-title-${index}`).focus();
  }

  function finish() {
    $('practice-active').hidden = true;
    $('practice-complete').hidden = false;
    $('attention-review').textContent = $('next-attention').value.trim() || 'Choose one familiar thing to meet with fresh attention today.';
    $('practice-status').textContent = '';
    $('complete-title').focus();
  }

  $('practice-start').hidden = false;
  $('practice-start').addEventListener('click', () => showStep(0));
  $('practice-next').addEventListener('click', () => currentStep < 2 ? showStep(currentStep + 1) : finish());
  $('practice-back').addEventListener('click', () => { if (currentStep > 0) showStep(currentStep - 1); });
  $('practice-review').addEventListener('click', () => showStep(2));
  $('practice-restart').addEventListener('click', () => {
    fields.forEach(id => { $(id).value = ''; });
    ['observation-review', 'interpretation-review', 'attention-review'].forEach(id => { $(id).textContent = ''; });
    showStep(0);
  });
  $('practice-download').addEventListener('click', () => {
    const note = [
      'MYSTERY SCHOOL — LOOK AGAIN', 'A personal field note', '',
      'OBSERVE — What I noticed', $('observation').value.trim() || '(Held in mind)', '',
      'IMAGINE — The story I gave it', $('interpretation').value.trim() || '(Held in mind)', '',
      'RETURN — What I will notice next', $('next-attention').value.trim() || '(An open question)', '',
      'An exercise in attention and imagination. Personal interpretations are not scientific evidence.',
      'https://northstarprime.net/mystery-school/', ''
    ].join('\n');
    let objectUrl;
    let link;
    try {
      objectUrl = URL.createObjectURL(new Blob([note], { type: 'text/plain;charset=utf-8' }));
      link = document.createElement('a');
      link.href = objectUrl;
      link.download = 'mystery-school-look-again.txt';
      document.body.appendChild(link);
      link.click();
      $('practice-status').textContent = 'Your field-note download is ready. Check your browser’s downloads.';
    } catch {
      $('practice-status').textContent = 'The download could not start. Your notes are still here; you can go back and copy them.';
    } finally {
      if (link) link.remove();
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  });
})();
