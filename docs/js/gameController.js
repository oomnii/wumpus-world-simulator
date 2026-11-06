import { generateWorld } from '../algorithm/worldGenerator.js';
import { createWorldState, WorldEngine } from '../algorithm/worldEngine.js';
import { KnowledgeBase } from '../algorithm/knowledgeBase.js';
import { InferenceEngine, applyArrowMiss } from '../algorithm/inferenceEngine.js';
import { AIAgent } from '../algorithm/aiAgent.js';
import { logDecisionDiagnostics } from '../algorithm/decisionDiagnostics.js';
import { auditConfirmedPits, evaluateKbAgainstWorld } from '../algorithm/knowledgeConsistency.js';
import { perceptText } from '../algorithm/perceptEngine.js';
import {
  ACTION,
  AI_STAGE,
  HISTORY_KEY,
  MOVE_ACTIONS,
  MODE,
  SPEEDS,
  STATUS,
} from '../algorithm/shared.js';

/** Complete escape when agent returns to start with gold (same rules as Climb). */
function tryCompleteEscape(engine, state) {
  if (state.status !== STATUS.PLAYING) return null;
  if (!state.goldCollected || state.agent.x !== 0 || state.agent.y !== 0) return null;
  return engine.climb();
}

export class GameController {
  constructor(onChange) {
    this.onChange = onChange;
    this.onGameEnd = null;
    this.config = { size: 10, pitDensity: 25, debug: false, note: '' };
    this.layout = null;
    this.mode = MODE.AI;
    this.log = [];
    this.step = 1;
    this.aiStage = AI_STAGE.IDLE;
    this.infer = new InferenceEngine();
    this.ai = new AIAgent();
    this.timer = null;
    this.running = false;
    this.paused = false;
    this.intervalMs = 500;
    this.gen = 0;
    this.finalized = false;
    this.newWorld();
  }

  emit() {
    this.onChange(this.getView());
  }

  newWorld(overrides = {}) {
    this.stopAI();
    this.gen += 1;
    this.finalized = false;
    if (overrides.size != null) this.config.size = overrides.size;
    if (overrides.pitDensity != null) this.config.pitDensity = overrides.pitDensity;
    if (overrides.debug != null) this.config.debug = overrides.debug;
    const world = generateWorld({
      size: Number(this.config.size),
      pitDensity: Number(this.config.pitDensity),
    });
    this.config.note = world.note;
    this.layout = {
      size: world.size,
      pitDensity: Number(this.config.pitDensity),
      wumpus: { ...world.wumpus },
      pits: world.pits.map((p) => ({ ...p })),
      gold: { ...world.gold },
      note: world.note,
    };
    this.bootSession();
  }

  /** Restart the current map from (0,0) without generating a new world. */
  resetWorld() {
    this.stopAI();
    this.gen += 1;
    this.finalized = false;
    this.bootSession();
  }

  bootSession() {
    this.state = createWorldState({
      size: this.layout.size,
      pitDensity: this.layout.pitDensity,
      wumpus: { ...this.layout.wumpus },
      pits: this.layout.pits.map((p) => ({ ...p })),
      gold: { ...this.layout.gold },
      note: this.layout.note,
    });
    this.engine = new WorldEngine(this.state);
    this.kb = new KnowledgeBase(this.state.size);
    this.ai.setKnowledge(this.kb);
    this.log = [];
    this.step = 1;
    this.logLine('[Step 01] Agent at start (0,0), facing East.');
    this.logLine(`[Step 01] Percepts: ${perceptText(this.engine.percepts())}.`);
    this.runInference(1);
    this.emit();
  }

  runInference(step) {
    const p = this.engine.percepts();
    const { x, y } = this.state.agent;
    this.infer.infer(this.kb, x, y, p, (t, type) => this.logLine(t, type), step);
  }

  setMode(m) {
    this.mode = m;
    this.stopAI();
    this.emit();
  }

  logLine(text, type = 'neutral') {
    this.log.push({ text, type });
  }

  clearLog() {
    this.log = [];
    this.logLine('Log cleared.');
    this.emit();
  }

  getView() {
    const s = this.state;
    return {
      config: { ...this.config },
      mode: this.mode,
      state: s,
      percepts: this.engine.percepts(),
      kb: this.kb.snapshot(),
      kbStats: this.kb.stats(),
      log: this.log,
      aiStage: this.aiStage,
      aiRunning: this.running,
      aiPaused: this.paused,
      intervalMs: this.intervalMs,
      hidden: this.config.debug ? { wumpus: s.wumpus, pits: s.pits, gold: s.gold } : null,
    };
  }

