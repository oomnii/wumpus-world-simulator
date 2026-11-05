import { cellKey, inBounds, neighbors } from '../utils/coordinates.js';
import { createSeededRandom, randomInt, shuffle } from '../utils/seededRandom.js';
import { WORLD_GEN_MAX_RETRIES } from '../utils/constants.js';

function hiddenBfs(size, start, goal, isBlocked) {
  const queue = [{ ...start }];
  const visited = new Set([cellKey(start.x, start.y)]);
  const parent = new Map();

  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [cur];
      let k = cellKey(cur.x, cur.y);
      while (parent.has(k)) {
        const prev = parent.get(k);
        path.unshift(prev);
        k = cellKey(prev.x, prev.y);
      }
      return path;
    }
    for (const n of neighbors(cur.x, cur.y, size)) {
      const key = cellKey(n.x, n.y);
      if (visited.has(key) || isBlocked(n.x, n.y)) continue;
      visited.add(key);
      parent.set(key, cur);
      queue.push(n);
    }
  }
  return null;
}

function isWorldSolvable(size, wumpus, pits, gold) {
  const pitSet = new Set(pits.map((p) => cellKey(p.x, p.y)));
  const blocked = (x, y) => {
    if (pitSet.has(cellKey(x, y))) return true;
    if (wumpus.x === x && wumpus.y === y) return true;
    return false;
  };
  const start = { x: 0, y: 0 };
  const toGold = hiddenBfs(size, start, gold, blocked);
  if (!toGold) return false;
  const home = hiddenBfs(size, gold, start, blocked);
  return Boolean(home);
}

function buildFallbackWorld(size, pitDensity, rng) {
  const path = [{ x: 0, y: 0 }];
  let cx = 0;
  let cy = 0;
  const pathSet = new Set([cellKey(0, 0)]);

  while (path.length < size * 2 && path.length < size * size) {
    const options = neighbors(cx, cy, size).filter((n) => !pathSet.has(cellKey(n.x, n.y)));
    if (!options.length) break;
    const next = options[randomInt(rng, 0, options.length - 1)];
    path.push({ x: next.x, y: next.y });
    pathSet.add(cellKey(next.x, next.y));
    cx = next.x;
    cy = next.y;
  }

  const goldCandidates = path.filter((p) => !(p.x === 0 && p.y === 0));
  const gold = goldCandidates.length
    ? goldCandidates[randomInt(rng, 0, goldCandidates.length - 1)]
    : { x: size - 1, y: size - 1 };

  const freeCells = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (x === 0 && y === 0) continue;
      if (x === gold.x && y === gold.y) continue;
      if (!pathSet.has(cellKey(x, y))) freeCells.push({ x, y });
    }
  }

  const shuffled = shuffle(rng, freeCells);
  const wumpus = shuffled[0] || { x: size - 1, y: 0 };

  const availableForPits = shuffled.slice(1);
  const pitTarget = Math.floor((size * size - 1) * (pitDensity / 100));
  const pits = availableForPits.slice(0, Math.max(0, pitTarget));

  return {
    size,
    wumpus,
    pits,
    gold,
    usedFallback: true,
  };
}

function isStartArea(x, y, includeNeighbors) {
  if (x === 0 && y === 0) return true;
  if (!includeNeighbors) return false;
  return (x === 1 && y === 0) || (x === 0 && y === 1);
}

function generateRandomWorld(size, pitDensity, rng) {
  const freeForHazards = [];
  const freeForGold = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isStartArea(x, y, false)) continue;
      freeForGold.push({ x, y });
      if (!isStartArea(x, y, true)) freeForHazards.push({ x, y });
    }
  }
  const shuffledH = shuffle(rng, freeForHazards);
  const shuffledGold = shuffle(rng, freeForGold);
  const wumpus = shuffledH[0];
  const gold = shuffledGold[0];
  const pitCount = Math.floor((size * size - 1) * (pitDensity / 100));
  const pits = shuffledH.slice(1, 1 + pitCount);

  return { size, wumpus, pits, gold, usedFallback: false };
}

export function generateWorld({ size, pitDensity, seed }) {
  const rng = seed !== undefined && seed !== null && String(seed).trim() !== ''
    ? createSeededRandom(String(seed).trim())
    : createSeededRandom(String(Date.now()) + Math.random());

  for (let attempt = 0; attempt < WORLD_GEN_MAX_RETRIES; attempt += 1) {
    const world = generateRandomWorld(size, pitDensity, rng);
    if (isWorldSolvable(size, world.wumpus, world.pits, world.gold)) {
      return { ...world, generationNote: attempt > 0 ? `Regenerated ${attempt + 1} times` : 'Random generation' };
    }
  }

  const fallback = buildFallbackWorld(size, pitDensity, rng);
  return {
    ...fallback,
    generationNote: 'Used constrained fallback generator after failed solvability checks',
  };
}

export function validateWorldStructure(world) {
  const { size, wumpus, pits, gold } = world;
  if (!inBounds(wumpus.x, wumpus.y, size)) return false;
  if (!inBounds(gold.x, gold.y, size)) return false;
  if (wumpus.x === 0 && wumpus.y === 0) return false;
  if (gold.x === 0 && gold.y === 0) return false;
  const pitKeys = new Set();
  for (const p of pits) {
    if (!inBounds(p.x, p.y, size)) return false;
    if (p.x === 0 && p.y === 0) return false;
    const k = cellKey(p.x, p.y);
    if (pitKeys.has(k)) return false;
    pitKeys.add(k);
    if (p.x === wumpus.x && p.y === wumpus.y) return false;
    if (p.x === gold.x && p.y === gold.y) return false;
  }
  if (wumpus.x === gold.x && wumpus.y === gold.y) return false;
  return true;
}
