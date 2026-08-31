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
 * the full-width Sims bottom toolbar. Visual register (toolbar pass,
 * 2026-08-29) is the designer chrome: 40 px (44 on the phone) paper-and-rim
 * controls; "Clear all" keeps an INK label with a terracotta icon + rim
 * (terracotta text on white was 3.09:1) and fills terracotta on hover.
 */
import { useEffect, useState } from 'react';
import { clearActiveRoomProducts, clearEntireDesign } from '../lib/clearActions';
import { useDesignStore } from '../store/designStore';
import { useToastStore } from '../store/toastStore';

type PendingClear = 'products' | 'all' | null;

/**
 * Shared chrome: 120 ms colours, mint focus ring, inset press, 40 % disabled.
 * Polish (2026-08-29): below md the pair used to be icon-only squares (a
 * trash + a terracotta X that read as "close"); they are now 44 px pills
 * with an icon + a short 11/600 label ("Items" / "All"), full names in the
 * aria-label / title. 40 px labelled controls from md.
 */
const CTRL =
  'pointer-events-auto inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-[11px] font-semibold md:text-[12px] md:font-medium leading-none transition-colors duration-[120ms] ease-out motion-reduce:transition-none focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:cursor-not-allowed disabled:opacity-40 md:h-10';
const CTRL_REST =
  'bg-ppw-chrome border-ppw-rim text-[#37362f] shadow-sm hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
const CTRL_DANGER =
  'group bg-ppw-chrome border-ppw-clay text-ppw-inkDeep shadow-sm hover:bg-ppw-clay hover:border-ppw-clay hover:text-white';

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
  // the action is harmless either way). "Clear all" is NEVER disabled: a
  // freshly-seeded room is polygon:[] so the old `!hasProducts && !hasRoom`
  // gate wrongly disabled it on a blank canvas — the exact "always reset a
  // half-drawn room" case the button exists for. clearEntireDesign() is
  // harmless + a single undoable frame (Ctrl+Z), so it always stays live.
  const hasProducts = placedItems.length > 0;

  return (
    <>
      <div
        className="pointer-events-none absolute z-30 flex items-center gap-2"
        // 2026-08-25: mobile used to pin these at `top-16`, where they
        // covered the canvas readout badges. They are now bottom-left at
        // EVERY width — the same place desktop already put them.
        // Toolbar pass (2026-08-29): `<main>` now pads by the mobile
        // toolbar's live height, so this section already ends ABOVE the
        // toolbar at every width — no toolbar offset here any more (adding
        // it back would double it).
        style={{
          left: 'max(0.75rem, env(safe-area-inset-left))',
          bottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
        data-testid="clear-controls"
      >
        <button
          type="button"
          data-testid="clear-products-button"
          onClick={() => setPending('products')}
          disabled={!hasProducts}
          title="Remove all placed products, keep the room (Shift+P)"
          aria-label="Clear products"
          className={`${CTRL} ${CTRL_REST}`}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              d="M3 5h10M6.5 5V3.5h3V5M5 5l.6 8h4.8L11 5"
            />
          </svg>
          {/* Short label below md (the cart pill shares this band on a
              phone); the full name from md up and in the aria-label. */}
          <span className="md:hidden">Products</span>
          <span className="hidden md:inline">Clear products</span>
        </button>
        <button
          type="button"
          data-testid="clear-all-button"
          onClick={() => setPending('all')}
          title="Delete the whole room + products, start blank (Shift+X)"
          aria-label="Clear all"
          className={`${CTRL} ${CTRL_DANGER}`}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4 text-ppw-clay transition-colors duration-[120ms] group-hover:text-white motion-reduce:transition-none"
            aria-hidden="true"
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.5 3.5l9 9M12.5 3.5l-9 9"
            />
          </svg>
          <span className="md:hidden">Clear all</span>
          <span className="hidden md:inline">Clear all</span>
        </button>
      </div>

      {pending && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-controls-title"
          data-testid="clear-controls-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(42,41,38,0.55)] px-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPending(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPending(null);
          }}
        >
          <div className="w-[min(92vw,360px)] rounded-xl border border-ppw-rim bg-ppw-chrome p-5 text-[#37362f] shadow-[0_12px_32px_rgba(42,41,38,0.18)]">
            <h2 id="clear-controls-title" className="text-sm font-semibold">
              {pending === 'products' ? 'Clear all products?' : 'Clear everything?'}
            </h2>
            <p className="mt-1 text-xs leading-snug text-ppw-charcoal">
              {pending === 'products'
                ? 'This removes every product you have placed. Your drawn room stays. Press Ctrl+Z to restore.'
                : 'This deletes the whole room and every product, leaving a fresh blank canvas. Press Ctrl+Z to restore.'}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPending(null)}
                className={`${CTRL} ${CTRL_REST} flex-1 text-sm`}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="clear-controls-confirm"
                onClick={confirmClear}
                className={`${CTRL} ${CTRL_DANGER} flex-1 text-sm font-semibold`}
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
