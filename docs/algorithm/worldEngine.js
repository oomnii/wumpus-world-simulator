import {
  ACTION,
  FACING,
  FACING_DELTA,
  SCORE,
  STATUS,
  cellKey,
  inBounds,
} from './shared.js';
import { getPercepts } from './perceptEngine.js';

export function createWorldState(config) {
  return {
    size: config.size,
    pitDensity: config.pitDensity,
    note: config.note ?? '',
    wumpus: { ...config.wumpus },
    wumpusAlive: true,
    pits: config.pits.map((p) => ({ ...p })),
    gold: { ...config.gold },
    goldCollected: false,
    agent: { x: 0, y: 0, facing: FACING.E },
    arrowLeft: 1,
    arrowsUsed: 0,
    steps: 0,
    score: 0,
    scored: new Set(),
    visited: new Set(['0,0']),
    revealed: new Set(['0,0']),
    status: STATUS.PLAYING,
    deathReason: null,
    endReason: null,
    screamFlag: false,
    bumpFlag: false,
  };
}

function applyScore(state, key, delta) {
  if (state.scored.has(key)) return;
  state.scored.add(key);
  state.score += delta;
}

function actionCost(state) {
  state.steps += 1;
  applyScore(state, `act-${state.steps}`, SCORE.ACTION);
}

export class WorldEngine {
  constructor(state) {
    this.state = state;
  }

  terminal() {
    return [STATUS.WON, STATUS.LOST, STATUS.STUCK].includes(this.state.status);
  }

  percepts() {
    const s = this.state;
    return getPercepts(s, s.agent.x, s.agent.y, {
      scream: s.screamFlag,
      bump: s.bumpFlag,
    });
  }

  clearFlags() {
    this.state.screamFlag = false;
    this.state.bumpFlag = false;
  }

  pitAt(x, y) {
    return this.state.pits.some((p) => p.x === x && p.y === y);
  }

  wumpusAt(x, y) {
    return (
      this.state.wumpusAlive &&
      this.state.wumpus.x === x &&
      this.state.wumpus.y === y
    );
  }

  visit(x, y) {
    const k = cellKey(x, y);
    this.state.visited.add(k);
    this.state.revealed.add(k);
  }

  turnLeft() {
    if (this.terminal()) return { ok: false };
    this.clearFlags();
    this.state.agent.facing = (this.state.agent.facing + 3) % 4;
    actionCost(this.state);
    return { ok: true, percepts: this.percepts() };
  }

  turnRight() {
    if (this.terminal()) return { ok: false };
    this.clearFlags();
    this.state.agent.facing = (this.state.agent.facing + 1) % 4;
    actionCost(this.state);
    return { ok: true, percepts: this.percepts() };
  }

  moveAbsolute(facing) {
    if (this.terminal()) return { ok: false };
    this.state.agent.facing = facing;
    return this.moveForward();
  }

  moveForward() {
    if (this.terminal()) return { ok: false };
    this.clearFlags();
    const { agent, size } = this.state;
    const d = FACING_DELTA[agent.facing];
    const nx = agent.x + d.dx;
    const ny = agent.y + d.dy;
    if (!inBounds(nx, ny, size)) {
      this.state.bumpFlag = true;
      actionCost(this.state);
      return { ok: true, bump: true, percepts: this.percepts() };
    }
    agent.x = nx;
    agent.y = ny;
    actionCost(this.state);
    if (this.pitAt(nx, ny)) {
      this.visit(nx, ny);
      this.state.status = STATUS.LOST;
      this.state.deathReason = 'Fell into a pit';
      this.state.endReason = this.state.deathReason;
      applyScore(this.state, 'death', SCORE.DEATH);
      return { ok: true, died: true, percepts: getPercepts(this.state, nx, ny) };
    }
    if (this.wumpusAt(nx, ny)) {
      this.visit(nx, ny);
      this.state.status = STATUS.LOST;
      this.state.deathReason = 'Eaten by the Wumpus';
      this.state.endReason = this.state.deathReason;
      applyScore(this.state, 'death', SCORE.DEATH);
      return { ok: true, died: true, percepts: getPercepts(this.state, nx, ny) };
    }
    this.visit(nx, ny);
    return { ok: true, percepts: getPercepts(this.state, nx, ny) };
  }

  shoot() {
    if (this.terminal()) return { ok: false };
    if (this.state.arrowLeft <= 0) return { ok: false, reason: 'No arrow' };
    this.clearFlags();
    this.state.arrowLeft -= 1;
    this.state.arrowsUsed += 1;
    applyScore(this.state, 'shoot', SCORE.SHOOT);
    actionCost(this.state);
    let { x, y } = this.state.agent;
    const d = FACING_DELTA[this.state.agent.facing];
    let hit = false;
    while (inBounds(x + d.dx, y + d.dy, this.state.size)) {
      x += d.dx;
      y += d.dy;
      if (this.wumpusAt(x, y)) {
        this.state.wumpusAlive = false;
        this.state.screamFlag = true;
        hit = true;
        break;
      }
    }
    return { ok: true, hit, percepts: this.percepts() };
  }

  grab() {
    if (this.terminal()) return { ok: false };
    const { agent, gold, goldCollected } = this.state;
    if (goldCollected) return { ok: false, reason: 'Already have gold' };
    if (agent.x !== gold.x || agent.y !== gold.y) return { ok: false, reason: 'No gold here' };
    this.clearFlags();
    this.state.goldCollected = true;
    applyScore(this.state, 'gold', SCORE.GOLD);
    actionCost(this.state);
    return { ok: true, percepts: this.percepts() };
  }

  climb() {
    if (this.terminal()) return { ok: false };
    const { agent, goldCollected } = this.state;
    if (agent.x !== 0 || agent.y !== 0) return { ok: false, reason: 'Not at start' };
    if (!goldCollected) return { ok: false, reason: 'Need gold' };
    this.clearFlags();
    actionCost(this.state);
    applyScore(this.state, 'exit', SCORE.EXIT);
    this.state.status = STATUS.WON;
    this.state.endReason = 'Escaped with gold';
    return { ok: true, won: true, percepts: this.percepts() };
  }

  setStuck(reason) {
    if (this.terminal()) return;
    this.state.status = STATUS.STUCK;
    this.state.endReason = reason;
  }

  apply(action) {
    switch (action) {
      case ACTION.TURN_LEFT:
        return this.turnLeft();
      case ACTION.TURN_RIGHT:
        return this.turnRight();
      case ACTION.MOVE_FORWARD:
        return this.moveForward();
      case ACTION.MOVE_UP:
        return this.moveAbsolute(FACING.N);
      case ACTION.MOVE_DOWN:
        return this.moveAbsolute(FACING.S);
      case ACTION.MOVE_LEFT:
        return this.moveAbsolute(FACING.W);
      case ACTION.MOVE_RIGHT:
        return this.moveAbsolute(FACING.E);
      case ACTION.SHOOT:
        return this.shoot();
      case ACTION.GRAB:
        return this.grab();
      case ACTION.CLIMB:
        return this.climb();
      default:
        return { ok: false };
    }
  }
}
