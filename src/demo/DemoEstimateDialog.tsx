import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { HouseCostPanel } from '../components/HouseCostPanel';
import '../components/houseWorkspace.css';

/** Shared local estimate; never leaves the designer for a commerce route. */
export function DemoEstimateDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') { event.preventDefault(); closeRef.current?.focus(); }
    };
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('keydown', key, true); previous?.focus(); };
  }, [onClose]);
  return createPortal(<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-3" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Demo product estimate" className="max-h-[85dvh] w-full max-w-lg overflow-auto rounded-2xl border border-[#34415b] bg-[#172139] p-4 text-[#dce5f5] shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">Your design estimate</h2><button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border border-[#34415b] px-3 py-2">Close ×</button></div>
      <HouseCostPanel />
    </section>
  </div>, document.body);
}
