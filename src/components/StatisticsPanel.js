export function renderStatisticsPanel(container, vm) {
  const { state, kbStats } = vm;
  const statusLabel = {
    playing: 'In progress',
    won: 'Victory',
    lost: 'Defeat',
    stuck: 'Stuck',
    ready: 'Ready',
    paused: 'Paused',
  }[state.status] || state.status;

  container.innerHTML = `
    <ul class="stats-list">
      <li><span>Score</span><strong>${state.score}</strong></li>
      <li><span>Steps</span><strong>${state.steps}</strong></li>
      <li><span>Arrows left</span><strong>${state.arrowRemaining}</strong></li>
      <li><span>Gold</span><strong>${state.goldCollected ? 'Collected' : 'Not yet'}</strong></li>
      <li><span>Status</span><strong class="status-${state.status}">${statusLabel}</strong></li>
      <li><span>Cells visited</span><strong>${kbStats.visited}</strong></li>
      <li><span>Safe cells</span><strong>${kbStats.safe}</strong></li>
      <li><span>Possible danger</span><strong>${kbStats.possible}</strong></li>
      <li><span>Confirmed danger</span><strong>${kbStats.confirmed}</strong></li>
      <li><span>Exploration</span><strong>${kbStats.explorationPct}%</strong></li>
      <li><span>Survival</span><strong>${state.status === 'lost' ? 'Dead' : 'Alive'}</strong></li>
    </ul>
  `;
}
