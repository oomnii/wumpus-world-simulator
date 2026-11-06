import {
  ACTION,
  facingBetween,
  neighbors,
  turnSteps,
} from './shared.js';
import { adjacentSafeUnvisited } from './knowledgeBase.js';
import { PathFinder } from './pathFinder.js';
import { captureDecisionState } from './decisionDiagnostics.js';

export function planMoves(agent, target) {
  if (agent.x === target.x && agent.y === target.y) return [];
  const needFace = facingBetween(agent, target);
  if (needFace == null) return [];
  const actions = [...turnSteps(agent.facing, needFace), ACTION.MOVE_FORWARD];
  return actions;
}

function infoGain(kb, x, y) {
  let n = 0;
  for (const adj of neighbors(x, y, kb.size)) {
    const c = kb.get(adj.x, adj.y);
    if (!c.visited && !kb.isSafe(adj.x, adj.y) && !kb.isDanger(adj.x, adj.y)) n += 1;
  }
  return n;
}

function wumpusTargets(kb, { confirmedOnly } = {}) {
  const out = [];
  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const c = kb.get(x, y);
      if (c.confirmedWumpus) out.push({ x, y, confirmed: true });
      else if (!confirmedOnly && c.possibleWumpus && !c.confirmedPit) out.push({ x, y, confirmed: false });
    }
  }
  out.sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || a.y - b.y || a.x - b.x);
  return out;
}

function shootDecision(kb, agent, targets, log, pad, label) {
  const shot = PathFinder.planShot(kb, agent, targets);
  if (!shot) return null;
  const atPad = agent.x === shot.shootFrom.x && agent.y === shot.shootFrom.y;
  if (atPad) {
    const acts = [...turnSteps(agent.facing, shot.facing), ACTION.SHOOT];
    log(
      `[Step ${pad}] ${label} Wumpus at (${shot.target.x},${shot.target.y}) facing ${shot.facing}.`,
      'warn',
    );
    return { action: acts[0], plan: acts };
  }
  if (shot.approachPath.length > 1) {
    const nxt = shot.approachPath[1];
    const acts = planMoves(agent, nxt);
    if (!acts.length) return null;
    log(
      `[Step ${pad}] Move to shoot from (${shot.shootFrom.x},${shot.shootFrom.y}) at (${shot.target.x},${shot.target.y}).`,
      'warn',
    );
    return { action: acts[0], plan: acts };
  }
  return null;
}

function followRisk(kb, agent, riskPlan, log, pad) {
  const { frontier, approachPath, risk } = riskPlan;
  const onApproach =
    agent.x === approachPath.at(-1).x && agent.y === approachPath.at(-1).y;
  const adjacentToFrontier = neighbors(agent.x, agent.y, kb.size).some(
    (n) => n.x === frontier.x && n.y === frontier.y,
  );
  if (onApproach && adjacentToFrontier) {
    const acts = planMoves(agent, frontier);
    if (acts.length) {
      log(
        `[Step ${pad}] RISK-BASED EXPLORATION → (${frontier.x},${frontier.y}) score ${risk}.`,
        'warn',
      );
      return { action: acts[0], plan: acts, risky: true, target: frontier };
    }
  }
  if (approachPath.length > 1) {
    const acts = planMoves(agent, approachPath[1]);
    if (acts.length) {
      log(
        `[Step ${pad}] Move toward risk frontier via safe route → next (${approachPath[1].x},${approachPath[1].y}); target (${frontier.x},${frontier.y}) risk ${risk}.`,
        'warn',
      );
      return { action: acts[0], plan: acts, risky: true, target: frontier };
    }
  }
  return null;
}

export class DecisionEngine {
  decide(kb, view, log, step, options = {}) {
    const pad = String(step).padStart(2, '0');
    const { agent, percepts, goldCollected, arrowLeft, status } = view;
    if (status !== 'playing') return { action: null };

    if (percepts.glitter && !goldCollected) {
      log(`[Step ${pad}] Decision: grab gold (Glitter).`, 'gold');
      return { action: ACTION.GRAB };
    }
    if (goldCollected && agent.x === 0 && agent.y === 0) {
      log(`[Step ${pad}] Decision: climb out with gold.`, 'safe');
      return { action: ACTION.CLIMB };
    }
    if (goldCollected) {
      const home = PathFinder.path(kb, agent, { x: 0, y: 0 });
      if (home && home.length > 1) {
        const acts = planMoves(agent, home[1]);
        if (acts.length) {
          log(`[Step ${pad}] Return via known-safe path toward (${home[1].x},${home[1].y}).`, 'safe');
          return { action: acts[0], plan: acts };
        }
      }
      log(`[Step ${pad}] Stuck — no known-safe route home.`, 'danger');
      return { stuck: true, diagnostics: captureDecisionState(kb, agent, percepts, options.prevAgent) };
    }

    const adj = adjacentSafeUnvisited(kb, agent.x, agent.y);
    if (adj.length) {
      adj.sort((a, b) => infoGain(kb, b.x, b.y) - infoGain(kb, a.x, a.y) || a.y - b.y || a.x - b.x);
      const acts = planMoves(agent, adj[0]);
      if (acts.length) {
        log(`[Step ${pad}] Explore known-safe unvisited (${adj[0].x},${adj[0].y}).`, 'safe');
        return { action: acts[0], plan: acts };
      }
    }

    const path = PathFinder.nearestSafeUnvisited(kb, agent);
    if (path && path.length > 1) {
      const acts = planMoves(agent, path[1]);
      if (acts.length) {
        log(
          `[Step ${pad}] BFS to known-safe unvisited (${path.at(-1).x},${path.at(-1).y}) via (${path[1].x},${path[1].y}).`,
          'safe',
        );
        return { action: acts[0], plan: acts };
      }
    }

    if (arrowLeft > 0) {
      const confirmed = wumpusTargets(kb, { confirmedOnly: true });
      if (confirmed.length) {
        const shot = shootDecision(kb, agent, confirmed, log, pad, 'Shoot confirmed');
        if (shot) return shot;
      }
      const possibles = wumpusTargets(kb, { confirmedOnly: false }).filter((t) => !t.confirmed);
      if (possibles.length && possibles.length <= 2) {
        const shot = shootDecision(kb, agent, possibles, log, pad, 'Shoot possible');
        if (shot) return shot;
      }
    }

    const riskPlan = PathFinder.bestRiskFrontier(kb, agent);
    if (riskPlan) {
      const next = followRisk(kb, agent, riskPlan, log, pad);
      if (next) return next;
    }

    const diagnostics = captureDecisionState(kb, agent, percepts, options.prevAgent);
    log(`[Step ${pad}] Stuck — ${diagnostics.stuckTrigger || 'no acceptable safe target remains'}.`, 'danger');
    return { stuck: true, diagnostics };
  }
}
