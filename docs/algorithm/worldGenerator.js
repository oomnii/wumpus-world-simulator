import { cellKey, inBounds, neighbors, shuffle, GEN_RETRIES } from './shared.js';

function hiddenBfs(size, start, goal, blocked) {
  const q = [{ ...start }];
  const seen = new Set([cellKey(start.x, start.y)]);
  const parent = new Map();
  while (q.length) {
    const cur = q.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [cur];
      let k = cellKey(cur.x, cur.y);
      while (parent.has(k)) {
        const p = parent.get(k);
        path.unshift(p);
        k = cellKey(p.x, p.y);
      }
      return path;
    }
    for (const n of neighbors(cur.x, cur.y, size)) {
      const k = cellKey(n.x, n.y);
      if (seen.has(k) || blocked(n.x, n.y)) continue;
      seen.add(k);
      parent.set(k, cur);
      q.push(n);
    }
  }
  return null;
}

function isSolvable(size, wumpus, pits, gold) {
  const pitsSet = new Set(pits.map((p) => cellKey(p.x, p.y)));
  const blocked = (x, y) =>
    pitsSet.has(cellKey(x, y)) || (wumpus.x === x && wumpus.y === y);
  const start = { x: 0, y: 0 };
  return (
    hiddenBfs(size, start, gold, blocked) &&
    hiddenBfs(size, gold, start, blocked)
  );
}

function isStartArea(x, y, includeNeighbors) {
  if (x === 0 && y === 0) return true;
  if (!includeNeighbors) return false;
  return (x === 1 && y === 0) || (x === 0 && y === 1);
}

function fallbackWorld(size, pitDensity) {
  const path = [{ x: 0, y: 0 }];
  let cx = 0;
  let cy = 0;
  const pathSet = new Set(['0,0']);
  while (path.length < size * 2) {
    const opts = neighbors(cx, cy, size).filter((n) => !pathSet.has(cellKey(n.x, n.y)));
    if (!opts.length) break;
    const n = opts[Math.floor(Math.random() * opts.length)];
    path.push(n);
    pathSet.add(cellKey(n.x, n.y));
    cx = n.x;
    cy = n.y;
  }
  const goldOpts = path.filter((p) => p.x || p.y);
  const gold = goldOpts[Math.floor(Math.random() * goldOpts.length)] || { x: size - 1, y: size - 1 };
  const free = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isStartArea(x, y, false) || (x === gold.x && y === gold.y)) continue;
      if (!pathSet.has(cellKey(x, y))) free.push({ x, y });
    }
  }
  const sh = shuffle(free);
  const wumpus = sh[0] || { x: size - 1, y: 0 };
  const pitN = Math.floor((size * size - 1) * (pitDensity / 100));
  const pits = sh.slice(1, 1 + pitN);
  return { wumpus, pits, gold, note: 'Fallback generator used' };
}

function randomWorld(size, pitDensity) {
  const hazardCells = [];
  const goldCells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isStartArea(x, y, false)) continue;
      goldCells.push({ x, y });
      if (!isStartArea(x, y, true)) hazardCells.push({ x, y });
    }
  }
  const h = shuffle(hazardCells);
  const g = shuffle(goldCells);
  const wumpus = h[0];
  const gold = g[0];
  const pitN = Math.floor((size * size - 1) * (pitDensity / 100));
  const pits = h.slice(1, 1 + pitN);
  return { wumpus, pits, gold, note: 'Random generation' };
}

export function generateWorld({ size, pitDensity }) {
  for (let i = 0; i < GEN_RETRIES; i += 1) {
    const w = randomWorld(size, pitDensity);
    if (isSolvable(size, w.wumpus, w.pits, w.gold)) {
      return { size, ...w, note: i ? `Regenerated ${i + 1} times` : w.note };
    }
  }
  const f = fallbackWorld(size, pitDensity);
  return { size, ...f };
}

export function validateWorld(world) {
  const { size, wumpus, pits, gold } = world;
  if (!inBounds(wumpus.x, wumpus.y, size)) return false;
  if (!inBounds(gold.x, gold.y, size)) return false;
  if (wumpus.x === 0 && wumpus.y === 0) return false;
  if (gold.x === 0 && gold.y === 0) return false;
  const used = new Set();
  for (const p of pits) {
    const k = cellKey(p.x, p.y);
    if (used.has(k) || !inBounds(p.x, p.y, size)) return false;
    if (p.x === 0 && p.y === 0) return false;
    used.add(k);
  }
  return true;
}
