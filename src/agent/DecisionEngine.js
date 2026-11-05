import { ACTION } from '../utils/constants.js';
import { directionFromTo } from '../utils/coordinates.js';
import { getAdjacentSafeUnvisited, getUnknownRiskCells } from './KnowledgeBase.js';
import { PathFinder } from './PathFinder.js';

function actionForDirection(dir) {
  const map = {
    up: ACTION.MOVE_UP,
    down: ACTION.MOVE_DOWN,
    left: ACTION.MOVE_LEFT,
    right: ACTION.MOVE_RIGHT,
  };
  return map[dir];
}

function shootDirectionFrom(agent, target) {
  if (agent.x === target.x) {
    return target.y < agent.y ? 'up' : 'down';
  }
  if (agent.y === target.y) {
    return target.x < agent.x ? 'left' : 'right';
  }
  return null;
}

export class DecisionEngine {
  decide(kb, agentView, log) {
    const pos = agentView.position;
    const step = log?.step ?? 0;

    if (agentView.status !== 'playing') {
      return { type: 'none', reason: 'Game not active' };
    }

    const percepts = agentView.percepts;
    if (percepts?.glitter && !agentView.goldCollected) {
      log?.add(
        `[Step ${String(step).padStart(2, '0')}] Decision: Grab gold (Glitter present).`,
        'gold',
      );
      return { type: ACTION.GRAB, reason: 'Glitter in current cell' };
    }

    if (agentView.goldCollected && pos.x === 0 && pos.y === 0) {
      log?.add(
        `[Step ${String(step).padStart(2, '0')}] Decision: Climb out with gold.`,
        'safe',
      );
      return { type: ACTION.CLIMB, reason: 'At start with gold' };
    }

    if (agentView.goldCollected) {
      const homePath = PathFinder.bfsSafePath(kb, pos, { x: 0, y: 0 });
      if (homePath && homePath.length > 1) {
        const next = homePath[1];
        const dir = directionFromTo(pos, next);
        log?.add(
          `[Step ${String(step).padStart(2, '0')}] Decision: Return toward start via (${next.x},${next.y}).`,
          'safe',
        );
        return { type: actionForDirection(dir), reason: 'Return path (known safe)' };
      }
      const risky = getUnknownRiskCells(kb)[0];
      if (risky) {
        const dir = directionFromTo(pos, risky);
        if (dir) {
          log?.add(
            `[Step ${String(step).padStart(2, '0')}] Risk-based return move toward (${risky.x},${risky.y}).`,
            'warning',
          );
          return { type: actionForDirection(dir), reason: 'Risk-aware return fallback', risky: true };
        }
      }
      return { type: 'stuck', reason: 'No return path available' };
    }

    if (agentView.arrowRemaining > 0) {
      for (let y = 0; y < kb.size; y += 1) {
        for (let x = 0; x < kb.size; x += 1) {
          if (!kb.get(x, y).confirmedWumpus) continue;
          const dir = shootDirectionFrom(pos, { x, y });
          if (dir) {
            log?.add(
              `[Step ${String(step).padStart(2, '0')}] Decision: Shoot ${dir} at confirmed Wumpus.`,
              'warning',
            );
            return { type: ACTION.SHOOT, direction: dir, reason: 'Confirmed Wumpus in line' };
          }
        }
      }
    }

    const adjacent = getAdjacentSafeUnvisited(kb, pos.x, pos.y);
    if (adjacent.length) {
      adjacent.sort((a, b) => a.y - b.y || a.x - b.x);
      const target = adjacent[0];
      const dir = directionFromTo(pos, target);
      log?.add(
        `[Step ${String(step).padStart(2, '0')}] Decision: Explore safe neighbor (${target.x},${target.y}).`,
        'safe',
      );
      return { type: actionForDirection(dir), reason: 'Adjacent safe unexplored cell' };
    }

    const path = PathFinder.nearestSafeUnvisited(kb, pos);
    if (path && path.length > 1) {
      const next = path[1];
      const dir = directionFromTo(pos, next);
      log?.add(
        `[Step ${String(step).padStart(2, '0')}] Decision: BFS to safe unvisited (${path[path.length - 1].x},${path[path.length - 1].y}).`,
        'safe',
      );
      return { type: actionForDirection(dir), reason: 'BFS to safe unvisited cell' };
    }

    const riskyCells = getUnknownRiskCells(kb);
    if (riskyCells.length) {
      const target = riskyCells[0];
      const dir = directionFromTo(pos, target);
      if (dir) {
        log?.add(
          `[Step ${String(step).padStart(2, '0')}] Risk-based exploration toward (${target.x},${target.y}) (risk=${target.risk}).`,
          'warning',
        );
        return {
          type: actionForDirection(dir),
          reason: 'Risk-based exploration (not proven safe)',
          risky: true,
        };
      }
    }

    log?.add(
      `[Step ${String(step).padStart(2, '0')}] Agent stuck — no viable action.`,
      'danger',
    );
    return { type: 'stuck', reason: 'No safe or risk-acceptable moves' };
  }
}
