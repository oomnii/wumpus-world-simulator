import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateWorld, validateWorld } from '../docs/algorithm/worldGenerator.js';
import { createWorldState, WorldEngine } from '../docs/algorithm/worldEngine.js';
import { getPercepts } from '../docs/algorithm/perceptEngine.js';
import { KnowledgeBase } from '../docs/algorithm/knowledgeBase.js';
import { InferenceEngine } from '../docs/algorithm/inferenceEngine.js';
import { PathFinder } from '../docs/algorithm/pathFinder.js';
import { DecisionEngine, planMoves } from '../docs/algorithm/decisionEngine.js';
import { GameController } from '../docs/js/gameController.js';
import { evaluateKbAgainstWorld, validateKnowledgeBase } from '../docs/algorithm/knowledgeConsistency.js';
import { ACTION, FACING, SCORE, SPEEDS, STATUS } from '../docs/algorithm/shared.js';

function fixtureWorld(extra = {}) {
  return {
    size: 4,
    pitDensity: 10,
    wumpus: { x: 3, y: 3 },
    pits: [],
    gold: { x: 2, y: 2 },
    note: 'fixture',
    ...extra,
  };
}

describe('worldGenerator', () => {
  it('start cell has no adjacent hazards in generated world', () => {
    const w = generateWorld({ size: 8, pitDensity: 25 });
    const s = createWorldState(w);
    const eng = new WorldEngine(s);
    const p = eng.percepts();
    assert.equal(p.breeze, false);
    assert.equal(p.stench, false);
  });
  it('generates valid solvable worlds', () => {
    for (const size of [4, 6, 10]) {
      const w = generateWorld({ size, pitDensity: 20 });
      assert.equal(validateWorld(w), true);
      assert.notDeepEqual(w.wumpus, { x: 0, y: 0 });
      assert.notDeepEqual(w.gold, { x: 0, y: 0 });
    }
  });
});

describe('percepts', () => {
  it('breeze and stench adjacency', () => {
    const world = {
      size: 4,
      wumpus: { x: 2, y: 1 },
      wumpusAlive: true,
      pits: [{ x: 1, y: 2 }],
      gold: { x: 3, y: 3 },
      goldCollected: false,
    };
    assert.equal(getPercepts(world, 1, 1).breeze, true);
    assert.equal(getPercepts(world, 2, 0).stench, true);
    assert.equal(getPercepts(world, 1, 0).stench, false);
  });
});

describe('inference', () => {
  it('no breeze marks pit-safe neighbors', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    inf.infer(kb, 0, 0, { breeze: false, stench: false, glitter: false, scream: false, bump: false }, () => {}, 1);
    assert.equal(kb.get(1, 0).pitSafe, true);
  });
});

describe('pathFinder', () => {
  it('finds safe path', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    kb.markPitSafe(2, 0, '');
    kb.markWumpusSafe(2, 0, '');
    const p = PathFinder.path(kb, { x: 0, y: 0 }, { x: 2, y: 0 });
    assert.equal(p.length, 3);
  });
});

describe('decisionEngine', () => {
  it('grabs on glitter', () => {
    const kb = new KnowledgeBase(4);
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 1, y: 1, facing: FACING.E },
        percepts: { glitter: true, breeze: false, stench: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      1,
    );
    assert.equal(d.action, ACTION.GRAB);
  });
});

describe('worldEngine scoring', () => {
  it('bump percept on wall', () => {
    const s = createWorldState(fixtureWorld());
    s.agent = { x: 0, y: 0, facing: FACING.W };
    const eng = new WorldEngine(s);
    eng.moveForward();
    assert.equal(eng.percepts().bump, true);
    assert.equal(s.agent.x, 0);
  });
  it('victory climb adds exit score', () => {
    const s = createWorldState(fixtureWorld());
    s.agent = { x: 0, y: 0, facing: FACING.E };
    s.goldCollected = true;
    const eng = new WorldEngine(s);
    const before = s.score;
    eng.climb();
    assert.equal(s.status, STATUS.WON);
    assert.ok(s.score > before);
  });
  it('death applies penalty', () => {
    const s = createWorldState(fixtureWorld({ pits: [{ x: 1, y: 0 }] }));
    s.agent = { x: 0, y: 0, facing: FACING.E };
    const eng = new WorldEngine(s);
    eng.moveForward();
    assert.equal(s.status, STATUS.LOST);
    assert.ok(s.score < 0);
  });
});

