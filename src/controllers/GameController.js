import {
  ACTION,
  AI_STAGE,
  DEFAULT_AI_INTERVAL_MS,
  DEFAULT_GRID_SIZE,
  DEFAULT_PIT_DENSITY,
  GAME_STATUS,
  HISTORY_STORAGE_KEY,
  MODE,
} from '../utils/constants.js';
import { createInitialGameState } from '../engine/GameState.js';
import { WorldEngine } from '../engine/WorldEngine.js';
import { KnowledgeBase } from '../agent/KnowledgeBase.js';
import { InferenceEngine } from '../agent/InferenceEngine.js';
import { AIAgent } from '../agent/AIAgent.js';
import { AnimationController } from './AnimationController.js';
import { formatManualPerceptLog } from './ManualController.js';

export class ReasoningLog {
  constructor() {
    this.entries = [];
    this.step = 1;
  }

  clear() {
    this.entries = [];
    this.step = 1;
  }

  add(text, type = 'neutral') {
    this.entries.push({ text, type, id: `${Date.now()}-${this.entries.length}` });
  }

  nextStep() {
    this.step += 1;
  }
}

export class GameController {
  constructor() {
    this.config = {
      size: DEFAULT_GRID_SIZE,
      pitDensity: DEFAULT_PIT_DENSITY,
      seed: '',
      debugReveal: false,
    };
    this.state = createInitialGameState(this.config);
    this.world = new WorldEngine(this.state);
    this.knowledge = new KnowledgeBase(this.state.size);
    this.inference = new InferenceEngine();
    this.agent = new AIAgent();
    this.agent.setKnowledge(this.knowledge);
    this.log = new ReasoningLog();
    this.anim = new AnimationController();
    this.anim.setTickHandler((gen) => this.aiTick(gen));
    this.listeners = new Set();
    this.aiStage = AI_STAGE.IDLE;
    this._finalized = false;

    this.observeInitialCell();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) fn(this.getViewModel());
  }

  getViewModel() {
    const s = this.state;
    return {
      config: { ...this.config },
      state: {
        size: s.size,
        pitDensity: s.pitDensity,
        seed: s.seed,
        generationNote: s.generationNote,
        usedFallback: s.usedFallback,
        agent: { ...s.agent },
        goldCollected: s.goldCollected,
        arrowRemaining: s.arrowRemaining,
        arrowsUsed: s.arrowsUsed,
        steps: s.steps,
        moves: s.moves,
        cellsVisited: s.cellsVisited,
        visitedKeys: s.visitedKeys,
        revealedKeys: s.revealedKeys,
        status: s.status,
        deathReason: s.deathReason,
        endReason: s.endReason,
        score: s.scoring.getScore(),
        debugReveal: s.debugReveal,
        mode: s.mode,
        wumpusAlive: s.wumpusAlive,
      },
      hidden: {
        wumpus: { ...s.wumpus },
        pits: s.pits.map((p) => ({ ...p })),
        gold: { ...s.gold },
      },
      percepts: this.world.getCurrentPercepts(),
      knowledge: this.knowledge.snapshot(),
      kbStats: this.knowledge.getStats(),
      log: this.log.entries,
      aiStage: this.aiStage,
      anim: {
        running: this.anim.running,
        paused: this.anim.paused,
        intervalMs: this.anim.intervalMs,
      },
    };
  }

  observeInitialCell() {
    const p = this.world.getCurrentPercepts();
    this.log.add('[Step 01] Agent entered starting cell.', 'neutral');
    this.log.add(formatManualPerceptLog(this.log.step, p), 'neutral');
    this.inference.run(this.knowledge, 0, 0, p, this.log);
  }

  newGame(overrides = {}) {
    this._finalized = false;
    this.anim.bumpGeneration();
    this.config = {
      ...this.config,
      size: overrides.size ?? this.config.size,
      pitDensity: overrides.pitDensity ?? this.config.pitDensity,
      seed: overrides.seed ?? this.config.seed,
      debugReveal: overrides.debugReveal ?? this.config.debugReveal,
    };
    this.state = createInitialGameState({
      size: this.config.size,
      pitDensity: this.config.pitDensity,
      seed: this.config.seed,
      mode: this.state.mode,
    });
    this.state.debugReveal = this.config.debugReveal;
    this.world = new WorldEngine(this.state);
    this.knowledge = new KnowledgeBase(this.state.size);
    this.agent.setKnowledge(this.knowledge);
    this.log.clear();
    this.aiStage = AI_STAGE.IDLE;
    this.observeInitialCell();
    this.notify();
  }

  resetGame() {
    this._finalized = false;
    this.anim.bumpGeneration();
    const mode = this.state.mode;
    const cfg = { ...this.config, mode };
    this.state = createInitialGameState(cfg);
    this.state.debugReveal = this.config.debugReveal;
    this.world = new WorldEngine(this.state);
    this.knowledge = new KnowledgeBase(this.state.size);
    this.agent.setKnowledge(this.knowledge);
    this.log.clear();
    this.aiStage = AI_STAGE.IDLE;
    this.observeInitialCell();
    this.notify();
  }

  setMode(mode) {
    if (this.state.mode === mode) return;
    this.anim.stop();
    this.state.mode = mode;
    this.aiStage = AI_STAGE.IDLE;
    this.notify();
  }

  setDebugReveal(enabled) {
    this.config.debugReveal = enabled;
    this.state.debugReveal = enabled;
    this.notify();
  }

  setSpeed(ms) {
    this.anim.setSpeed(ms ?? DEFAULT_AI_INTERVAL_MS);
    this.notify();
  }

  playAI() {
    if (this.state.mode !== MODE.AI) return;
    if (this.world.isTerminal()) return;
    this.anim.start();
    this.notify();
  }

  pauseAI() {
    this.anim.pause();
    this.notify();
  }

  resumeAI() {
    if (this.state.mode !== MODE.AI) return;
    this.anim.resume();
    this.notify();
  }

  stepAI() {
    if (this.state.mode !== MODE.AI) return;
    this.anim.bumpGeneration();
    return this.aiTick(this.anim.generation);
  }

  async aiTick(generation) {
    if (generation !== this.anim.generation) return;
    if (this.state.mode !== MODE.AI) return;
    if (this.world.isTerminal()) {
      this.anim.stop();
      this.finalizeIfNeeded();
      this.notify();
      return;
    }

    const agentView = {
      ...this.world.getAgentView(),
      percepts: this.world.getCurrentPercepts(),
    };

    this.aiStage = AI_STAGE.OBSERVE;
    this.notify();

    const decision = this.agent.runCycle(agentView, this.log);
    this.aiStage = this.agent.getStage();
    this.notify();

    if (decision.type === 'stuck') {
      this.world.setStuck(decision.reason);
      this.anim.stop();
      this.finalizeIfNeeded();
      this.notify();
      return;
    }

    if (decision.type === 'none') return;

    await this.executeAction(decision.type, {
      direction: decision.direction,
      fromAI: true,
    });

    if (generation !== this.anim.generation) return;

    if (this.world.isTerminal()) {
      this.anim.stop();
      this.finalizeIfNeeded();
    }

    this.aiStage = AI_STAGE.IDLE;
    this.notify();
  }

  executeAction(action, options = {}) {
    if (this.world.isTerminal() && action !== ACTION.CLIMB) {
      this.notify();
      return { ok: false };
    }

    let result;
    switch (action) {
      case ACTION.MOVE_UP:
        result = this.world.move('up');
        break;
      case ACTION.MOVE_DOWN:
        result = this.world.move('down');
        break;
      case ACTION.MOVE_LEFT:
        result = this.world.move('left');
        break;
      case ACTION.MOVE_RIGHT:
        result = this.world.move('right');
        break;
      case ACTION.SHOOT:
        result = this.world.shoot(options.direction || 'up');
        break;
      case ACTION.GRAB:
        result = this.world.grab();
        break;
      case ACTION.CLIMB:
        result = this.world.climb();
        break;
      default:
        return { ok: false };
    }

    if (!result?.ok) {
      if (!options.fromAI) {
        this.log.add(`Action failed: ${result?.reason || 'Invalid action'}`, 'warning');
      }
      this.notify();
      return result;
    }

    const pos = this.state.agent;
    const percepts = result.percepts || this.world.getCurrentPercepts();

    if (result.moved && !result.died) {
      this.knowledge.markVisitedSafe(pos.x, pos.y, 'Survived entry — cell is safe.');
    }

    if (result.moved || action === ACTION.GRAB || action === ACTION.SHOOT || result.bump) {
      if (!options.fromAI) {
        this.log.nextStep();
        this.log.add(
          formatManualPerceptLog(this.log.step, percepts),
          result.died ? 'danger' : 'neutral',
        );
      } else if (result.moved) {
        this.log.nextStep();
      }
    }

    this.inference.run(this.knowledge, pos.x, pos.y, percepts, this.log);

    if (result.died) {
      this.log.add(`Agent died: ${this.state.deathReason}`, 'danger');
      this.anim.stop();
      this.finalizeIfNeeded();
    } else if (result.won) {
      this.log.add('Victory — agent escaped with gold!', 'safe');
      this.anim.stop();
      this.finalizeIfNeeded();
    }

    this.world.clearTransientPercepts();
    this.notify();
    return result;
  }

  finalizeIfNeeded() {
    if (!this.world.isTerminal()) return;
    if (this._finalized) return;
    this._finalized = true;
    const s = this.state;
    const entry = {
      id: Date.now(),
      gameNumber: this.loadHistory().length + 1,
      outcome:
        s.status === GAME_STATUS.WON ? 'Win' : s.status === GAME_STATUS.LOST ? 'Loss' : 'Stuck',
      steps: s.steps,
      score: s.scoring.getScore(),
      reason: s.endReason || s.deathReason || 'Game ended',
      timestamp: new Date().toISOString(),
    };
    this.saveHistoryEntry(entry);
  }

  loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveHistoryEntry(entry) {
    try {
      const list = this.loadHistory();
      list.unshift(entry);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
    } catch {
      /* ignore storage failures */
    }
  }

  clearHistory() {
    try {
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.notify();
  }

  clearLog() {
    this.log.clear();
    this.log.add('[Step 01] Log cleared.', 'neutral');
    this.notify();
  }
}
