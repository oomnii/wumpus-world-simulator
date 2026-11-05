import { describe, it, expect } from 'vitest';
import { GameController } from '../controllers/GameController.js';
import { DecisionEngine } from '../agent/DecisionEngine.js';
import { KnowledgeBase } from '../agent/KnowledgeBase.js';
import { ACTION } from '../utils/constants.js';

describe('AIAgent', () => {
  it('chooses grab when glitter present', () => {
    const kb = new KnowledgeBase(4);
    const decision = new DecisionEngine().decide(
      kb,
      {
        position: { x: 1, y: 1 },
        goldCollected: false,
        arrowRemaining: 1,
        status: 'playing',
        percepts: { glitter: true, breeze: false, stench: false, scream: false, bump: false },
      },
      { step: 1, add: () => {} },
    );
    expect(decision.type).toBe(ACTION.GRAB);
  });

  it('controller keeps hidden world out of agent decide path', () => {
    const game = new GameController();
    const vm = game.getViewModel();
    expect(vm.hidden).toBeTruthy();
    expect(game.knowledge.get(0, 0).visited).toBe(true);
    expect(game.knowledge.get(3, 3).confirmedPit).toBe(false);
  });
});

describe('AnimationController integration', () => {
  it('pause stops running timer loop', () => {
    const game = new GameController();
    game.pauseAI();
    expect(game.anim.paused).toBe(false);
    game.playAI();
    expect(game.anim.running).toBe(true);
    game.pauseAI();
    expect(game.anim.paused).toBe(true);
    game.anim.stop();
  });
});
