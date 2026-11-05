import { cellKey, neighbors } from '../utils/coordinates.js';

function wumpusCandidateSet(kb, x, y) {
  return new Set(
    neighbors(x, y, kb.size)
      .filter((n) => !kb.get(n.x, n.y).wumpusSafe)
      .map((n) => cellKey(n.x, n.y)),
  );
}

function breezeUnknownNeighbors(kb, x, y) {
  return neighbors(x, y, kb.size).filter((n) => {
    const c = kb.get(n.x, n.y);
    return !c.pitSafe && !c.confirmedPit && !c.visited;
  });
}

export class InferenceEngine {
  run(kb, x, y, percepts, log) {
    const entries = [];
    const step = log?.step ?? 0;

    if (percepts.glitter) {
      kb.recordGoldAt(x, y);
      entries.push({
        type: 'gold',
        text: `[Step ${String(step).padStart(2, '0')}] Glitter detected — gold is in cell (${x},${y}).`,
      });
    }

    if (!percepts.breeze) {
      for (const n of neighbors(x, y, kb.size)) {
        kb.markPitSafe(
          n.x,
          n.y,
          `No Breeze at (${x},${y}) → no pit at (${n.x},${n.y}).`,
        );
        entries.push({
          type: 'safe',
          text: `[Step ${String(step).padStart(2, '0')}] Inference: (${n.x},${n.y}) pit-safe (no Breeze at (${x},${y})).`,
        });
      }
    } else {
      const unknown = breezeUnknownNeighbors(kb, x, y);
      for (const n of unknown) {
        kb.markPossiblePit(
          n.x,
          n.y,
          `Breeze at (${x},${y}) → adjacent pit possible.`,
        );
      }
      if (unknown.length === 1) {
        const n = unknown[0];
        kb.markConfirmedPit(n.x, n.y, `Single pit candidate for Breeze at (${x},${y}).`);
        entries.push({
          type: 'danger',
          text: `[Step ${String(step).padStart(2, '0')}] Inference: Pit confirmed at (${n.x},${n.y}).`,
        });
      } else if (unknown.length > 0) {
        entries.push({
          type: 'warning',
          text: `[Step ${String(step).padStart(2, '0')}] Inference: Breeze at (${x},${y}) — at least one adjacent pit possible.`,
        });
      }
    }

    if (!percepts.stench) {
      for (const n of neighbors(x, y, kb.size)) {
        kb.markWumpusSafe(
          n.x,
          n.y,
          `No Stench at (${x},${y}) → no living Wumpus at (${n.x},${n.y}).`,
        );
        entries.push({
          type: 'safe',
          text: `[Step ${String(step).padStart(2, '0')}] Inference: (${n.x},${n.y}) Wumpus-safe (no Stench at (${x},${y})).`,
        });
      }
    } else {
      const set = wumpusCandidateSet(kb, x, y);
      kb.intersectWumpusCandidates(set);
      for (const key of set) {
        const [cx, cy] = key.split(',').map(Number);
        kb.markPossibleWumpus(cx, cy, `Stench at (${x},${y}).`);
      }
      entries.push({
        type: 'warning',
        text: `[Step ${String(step).padStart(2, '0')}] Inference: Stench at (${x},${y}) — Wumpus may be adjacent.`,
      });
    }

    this.refineWumpusCandidates(kb, entries, step);

    if (!percepts.breeze && !percepts.stench) {
      for (const n of neighbors(x, y, kb.size)) {
        if (kb.isDefinitelySafe(n.x, n.y)) {
          entries.push({
            type: 'safe',
            text: `[Step ${String(step).padStart(2, '0')}] Inference: (${n.x},${n.y}) safe from pits and Wumpus.`,
          });
        }
      }
    }

    if (percepts.scream) {
      for (let yy = 0; yy < kb.size; yy += 1) {
        for (let xx = 0; xx < kb.size; xx += 1) {
          kb.markWumpusSafe(xx, yy, 'Scream — Wumpus dead.');
        }
      }
      kb.clearWumpusCandidates();
      entries.push({
        type: 'safe',
        text: `[Step ${String(step).padStart(2, '0')}] Inference: Scream — Wumpus eliminated.`,
      });
    }

    if (log) {
      for (const e of entries) log.add(e.text, e.type);
    }

    return entries;
  }

  refineWumpusCandidates(kb, entries, step) {
    if (!kb.wumpusCandidateKeys || kb.wumpusCandidateKeys.length === 0) return;
    if (kb.wumpusCandidateKeys.length === 1) {
      const [key] = kb.wumpusCandidateKeys;
      const [cx, cy] = key.split(',').map(Number);
      kb.markConfirmedWumpus(cx, cy, 'Only remaining Wumpus candidate.');
      entries.push({
        type: 'danger',
        text: `[Step ${String(step).padStart(2, '0')}] Inference: Wumpus confirmed at (${cx},${cy}).`,
      });
    }
  }
}

export function observePerceptSentence(percepts) {
  const parts = [];
  parts.push(percepts.breeze ? 'Breeze' : 'No Breeze');
  parts.push(percepts.stench ? 'Stench' : 'No Stench');
  parts.push(percepts.glitter ? 'Glitter' : 'No Glitter');
  if (percepts.scream) parts.push('Scream');
  if (percepts.bump) parts.push('Bump');
  return parts.join(', ');
}
