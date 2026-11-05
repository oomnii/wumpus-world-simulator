export function bindConfigurationPanel(root, game, onNewGame) {
  const sizeSelect = root.querySelector('#grid-size');
  const pitSlider = root.querySelector('#pit-density');
  const pitLabel = root.querySelector('#pit-density-value');
  const seedInput = root.querySelector('#world-seed');
  const debugToggle = root.querySelector('#debug-reveal');
  const modeAi = root.querySelector('#mode-ai');
  const modeManual = root.querySelector('#mode-manual');
  const genNote = root.querySelector('#generation-note');

  pitSlider.addEventListener('input', () => {
    pitLabel.textContent = `${pitSlider.value}%`;
  });

  root.querySelector('#btn-new-game').addEventListener('click', () => {
    onNewGame?.();
    game.newGame({
      size: Number(sizeSelect.value),
      pitDensity: Number(pitSlider.value),
      seed: seedInput.value.trim(),
      debugReveal: debugToggle.checked,
    });
    if (genNote) {
      const vm = game.getViewModel();
      genNote.textContent = vm.state.generationNote || '';
    }
  });

  root.querySelector('#btn-reset').addEventListener('click', () => {
    game.config.size = Number(sizeSelect.value);
    game.config.pitDensity = Number(pitSlider.value);
    game.config.seed = seedInput.value.trim();
    game.resetGame();
  });

  debugToggle.addEventListener('change', () => {
    game.setDebugReveal(debugToggle.checked);
  });

  modeAi.addEventListener('change', () => {
    if (modeAi.checked) game.setMode('ai');
  });
  modeManual.addEventListener('change', () => {
    if (modeManual.checked) game.setMode('manual');
  });

  return () => {
    sizeSelect.value = String(game.config.size);
    pitSlider.value = String(game.config.pitDensity);
    pitLabel.textContent = `${game.config.pitDensity}%`;
    debugToggle.checked = game.config.debugReveal;
    if (game.state.mode === 'ai') modeAi.checked = true;
    else modeManual.checked = true;
    if (genNote) genNote.textContent = game.state.generationNote || '';
  };
}