describe('configuration', () => {
  it('default AI speed option includes 500ms', () => {
    assert.ok(SPEEDS.some((s) => s.ms === 500));
  });
});

describe('game end (manual win)', () => {
  it('Climb at start with gold sets won and calls onGameEnd', () => {
    let endStatus = null;
    const g = new GameController(() => {});
    g.onGameEnd = (view) => {
      endStatus = view.state.status;
    };
    g.newWorld({ size: 4, pitDensity: 10 });
    g.state.goldCollected = true;
    g.state.agent = { x: 0, y: 0, facing: FACING.E };
    g.execute(ACTION.CLIMB);
    assert.equal(g.state.status, STATUS.WON);
    assert.equal(endStatus, STATUS.WON);
  });

  it('moving onto start with gold auto-completes escape (won)', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 4, pitDensity: 10 });
    g.state.goldCollected = true;
    g.state.agent = { x: 1, y: 0, facing: FACING.W };
    g.state.visited.add('1,0');
    g.state.revealed.add('1,0');
    g.execute(ACTION.MOVE_LEFT);
    assert.equal(g.state.status, STATUS.WON);
    assert.equal(g.state.agent.x, 0);
    assert.equal(g.state.agent.y, 0);
  });
});

describe('planMoves', () => {
  it('turns then forward', () => {
    const acts = planMoves({ x: 0, y: 0, facing: FACING.N }, { x: 1, y: 0 });
    assert.ok(acts.includes(ACTION.MOVE_FORWARD));
  });
});

describe('inference extended', () => {
  it('no stench marks adjacent wumpus-safe', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    inf.infer(kb, 0, 0, { breeze: false, stench: false, glitter: false, scream: false, bump: false }, () => {}, 1);
    assert.equal(kb.get(1, 0).wumpusSafe, true);
  });
  it('breeze with multiple candidates does not confirm all neighbors', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(1, 0, '');
    const inf = new InferenceEngine();
    inf.infer(kb, 1, 0, { breeze: true, stench: false, glitter: false, scream: false, bump: false }, () => {}, 2);
    assert.equal(kb.get(0, 1).confirmedPit, false);
    assert.equal(kb.get(2, 1).confirmedPit, false);
  });
  it('confirms pit when only one location candidate remains for a breeze', () => {
    const kb = new KnowledgeBase(5);
    kb.markSafe(1, 0, '');
    kb.markSafe(3, 0, '');
    for (const key of ['0,1', '1,1', '3,1', '4,0', '2,1']) {
      const [x, y] = key.split(',').map(Number);
      kb.markPitSafe(x, y, '');
      kb.markWumpusSafe(x, y, '');
    }
    const inf = new InferenceEngine();
    inf.infer(kb, 1, 0, { breeze: true, stench: false, glitter: false, scream: false, bump: false }, () => {}, 1);
    inf.infer(kb, 3, 0, { breeze: true, stench: false, glitter: false, scream: false, bump: false }, () => {}, 2);
    assert.equal(kb.get(2, 0).confirmedPit, true);
  });
  it('does not confirm shared candidate from two breezes when each has multiple pits', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 1, '');
    kb.markSafe(2, 1, '');
    kb.markPitSafe(0, 0, '');
    kb.markPitSafe(2, 0, '');
    kb.markPitSafe(1, 2, '');
    kb.markWumpusSafe(0, 0, '');
    kb.markWumpusSafe(2, 0, '');
    kb.markWumpusSafe(1, 2, '');
    kb.get(0, 1).observedBreeze = true;
    kb.get(2, 1).observedBreeze = true;
    kb.markPossiblePit(1, 1, 'shared');
    kb.markPossiblePit(0, 2, 'left');
    kb.markPossiblePit(2, 2, 'right');
    const inf = new InferenceEngine();
    inf.resolvePits(kb, () => {}, '99');
    assert.equal(kb.get(1, 1).confirmedPit, false);
  });
});

describe('pathFinder safety', () => {
  it('path avoids non-safe cells', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    kb.markConfirmedPit(2, 0, '');
    const p = PathFinder.path(kb, { x: 0, y: 0 }, { x: 3, y: 0 });
    assert.equal(p, null);
  });
});

