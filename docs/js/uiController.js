import { ACTION, FACING_NAME, MODE } from '../algorithm/shared.js';

const FACE_ICON = ['↑', '→', '↓', '←'];

export class UIController {
  constructor(game) {
    this.game = game;
    this.els = {
      board: document.getElementById('board'),
      knowledge: document.getElementById('knowledge'),
      percepts: document.getElementById('percepts'),
      stats: document.getElementById('stats'),
      log: document.getElementById('log'),
      history: document.getElementById('history'),
      historyAll: document.getElementById('history-all'),
      boardMeta: document.getElementById('board-meta'),
      aiStage: document.getElementById('ai-stage'),
      headerBadge: document.getElementById('header-badge'),
      cfgNote: document.getElementById('cfg-note'),
      cfgPitLabel: document.getElementById('cfg-pit-label'),
      panelManual: document.getElementById('panel-manual'),
      panelAi: document.getElementById('panel-ai'),
      modalResult: document.getElementById('modal-result'),
      resultTitle: document.getElementById('result-title'),
      resultBody: document.getElementById('result-body'),
      modalHistory: document.getElementById('modal-history'),
    };
    this.bind();
  }

  bind() {
    const g = this.game;
    const pit = document.getElementById('cfg-pit');
    pit.addEventListener('input', () => {
      this.els.cfgPitLabel.textContent = `${pit.value}%`;
    });

    document.getElementById('btn-new').addEventListener('click', () => {
      g.newWorld({
        size: document.getElementById('cfg-size').value,
        pitDensity: pit.value,
        debug: document.getElementById('cfg-debug').checked,
      });
    });
    document.getElementById('btn-reset').addEventListener('click', () => {
      g.config.debug = document.getElementById('cfg-debug').checked;
      g.resetWorld();
    });
    document.getElementById('cfg-debug').addEventListener('change', (e) => {
      g.config.debug = e.target.checked;
      g.emit();
    });
    document.querySelectorAll('input[name="mode"]').forEach((el) => {
      el.addEventListener('change', () => {
        g.setMode(document.getElementById('mode-ai').checked ? MODE.AI : MODE.MANUAL);
      });
    });

    document.getElementById('act-up').addEventListener('click', () => g.execute(ACTION.MOVE_UP));
    document.getElementById('act-down').addEventListener('click', () => g.execute(ACTION.MOVE_DOWN));
    document.getElementById('act-left').addEventListener('click', () => g.execute(ACTION.MOVE_LEFT));
    document.getElementById('act-right').addEventListener('click', () => g.execute(ACTION.MOVE_RIGHT));
    document.getElementById('act-shoot').addEventListener('click', () => g.execute(ACTION.SHOOT));
    document.getElementById('act-grab').addEventListener('click', () => g.execute(ACTION.GRAB));
    document.getElementById('act-climb').addEventListener('click', () => g.execute(ACTION.CLIMB));

    document.getElementById('ai-play').addEventListener('click', () => g.startAI());
    document.getElementById('ai-pause').addEventListener('click', () => g.pauseAI());
    document.getElementById('ai-resume').addEventListener('click', () => g.resumeAI());
    document.getElementById('ai-step').addEventListener('click', () => g.stepAI());
    document.getElementById('btn-clear-log').addEventListener('click', () => g.clearLog());
    document.getElementById('btn-history').addEventListener('click', () => {
      this.renderHistory(g.loadHistory(), this.els.historyAll);
      this.els.modalHistory.showModal();
    });
    document.getElementById('hist-close').addEventListener('click', () => this.els.modalHistory.close());
    document.getElementById('btn-clear-hist').addEventListener('click', () => {
      if (confirm('Clear saved history?')) g.clearHistory();
    });
    document.getElementById('result-close').addEventListener('click', () => this.els.modalResult.close());

    const speed = document.getElementById('ai-speed');
    this.game.constructor.speedOptions().forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.ms;
      opt.textContent = o.label;
      if (o.ms === 500) opt.selected = true;
      speed.appendChild(opt);
    });
    speed.addEventListener('change', () => g.setSpeed(Number(speed.value)));

    this.onKeyDown = (e) => {
      if (g.mode !== MODE.MANUAL || g.engine.terminal()) return;
      const t = e.target;
      if (t && /input|textarea|select/i.test(t.tagName)) return;
      const map = {
        ArrowUp: ACTION.MOVE_UP,
        ArrowDown: ACTION.MOVE_DOWN,
        ArrowLeft: ACTION.MOVE_LEFT,
        ArrowRight: ACTION.MOVE_RIGHT,
      };
      if (map[e.key]) {
        e.preventDefault();
        g.execute(map[e.key]);
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        g.execute(ACTION.GRAB);
      } else if (e.key === 's' || e.key === 'S') {
        g.execute(ACTION.SHOOT);
      } else if (e.key === 'Enter') {
        g.execute(ACTION.CLIMB);
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  render(view) {
    this.renderBoard(view);
    this.renderKnowledge(view);
    this.renderPercepts(view);
    this.renderStats(view);
    this.renderLog(view);
    this.renderHistory(this.game.loadHistory().slice(0, 5), this.els.history);
    this.els.cfgNote.textContent = view.config.note || '';
    this.els.aiStage.textContent = `AI stage: ${view.aiStage}`;
    this.els.headerBadge.textContent =
      view.mode === MODE.AI ? `AI · ${view.aiStage}` : 'Manual';

    const manual = view.mode === MODE.MANUAL;
    this.els.panelManual.hidden = !manual;
    this.els.panelAi.hidden = manual;
    const terminal = ['won', 'lost', 'stuck'].includes(view.state.status);
    document.querySelectorAll('#panel-manual button, #panel-ai button').forEach((b) => {
      b.disabled = terminal;
    });
    document.getElementById('ai-play').disabled = manual || terminal || view.aiRunning;
    document.getElementById('ai-pause').disabled = !view.aiRunning || view.aiPaused;
    document.getElementById('ai-resume').disabled = !view.aiRunning || !view.aiPaused;
    document.getElementById('ai-step').disabled = manual || terminal;

  }

  renderBoard(view) {
    const { state, percepts, hidden, config } = view;
    const n = state.size;
    const track = `repeat(${n}, minmax(0, 1fr))`;
    this.els.board.style.gridTemplateColumns = track;
    this.els.board.style.gridTemplateRows = track;
    this.els.board.style.setProperty('--cell-n', String(n));
    this.els.board.innerHTML = '';
    const pits = new Set((hidden?.pits || []).map((p) => `${p.x},${p.y}`));
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const key = `${x},${y}`;
        const revealed = state.revealed.has(key) || config.debug;
        const agent = state.agent.x === x && state.agent.y === y;
        if (state.visited.has(key)) cell.classList.add('visited');
        if (agent) cell.classList.add('agent');
        if (!revealed && !agent) cell.classList.add('unexplored');
        let html = '?';
        if (config.debug && hidden) {
          let icons = '';
          if (hidden.wumpus.x === x && hidden.wumpus.y === y && state.wumpusAlive) icons += '👹';
          if (pits.has(key)) icons += '🕳';
          if (hidden.gold.x === x && hidden.gold.y === y && !state.goldCollected) icons += '🪙';
          if (agent) icons = `${FACE_ICON[state.agent.facing]}${icons}`;
          html = icons || '·';
        } else if (!revealed && !agent) {
          html = '?';
        } else if (agent) {
          html = FACE_ICON[state.agent.facing];
          if (percepts.glitter && !state.goldCollected) html += '🪙';
        } else {
          html = '·';
        }
        cell.textContent = html;
        this.els.board.appendChild(cell);
      }
    }
    this.els.boardMeta.textContent = config.debug
      ? 'DEBUG — hidden world visible (AI does not see this)'
      : `Agent (${state.agent.x},${state.agent.y}) facing ${FACING_NAME[state.agent.facing]} · ${percepts.breeze ? 'Breeze' : 'No Breeze'} · ${percepts.stench ? 'Stench' : 'No Stench'}`;
  }

  renderKnowledge(view) {
    const { kb, state } = view;
    const n = kb.size;
    const track = `repeat(${n}, minmax(0, 1fr))`;
    this.els.knowledge.style.gridTemplateColumns = track;
    this.els.knowledge.style.gridTemplateRows = track;
    this.els.knowledge.style.setProperty('--cell-n', String(n));
    this.els.knowledge.innerHTML = '';
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const c = kb.cells[`${x},${y}`] || {};
        const el = document.createElement('div');
        el.className = 'cell';
        if (c.confirmedPit || c.confirmedWumpus) el.classList.add('conf');
        else if (c.possiblePit || c.possibleWumpus) el.classList.add('poss');
        else if (c.visited) el.classList.add('vis');
        else if (c.pitSafe && c.wumpusSafe && !c.possiblePit && !c.possibleWumpus) el.classList.add('safe');
        else el.classList.add('unk');
        let t = '?';
        if (c.confirmedPit) t = 'P!';
        else if (c.confirmedWumpus) t = 'W!';
        else if (c.goldKnown) t = '🪙';
        else if (c.visited) t = '✓';
        else if (c.pitSafe && c.wumpusSafe && !c.possiblePit && !c.possibleWumpus) t = 'S';
        if (state.agent.x === x && state.agent.y === y) t = FACE_ICON[state.agent.facing];
        el.textContent = t;
        el.title = c.note || '';
        this.els.knowledge.appendChild(el);
      }
    }
  }

  renderPercepts(view) {
    const p = view.percepts;
    const s = view.state;
    const c = view.kb.cells[`${s.agent.x},${s.agent.y}`] || {};
    const knownSafe =
      c.pitSafe && c.wumpusSafe && !c.possiblePit && !c.possibleWumpus && !c.confirmedPit && !c.confirmedWumpus;
    const safety = c.confirmedPit || c.confirmedWumpus
      ? 'Confirmed hazard (KB)'
      : c.possiblePit || c.possibleWumpus
        ? 'Possible hazard (KB)'
        : knownSafe
          ? 'Known safe (KB)'
          : 'Unknown (KB)';
    const row = (name, on) =>
      `<div class="percept ${on ? 'on' : ''}"><span>${name}</span><span>${on ? 'Yes' : 'No'}</span></div>`;
    this.els.percepts.innerHTML =
      row('Breeze', p.breeze) +
      row('Stench', p.stench) +
      row('Glitter', p.glitter) +
      row('Scream', p.scream) +
      row('Bump', p.bump) +
      `<p class="hint">Position (${s.agent.x},${s.agent.y}) · Facing ${FACING_NAME[s.agent.facing]}</p>` +
      `<p class="hint">Cell status: ${safety}</p>`;
  }

  renderStats(view) {
    const s = view.state;
    const k = view.kbStats;
    const li = (a, b) => `<li><span>${a}</span><strong>${b}</strong></li>`;
    this.els.stats.innerHTML =
      li('Score', s.score) +
      li('Steps', s.steps) +
      li('Arrows', s.arrowLeft) +
      li('Gold', s.goldCollected ? 'Yes' : 'No') +
      li('Position', `(${s.agent.x}, ${s.agent.y})`) +
      li('Facing', FACING_NAME[s.agent.facing]) +
      li('Status', s.status) +
      li('Possible hazards', k.possible) +
      li('Confirmed hazards', k.confirmed) +
      li('Visited', k.visited) +
      li('Safe known', k.safe) +
      li('Exploration', `${k.explore}%`) +
      li('Survival', s.status === 'playing' ? 'Alive' : s.status);
  }

  renderLog(view) {
    this.els.log.innerHTML = view.log
      .map((e) => `<div class="log-${e.type}">${escapeHtml(e.text)}</div>`)
      .join('');
    this.els.log.scrollTop = this.els.log.scrollHeight;
  }

  renderHistory(list, el) {
    if (!list.length) {
      el.innerHTML = '<p class="hint">No completed games.</p>';
      return;
    }
    el.innerHTML = `<ul class="hist">${list
      .map(
        (h) =>
          `<li><strong>${h.outcome}</strong> · ${h.steps} steps · ${h.score} pts<br/><span class="hint">${escapeHtml(h.reason)}</span></li>`,
      )
      .join('')}</ul>`;
  }

  /** Called once from GameController.finalize() — Win / Defeat / Stuck dialog. */
  showResult(view) {
    const s = view.state;
    if (!['won', 'lost', 'stuck'].includes(s.status)) return;
    const titles = { won: 'Victory', lost: 'Defeat', stuck: 'Stuck' };
    const theme = { won: 'result-won', lost: 'result-lost', stuck: 'result-stuck' };
    this.els.resultTitle.textContent = titles[s.status] || 'Game Over';
    this.els.modalResult.classList.remove('result-won', 'result-lost', 'result-stuck');
    this.els.modalResult.classList.add(theme[s.status]);
    const reason =
      s.endReason ||
      s.deathReason ||
      (s.status === 'won' ? 'Escaped with gold' : '');
    this.els.resultBody.innerHTML = `<p>Score: ${s.score}</p><p>Steps: ${s.steps}</p><p>${escapeHtml(reason)}</p>`;
    if (typeof this.els.modalResult.showModal === 'function') {
      this.els.modalResult.showModal();
    }
  }
}

function escapeHtml(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
