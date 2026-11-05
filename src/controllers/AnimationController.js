import { DEFAULT_AI_INTERVAL_MS } from '../utils/constants.js';

export class AnimationController {
  constructor() {
    this.intervalMs = DEFAULT_AI_INTERVAL_MS;
    this.timerId = null;
    this.running = false;
    this.paused = false;
    this.generation = 0;
    this.onTick = null;
  }

  setSpeed(ms) {
    this.intervalMs = ms;
    if (this.running && !this.paused) {
      this._restartTimer();
    }
  }

  setTickHandler(fn) {
    this.onTick = fn;
  }

  start() {
    this.running = true;
    this.paused = false;
    this._restartTimer();
  }

  pause() {
    if (!this.running) return;
    this.paused = true;
    this._clearTimer();
  }

  resume() {
    if (!this.running) return;
    this.paused = false;
    this._restartTimer();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this._clearTimer();
  }

  bumpGeneration() {
    this.generation += 1;
    this.stop();
    return this.generation;
  }

  async runSingleStep() {
    const gen = this.generation;
    if (this.onTick) {
      await this.onTick(gen);
    }
  }

  _clearTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  _restartTimer() {
    this._clearTimer();
    const gen = this.generation;
    this.timerId = setTimeout(async () => {
      if (!this.running || this.paused || gen !== this.generation) return;
      if (this.onTick) {
        await this.onTick(gen);
      }
      if (this.running && !this.paused && gen === this.generation) {
        this._restartTimer();
      }
    }, this.intervalMs);
  }
}