describe('decisionEngine safety', () => {
  it('prefers adjacent safe unvisited', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.E },
        percepts: { glitter: false, breeze: false, stench: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      1,
    );
    assert.ok(d.plan && d.plan.includes(ACTION.MOVE_FORWARD));
  });
  it('never steps into a possible pit while a safe unvisited cell exists', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    kb.markPossiblePit(0, 1, 'breeze');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.E },
        percepts: { glitter: false, breeze: false, stench: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      2,
    );
    assert.notEqual(d.stuck, true);
    assert.notEqual(d.risky, true);
    assert.ok(d.plan && d.plan.includes(ACTION.MOVE_FORWARD));
  });
  it('does not treat unknown as safe path target', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    const path = PathFinder.nearestSafeUnvisited(kb, { x: 0, y: 0 });
    assert.equal(path, null);
  });
  it('returns stuck when no safe or risk move', () => {
    const kb = new KnowledgeBase(3);
    kb.markSafe(0, 0, '');
    kb.markConfirmedPit(1, 0, '');
    kb.markConfirmedPit(0, 1, '');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.E },
        percepts: { breeze: true, stench: false, glitter: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      5,
    );
    assert.equal(d.stuck, true);
  });
});

describe('manual movement', () => {
  it('move right updates position', () => {
    const s = createWorldState(fixtureWorld());
    const eng = new WorldEngine(s);
    const r = eng.apply(ACTION.MOVE_RIGHT);
    assert.equal(r.ok, true);
    assert.equal(s.agent.x, 1);
    assert.equal(s.agent.facing, FACING.E);
  });
  it('move up bumps at north edge', () => {
    const s = createWorldState(fixtureWorld());
    const eng = new WorldEngine(s);
    eng.apply(ACTION.MOVE_UP);
    assert.equal(s.agent.y, 0);
    assert.equal(eng.percepts().bump, true);
  });
});

describe('pit regression', () => {
  it('AI avoids confirmed pit neighbor when safe alternative exists', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(0, 1, '');
    kb.markWumpusSafe(0, 1, '');
    kb.markConfirmedPit(1, 0, 'pit');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.E },
        percepts: { breeze: true, stench: false, glitter: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      2,
    );
    assert.notEqual(d.action, ACTION.MOVE_FORWARD);
    assert.notEqual(d.stuck, true);
  });
});

describe('frontier exploration', () => {
  it('BFS reaches safe unvisited beyond visited corridor', () => {
    const kb = new KnowledgeBase(5);
    for (const key of ['0,0', '1,0', '2,0', '2,1', '1,1']) {
      const [x, y] = key.split(',').map(Number);
      kb.markSafe(x, y, '');
    }
    kb.markPitSafe(3, 0, '');
    kb.markWumpusSafe(3, 0, '');
    const path = PathFinder.nearestSafeUnvisited(kb, { x: 1, y: 1 });
    assert.ok(path);
    assert.equal(path.at(-1).x, 3);
    assert.equal(path.at(-1).y, 0);
  });

  it('does not stuck when only reachable expansion is a risk frontier', () => {
    const kb = new KnowledgeBase(5);
    for (const key of ['0,0', '1,0', '2,0', '2,1', '1,1', '0,1']) {
      const [x, y] = key.split(',').map(Number);
      kb.markSafe(x, y, '');
    }
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 1, y: 1, facing: FACING.E },
        percepts: { breeze: false, stench: false, glitter: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      9,
    );
    assert.notEqual(d.stuck, true);
    assert.ok(d.action);
  });

  it('picks lowest-risk frontier when multiple exist', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    kb.markPossiblePit(1, 1, 'risky');
    kb.markWumpusSafe(0, 1, '');
    const plan = PathFinder.bestRiskFrontier(kb, { x: 0, y: 0 });
    assert.ok(plan);
    assert.equal(plan.risk, PathFinder.riskScore(kb, 0, 1));
  });

  it('returns stuck when all neighbors are confirmed hazards', () => {
    const kb = new KnowledgeBase(3);
    kb.markSafe(1, 1, '');
    kb.markConfirmedPit(1, 0, '');
    kb.markConfirmedPit(1, 2, '');
    kb.markConfirmedPit(0, 1, '');
    kb.markConfirmedPit(2, 1, '');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 1, y: 1, facing: FACING.E },
        percepts: { breeze: true, stench: false, glitter: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      9,
    );
    assert.equal(d.stuck, true);
    assert.ok(d.diagnostics);
  });
});

