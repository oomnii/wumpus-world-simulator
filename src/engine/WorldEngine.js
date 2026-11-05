import { GAME_STATUS } from '../utils/constants.js';
import { cellKey, inBounds, stepFromDirection } from '../utils/coordinates.js';
import { computePercepts, mergePerceptEvents } from './PerceptEngine.js';

export class WorldEngine {
  constructor(state) {
    this.state = state;
  }

  getState() {
    return this.state;
  }

  isTerminal() {
    return [GAME_STATUS.WON, GAME_STATUS.LOST, GAME_STATUS.STUCK].includes(this.state.status);
  }

  getAgentView() {
    const { agent, arrowRemaining, goldCollected, status, size } = this.state;
    return {
      position: { ...agent },
      arrowRemaining,
      goldCollected,
      status,
      size,
    };
  }

  getCurrentPercepts() {
    const percepts = computePercepts(this.state, this.state.agent.x, this.state.agent.y);
    return mergePerceptEvents(percepts, {
      scream: this.state.screamPending,
      bump: this.state.bumpPending,
    });
  }

  clearTransientPercepts() {
    this.state.screamPending = false;
    this.state.bumpPending = false;
  }

  _pitAt(x, y) {
    return this.state.pits.some((p) => p.x === x && p.y === y);
  }

  _wumpusAt(x, y) {
    return (
      this.state.wumpusAlive &&
      this.state.wumpus.x === x &&
      this.state.wumpus.y === y
    );
  }

  _markVisited(x, y) {
    const key = cellKey(x, y);
    if (!this.state.visitedKeys.has(key)) {
      this.state.visitedKeys.add(key);
      this.state.cellsVisited += 1;
    }
    this.state.revealedKeys.add(key);
  }

  _afterSurvivingEntry(x, y) {
    this._markVisited(x, y);
    return computePercepts(this.state, x, y);
  }

  move(direction) {
    if (this.isTerminal()) {
      return { ok: false, reason: 'Game ended' };
    }

    this.clearTransientPercepts();
    const { x, y } = this.state.agent;
    const next = stepFromDirection(x, y, direction);

    if (!inBounds(next.x, next.y, this.state.size)) {
      this.state.bumpPending = true;
      this.state.steps += 1;
      this.state.actionIndex += 1;
      const scoreDelta = this.state.scoring.onMove(this.state.actionIndex);
      return {
        ok: true,
        moved: false,
        bump: true,
        percepts: this.getCurrentPercepts(),
        scoreDelta,
      };
    }

    this.state.agent = next;
    this.state.moves += 1;
    this.state.steps += 1;
    this.state.actionIndex += 1;
    const scoreDelta = this.state.scoring.onMove(this.state.actionIndex);

    if (this._pitAt(next.x, next.y)) {
      this._markVisited(next.x, next.y);
      this.state.status = GAME_STATUS.LOST;
      this.state.deathReason = 'Fell into a pit';
      this.state.endReason = this.state.deathReason;
      const deathDelta = this.state.scoring.onDeath();
      return {
        ok: true,
        moved: true,
        died: true,
        percepts: computePercepts(this.state, next.x, next.y),
        scoreDelta: { move: scoreDelta, death: deathDelta },
      };
    }

    if (this._wumpusAt(next.x, next.y)) {
      this._markVisited(next.x, next.y);
      this.state.status = GAME_STATUS.LOST;
      this.state.deathReason = 'Eaten by the Wumpus';
      this.state.endReason = this.state.deathReason;
      const deathDelta = this.state.scoring.onDeath();
      return {
        ok: true,
        moved: true,
        died: true,
        percepts: computePercepts(this.state, next.x, next.y),
        scoreDelta: { move: scoreDelta, death: deathDelta },
      };
    }

    const percepts = this._afterSurvivingEntry(next.x, next.y);
    return {
      ok: true,
      moved: true,
      percepts,
      scoreDelta,
      position: { ...next },
    };
  }

  shoot(direction) {
    if (this.isTerminal()) return { ok: false, reason: 'Game ended' };
    if (this.state.arrowRemaining <= 0) return { ok: false, reason: 'No arrows left' };

    this.clearTransientPercepts();
    this.state.steps += 1;
    this.state.actionIndex += 1;
    this.state.arrowRemaining -= 1;
    this.state.arrowsUsed += 1;
    const scoreDelta = this.state.scoring.onShoot();
    this.state.scoring.onMove(this.state.actionIndex);

    let hit = false;
    let cx = this.state.agent.x;
    let cy = this.state.agent.y;
    const delta = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    }[direction];

    while (inBounds(cx + delta.dx, cy + delta.dy, this.state.size)) {
      cx += delta.dx;
      cy += delta.dy;
      if (this.state.wumpusAlive && this.state.wumpus.x === cx && this.state.wumpus.y === cy) {
        this.state.wumpusAlive = false;
        hit = true;
        this.state.screamPending = true;
        break;
      }
    }

    return {
      ok: true,
      hit,
      percepts: this.getCurrentPercepts(),
      scoreDelta,
    };
  }

  grab() {
    if (this.isTerminal()) return { ok: false, reason: 'Game ended' };
    const { agent, gold, goldCollected } = this.state;
    if (goldCollected) return { ok: false, reason: 'Gold already collected' };
    if (agent.x !== gold.x || agent.y !== gold.y) {
      return { ok: false, reason: 'No gold here' };
    }

    this.clearTransientPercepts();
    this.state.goldCollected = true;
    this.state.steps += 1;
    this.state.actionIndex += 1;
    const scoreDelta = this.state.scoring.onGrabGold();
    this.state.scoring.onMove(this.state.actionIndex);

    return {
      ok: true,
      percepts: this.getCurrentPercepts(),
      scoreDelta,
    };
  }

  climb() {
    if (this.isTerminal()) return { ok: false, reason: 'Game ended' };
    const { agent, goldCollected } = this.state;
    if (agent.x !== 0 || agent.y !== 0) {
      return { ok: false, reason: 'Must be at start to climb out' };
    }
    if (!goldCollected) {
      return { ok: false, reason: 'Collect gold before climbing out' };
    }

    this.clearTransientPercepts();
    this.state.steps += 1;
    this.state.actionIndex += 1;
    this.state.hasClimbed = true;
    this.state.status = GAME_STATUS.WON;
    this.state.endReason = 'Escaped with gold';
    const climbDelta = this.state.scoring.onClimbWithGold();
    this.state.scoring.onMove(this.state.actionIndex);

    return {
      ok: true,
      won: true,
      percepts: this.getCurrentPercepts(),
      scoreDelta: climbDelta,
    };
  }

  setStuck(reason) {
    if (this.isTerminal()) return;
    this.state.status = GAME_STATUS.STUCK;
    this.state.endReason = reason || 'Agent cannot proceed safely';
  }
}
