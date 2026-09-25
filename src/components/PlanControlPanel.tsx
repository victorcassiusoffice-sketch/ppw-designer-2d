import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/** A small option panel occupies header space, never a floating part of the drawing. */
export function PlanControlPanel({ open, title, id, anchor, target, onClose, children, keepMounted = false }: {
  open: boolean;
  title: string;
  id: string;
  anchor: RefObject<HTMLElement>;
  target: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
  keepMounted?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const openedPanel = panel.current;
    const opener = anchor.current;
    openedPanel?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    const close = () => { onClose(); anchor.current?.focus({ preventScroll: true }); };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); close();
    };
    const away = (event: PointerEvent) => {
      const element = event.target instanceof Element ? event.target : null;
      if (!element || panel.current?.contains(element) || anchor.current?.contains(element)) return;
      if (element.closest('[data-ppw-popover], [data-ppw-sheet], [aria-modal="true"]')) return;
      onClose();
      // The first tap dismisses options; it cannot also draw or place an item.
      if (element.closest('[data-testid="plan-workspace"], [data-testid="plan-drawing-viewport"]')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', away, true);
    return () => {
      document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', away, true);
      if (openedPanel?.contains(document.activeElement)) opener?.focus({ preventScroll: true });
    };
  }, [anchor, onClose, open]);
  if (!target || (!open && !keepMounted)) return null;
  return createPortal(<div ref={panel} id={id} role="region" aria-label={title} hidden={!open} className="plan-control-panel" data-plan-control-panel="">
    <div className="plan-control-panel-heading"><strong>{title}</strong><button type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={() => { onClose(); anchor.current?.focus({ preventScroll: true }); }}>Close <span aria-hidden="true">×</span></button></div>
    <div className="plan-control-panel-content">{children}</div>
  </div>, target);
}
