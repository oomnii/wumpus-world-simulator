import { describe, it, expect } from 'vitest';
import { computePercepts } from '../engine/PerceptEngine.js';

function world(overrides = {}) {
  return {
    size: 4,
    wumpus: { x: 2, y: 1 },
    wumpusAlive: true,
    pits: [{ x: 1, y: 2 }],
    gold: { x: 3, y: 3 },
    goldCollected: false,
    ...overrides,
  };
}

describe('PerceptEngine', () => {
  it('detects breeze near pit', () => {
    const p = computePercepts(world(), 1, 1);
    expect(p.breeze).toBe(true);
  });

  it('detects stench near wumpus', () => {
    const p = computePercepts(world(), 2, 0);
    expect(p.stench).toBe(true);
  });

  it('no diagonal stench', () => {
    const p = computePercepts(world(), 1, 0);
    expect(p.stench).toBe(false);
  });

  it('glitter on gold cell', () => {
    const p = computePercepts(world(), 3, 3);
    expect(p.glitter).toBe(true);
  });

  it('no stench when wumpus dead', () => {
    const p = computePercepts(world({ wumpusAlive: false }), 2, 0);
    expect(p.stench).toBe(false);
  });
});
