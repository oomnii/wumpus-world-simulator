import { cellKey, neighbors } from './shared.js';

function blank() {
  return {
    visited: false,
    safe: false,
    pitSafe: false,
    wumpusSafe: false,
    possiblePit: false,
    confirmedPit: false,
    possibleWumpus: false,
    confirmedWumpus: false,
    goldKnown: false,
    observedBreeze: null,
    observedStench: null,
    note: '',
  };
}

export class KnowledgeBase {
  constructor(size) {
    this.size = size;
    this.cells = new Map();
    this.wumpusCandidates = [];
    this.goldAt = null;
    this.reset();
  }

  reset() {
    this.cells.clear();
    this.wumpusCandidates = [];
    this.goldAt = null;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        this.cells.set(cellKey(x, y), blank());
      }
    }
    this.markSafe(0, 0, 'Starting cell survived.');
  }

  get(x, y) {
    return this.cells.get(cellKey(x, y)) ?? blank();
  }

  isSafe(x, y) {
    const c = this.get(x, y);
    if (c.confirmedPit || c.confirmedWumpus) return false;
    if (c.possiblePit || c.possibleWumpus) return false;
    return (c.pitSafe && c.wumpusSafe) || (c.visited && c.safe);
  }

  isTraversable(x, y) {
    return !this.isDanger(x, y);
  }

  isDanger(x, y) {
    const c = this.get(x, y);
    return c.confirmedPit || c.confirmedWumpus;
  }

  markSafe(x, y, note) {
    const c = this.get(x, y);
    c.visited = true;
    c.safe = true;
    c.pitSafe = true;
    c.wumpusSafe = true;
    c.possiblePit = false;
    c.possibleWumpus = false;
    c.note = note;
  }

  markPitSafe(x, y, note) {
    const c = this.get(x, y);
    if (c.confirmedPit) return;
    c.pitSafe = true;
    c.possiblePit = false;
    if (c.confirmedWumpus) return;
    if (c.pitSafe && c.wumpusSafe) c.safe = true;
    c.note = note;
  }

  markWumpusSafe(x, y, note) {
    const c = this.get(x, y);
    if (c.confirmedWumpus) return;
    c.wumpusSafe = true;
    c.possibleWumpus = false;
    this.dropWumpusCandidate(x, y);
    if (c.confirmedPit) return;
    if (c.pitSafe && c.wumpusSafe) c.safe = true;
    c.note = note;
  }

  markPossiblePit(x, y, note) {
    const c = this.get(x, y);
    if (c.confirmedPit || c.visited) return;
    c.possiblePit = true;
    c.pitSafe = false;
    c.safe = false;
    c.note = note;
  }

  markPossibleWumpus(x, y, note) {
    const c = this.get(x, y);
    if (c.confirmedWumpus || c.visited) return;
    c.possibleWumpus = true;
    c.wumpusSafe = false;
    c.safe = false;
    c.note = note;
  }

  markConfirmedPit(x, y, note) {
    const c = this.get(x, y);
    if (c.visited || c.confirmedWumpus) return;
    c.confirmedPit = true;
    c.possiblePit = true;
    c.pitSafe = false;
    c.safe = false;
    c.possibleWumpus = false;
    c.wumpusSafe = true;
    c.note = note;
    this.dropWumpusCandidate(x, y);
  }

  markConfirmedWumpus(x, y, note) {
    const c = this.get(x, y);
    if (c.visited || c.confirmedPit) return;
    c.confirmedWumpus = true;
    c.possibleWumpus = true;
    c.wumpusSafe = false;
    c.possiblePit = false;
    c.pitSafe = true;
    c.safe = false;
    c.note = note;
    this.wumpusCandidates = [cellKey(x, y)];
  }

  setGold(x, y) {
    this.goldAt = { x, y };
    this.get(x, y).goldKnown = true;
  }

  intersectWumpus(set) {
    const list = [...set];
    if (!this.wumpusCandidates.length) {
      this.wumpusCandidates = list;
      return;
    }
    const prev = new Set(this.wumpusCandidates);
    const next = list.filter((k) => prev.has(k));
    if (next.length) this.wumpusCandidates = next;
  }

  dropWumpusCandidate(x, y) {
    const k = cellKey(x, y);
    this.wumpusCandidates = this.wumpusCandidates.filter((c) => c !== k);
  }

  pruneWumpusCandidates() {
    this.wumpusCandidates = this.wumpusCandidates.filter((k) => {
      const [x, y] = k.split(',').map(Number);
      const c = this.get(x, y);
      return !c.visited && !c.wumpusSafe && !c.confirmedPit;
    });
  }

  stenchObserved() {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.get(x, y).visited && this.get(x, y).observedStench === true) return true;
      }
    }
    return false;
  }

  /** Scream: living Wumpus is gone; the corpse square is enterable. */
  clearWumpus() {
    this.wumpusCandidates = [];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const c = this.get(x, y);
        c.confirmedWumpus = false;
        c.possibleWumpus = false;
        c.wumpusSafe = true;
        if (!c.confirmedPit && c.pitSafe) c.safe = true;
      }
    }
  }

  safeUnvisited() {
    const out = [];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const c = this.get(x, y);
        if (!c.visited && this.isSafe(x, y)) out.push({ x, y });
      }
    }
    return out;
  }

  stats() {
    let visited = 0;
    let safe = 0;
    let possible = 0;
    let confirmed = 0;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const c = this.get(x, y);
        if (c.visited) visited += 1;
        if (this.isSafe(x, y)) safe += 1;
        if ((c.possiblePit || c.possibleWumpus) && !this.isDanger(x, y)) possible += 1;
        if (this.isDanger(x, y)) confirmed += 1;
      }
    }
    const total = this.size * this.size;
    return { visited, safe, possible, confirmed, explore: Math.round((visited / total) * 100) };
  }

  snapshot() {
    const cells = {};
    this.cells.forEach((v, k) => {
      cells[k] = { ...v };
    });
    return { size: this.size, cells, goldAt: this.goldAt };
  }
}

export function adjacentSafeUnvisited(kb, x, y) {
  return neighbors(x, y, kb.size).filter((n) => !kb.get(n.x, n.y).visited && kb.isSafe(n.x, n.y));
}
