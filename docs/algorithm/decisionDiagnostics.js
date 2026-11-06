import { adjacentSafeUnvisited } from './knowledgeBase.js';
import { PathFinder } from './pathFinder.js';

function classifyCell(kb, x, y) {
  const c = kb.get(x, y);
  if (c.confirmedPit) return 'confirmedPit';
  if (c.confirmedWumpus) return 'confirmedWumpus';
  if (c.possiblePit) return 'possiblePit';
  if (c.possibleWumpus) return 'possibleWumpus';
  if (kb.isSafe(x, y)) return c.visited ? 'safeVisited' : 'safeUnvisited';
  if (c.visited) return 'visitedUnknown';
  return 'unknown';
}

/** Full KB snapshot for debugging (no hidden world). */
export function captureDecisionState(kb, agent, percepts, prevAgent = null) {
  const visited = [];
  const safe = [];
  const possiblePits = [];
  const confirmedPits = [];
  const possibleWumpus = [];
  const confirmedWumpus = [];
  const unknown = [];

  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const k = `${x},${y}`;
      const cls = classifyCell(kb, x, y);
      if (kb.get(x, y).visited) visited.push(k);
      if (kb.isSafe(x, y)) safe.push(k);
      if (cls === 'possiblePit') possiblePits.push(k);
      if (cls === 'confirmedPit') confirmedPits.push(k);
      if (cls === 'possibleWumpus') possibleWumpus.push(k);
      if (cls === 'confirmedWumpus') confirmedWumpus.push(k);
      if (cls === 'unknown' || cls === 'visitedUnknown') unknown.push(k);
    }
  }

  const adjSafe = adjacentSafeUnvisited(kb, agent.x, agent.y);
  const safePath = PathFinder.nearestSafeUnvisited(kb, agent);
  const region = PathFinder.reachableSafeKeys(kb, agent);
  const frontiers = PathFinder.unknownFrontiers(kb, region);
  const riskPlan = PathFinder.bestRiskFrontier(kb, agent);

  const frontierAudit = frontiers.map((f) => {
    const c = kb.get(f.x, f.y);
    const approach = PathFinder.path(kb, agent, f.fromSafe);
    return {
      cell: `${f.x},${f.y}`,
      possiblePit: c.possiblePit,
      possibleWumpus: c.possibleWumpus,
      confirmedDanger: kb.isDanger(f.x, f.y),
      reachableViaSafe: Boolean(approach && approach.length),
      risk: PathFinder.riskScore(kb, f.x, f.y),
      rejectedBecause: kb.isDanger(f.x, f.y)
        ? 'confirmed hazard'
        : !approach
          ? 'no safe approach path'
          : 'candidate',
    };
  });

  const rejections = [];
  if (!adjSafe.length) {
    rejections.push('No adjacent known-safe unvisited neighbor.');
  }
  if (!safePath) {
    rejections.push('BFS found no reachable known-safe unvisited cell through safe cells.');
  }
  if (!frontiers.length) {
    rejections.push('No unknown frontier cell touches the reachable known-safe region.');
  } else if (!riskPlan) {
    rejections.push('Unknown frontiers exist but no safe approach path to any candidate.');
  }

  return {
    wumpusInconsistent: Boolean(kb.wumpusInconsistent),
    wumpusDead: Boolean(kb.wumpusDead),
    agent: { ...agent },
    previousAgent: prevAgent ? { ...prevAgent } : null,
    percepts: { ...percepts },
    visited,
    safe,
    possiblePits,
    confirmedPits,
    possibleWumpus,
    confirmedWumpus,
    unknown,
    adjacentSafeUnvisited: adjSafe,
    bfsSafeUnvisitedPath: safePath,
    reachableSafeCount: region.size,
    unknownFrontiers: frontiers.map((f) => ({ ...f, risk: PathFinder.riskScore(kb, f.x, f.y) })),
    frontierAudit,
    bestRiskFrontier: riskPlan,
    rejections,
    stuckTrigger:
      !adjSafe.length && !safePath && (!frontiers.length || !riskPlan)
        ? 'STUCK: no safe target and no valid risk-based frontier route'
        : null,
  };
}

export function logDecisionDiagnostics(state) {
  const line = (label, value) => console.log(`[Wumpus AI] ${label}:`, value);
  line('Agent', state.agent);
  line('Previous', state.previousAgent);
  line('Percepts', state.percepts);
  line('Visited', state.visited);
  line('SAFE (KB)', state.safe);
  line('Possible pits', state.possiblePits);
  line('Confirmed pits', state.confirmedPits);
  line('Possible Wumpus', state.possibleWumpus);
  line('Confirmed Wumpus', state.confirmedWumpus);
  line('Unknown', state.unknown);
  line('Adjacent safe unvisited', state.adjacentSafeUnvisited);
  line('BFS safe-unvisited path', state.bfsSafeUnvisitedPath);
  line('Unknown frontiers', state.unknownFrontiers);
  line('Frontier audit', state.frontierAudit);
  line('Best risk plan', state.bestRiskFrontier);
  line('Rejections', state.rejections);
  line('Stuck trigger', state.stuckTrigger);
}
