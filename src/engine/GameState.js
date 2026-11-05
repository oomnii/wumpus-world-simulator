import { GAME_STATUS } from '../utils/constants.js';
import { generateWorld } from './WorldGenerator.js';
import { ScoringSystem } from './ScoringSystem.js';

export function createInitialGameState(config = {}) {
  const size = config.size ?? 10;
  const pitDensity = config.pitDensity ?? 25;
  const seed = config.seed;
  const worldData = generateWorld({ size, pitDensity, seed });

  return {
    size,
    pitDensity,
    seed: seed ?? '',
    generationNote: worldData.generationNote,
    usedFallback: worldData.usedFallback ?? false,
    wumpus: { ...worldData.wumpus },
    wumpusAlive: true,
    pits: worldData.pits.map((p) => ({ ...p })),
    gold: { ...worldData.gold },
    goldCollected: false,
    agent: { x: 0, y: 0 },
    arrowRemaining: 1,
    arrowsUsed: 0,
    steps: 0,
    moves: 0,
    cellsVisited: 1,
    visitedKeys: new Set(['0,0']),
    revealedKeys: new Set(['0,0']),
    status: GAME_STATUS.PLAYING,
    deathReason: null,
    endReason: null,
    hasClimbed: false,
    scoring: new ScoringSystem(),
    screamPending: false,
    bumpPending: false,
    debugReveal: false,
    mode: config.mode ?? 'ai',
    actionIndex: 0,
  };
}