  execute(action, fromAI = false) {
    if (this.engine.terminal() && action !== ACTION.CLIMB) {
      return { ok: false };
    }
    const result = this.engine.apply(action);
    let outcome = result;
    if (!result.ok) {
      if (!fromAI) this.logLine(result.reason || 'Invalid action', 'warn');
      this.emit();
      return result;
    }

    if (!fromAI) {
      this.step += 1;
      this.logLine(
        `[Step ${String(this.step).padStart(2, '0')}] Percepts: ${perceptText(outcome.percepts ?? result.percepts)}.`,
      );
    }

    if (MOVE_ACTIONS.has(action) && !outcome.died && !outcome.bump) {
      this.kb.markSafe(this.state.agent.x, this.state.agent.y, 'Survived.');
      const exit = tryCompleteEscape(this.engine, this.state);
      if (exit?.ok && exit.won) {
        outcome = { ...outcome, won: true, percepts: exit.percepts };
      }
    }

    if (action === ACTION.SHOOT && outcome.ok && !outcome.hit) {
      applyArrowMiss(this.kb, this.state.agent);
    }

    if (!outcome.died) {
      this.runInference(this.step);
    }

    if (outcome.died) {
      this.logLine(this.state.deathReason, 'danger');
      this.finalize();
      this.stopAI();
    } else if (outcome.won) {
      this.logLine('Victory — escaped with gold!', 'safe');
      this.finalize();
      this.stopAI();
    }

    this.engine.clearFlags();
    this.emit();
    return outcome;
  }

  aiTick(options = {}) {
    const force = options.force === true;
    if (!force && (!this.running || this.paused || this.mode !== MODE.AI)) return;
    if (this.engine.terminal()) {
      this.stopAI();
      return;
    }
    const view = {
      agent: { ...this.state.agent },
      percepts: this.engine.percepts(),
      goldCollected: this.state.goldCollected,
      arrowLeft: this.state.arrowLeft,
      status: this.state.status,
    };
    const out = this.ai.cycle(
      view,
      (t, type) => this.logLine(t, type || 'neutral'),
      this.step,
    );
    this.aiStage = this.ai.stage;
    if (out.stuck) {
      if (out.diagnostics) {
        logDecisionDiagnostics(out.diagnostics);
        console.log('[Wumpus AI] Pit audit:', auditConfirmedPits(this.kb));
        if (this.config.debug) {
          console.log('[Wumpus AI] World check (debug only):', evaluateKbAgainstWorld(this.kb, this.state));
        }
      }
      this.engine.setStuck('No acceptable safe target remains');
      this.finalize();
      this.stopAI();
      this.emit();
      return;
    }
    if (!out.action) {
      this.emit();
      return;
    }
    this.execute(out.action, true);
    this.step += 1;
    this.aiStage = AI_STAGE.IDLE;
    this.emit();
    if (this.engine.terminal()) this.stopAI();
  }

  startAI() {
    if (this.mode !== MODE.AI || this.engine.terminal()) return;
    this.running = true;
    this.paused = false;
    this.schedule();
    this.emit();
  }

  pauseAI() {
    if (!this.running) return;
    this.paused = true;
    clearTimeout(this.timer);
    this.emit();
  }

  resumeAI() {
    if (!this.running) return;
    this.paused = false;
    this.schedule();
    this.emit();
  }

  stopAI() {
    this.running = false;
    this.paused = false;
    clearTimeout(this.timer);
    this.aiStage = AI_STAGE.IDLE;
  }

  stepAI() {
    this.stopAI();
    this.aiTick({ force: true });
  }

  schedule() {
    clearTimeout(this.timer);
    const g = this.gen;
    this.timer = setTimeout(() => {
      if (g !== this.gen || !this.running || this.paused) return;
      this.aiTick();
      if (this.running && !this.paused) this.schedule();
    }, this.intervalMs);
  }

  setSpeed(ms) {
    this.intervalMs = ms;
    if (this.running && !this.paused) this.schedule();
    this.emit();
  }

  finalize() {
    if (this.finalized) return;
    this.finalized = true;
    const s = this.state;
    const list = this.loadHistory();
    list.unshift({
      id: Date.now(),
      n: list.length + 1,
      outcome: s.status === STATUS.WON ? 'Win' : s.status === STATUS.LOST ? 'Defeat' : 'Stuck',
      steps: s.steps,
      score: s.score,
      reason: s.endReason || s.deathReason || s.status,
    });
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 50)));
    } catch {
      /* ignore */
    }
    if (typeof this.onGameEnd === 'function') {
      this.onGameEnd(this.getView());
    }
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    this.emit();
  }

  static speedOptions() {
    return SPEEDS;
  }
}
