import { SCORE } from '../utils/constants.js';

export class ScoringSystem {
  constructor() {
    this.score = 0;
    this.applied = new Set();
  }

  reset() {
    this.score = 0;
    this.applied.clear();
  }

  apply(eventKey, delta, reason) {
    if (this.applied.has(eventKey)) return { delta: 0, reason: 'Already scored' };
    this.applied.add(eventKey);
    this.score += delta;
    return { delta, reason, total: this.score };
  }

  onMove(stepIndex) {
    return this.apply(`move-${stepIndex}`, SCORE.MOVE, 'Action cost');
  }

  onGrabGold() {
    return this.apply('grab-gold', SCORE.GRAB_GOLD, 'Gold collected');
  }

  onShoot() {
    return this.apply('shoot', SCORE.SHOOT, 'Arrow fired');
  }

  onClimbWithGold() {
    return this.apply('climb-gold', SCORE.CLIMB_WITH_GOLD, 'Escaped with gold');
  }

  onDeath() {
    return this.apply('death', SCORE.DEATH, 'Agent died');
  }

  getScore() {
    return this.score;
  }
}
