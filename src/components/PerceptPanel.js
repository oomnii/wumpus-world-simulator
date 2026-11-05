export function renderPerceptPanel(container, vm) {
  const { percepts, state, knowledge } = vm;
  const key = `${state.agent.x},${state.agent.y}`;
  const cell = knowledge.cells[key] || {};
  const safe = cell.pitSafe && cell.wumpusSafe;

  container.innerHTML = `
    <div class="percept-grid">
      ${perceptRow('Breeze', percepts.breeze, '💨')}
      ${perceptRow('Stench', percepts.stench, '👃')}
      ${perceptRow('Glitter', percepts.glitter, '✨')}
      ${perceptRow('Scream', percepts.scream, '📣')}
      ${perceptRow('Bump', percepts.bump, '🧱')}
    </div>
    <dl class="percept-meta">
      <div><dt>Coordinates</dt><dd>(${state.agent.x}, ${state.agent.y})</dd></div>
      <div><dt>Cell status</dt><dd>${cell.visited ? 'Visited' : 'Current'}</dd></div>
      <div><dt>Safe (inferred)</dt><dd>${safe || cell.safe ? 'Yes' : 'Unknown / risk'}</dd></div>
    </dl>
  `;
}

function perceptRow(name, active, icon) {
  return `
    <div class="percept-item ${active ? 'active' : 'inactive'}">
      <span class="percept-icon">${icon}</span>
      <span class="percept-name">${name}</span>
      <span class="percept-state">${active ? 'Present' : 'Absent'}</span>
    </div>
  `;
}