describe('hybrid inference', () => {
  const quiet = () => {};
  const none = { breeze: false, stench: false, glitter: false, scream: false, bump: false };

  it('localizes Wumpus: cells outside the candidate set become wumpus-safe', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    inf.infer(kb, 0, 0, none, quiet, 1);
    kb.markSafe(0, 1, '');
    inf.infer(kb, 0, 1, { ...none, stench: true }, quiet, 2);
    assert.equal(kb.get(3, 3).wumpusSafe, true);
    assert.equal(kb.get(2, 2).wumpusSafe, true);
    assert.equal(kb.get(3, 3).possibleWumpus, false);
    const local = [kb.get(0, 2).possibleWumpus, kb.get(1, 1).possibleWumpus, kb.get(0, 2).confirmedWumpus, kb.get(1, 1).confirmedWumpus];
    assert.equal(local.some(Boolean), true);
  });

  it('does not confirm a second neighbor when a breeze is already explained', () => {
    const kb = new KnowledgeBase(5);
    kb.markSafe(0, 3, '');
    kb.markConfirmedPit(1, 3, 'known pit');
    const inf = new InferenceEngine();
    inf.infer(kb, 0, 3, { ...none, breeze: true }, quiet, 3);
    assert.equal(kb.get(0, 4).confirmedPit, false);
    assert.equal(kb.get(0, 4).possiblePit, false);
    assert.equal(kb.get(1, 3).confirmedPit, true);
  });

  it('clears possible-pit on neighbors once a breeze is explained by a confirmed pit', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(1, 0, '');
    kb.markPossiblePit(2, 0, 'breeze');
    kb.markPossiblePit(1, 1, 'breeze');
    kb.get(1, 0).observedBreeze = true;
    kb.markConfirmedPit(2, 0, 'forced');
    const inf = new InferenceEngine();
    inf.resolvePits(kb, quiet, '01');
    assert.equal(kb.get(2, 0).confirmedPit, true);
    assert.equal(kb.get(1, 1).possiblePit, false);
    assert.equal(kb.get(1, 1).confirmedPit, false);
  });

  it('scream clears confirmed Wumpus so the corpse square is enterable', () => {
    const kb = new KnowledgeBase(4);
    kb.markConfirmedWumpus(2, 0, 'W');
    assert.equal(kb.isDanger(2, 0), true);
    const inf = new InferenceEngine();
    inf.infer(kb, 0, 0, { ...none, scream: true }, quiet, 5);
    assert.equal(kb.get(2, 0).confirmedWumpus, false);
    assert.equal(kb.get(2, 0).wumpusSafe, true);
    assert.equal(kb.isDanger(2, 0), false);
  });

  it('shoots a confirmed Wumpus that is aligned but not adjacent', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markSafe(1, 0, '');
    kb.markSafe(2, 0, '');
    kb.markConfirmedWumpus(3, 0, 'W');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.N },
        percepts: { glitter: false, breeze: false, stench: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      quiet,
      4,
    );
    assert.ok(d.plan && d.plan.includes(ACTION.SHOOT));
    assert.notEqual(d.stuck, true);
  });
});

describe('playthrough', () => {
  it('stepAI advances the agent', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 6, pitDensity: 15 });
    const before = g.state.steps;
    g.stepAI();
    assert.ok(g.state.steps > before || g.state.status !== STATUS.PLAYING);
  });

  it('does not false-confirm pits during a short play', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 8, pitDensity: 20 });
    for (let i = 0; i < 20; i++) {
      if (g.state.status !== STATUS.PLAYING) break;
      g.stepAI();
    }
    const evalResult = evaluateKbAgainstWorld(g.kb, g.state);
    assert.equal(evalResult.falseConfirmedPits.length, 0);
    assert.equal(validateKnowledgeBase(g.kb).length, 0);
  });

  it('reset restores the same map and start position', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 5, pitDensity: 15 });
    const wumpus = { ...g.state.wumpus };
    const gold = { ...g.state.gold };
    const pits = g.state.pits.map((p) => ({ ...p }));
    g.execute(ACTION.MOVE_RIGHT);
    g.resetWorld();
    assert.deepEqual(g.state.wumpus, wumpus);
    assert.deepEqual(g.state.gold, gold);
    assert.deepEqual(g.state.pits, pits);
    assert.equal(g.state.agent.x, 0);
    assert.equal(g.state.agent.y, 0);
    assert.equal(g.state.status, STATUS.PLAYING);
  });

  it('does not mark a pit death cell as survived', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 4, pitDensity: 5 });
    g.state.pits = [{ x: 2, y: 0 }];
    g.state.wumpus = { x: 3, y: 3 };
    g.state.gold = { x: 3, y: 2 };
    g.execute(ACTION.MOVE_RIGHT);
    assert.equal(g.state.status, STATUS.PLAYING);
    g.execute(ACTION.MOVE_RIGHT);
    assert.equal(g.state.status, STATUS.LOST);
    assert.equal(g.state.agent.x, 2);
    assert.equal(g.kb.get(2, 0).visited, false);
    assert.notEqual(g.kb.get(2, 0).note, 'Survived.');
  });

  it('full play ends without false confirmed pits', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 6, pitDensity: 15 });
    for (let i = 0; i < 400; i++) {
      if (g.state.status !== STATUS.PLAYING) break;
      g.stepAI();
    }
    const evalResult = evaluateKbAgainstWorld(g.kb, g.state);
    assert.equal(evalResult.falseConfirmedPits.length, 0);
    assert.ok([STATUS.WON, STATUS.LOST, STATUS.STUCK].includes(g.state.status));
  });
});

