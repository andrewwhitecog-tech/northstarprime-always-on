(() => {
  'use strict';
  const nav = document.querySelector('.nsp-shell-v2');
  const dialog = document.querySelector('#nsp-command');
  if (!nav || !dialog) return;

  const path = location.pathname.replace(/\/$/, '') || '/';
  document.body.dataset.nspPath = path;

  const routeLinks = [...nav.querySelectorAll('a[href^="/"]')];
  const candidates = routeLinks
    .map(link => ({ link, route: new URL(link.href, location.origin).pathname.replace(/\/$/, '') || '/' }))
    .filter(item => item.route === '/' ? path === '/' : path === item.route || path.startsWith(`${item.route}/`))
    .sort((a, b) => b.route.length - a.route.length);
  if (candidates[0]) candidates[0].link.setAttribute('aria-current', 'page');

  const trigger = nav.querySelector('[data-nsp-command-open]');
  const close = dialog.querySelector('[data-nsp-command-close]');
  const input = dialog.querySelector('input');
  const items = [...dialog.querySelectorAll('.nsp-command-item')];
  const empty = dialog.querySelector('.nsp-command-empty');

  const open = () => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    input.value = '';
    filter('');
    requestAnimationFrame(() => input.focus());
  };
  const shut = () => dialog.close ? dialog.close() : dialog.removeAttribute('open');
  const filter = value => {
    const query = value.trim().toLowerCase();
    let visible = 0;
    items.forEach(item => {
      const match = !query || item.textContent.toLowerCase().includes(query) || (item.dataset.keywords || '').includes(query);
      item.hidden = !match;
      if (match) visible += 1;
    });
    empty.hidden = visible !== 0;
  };

  trigger?.addEventListener('click', open);
  close?.addEventListener('click', shut);
  input?.addEventListener('input', event => filter(event.target.value));
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) shut();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      dialog.open ? shut() : open();
    } else if (event.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      open();
    }
  });

  const more = nav.querySelector('.nsp-nav-more');
  document.addEventListener('click', event => {
    if (more?.open && !more.contains(event.target)) more.removeAttribute('open');
  });
})();
