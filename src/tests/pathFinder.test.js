import { describe, it, expect } from 'vitest';
import { KnowledgeBase } from '../agent/KnowledgeBase.js';
import { PathFinder } from '../agent/PathFinder.js';

describe('PathFinder', () => {
  it('finds shortest safe path', () => {
    const kb = new KnowledgeBase(4);
    kb.markVisitedSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    kb.markPitSafe(2, 0, '');
    kb.markWumpusSafe(2, 0, '');
    const path = PathFinder.bfsSafePath(kb, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });

  it('returns null when blocked', () => {
    const kb = new KnowledgeBase(3);
    kb.markVisitedSafe(0, 0, '');
    kb.markConfirmedPit(1, 0, '');
    const path = PathFinder.bfsSafePath(kb, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toBeNull();
  });

  it('does not traverse unknown cells', () => {
    const kb = new KnowledgeBase(3);
    kb.markVisitedSafe(0, 0, '');
    const path = PathFinder.bfsSafePath(kb, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toBeNull();
  });
});
