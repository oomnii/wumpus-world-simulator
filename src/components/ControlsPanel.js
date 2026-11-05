import { ACTION, SPEED_OPTIONS } from '../utils/constants.js';

export function bindControlsPanel(root, game, manual) {
  const manualSection = root.querySelector('.manual-controls');
  const aiSection = root.querySelector('.ai-controls');
  const speedSelect = root.querySelector('#ai-speed');
  const shootDir = root.querySelector('#shoot-direction');

  SPEED_OPTIONS.forEach((opt) => {
    const el = document.createElement('option');
    el.value = String(opt.ms);
    el.textContent = opt.label;
    if (opt.ms === 500) el.selected = true;
    speedSelect.appendChild(el);
  });

  speedSelect.addEventListener('change', () => {
    game.setSpeed(Number(speedSelect.value));
  });

  shootDir?.addEventListener('change', () => {
    manual.setShootDirection(shootDir.value);
  });

  const bindBtn = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);

  bindBtn('#move-up', () => game.executeAction(ACTION.MOVE_UP));
  bindBtn('#move-down', () => game.executeAction(ACTION.MOVE_DOWN));
  bindBtn('#move-left', () => game.executeAction(ACTION.MOVE_LEFT));
  bindBtn('#move-right', () => game.executeAction(ACTION.MOVE_RIGHT));
  bindBtn('#btn-shoot', () =>
    game.executeAction(ACTION.SHOOT, { direction: shootDir?.value || 'up' }),
  );
  bindBtn('#btn-grab', () => game.executeAction(ACTION.GRAB));
  bindBtn('#btn-climb', () => game.executeAction(ACTION.CLIMB));

  bindBtn('#ai-play', () => game.playAI());
  bindBtn('#ai-pause', () => game.pauseAI());
  bindBtn('#ai-resume', () => game.resumeAI());
  bindBtn('#ai-step', () => game.stepAI());

  return function syncControls(vm) {
    const isManual = vm.state.mode === 'manual';
    manualSection.hidden = !isManual;
    aiSection.hidden = isManual;

    const terminal = ['won', 'lost', 'stuck'].includes(vm.state.status);
    const playing = vm.state.status === 'playing';

    root.querySelectorAll('.manual-controls button').forEach((b) => {
      b.disabled = !isManual || terminal;
    });
    root.querySelector('#ai-play').disabled = !playing || isManual || vm.anim.running;
    root.querySelector('#ai-pause').disabled = !vm.anim.running || vm.anim.paused;
    root.querySelector('#ai-resume').disabled = !vm.anim.running || !vm.anim.paused || isManual;
    root.querySelector('#ai-step').disabled = !playing || isManual;
  };
}
