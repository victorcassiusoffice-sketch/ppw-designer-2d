import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearActiveRoomProducts, clearEntireDesign } from '../lib/clearActions';
import { usePropertyStore } from '../store/propertyStore';
import { useDesignerUIStore } from '../store/designerUIStore';
import { usePlacementIntentStore } from '../store/placementIntentStore';
import { useGardenEditorStore } from '../store/gardenEditorStore';
import { useToastStore } from '../store/toastStore';

type PendingClear = 'products' | 'all' | null;
interface Props { inline?: boolean; enabled?: boolean; onBeforeClear?: () => void }
const BUTTON = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-[#193d45] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#28525b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#82dfd0] disabled:opacity-40';

/** A named action in the toolbar, not a second floating panel over the drawing.
 * Reset is confirmed, cancellable and one undo frame across every floor/layer. */
export function ClearControls({ inline = false, enabled = true, onBeforeClear }: Props): JSX.Element | null {
  const [pending, setPending] = useState<PendingClear>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const hasProducts = usePropertyStore(s => (s.property.rooms.find(r => r.id === s.property.activeRoomId)?.placedItems.length ?? 0) > 0);
  const pushToast = useToastStore(s => s.push);

  useEffect(() => {
    if (!enabled) { setPending(null); return; }
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || !event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (event.key.toLowerCase() === 'p' || event.key.toLowerCase() === 'x') {
        event.preventDefault();
        setPending(event.key.toLowerCase() === 'p' ? 'products' : 'all');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [enabled]);

  useEffect(() => {
    if (!pending) return;
    const opener = document.activeElement as HTMLElement | null;
    const clearButton = trigger.current;
    dialog.current?.querySelector<HTMLButtonElement>('[data-clear-cancel]')?.focus();
    return () => { if (opener?.isConnected) opener.focus(); else clearButton?.focus(); };
  }, [pending]);

  function confirmClear() {
    onBeforeClear?.();
    usePlacementIntentStore.setState({ armedProductId: null, intent: null, moveIntent: null });
    useDesignerUIStore.getState().setTool('hand');
    useGardenEditorStore.getState().close();
    window.dispatchEvent(new CustomEvent('ppw:before-design-clear', { detail: { all: pending === 'all' } }));
    if (pending === 'products') {
      clearActiveRoomProducts();
      pushToast('Products cleared from this room. Undo restores them.', 'info', 4000);
    } else {
      clearEntireDesign();
      pushToast('Fresh blank page. Undo restores your whole design.', 'info', 4000);
    }
    setPending(null);
  }

  if (!enabled) return null;
  return <>
    <div data-testid="clear-controls" data-inline={inline} className={inline ? 'shrink-0' : 'absolute bottom-3 left-3 z-30'}>
      <button ref={trigger} type="button" data-testid="clear-all-button" aria-label="Clear page" title="Start a fresh page (Shift+X)" onClick={() => setPending('all')} className={BUTTON}>
        <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M4 6h12M8 6V3h4v3M6 6l1 11h6l1-11M9 9v5m2-5v5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <span>Clear</span>
      </button>
    </div>
    {pending && createPortal(<div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/65 p-4" data-testid="clear-controls-modal" onClick={event => { if (event.target === event.currentTarget) setPending(null); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="clear-controls-title" className="w-full max-w-sm rounded-2xl border border-white/20 bg-[#142e37] p-5 text-white shadow-2xl" onKeyDown={event => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPending(null); }
        if (event.key === 'Tab') {
          const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
          const first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
        <h2 id="clear-controls-title" className="text-base font-semibold">{pending === 'all' ? 'Start a fresh page?' : 'Clear this room’s products?'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{pending === 'all' ? 'Remove this page’s rooms, floors, roof, garden and products. Other saved pages stay intact.' : 'Remove products in the selected room. Keep the building, garden and other rooms.'} You can restore everything with Undo.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" data-clear-cancel onClick={() => setPending(null)} className={`${BUTTON} flex-1`}>Cancel</button>
          <button type="button" data-testid="clear-controls-confirm" onClick={confirmClear} className={`${BUTTON} flex-1 !border-[#df7969] !bg-[#843b32] hover:!bg-[#a4473d]`}>{pending === 'all' ? 'Clear page' : 'Clear products'}</button>
        </div>
        {pending === 'all' ? <button type="button" data-testid="clear-products-button" disabled={!hasProducts} onClick={() => setPending('products')} className="mt-3 min-h-11 w-full text-xs text-[#9eeadd] underline disabled:opacity-40">Only clear products in this room instead</button> : <button type="button" onClick={() => setPending('all')} className="mt-3 min-h-11 w-full text-xs text-[#9eeadd] underline">Clear the whole page instead</button>}
      </div>
    </div>, document.body)}
  </>;
}