describe('wumpus candidate intersection', () => {
  const quiet = () => {};
  const none = { breeze: false, stench: false, glitter: false, scream: false, bump: false };

  it('starts with no living-Wumpus constraint', () => {
    const kb = new KnowledgeBase(4);
    assert.deepEqual(kb.wumpusCandidates, []);
    assert.equal(kb.wumpusConstrained, false);
    assert.equal(kb.wumpusInconsistent, false);
    assert.equal(kb.wumpusDead, false);
  });

  it('narrows a valid intersection and does not keep eliminated cells', () => {
    const kb = new KnowledgeBase(4);
    assert.equal(kb.intersectWumpus(new Set(['1,0', '0,1'])), true);
    assert.equal(kb.intersectWumpus(new Set(['1,0', '1,1'])), true);
    assert.deepEqual(kb.wumpusCandidates, ['1,0']);
    assert.equal(kb.wumpusInconsistent, false);
  });

  it('drops stale candidates when the intersection is empty', () => {
    const kb = new KnowledgeBase(4);
    kb.intersectWumpus(new Set(['1,0', '0,1']));
    assert.equal(kb.intersectWumpus(new Set(['3,3', '2,3'])), false);
    assert.deepEqual(kb.wumpusCandidates, []);
    assert.equal(kb.wumpusInconsistent, true);
    assert.equal(kb.intersectWumpus(new Set(['2,2'])), false);
    assert.deepEqual(kb.wumpusCandidates, []);
    const issues = validateKnowledgeBase(kb);
    assert.ok(issues.some((m) => m.includes('empty')));
  });

  it('contradictory stenches do not mark unrelated cells Wumpus-safe', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    inf.infer(kb, 0, 0, none, quiet, 1);
    kb.markSafe(0, 1, '');
    inf.infer(kb, 0, 1, { ...none, stench: true }, quiet, 2);
    assert.equal(kb.wumpusInconsistent, false);
    assert.ok(kb.wumpusCandidates.length > 0);
    kb.markSafe(3, 3, '');
    inf.infer(kb, 3, 3, { ...none, stench: true }, quiet, 3);
    assert.equal(kb.wumpusInconsistent, true);
    assert.deepEqual(kb.wumpusCandidates, []);
    assert.equal(kb.get(2, 3).wumpusSafe, false);
    assert.equal(kb.get(3, 2).wumpusSafe, false);
    assert.equal(kb.get(2, 3).possibleWumpus, true);
    assert.equal(kb.get(2, 3).confirmedWumpus, false);
    for (const key of ['0,2', '1,1']) {
      const [x, y] = key.split(',').map(Number);
      assert.equal(kb.get(x, y).confirmedWumpus, false);
    }
  });

  it('scream clears living Wumpus danger and is not a contradiction', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    kb.intersectWumpus(new Set(['1,0']));
    kb.intersectWumpus(new Set(['3,3']));
    assert.equal(kb.wumpusInconsistent, true);
    inf.infer(kb, 0, 0, { ...none, scream: true }, quiet, 4);
    assert.equal(kb.wumpusDead, true);
    assert.equal(kb.wumpusInconsistent, false);
    assert.equal(kb.get(1, 0).wumpusSafe, true);
    assert.equal(kb.get(1, 0).confirmedWumpus, false);
    assert.equal(validateKnowledgeBase(kb).some((m) => m.includes('empty')), false);
  });
});

