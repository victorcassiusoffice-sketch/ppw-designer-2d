/**
 * ClearControls (2026-06-09, Vic) — two small, always-visible STICKY
 * clear buttons pinned to the canvas, with keyboard shortcuts:
 *
 *   • "Clear products"  (Shift+P)  — removes every placed product but
 *                                    KEEPS the drawn room (polygon, walls,
 *                                    floors, paint).
 *   • "Clear all"       (Shift+X)  — wipes the room + products back to the
 *                                    fresh blank-on-open canvas.
 *
 * Both are destructive, so both ask for a quick confirm first. Each action
 * is a single undoable frame (Ctrl+Z restores it). Placement keeps the
 * cluster clear of the other canvas chrome on every viewport: bottom-left on
 * desktop (≥1024 px, where the Sims bottom toolbar is hidden), and top-left
 * on mobile/tablet (just below the undo/redo strip) so it never sits under
 * the full-width Sims bottom toolbar. Visual register matches the Designer:
 * subtle white pills with a coral accent on the destructive "Clear all".
 */
import { useEffect, useState } from 'react';
import { clearActiveRoomProducts, clearEntireDesign } from '../lib/clearActions';
import { useDesignStore } from '../store/designStore';
import { usePropertyStore, selectActiveRoom } from '../store/propertyStore';
import { useToastStore } from '../store/toastStore';

type PendingClear = 'products' | 'all' | null;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function ClearControls(): JSX.Element {
  const [pending, setPending] = useState<PendingClear>(null);
  const placedItems = useDesignStore((s) => s.placedItems);
  const pushToast = useToastStore((s) => s.push);

  // Keyboard: Shift+P → confirm clear products; Shift+X → confirm clear all.
  // Self-contained so the shortcut opens the SAME confirm flow as the button
  // (never a silent wipe). Ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!e.shiftKey) return;
      if (e.key === 'P' || e.key === 'p') {
        e.preventDefault();
        setPending('products');
      } else if (e.key === 'X' || e.key === 'x') {
        e.preventDefault();
        setPending('all');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function confirmClear(): void {
    if (pending === 'products') {
      clearActiveRoomProducts();
      pushToast('Products cleared — room kept. Ctrl+Z to restore.', 'info', 4000);
    } else if (pending === 'all') {
      clearEntireDesign();
      pushToast('Cleared to a blank canvas. Ctrl+Z to restore.', 'info', 4000);
    }
    setPending(null);
  }

  // Disable "Clear products" when there's nothing placed (purely cosmetic —
  // the action is harmless either way). "Clear all" stays enabled so a user
  // can always reset a half-drawn room.
  const hasProducts = placedItems.length > 0;
  const activeRoom = usePropertyStore(selectActiveRoom);
  const hasRoom = (activeRoom?.polygon.length ?? 0) >= 3;
  const nothingToClear = !hasProducts && !hasRoom;

  return (
    <>
      <div
        className="pointer-events-none absolute z-30 flex items-center gap-2"
        // 2026-08-25: mobile used to pin these at `top-16`, where they
        // covered the canvas readout badges. They are now bottom-left at
        // EVERY width — the same place desktop already put them. The mobile
        // Sims toolbar is `fixed` (outside this section's flow), so its live
        // height is added back; on desktop the dock IS in flow, so the
        // section already ends above it and `--sims-toolbar-h` is 0.
        style={{
          left: 'max(0.75rem, env(safe-area-inset-left))',
          bottom: 'calc(max(1.25rem, env(safe-area-inset-bottom)) + var(--sims-toolbar-h, 0px))',
        }}
        data-testid="clear-controls"
      >
        <button
          type="button"
          data-testid="clear-products-button"
          onClick={() => setPending('products')}
          disabled={!hasProducts}
          title="Remove all placed products, keep the room (Shift+P)"
          className="pointer-events-auto flex min-h-[34px] items-center gap-1.5 rounded-full border border-ppw-stone bg-white/95 px-3 text-[11px] font-semibold text-ppw-slate shadow-sm backdrop-blur transition hover:border-ppw-teal hover:text-ppw-teal disabled:cursor-not-allowed disabled:opacity-45"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              d="M3 5h10M6.5 5V3.5h3V5M5 5l.6 8h4.8L11 5"
            />
          </svg>
          Clear products
        </button>
        <button
          type="button"
          data-testid="clear-all-button"
          onClick={() => setPending('all')}
          disabled={nothingToClear}
          title="Delete the whole room + products, start blank (Shift+X)"
          className="pointer-events-auto flex min-h-[34px] items-center gap-1.5 rounded-full border border-ppw-coral/60 bg-white/95 px-3 text-[11px] font-semibold text-ppw-coral shadow-sm backdrop-blur transition hover:border-ppw-coral hover:bg-ppw-coral hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 3l10 10M13 3L3 13"
            />
          </svg>
          Clear all
        </button>
      </div>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-controls-title"
          data-testid="clear-controls-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPending(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPending(null);
          }}
        >
          <div className="w-[min(92vw,360px)] rounded-xl bg-white p-5 shadow-2xl">
            <h2 id="clear-controls-title" className="text-sm font-semibold text-ppw-ink">
              {pending === 'products' ? 'Clear all products?' : 'Clear everything?'}
            </h2>
            <p className="mt-1 text-xs leading-snug text-ppw-slate">
              {pending === 'products'
                ? 'This removes every product you have placed. Your drawn room stays. Press Ctrl+Z to restore.'
                : 'This deletes the whole room and every product, leaving a fresh blank canvas. Press Ctrl+Z to restore.'}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPending(null)}
                className="flex-1 rounded-md border border-ppw-stone bg-white px-3 py-1.5 text-sm font-semibold text-ppw-slate hover:border-ppw-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="clear-controls-confirm"
                onClick={confirmClear}
                className="flex-1 rounded-md bg-ppw-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-ppw-coral/90"
              >
                {pending === 'products' ? 'Clear products' : 'Clear all'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
