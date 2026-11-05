import { neighbors } from '../utils/coordinates.js';

export function computePercepts(world, x, y) {
  const pitSet = new Set(world.pits.map((p) => `${p.x},${p.y}`));
  let breeze = false;
  let stench = false;

  for (const n of neighbors(x, y, world.size)) {
    const key = `${n.x},${n.y}`;
    if (pitSet.has(key)) breeze = true;
    if (world.wumpusAlive && world.wumpus.x === n.x && world.wumpus.y === n.y) {
      stench = true;
    }
  }

  const glitter =
    !world.goldCollected && world.gold.x === x && world.gold.y === y;

  return {
    breeze,
    stench,
    glitter,
    scream: false,
    bump: false,
  };
}

export function mergePerceptEvents(base, events = {}) {
  return {
    ...base,
    scream: Boolean(events.scream),
    bump: Boolean(events.bump),
  };
}
