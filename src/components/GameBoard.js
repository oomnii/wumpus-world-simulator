export function renderGameBoard(container, vm) {
  const { state, hidden, percepts } = vm;
  const size = state.size;
  container.style.setProperty('--grid-size', size);
  container.innerHTML = '';

  const pitSet = new Set(hidden?.pits?.map((p) => `${p.x},${p.y}`) ?? []);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cell = document.createElement('div');
      cell.className = 'board-cell';
      const key = `${x},${y}`;
      const revealed = state.revealedKeys.has(key) || state.debugReveal;
      const isAgent = state.agent.x === x && state.agent.y === y;
      const visited = state.visitedKeys.has(key);

      if (visited) cell.classList.add('visited');
      if (isAgent) cell.classList.add('agent-here');

      let content = '?';

      if (state.debugReveal && hidden) {
        let icons = '';
        if (hidden.wumpus.x === x && hidden.wumpus.y === y && state.wumpusAlive) {
          icons += '<span class="icon wumpus" title="Wumpus">👹</span>';
        }
        if (pitSet.has(key)) icons += '<span class="icon pit" title="Pit">🕳️</span>';
        if (hidden.gold.x === x && hidden.gold.y === y && !state.goldCollected) {
          icons += '<span class="icon gold" title="Gold">🪙</span>';
        }
        if (isAgent) icons = `<span class="icon agent">🤖</span>${icons}`;
        content = icons || '·';
      } else if (!revealed && !isAgent) {
        content = '?';
      } else {
        let icons = '';
        if (isAgent) icons += '<span class="icon agent">🤖</span>';
        if (isAgent && percepts.glitter && !state.goldCollected) {
          icons += '<span class="icon gold">🪙</span>';
        }
        content = icons || '·';
      }

      cell.innerHTML = `<div class="cell-inner">${content}</div>`;
      container.appendChild(cell);
    }
  }

  const footer = container.parentElement.querySelector('.board-meta');
  if (footer) {
    footer.textContent = state.debugReveal
      ? 'DEBUG — full world revealed (AI does not receive this)'
      : `Agent at (${state.agent.x}, ${state.agent.y}) · ${percepts.breeze ? 'Breeze' : 'No Breeze'} · ${percepts.stench ? 'Stench' : 'No Stench'}`;
  }
}
