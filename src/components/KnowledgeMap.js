export function renderKnowledgeMap(container, vm) {
  const { knowledge, state } = vm;
  const size = state.size;
  container.style.setProperty('--grid-size', size);
  container.innerHTML = '';

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const key = `${x},${y}`;
      const cell = knowledge.cells[key] || {};
      const el = document.createElement('div');
      el.className = 'knowledge-cell';

      if (cell.visited) el.classList.add('visited');
      if (cell.confirmedPit || cell.confirmedWumpus) el.classList.add('confirmed-danger');
      else if (cell.possiblePit || cell.possibleWumpus) el.classList.add('possible-danger');
      else if (cell.pitSafe && cell.wumpusSafe) el.classList.add('safe');
      else if (cell.safe) el.classList.add('safe');
      else el.classList.add('unknown');

      if (cell.goldDiscovered) el.classList.add('gold-known');

      let label = '';
      if (cell.confirmedPit) label = 'P!';
      else if (cell.confirmedWumpus) label = 'W!';
      else if (cell.possiblePit && cell.possibleWumpus) label = '?';
      else if (cell.possiblePit) label = 'p?';
      else if (cell.possibleWumpus) label = 'w?';
      else if (cell.visited) label = '✓';
      else if (cell.pitSafe && cell.wumpusSafe) label = 'S';
      else label = '?';

      if (state.agent.x === x && state.agent.y === y) {
        el.classList.add('agent-marker');
        label = '🤖';
      }

      el.innerHTML = `<span>${label}</span>`;
      el.title = cell.lastInference || 'Unknown';
      container.appendChild(el);
    }
  }
}