describe('pit contradiction', () => {
  it('does not mark the current cell as a pit when a breeze has no candidates', () => {
    const kb = new KnowledgeBase(4);
    const inf = new InferenceEngine();
    kb.markSafe(1, 1, '');
    for (const n of [
      [1, 0],
      [1, 2],
      [0, 1],
      [2, 1],
    ]) {
      kb.markPitSafe(n[0], n[1], '');
      kb.markWumpusSafe(n[0], n[1], '');
    }
    inf.infer(
      kb,
      1,
      1,
      { breeze: true, stench: false, glitter: false, scream: false, bump: false },
      () => {},
      2,
    );
    assert.equal(kb.get(1, 1).confirmedPit, false);
    assert.equal(kb.get(1, 1).visited, true);
    const issues = validateKnowledgeBase(kb);
    assert.ok(issues.some((m) => m.includes('breeze')));
  });
});

describe('shooting and score', () => {
  it('a hit screams once, kills the Wumpus, and spends the only arrow', () => {
    const s = createWorldState(fixtureWorld({ wumpus: { x: 2, y: 0 }, gold: { x: 3, y: 3 }, pits: [] }));
    s.agent.facing = FACING.E;
    const eng = new WorldEngine(s);
    const before = s.score;
    const hit = eng.shoot();
    assert.equal(hit.hit, true);
    assert.equal(hit.percepts.scream, true);
    assert.equal(s.wumpusAlive, false);
    assert.equal(s.arrowLeft, 0);
    assert.equal(s.score, before + SCORE.SHOOT + SCORE.ACTION);
    const again = eng.shoot();
    assert.equal(again.ok, false);
    assert.equal(s.score, before + SCORE.SHOOT + SCORE.ACTION);
  });

  it('a miss does not scream or kill, and the ray is Wumpus-safe', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 4, pitDensity: 5 });
    g.state.wumpus = { x: 0, y: 3 };
    g.state.pits = [];
    g.state.agent.facing = FACING.E;
    const result = g.execute(ACTION.SHOOT);
    assert.equal(result.hit, false);
    assert.equal(g.state.wumpusAlive, true);
    assert.equal(g.state.arrowLeft, 0);
    assert.equal(g.engine.percepts().scream, false);
    assert.equal(g.kb.get(1, 0).wumpusSafe, true);
    assert.equal(g.kb.get(3, 0).wumpusSafe, true);
    assert.equal(g.kb.get(0, 3).confirmedWumpus, false);
  });
});

describe('ai execution control', () => {
  it('pause and resume keep a single run, and step is one action', () => {
    const g = new GameController(() => {});
    g.newWorld({ size: 4, pitDensity: 5 });
    g.startAI();
    assert.equal(g.running, true);
    assert.equal(g.paused, false);
    const firstTimer = g.timer;
    g.startAI();
    assert.notEqual(g.timer, firstTimer);
    g.pauseAI();
    assert.equal(g.running, true);
    assert.equal(g.paused, true);
    g.resumeAI();
    assert.equal(g.paused, false);
    g.stopAI();
    assert.equal(g.running, false);

    const steps = g.state.steps;
    g.stepAI();
    assert.equal(g.running, false);
    assert.equal(g.state.steps, steps + 1);
    g.resetWorld();
    assert.equal(g.running, false);
    assert.equal(g.state.agent.x, 0);
    assert.equal(g.state.agent.y, 0);
    assert.equal(g.state.status, STATUS.PLAYING);
  });

  it('does not step into a confirmed living Wumpus', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markConfirmedWumpus(1, 0, 'W');
    kb.markConfirmedPit(0, 1, 'P');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.E },
        percepts: { glitter: false, breeze: false, stench: true, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      3,
    );
    assert.equal(d.action, ACTION.SHOOT);
    assert.notEqual(d.action, ACTION.MOVE_FORWARD);
  });

  it('follows the knowledge base even if that cell could hide a pit', () => {
    const kb = new KnowledgeBase(4);
    kb.markSafe(0, 0, '');
    kb.markPitSafe(1, 0, '');
    kb.markWumpusSafe(1, 0, '');
    const d = new DecisionEngine().decide(
      kb,
      {
        agent: { x: 0, y: 0, facing: FACING.E },
        percepts: { glitter: false, breeze: false, stench: false, scream: false, bump: false },
        goldCollected: false,
        arrowLeft: 1,
        status: 'playing',
      },
      () => {},
      2,
    );
    assert.ok(d.plan && d.plan.includes(ACTION.MOVE_FORWARD));
    assert.notEqual(d.stuck, true);
  });
});
