import { useCallback, useEffect, useRef, useState } from 'react';

/** Opening a canvas tool replaces the previous panel without resetting the design. */
export function dismissToolPanel(): boolean {
  return !window.dispatchEvent(new Event('olb:dismiss-canvas-panel', { cancelable: true }));
}

export function useToolPanel(onEscape?: () => void): [boolean, (open: boolean) => void] {
  const escape = useRef(onEscape);
  escape.current = onEscape;
  const [open, setOpen] = useState(false);
  const id = useRef(Symbol('canvas-panel'));
  useEffect(() => {
    const replace = (event: Event) => {
      if ((event as CustomEvent<symbol>).detail !== id.current) setOpen(false);
    };
    window.addEventListener('olb:canvas-tool-panel', replace);
    return () => window.removeEventListener('olb:canvas-tool-panel', replace);
  }, []);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      event.preventDefault();
      if (escape.current) escape.current(); else setOpen(false);
    };
    window.addEventListener('olb:dismiss-canvas-panel', dismiss);
    return () => window.removeEventListener('olb:dismiss-canvas-panel', dismiss);
  }, [open]);
  const change = useCallback((value: boolean) => {
    if (value) window.dispatchEvent(new CustomEvent('olb:canvas-tool-panel', { detail: id.current }));
    setOpen(value);
  }, []);
  return [open, change];
}
