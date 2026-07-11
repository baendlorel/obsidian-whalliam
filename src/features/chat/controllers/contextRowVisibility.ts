export function updateContextRowHasContent(contextRowEl: HTMLElement): void {
  const editorIndicator = contextRowEl.querySelector('.whalliam-selection-indicator');
  const browserIndicator = contextRowEl.querySelector('.whalliam-browser-selection-indicator');
  const canvasIndicator = contextRowEl.querySelector('.whalliam-canvas-indicator');
  const fileIndicator = contextRowEl.querySelector('.whalliam-file-indicator');
  const imagePreview = contextRowEl.querySelector('.whalliam-image-preview');

  const hasEditorSelection = !!editorIndicator && !editorIndicator.hasClass('whalliam-hidden');
  const hasBrowserSelection = !!browserIndicator && !browserIndicator.hasClass('whalliam-hidden');
  const hasCanvasSelection = !!canvasIndicator && !canvasIndicator.hasClass('whalliam-hidden');
  const hasFileChips = !!fileIndicator && fileIndicator.hasClass('whalliam-visible-flex');
  const hasImageChips = !!imagePreview && imagePreview.hasClass('whalliam-visible-flex');

  contextRowEl.classList.toggle(
    'has-content',
    hasEditorSelection || hasBrowserSelection || hasCanvasSelection || hasFileChips || hasImageChips
  );
}
