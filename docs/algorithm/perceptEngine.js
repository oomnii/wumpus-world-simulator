import { neighbors } from './shared.js';

export function getPercepts(world, x, y, extras = {}) {
  const pitSet = new Set(world.pits.map((p) => `${p.x},${p.y}`));
  let breeze = false;
  let stench = false;
  for (const n of neighbors(x, y, world.size)) {
    if (pitSet.has(`${n.x},${n.y}`)) breeze = true;
    if (world.wumpusAlive && world.wumpus.x === n.x && world.wumpus.y === n.y) stench = true;
  }
  const glitter = !world.goldCollected && world.gold.x === x && world.gold.y === y;
  return {
    breeze,
    stench,
    glitter,
    scream: Boolean(extras.scream),
    bump: Boolean(extras.bump),
  };
}

export function perceptText(p) {
  const parts = [
    p.breeze ? 'Breeze' : 'No Breeze',
    p.stench ? 'Stench' : 'No Stench',
    p.glitter ? 'Glitter' : 'No Glitter',
  ];
  if (p.scream) parts.push('Scream');
  if (p.bump) parts.push('Bump');
  return parts.join(', ');
}
