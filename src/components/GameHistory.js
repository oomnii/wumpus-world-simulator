export function renderGameHistory(container, game, expanded = false) {
  const history = game.loadHistory();
  const items = expanded ? history : history.slice(0, 5);

  if (!history.length) {
    container.innerHTML = '<p class="empty-state">No completed games yet.</p>';
    return;
  }

  container.innerHTML = `
    <ul class="history-list">
      ${items
        .map(
          (h) => `
        <li>
          <span class="hist-num">#${h.gameNumber}</span>
          <span class="hist-outcome outcome-${h.outcome.toLowerCase()}">${h.outcome}</span>
          <span class="hist-meta">${h.steps} steps · ${h.score} pts</span>
          <span class="hist-reason">${escapeHtml(h.reason)}</span>
        </li>`,
        )
        .join('')}
    </ul>
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
