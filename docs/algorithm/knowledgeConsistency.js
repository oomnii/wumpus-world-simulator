import { cellKey, neighbors } from './shared.js';

/** Cells adjacent to (bx,by) that could still contain a pit. */
export function pitLocationCandidates(kb, bx, by) {
  return neighbors(bx, by, kb.size).filter((n) => {
    const c = kb.get(n.x, n.y);
    if (c.visited || c.pitSafe || c.confirmedPit) return false;
    return true;
  });
}

export function unsatisfiedBreezeGroups(kb) {
  const out = [];
  for (const b of breezyVisitedCells(kb)) {
    if (neighbors(b.x, b.y, kb.size).some((n) => kb.get(n.x, n.y).confirmedPit)) continue;
    const cand = pitLocationCandidates(kb, b.x, b.y);
    if (cand.length) out.push({ breeze: b, cand });
  }
  return out;
}

/** Smallest unsatisfied-breeze candidate-set that still lists this cell. */
export function minPitSupport(kb, x, y) {
  let min = Infinity;
  for (const { cand } of unsatisfiedBreezeGroups(kb)) {
    if (cand.some((n) => n.x === x && n.y === y)) min = Math.min(min, cand.length);
  }
  return min === Infinity ? null : min;
}

/**
 * A positive breeze only requires at least one adjacent pit.
 * Once a breeze is explained by a confirmed pit, other neighbors are not "possible pits"
 * unless some other unsatisfied breeze still lists them.
 */
export function cleanupStalePossiblePits(kb) {
  const active = new Set();
  for (const { cand } of unsatisfiedBreezeGroups(kb)) {
    for (const n of cand) active.add(cellKey(n.x, n.y));
  }
  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const c = kb.get(x, y);
      if (!c.possiblePit || c.confirmedPit || c.visited) continue;
      if (active.has(cellKey(x, y))) continue;
      c.possiblePit = false;
      if (c.pitSafe && c.wumpusSafe) c.safe = true;
      c.note = 'Pit flag cleared — no unsatisfied breeze still lists this cell.';
    }
  }
}

export function breezyVisitedCells(kb) {
  const out = [];
  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const c = kb.get(x, y);
      if (c.visited && c.observedBreeze === true) out.push({ x, y });
    }
  }
  return out;
}

/** Explain each confirmed pit from KB-only evidence. */
export function auditConfirmedPits(kb) {
  const reports = [];
  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const c = kb.get(x, y);
      if (!c.confirmedPit) continue;
      const contributors = [];
      for (const b of breezyVisitedCells(kb)) {
        const cand = pitLocationCandidates(kb, b.x, b.y);
        const inSet = cand.some((n) => n.x === x && n.y === y);
        if (inSet || cand.length === 1) {
          contributors.push({
            breezyAt: `${b.x},${b.y}`,
            candidatesAtAudit: cand.map((n) => `${n.x},${n.y}`),
            singleCandidate: cand.length === 1 && cand[0].x === x && cand[0].y === y,
          });
        }
      }
      const logicallyForced = contributors.some((t) => t.singleCandidate);
      reports.push({
        cell: `${x},${y}`,
        note: c.note,
        contributors,
        logicallyForced,
      });
    }
  }
  return reports;
}

export function validateKnowledgeBase(kb) {
  const issues = [];

  if (kb.wumpusInconsistent) {
    issues.push('Contradiction: living-Wumpus candidate intersection is empty.');
  }

  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const c = kb.get(x, y);
      if (c.visited && c.confirmedPit) {
        issues.push(`Contradiction: visited cell (${x},${y}) marked confirmed pit.`);
      }
      if (c.visited && c.confirmedWumpus) {
        issues.push(`Contradiction: visited cell (${x},${y}) marked confirmed Wumpus.`);
      }
      if (kb.isSafe(x, y) && c.confirmedPit) {
        issues.push(`Contradiction: (${x},${y}) is SAFE and confirmed pit.`);
      }
      if (kb.isSafe(x, y) && c.confirmedWumpus) {
        issues.push(`Contradiction: (${x},${y}) is SAFE and confirmed Wumpus.`);
      }
    }
  }

  for (const b of breezyVisitedCells(kb)) {
    const cand = pitLocationCandidates(kb, b.x, b.y);
    const satisfied = neighbors(b.x, b.y, kb.size).some((n) => kb.get(n.x, n.y).confirmedPit);
    if (cand.length === 0 && !satisfied) {
      issues.push(`Contradiction: breeze at (${b.x},${b.y}) but no pit location candidates remain.`);
    }
  }

  let livingWumpus = kb.wumpusCandidates.length > 0;
  if (!livingWumpus) {
    for (let y = 0; y < kb.size && !livingWumpus; y += 1) {
      for (let x = 0; x < kb.size; x += 1) {
        const c = kb.get(x, y);
        if (c.confirmedWumpus || c.possibleWumpus) {
          livingWumpus = true;
          break;
        }
      }
    }
  }
  if (livingWumpus) {
    for (let y = 0; y < kb.size; y += 1) {
      for (let x = 0; x < kb.size; x += 1) {
        const c = kb.get(x, y);
        if (c.visited && c.observedStench === true && kb.wumpusCandidates.length === 0 && !c.confirmedWumpus) {
          issues.push(`Warning: stench at (${x},${y}) but Wumpus candidate set is empty.`);
        }
      }
    }
  }

  return issues;
}

/** Compare KB to hidden world — test / debug only, never for AI decisions. */
export function evaluateKbAgainstWorld(kb, worldState) {
  const falseConfirmedPits = [];
  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      if (!kb.get(x, y).confirmedPit) continue;
      const hasPit = worldState.pits.some((p) => p.x === x && p.y === y);
      if (!hasPit) falseConfirmedPits.push(`${x},${y}`);
    }
  }
  return { falseConfirmedPits, kbIssues: validateKnowledgeBase(kb) };
}
