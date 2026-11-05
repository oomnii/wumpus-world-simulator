import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/game.css';
import './styles/responsive.css';

import { GameController } from './controllers/GameController.js';
import { ManualController } from './controllers/ManualController.js';
import { bindConfigurationPanel } from './components/ConfigurationPanel.js';
import { bindControlsPanel } from './components/ControlsPanel.js';
import { renderGameBoard } from './components/GameBoard.js';
import { renderKnowledgeMap } from './components/KnowledgeMap.js';
import { renderPerceptPanel } from './components/PerceptPanel.js';
import { renderStatisticsPanel } from './components/StatisticsPanel.js';
import { renderReasoningLog } from './components/ReasoningLog.js';
import { renderGameHistory } from './components/GameHistory.js';

const game = new GameController();
const manual = new ManualController(game);

const els = {
  board: document.getElementById('game-board'),
  knowledge: document.getElementById('knowledge-map'),
  percepts: document.getElementById('percept-panel'),
  stats: document.getElementById('stats-panel'),
  log: document.getElementById('reasoning-log'),
  history: document.getElementById('history-panel'),
  historyAll: document.getElementById('history-all-panel'),
  headerStatus: document.getElementById('header-status'),
  resultModal: document.getElementById('modal-result'),
  resultTitle: document.getElementById('result-title'),
  resultBody: document.getElementById('result-body'),
};

const syncConfig = bindConfigurationPanel(document.getElementById('config-panel'), game, () => {
  lastTerminal = null;
});
const syncControls = bindControlsPanel(document.getElementById('controls-panel'), game, manual);

let lastTerminal = null;

function showResultModal(vm) {
  const s = vm.state;
  if (!['won', 'lost', 'stuck'].includes(s.status)) return;
  if (lastTerminal === `${s.status}-${s.steps}-${s.score}`) return;
  lastTerminal = `${s.status}-${s.steps}-${s.score}`;

  const titles = { won: 'Victory', lost: 'Defeat', stuck: 'Agent Stuck' };
  els.resultTitle.textContent = titles[s.status] || 'Game Over';
  els.resultBody.innerHTML = `
    <p><strong>Final score:</strong> ${s.score}</p>
    <p><strong>Steps:</strong> ${s.steps}</p>
    <p><strong>Gold:</strong> ${s.goldCollected ? 'Collected' : 'Not collected'}</p>
    <p><strong>Exploration:</strong> ${vm.kbStats.explorationPct}%</p>
    <p><strong>Outcome:</strong> ${s.endReason || s.deathReason || s.status}</p>
  `;
  if (!els.resultModal.open) els.resultModal.showModal();
}

function render(vm) {
  renderGameBoard(els.board, vm);
  renderKnowledgeMap(els.knowledge, vm);
  renderPerceptPanel(els.percepts, vm);
  renderStatisticsPanel(els.stats, vm);
  renderReasoningLog(els.log, vm);
  renderGameHistory(els.history, game, false);
  syncControls(vm);
  syncConfig();

  els.headerStatus.textContent =
    vm.state.mode === 'ai' ? `AI · ${vm.aiStage}` : 'Manual Mode';

  showResultModal(vm);
}

game.subscribe(render);
render(game.getViewModel());

document.getElementById('btn-clear-log').addEventListener('click', () => game.clearLog());

document.getElementById('btn-help').addEventListener('click', () => {
  document.getElementById('modal-help').showModal();
});

document.getElementById('btn-history-all').addEventListener('click', () => {
  renderGameHistory(els.historyAll, game, true);
  document.getElementById('modal-history').showModal();
});

document.getElementById('btn-clear-history').addEventListener('click', () => {
  if (window.confirm('Clear all saved game history?')) {
    game.clearHistory();
    renderGameHistory(els.history, game, false);
  }
});

document.getElementById('result-new-game').addEventListener('click', () => {
  els.resultModal.close();
  lastTerminal = null;
  game.newGame();
});
