import { describe, it, expect } from 'vitest';
import { KnowledgeBase } from '../agent/KnowledgeBase.js';
import { InferenceEngine } from '../agent/InferenceEngine.js';

describe('InferenceEngine', () => {
  it('no breeze marks adjacent pit-safe', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    inf.run(kb, 0, 0, { breeze: false, stench: false, glitter: false, scream: false, bump: false });
    expect(kb.get(1, 0).pitSafe).toBe(true);
    expect(kb.get(0, 1).pitSafe).toBe(true);
  });

  it('breeze does not confirm all neighbors as pits', () => {
    const kb = new KnowledgeBase(4);
    kb.markVisitedSafe(1, 1, 'start');
    const inf = new InferenceEngine();
    inf.run(kb, 1, 1, { breeze: true, stench: false, glitter: false, scream: false, bump: false });
    const candidates = [
      kb.get(0, 1),
      kb.get(2, 1),
      kb.get(1, 0),
      kb.get(1, 2),
    ].filter((c) => c.possiblePit);
    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates.every((c) => c.confirmedPit)).toBe(false);
  });

  it('safe requires both pit and wumpus ruled out', () => {
    const kb = new KnowledgeBase(3);
    const inf = new InferenceEngine();
    inf.run(kb, 0, 0, { breeze: false, stench: true, glitter: false, scream: false, bump: false });
    expect(kb.isDefinitelySafe(1, 0)).toBe(false);
    inf.run(kb, 0, 0, { breeze: false, stench: false, glitter: false, scream: false, bump: false });
    expect(kb.isDefinitelySafe(1, 0)).toBe(true);
  });

  it('single wumpus candidate becomes confirmed', () => {
    const kb = new KnowledgeBase(4);
    kb.markVisitedSafe(1, 1, '');
    kb.markWumpusSafe(0, 1, '');
    kb.markWumpusSafe(2, 1, '');
    kb.markWumpusSafe(1, 0, '');
    const inf = new InferenceEngine();
    inf.run(kb, 1, 1, { breeze: false, stench: true, glitter: false, scream: false, bump: false });
    expect(kb.get(1, 2).confirmedWumpus).toBe(true);
  });
});
