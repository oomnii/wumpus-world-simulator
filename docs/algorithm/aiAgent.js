import { AI_STAGE } from './shared.js';
import { perceptText } from './perceptEngine.js';
import { InferenceEngine } from './inferenceEngine.js';
import { DecisionEngine } from './decisionEngine.js';

export class AIAgent {
  constructor() {
    this.infer = new InferenceEngine();
    this.decide = new DecisionEngine();
    this.kb = null;
    this.stage = AI_STAGE.IDLE;
    this.prevAgent = null;
  }

  setKnowledge(kb) {
    this.kb = kb;
    this.prevAgent = null;
  }

  cycle(view, logFn, step) {
    this.stage = AI_STAGE.OBSERVE;
    logFn(`[Step ${String(step).padStart(2, '0')}] Percepts: ${perceptText(view.percepts)}.`, 'neutral');

    this.stage = AI_STAGE.UPDATE;
    this.kb.markSafe(view.agent.x, view.agent.y, 'Survived cell.');

    this.stage = AI_STAGE.INFER;
    this.infer.infer(this.kb, view.agent.x, view.agent.y, view.percepts, logFn, step);

    this.stage = AI_STAGE.DECIDE;
    const d = this.decide.decide(this.kb, view, logFn, step, { prevAgent: this.prevAgent });
    this.prevAgent = { ...view.agent };
    if (d.stuck) return { stuck: true, diagnostics: d.diagnostics };
    if (!d.action) return { action: null };
    this.stage = AI_STAGE.EXECUTE;
    return { action: d.action };
  }
}
