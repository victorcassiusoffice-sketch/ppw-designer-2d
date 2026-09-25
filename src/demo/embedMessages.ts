export type EmbeddedDesignerView = '2d' | '3d';
export const DESIGNER_VIEW_MESSAGE = 'ppw:designer-view';
export const DESIGNER_READY_MESSAGE = 'ppw:designer-ready';
export const DESIGNER_VIEW_STATE_MESSAGE = 'ppw:designer-view-state';

export function isDesignerViewMessage(value: unknown): value is { type: typeof DESIGNER_VIEW_MESSAGE; view: EmbeddedDesignerView } {
  return !!value && typeof value === 'object' && 'type' in value && value.type === DESIGNER_VIEW_MESSAGE
    && 'view' in value && (value.view === '2d' || value.view === '3d');
}

export function isDesignerReadyMessage(value: unknown): boolean {
  return !!value && typeof value === 'object' && 'type' in value && value.type === DESIGNER_READY_MESSAGE;
}

export function isDesignerViewStateMessage(value: unknown): value is { type: typeof DESIGNER_VIEW_STATE_MESSAGE; view: EmbeddedDesignerView } {
  return !!value && typeof value === 'object' && 'type' in value && value.type === DESIGNER_VIEW_STATE_MESSAGE
    && 'view' in value && (value.view === '2d' || value.view === '3d');
}

/** Only the same-origin containing page can control a designer's view. */
export function listenForEmbeddedDesignerView(onView: (view: EmbeddedDesignerView) => void): () => void {
  if (window.parent === window) return () => {};
  const receive = (event: MessageEvent<unknown>) => {
    if (event.origin !== window.location.origin || event.source !== window.parent || !isDesignerViewMessage(event.data)) return;
    onView(event.data.view);
  };
  window.addEventListener('message', receive);
  window.parent.postMessage({ type: DESIGNER_READY_MESSAGE }, window.location.origin);
  return () => window.removeEventListener('message', receive);
}
