import { DIRECTIONS } from './constants.js';

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function inBounds(x, y, size) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function neighbors(x, y, size) {
  const result = [];
  for (const dir of Object.values(DIRECTIONS)) {
    const nx = x + dir.dx;
    const ny = y + dir.dy;
    if (inBounds(nx, ny, size)) {
      result.push({ x: nx, y: ny, direction: dir.name });
    }
  }
  return result;
}

export function directionFromTo(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';
  return null;
}

export function stepFromDirection(x, y, direction) {
  const map = {
    up: { x, y: y - 1 },
    down: { x, y: y + 1 },
    left: { x: x - 1, y },
    right: { x: x + 1, y },
  };
  return map[direction];
}
