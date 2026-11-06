import { cellKey, inBounds, neighbors, FACING_DELTA } from './shared.js';
import {
  breezyVisitedCells,
  cleanupStalePossiblePits,
  pitLocationCandidates,
  validateKnowledgeBase,
} from './knowledgeConsistency.js';

function wumpusCandidateNeighbors(kb, x, y) {
  return neighbors(x, y, kb.size).filter((n) => {
    const c = kb.get(n.x, n.y);
    return !c.wumpusSafe && !c.confirmedWumpus && !c.visited && !c.confirmedPit;
  });
}

/** Arrow flew this facing and did not scream — no living Wumpus on the ray. */
export function applyArrowMiss(kb, agent) {
  const d = FACING_DELTA[agent.facing];
  let x = agent.x + d.dx;
  let y = agent.y + d.dy;
  while (inBounds(x, y, kb.size)) {
    kb.markWumpusSafe(x, y, 'Arrow missed — no living Wumpus on this ray');
    x += d.dx;
    y += d.dy;
  }
  kb.pruneWumpusCandidates();
}

export class InferenceEngine {
  infer(kb, x, y, p, log, step) {
    const pad = String(step).padStart(2, '0');
    const L = (t, type = 'neutral') => log(t, type);

    const here = kb.get(x, y);
    here.observedBreeze = p.breeze;
    here.observedStench = p.scream ? false : p.stench;

    if (p.scream) {
      kb.clearWumpus();
      L(`[Step ${pad}] Scream — Wumpus dead; all cells Wumpus-safe.`, 'safe');
    }

    if (p.glitter) {
      kb.setGold(x, y);
      L(`[Step ${pad}] Glitter — gold at (${x},${y}).`, 'gold');
    }

    if (!p.breeze) {
      for (const n of neighbors(x, y, kb.size)) {
        kb.markPitSafe(n.x, n.y, `No breeze at (${x},${y})`);
      }
      L(`[Step ${pad}] No Breeze — adjacent cells cannot contain pits (from this cell).`, 'safe');
    } else {
      const explained = neighbors(x, y, kb.size).some((n) => kb.get(n.x, n.y).confirmedPit);
      const cand = pitLocationCandidates(kb, x, y);
      if (explained) {
        L(`[Step ${pad}] Breeze already explained by a confirmed pit; other neighbors stay unforced.`, 'safe');
      } else {
        cand.forEach((n) => kb.markPossiblePit(n.x, n.y, `Breeze at (${x},${y})`));
        if (cand.length === 1) {
          kb.markConfirmedPit(cand[0].x, cand[0].y, 'Only pit location candidate for this breeze');
          L(`[Step ${pad}] Pit confirmed at (${cand[0].x},${cand[0].y}) — sole candidate.`, 'danger');
        } else if (cand.length) {
          L(`[Step ${pad}] Breeze — ${cand.length} possible pit location(s).`, 'warn');
        } else {
          L(`[Step ${pad}] Breeze but no pit candidates (KB inconsistency).`, 'danger');
        }
      }
    }

    if (!p.scream) {
      if (!p.stench) {
        for (const n of neighbors(x, y, kb.size)) {
          kb.markWumpusSafe(n.x, n.y, `No stench at (${x},${y})`);
        }
        L(`[Step ${pad}] No Stench — adjacent cells ruled out as living Wumpus.`, 'safe');
      } else {
        const cand = wumpusCandidateNeighbors(kb, x, y);
        const set = new Set(cand.map((n) => cellKey(n.x, n.y)));
        const consistent = kb.intersectWumpus(set);
        if (!consistent) {
          for (const n of neighbors(x, y, kb.size)) {
            kb.reopenWumpusPossibility(n.x, n.y, `Contradictory stench at (${x},${y})`);
          }
          L(
            `[Step ${pad}] Stench contradicts the living-Wumpus candidate set — knowledge inconsistent.`,
            'danger',
          );
        } else {
          cand.forEach((n) => kb.markPossibleWumpus(n.x, n.y, `Stench at (${x},${y})`));
          L(`[Step ${pad}] Stench — living Wumpus may be adjacent.`, 'warn');
        }
      }
    }

    this.resolvePits(kb, L, pad);
    this.resolveWumpus(kb, L, pad);

    const issues = validateKnowledgeBase(kb);
    issues.forEach((msg) => L(`[Step ${pad}] KB check: ${msg}`, 'danger'));
  }

  /**
   * Confirm a pit only when a breezy cell has exactly ONE remaining candidate.
   * Repeat to a fixpoint (new confirms can unit-propagate other breezes).
   */
  resolvePits(kb, L, pad) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of breezyVisitedCells(kb)) {
        if (neighbors(b.x, b.y, kb.size).some((n) => kb.get(n.x, n.y).confirmedPit)) continue;
        const cand = pitLocationCandidates(kb, b.x, b.y);
        if (cand.length === 1) {
          const { x, y } = cand[0];
          if (!kb.get(x, y).confirmedPit) {
            kb.markConfirmedPit(x, y, `Sole pit candidate for breeze at (${b.x},${b.y})`);
            L(`[Step ${pad}] Pit confirmed at (${x},${y}) from breeze at (${b.x},${b.y}).`, 'danger');
            changed = true;
          }
        }
      }
    }
    cleanupStalePossiblePits(kb);
  }

  /**
   * Exactly-one Wumpus: once stench localizes a candidate set, every other cell is Wumpus-safe.
   */
  resolveWumpus(kb, L, pad) {
    if (kb.wumpusDead) return;
    kb.pruneWumpusCandidates();
    if (kb.wumpusInconsistent) {
      L(
        `[Step ${pad}] KB inconsistent — refusing Wumpus-safe conclusions from the candidate set.`,
        'danger',
      );
      return;
    }
    if (kb.wumpusConstrained && kb.stenchObserved() && !kb.wumpusCandidates.length) {
      kb.wumpusInconsistent = true;
      kb.wumpusCandidates = [];
      L(
        `[Step ${pad}] Stench remains but no living-Wumpus candidate — knowledge inconsistent.`,
        'danger',
      );
      return;
    }
    if (!kb.stenchObserved() && !kb.wumpusCandidates.length) return;

    if (kb.wumpusCandidates.length === 1) {
      const [k] = kb.wumpusCandidates;
      const [cx, cy] = k.split(',').map(Number);
      if (!kb.get(cx, cy).confirmedWumpus) {
        kb.markConfirmedWumpus(cx, cy, 'Only living-Wumpus candidate');
        L(`[Step ${pad}] Wumpus confirmed at (${cx},${cy}).`, 'danger');
      }
    }

    const cand = new Set(kb.wumpusCandidates);
    if (!cand.size) return;

    for (let y = 0; y < kb.size; y += 1) {
      for (let x = 0; x < kb.size; x += 1) {
        const k = cellKey(x, y);
        if (cand.has(k)) {
          if (!kb.get(x, y).confirmedWumpus) {
            kb.markPossibleWumpus(x, y, 'Living-Wumpus candidate set');
          }
        } else {
          kb.markWumpusSafe(x, y, 'Exactly one Wumpus — outside candidate set');
        }
      }
    }
  }
}
