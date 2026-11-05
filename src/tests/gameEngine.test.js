import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../engine/GameState.js';
import { WorldEngine } from '../engine/WorldEngine.js';
import { GAME_STATUS } from '../utils/constants.js';

describe('WorldEngine', () => {
  it('starting cell has no pit or wumpus', () => {
    const state = createInitialGameState({ size: 5, pitDensity: 20, seed: 'engine-1' });
    expect(state.pits.some((p) => p.x === 0 && p.y === 0)).toBe(false);
    expect(state.wumpus.x === 0 && state.wumpus.y === 0).toBe(false);
    const engine = new WorldEngine(state);
    const p = engine.getCurrentPercepts();
    expect(p.breeze).toBe(false);
    expect(p.stench).toBe(false);
  });

  it('bump at boundary does not move agent', () => {
    const state = createInitialGameState({ size: 4, pitDensity: 10, seed: 'bump' });
    const engine = new WorldEngine(state);
    engine.move('left');
    expect(state.agent).toEqual({ x: 0, y: 0 });
    expect(engine.getCurrentPercepts().bump).toBe(true);
  });

  it('arrow kills wumpus and scream percept', () => {
    const state = createInitialGameState({ size: 4, pitDensity: 5, seed: 'arrow-test' });
    state.wumpus = { x: 2, y: 0 };
    state.agent = { x: 0, y: 0 };
    const engine = new WorldEngine(state);
    const res = engine.shoot('right');
    expect(res.hit).toBe(true);
    expect(state.wumpusAlive).toBe(false);
    expect(engine.getCurrentPercepts().scream).toBe(true);
  });
});

describe('Scoring', () => {
  it('applies death penalty once', () => {
    const state = createInitialGameState({ size: 4, pitDensity: 40, seed: 'death-score' });
    state.pits = [{ x: 1, y: 0 }];
    state.agent = { x: 0, y: 0 };
    const engine = new WorldEngine(state);
    engine.move('right');
    expect(state.status).toBe(GAME_STATUS.LOST);
    expect(state.scoring.getScore()).toBeLessThan(0);
  });
});
