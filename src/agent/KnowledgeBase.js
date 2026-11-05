import { cellKey, neighbors } from '../utils/coordinates.js';

export function createCellKnowledge() {
  return {
    visited: false,
    safe: false,
    pitSafe: false,
    wumpusSafe: false,
    possiblePit: false,
    confirmedPit: false,
    possibleWumpus: false,
    confirmedWumpus: false,
    goldDiscovered: false,
    lastInference: '',
  };
}

export class KnowledgeBase {
  constructor(size) {
    this.size = size;
    this.cells = new Map();
    this.wumpusCandidateKeys = [];
    this.hasGoldLocation = false;
    this.goldLocation = null;
    this.initialize();
  }

  initialize() {
    this.cells.clear();
    this.wumpusCandidateKeys = [];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        this.cells.set(cellKey(x, y), createCellKnowledge());
      }
    }
    this.markVisitedSafe(0, 0, 'Starting cell is safe after entry.');
  }

  get(x, y) {
    return this.cells.get(cellKey(x, y)) ?? createCellKnowledge();
  }

  isDefinitelySafe(x, y) {
    const c = this.get(x, y);
    if (c.confirmedPit || c.confirmedWumpus) return false;
    if (c.visited && c.safe) return true;
    if (c.pitSafe && c.wumpusSafe) return true;
    return c.safe;
  }

  isConfirmedDanger(x, y) {
    const c = this.get(x, y);
    return c.confirmedPit || c.confirmedWumpus;
  }

  isPossibleDanger(x, y) {
    const c = this.get(x, y);
    return (c.possiblePit || c.possibleWumpus) && !this.isConfirmedDanger(x, y);
  }

  markVisitedSafe(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell) return;
    cell.visited = true;
    cell.safe = true;
    cell.pitSafe = true;
    cell.wumpusSafe = true;
    cell.possiblePit = false;
    cell.possibleWumpus = false;
    cell.confirmedPit = false;
    cell.confirmedWumpus = false;
    cell.lastInference = reason;
  }

  markPitSafe(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell || cell.confirmedPit) return;
    cell.pitSafe = true;
    cell.possiblePit = false;
    if (cell.pitSafe && cell.wumpusSafe) cell.safe = true;
    cell.lastInference = reason;
  }

  markWumpusSafe(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell || cell.confirmedWumpus) return;
    cell.wumpusSafe = true;
    cell.possibleWumpus = false;
    if (cell.pitSafe && cell.wumpusSafe) cell.safe = true;
    cell.lastInference = reason;
  }

  markPossiblePit(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell || cell.pitSafe || cell.confirmedPit || cell.visited) return;
    cell.possiblePit = true;
    cell.safe = false;
    cell.lastInference = reason;
  }

  markPossibleWumpus(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell || cell.wumpusSafe || cell.confirmedWumpus || cell.visited) return;
    cell.possibleWumpus = true;
    cell.safe = false;
    cell.lastInference = reason;
  }

  markConfirmedPit(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell) return;
    cell.confirmedPit = true;
    cell.possiblePit = true;
    cell.safe = false;
    cell.lastInference = reason;
  }

  markConfirmedWumpus(x, y, reason) {
    const cell = this.cells.get(cellKey(x, y));
    if (!cell) return;
    cell.confirmedWumpus = true;
    cell.possibleWumpus = true;
    cell.safe = false;
    cell.lastInference = reason;
  }

  recordGoldAt(x, y) {
    this.hasGoldLocation = true;
    this.goldLocation = { x, y };
    const cell = this.cells.get(cellKey(x, y));
    if (cell) cell.goldDiscovered = true;
  }

  intersectWumpusCandidates(candidateSet) {
    const list = [...candidateSet];
    if (this.wumpusCandidateKeys.length === 0) {
      this.wumpusCandidateKeys = list;
      return;
    }
    const set = new Set(this.wumpusCandidateKeys);
    this.wumpusCandidateKeys = list.filter((k) => set.has(k));
  }

  clearWumpusCandidates() {
    this.wumpusCandidateKeys = [];
  }

  getSafeUnvisited() {
    const list = [];
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const c = this.get(x, y);
        if (!c.visited && this.isDefinitelySafe(x, y)) list.push({ x, y });
      }
    }
    return list;
  }

  getStats() {
    let safe = 0;
    let possible = 0;
    let confirmed = 0;
    let visited = 0;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const c = this.get(x, y);
        if (c.visited) visited += 1;
        if (this.isDefinitelySafe(x, y)) safe += 1;
        if (this.isPossibleDanger(x, y)) possible += 1;
        if (this.isConfirmedDanger(x, y)) confirmed += 1;
      }
    }
    const total = this.size * this.size;
    return {
      visited,
      safe,
      possible,
      confirmed,
      explorationPct: Math.round((visited / total) * 100),
    };
  }

  snapshot() {
    const cells = {};
    for (const [key, value] of this.cells.entries()) {
      cells[key] = { ...value };
    }
    return {
      size: this.size,
      cells,
      hasGoldLocation: this.hasGoldLocation,
      goldLocation: this.goldLocation ? { ...this.goldLocation } : null,
    };
  }
}

export function getUnknownRiskCells(kb) {
  const cells = [];
  for (let y = 0; y < kb.size; y += 1) {
    for (let x = 0; x < kb.size; x += 1) {
      const c = kb.get(x, y);
      if (c.visited || kb.isConfirmedDanger(x, y)) continue;
      if (kb.isDefinitelySafe(x, y)) continue;
      let risk = 0;
      if (c.possiblePit) risk += 2;
      if (c.possibleWumpus) risk += 3;
      if (!c.pitSafe) risk += 1;
      if (!c.wumpusSafe) risk += 1;
      cells.push({ x, y, risk });
    }
  }
  cells.sort((a, b) => a.risk - b.risk || a.y - b.y || a.x - b.x);
  return cells;
}

export function getAdjacentSafeUnvisited(kb, x, y) {
  return neighbors(x, y, kb.size).filter(
    (n) => !kb.get(n.x, n.y).visited && kb.isDefinitelySafe(n.x, n.y),
  );
}
