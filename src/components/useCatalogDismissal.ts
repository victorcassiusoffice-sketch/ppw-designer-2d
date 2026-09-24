import { useEffect } from 'react';

/** Scene dismissal consumes the first empty click, but an armed product can still be placed. */
export function useCatalogDismissal({ viewMode, open, desktop, close, placing = false }: {
  viewMode: string;
  open: boolean;
  desktop: boolean;
  close: () => void;
  placing?: boolean;
}) {
  useEffect(() => {
    const visible = () => (window.innerWidth >= 1024) === desktop;
    if (visible()) window.dispatchEvent(new CustomEvent('ppw:catalog-visibility', { detail: { open: viewMode === '3d' && open } }));
    const dismiss = () => { if (visible()) close(); };
    const resize = () => { if (viewMode === '3d' && open && !visible()) close(); };
    const scene = (event: Event) => {
      if (viewMode !== '3d' || !open || !visible()) return;
      // Keep the canvas dimensions stable during an intentional placement.
      // Its new pointer gesture is a placement, not a click-away dismissal.
      if (placing) return;
      event.preventDefault();
      close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || viewMode !== '3d' || !open || !visible()) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      close();
      document.querySelector<HTMLButtonElement>('[data-testid="house-mode-furnish"]')?.focus({ preventScroll: true });
    };
    window.addEventListener('ppw:close-catalog', dismiss);
    window.addEventListener('ppw:house-scene-pointer', scene);
    window.addEventListener('keydown', key, true);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('ppw:close-catalog', dismiss);
      window.removeEventListener('ppw:house-scene-pointer', scene);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', resize);
    };
  }, [close, desktop, open, placing, viewMode]);
}
