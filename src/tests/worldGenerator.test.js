import { describe, it, expect } from 'vitest';
import { generateWorld, validateWorldStructure } from '../engine/WorldGenerator.js';
import { GRID_SIZES } from '../utils/constants.js';

describe('WorldGenerator', () => {
  it.each(GRID_SIZES)('generates valid %i×%i world', (size) => {
    const world = generateWorld({ size, pitDensity: 20, seed: `grid-${size}` });
    expect(validateWorldStructure(world)).toBe(true);
    expect(world.wumpus).toBeTruthy();
    expect(world.gold).toBeTruthy();
    expect(world.wumpus.x !== 0 || world.wumpus.y !== 0).toBe(true);
    expect(world.gold.x !== 0 || world.gold.y !== 0).toBe(true);
  });

  it('has exactly one wumpus and one gold', () => {
    const world = generateWorld({ size: 6, pitDensity: 25, seed: 'one-each' });
    expect(world.wumpus).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(world.gold).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
  });

  it('respects pit density approximately', () => {
    const world = generateWorld({ size: 10, pitDensity: 30, seed: 'pits' });
    const expected = Math.floor(99 * 0.3);
    expect(world.pits.length).toBe(expected);
  });

  it('seed reproducibility', () => {
    const a = generateWorld({ size: 8, pitDensity: 20, seed: 'repeat-me' });
    const b = generateWorld({ size: 8, pitDensity: 20, seed: 'repeat-me' });
    expect(a).toEqual(b);
  });

  it('different seeds differ', () => {
    const a = generateWorld({ size: 8, pitDensity: 20, seed: 'a' });
    const b = generateWorld({ size: 8, pitDensity: 20, seed: 'b' });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it('starting cell is never occupied', () => {
    const world = generateWorld({ size: 7, pitDensity: 35, seed: 'safe-start' });
    expect(world.wumpus.x === 0 && world.wumpus.y === 0).toBe(false);
    expect(world.gold.x === 0 && world.gold.y === 0).toBe(false);
    expect(world.pits.some((p) => p.x === 0 && p.y === 0)).toBe(false);
  });
});
