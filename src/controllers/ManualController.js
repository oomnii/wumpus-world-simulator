import { ACTION } from '../utils/constants.js';
import { observePerceptSentence } from '../agent/InferenceEngine.js';

export class ManualController {
  constructor(gameController) {
    this.game = gameController;
    this.shootDirection = 'up';
    this._boundKeyHandler = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this._boundKeyHandler);
  }

  destroy() {
    window.removeEventListener('keydown', this._boundKeyHandler);
  }

  setShootDirection(dir) {
    this.shootDirection = dir;
  }

  isTypingTarget(target) {
    if (!target) return false;
    const tag = target.tagName?.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }

  handleKeyDown(e) {
    if (this.game.state.mode !== 'manual') return;
    if (this.isTypingTarget(e.target)) return;

    const map = {
      ArrowUp: ACTION.MOVE_UP,
      ArrowDown: ACTION.MOVE_DOWN,
      ArrowLeft: ACTION.MOVE_LEFT,
      ArrowRight: ACTION.MOVE_RIGHT,
    };

    if (map[e.key]) {
      e.preventDefault();
      this.game.executeAction(map[e.key]);
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      this.game.executeAction(ACTION.GRAB);
    }
    if (e.key === 's' || e.key === 'S') {
      this.game.executeAction(ACTION.SHOOT, { direction: this.shootDirection });
    }
    if (e.key === 'Enter') {
      this.game.executeAction(ACTION.CLIMB);
    }
  }
}

export function formatManualPerceptLog(step, percepts) {
  return `[Step ${String(step).padStart(2, '0')}] Percepts: ${observePerceptSentence(percepts)}.`;
}
