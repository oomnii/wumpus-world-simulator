import { AI_STAGE } from '../utils/constants.js';
import { InferenceEngine, observePerceptSentence } from './InferenceEngine.js';
import { DecisionEngine } from './DecisionEngine.js';

export class AIAgent {
  constructor() {
    this.inference = new InferenceEngine();
    this.decision = new DecisionEngine();
    this.knowledge = null;
    this.stage = AI_STAGE.IDLE;
  }

  setKnowledge(kb) {
    this.knowledge = kb;
  }

  getStage() {
    return this.stage;
  }

  runCycle(agentView, log) {
    const kb = this.knowledge;
    if (!kb) return { type: 'none', reason: 'No knowledge base' };

    const step = log?.step ?? 0;
    const pos = agentView.position;
    const percepts = agentView.percepts;

    this.stage = AI_STAGE.OBSERVE;
    log?.add(
      `[Step ${String(step).padStart(2, '0')}] Percepts: ${observePerceptSentence(percepts)}.`,
      'neutral',
    );

    this.stage = AI_STAGE.UPDATE_KNOWLEDGE;
    kb.markVisitedSafe(pos.x, pos.y, 'Survived current cell — safe.');

    this.stage = AI_STAGE.INFER;
    this.inference.run(kb, pos.x, pos.y, percepts, log);

    this.stage = AI_STAGE.DECIDE;
    const decision = this.decision.decide(
      kb,
      { ...agentView, percepts },
      log,
    );

    this.stage = AI_STAGE.EXECUTE;
    return decision;
  }
}
