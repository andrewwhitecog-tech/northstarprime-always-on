const searchInput = document.getElementById('game-search');
    const pills = document.querySelectorAll('.pill');
    const cards = document.querySelectorAll('.game-card');
    const noGamesEl = document.getElementById('no-games-found');
    const resetBtn = document.getElementById('reset-arcade-btn');
    const countEl = document.getElementById('visible-count');

    let currentFilter = 'all';

    function filterCards() {
      const query = (searchInput.value || '').toLowerCase().trim();
      let visible = 0;

      cards.forEach(card => {
        const category = card.getAttribute('data-category');
        const text = card.textContent.toLowerCase();

        const matchesFilter = currentFilter === 'all' || category === currentFilter;
        const matchesQuery = !query || text.includes(query);

        if (matchesFilter && matchesQuery) {
          card.style.display = 'flex';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });

      if (countEl) countEl.textContent = visible;
      if (noGamesEl) noGamesEl.style.display = visible === 0 ? 'block' : 'none';
    }

    searchInput.addEventListener('input', filterCards);

    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter');
        filterCards();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentFilter = 'all';
        pills.forEach(p => p.classList.remove('active'));
        pills[0].classList.add('active');
        filterCards();
      });
    }
  
