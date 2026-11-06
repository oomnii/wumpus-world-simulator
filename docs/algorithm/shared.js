/** Shared constants and helpers (no DOM). */

export const FACING = { N: 0, E: 1, S: 2, W: 3 };
export const FACING_DELTA = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];
export const FACING_NAME = ['N', 'E', 'S', 'W'];

export const ACTION = {
  TURN_LEFT: 'TURN_LEFT',
  TURN_RIGHT: 'TURN_RIGHT',
  MOVE_FORWARD: 'MOVE_FORWARD',
  MOVE_UP: 'MOVE_UP',
  MOVE_DOWN: 'MOVE_DOWN',
  MOVE_LEFT: 'MOVE_LEFT',
  MOVE_RIGHT: 'MOVE_RIGHT',
  SHOOT: 'SHOOT',
  GRAB: 'GRAB',
  CLIMB: 'CLIMB',
};

export const MOVE_ACTIONS = new Set([
  ACTION.MOVE_FORWARD,
  ACTION.MOVE_UP,
  ACTION.MOVE_DOWN,
  ACTION.MOVE_LEFT,
  ACTION.MOVE_RIGHT,
]);

export const STATUS = { PLAYING: 'playing', WON: 'won', LOST: 'lost', STUCK: 'stuck' };
export const MODE = { AI: 'ai', MANUAL: 'manual' };

export const SCORE = { ACTION: -1, GOLD: 1000, SHOOT: -10, EXIT: 1000, DEATH: -1000 };
export const AI_STAGE = {
  OBSERVE: 'OBSERVE',
  UPDATE: 'UPDATE KNOWLEDGE',
  INFER: 'INFER',
  DECIDE: 'DECIDE',
  EXECUTE: 'EXECUTE',
  IDLE: 'IDLE',
};
export const SPEEDS = [
  { label: '0.25s', ms: 250 },
  { label: '0.5s', ms: 500 },
  { label: '1s', ms: 1000 },
  { label: '2s', ms: 2000 },
];
export const HISTORY_KEY = 'wumpus_history_v3';
export const GEN_RETRIES = 80;

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function inBounds(x, y, size) {
  return x >= 0 && y >= 0 && x < size && y < size;
}

export function neighbors(x, y, size) {
  const out = [];
  if (inBounds(x + 1, y, size)) out.push({ x: x + 1, y });
  if (inBounds(x - 1, y, size)) out.push({ x: x - 1, y });
  if (inBounds(x, y + 1, size)) out.push({ x, y: y + 1 });
  if (inBounds(x, y - 1, size)) out.push({ x, y: y - 1 });
  return out;
}

export function facingBetween(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return FACING.E;
  if (dx === -1 && dy === 0) return FACING.W;
  if (dy === 1 && dx === 0) return FACING.S;
  if (dy === -1 && dx === 0) return FACING.N;
  return null;
}

/** Facing from `from` to `to` when they share a row or column (any distance). */
export function lineFacing(from, to) {
  if (from.x === to.x && from.y !== to.y) return from.y > to.y ? FACING.N : FACING.S;
  if (from.y === to.y && from.x !== to.x) return from.x > to.x ? FACING.W : FACING.E;
  return null;
}

export function turnSteps(from, to) {
  if (from === to) return [];
  const left = (from + 3) % 4;
  const right = (from + 1) % 4;
  if (to === left) return [ACTION.TURN_LEFT];
  if (to === right) return [ACTION.TURN_RIGHT];
  return [ACTION.TURN_LEFT, ACTION.TURN_LEFT];
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
