export function renderReasoningLog(container, vm) {
  const { log, aiStage } = vm;
  const stageEl = container.parentElement?.querySelector('.ai-stage-label');
  if (stageEl) stageEl.textContent = `AI stage: ${aiStage}`;

  container.innerHTML = log
    .map(
      (e) =>
        `<div class="log-entry log-${e.type}">${escapeHtml(e.text)}</div>`,
    )
    .join('');
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
