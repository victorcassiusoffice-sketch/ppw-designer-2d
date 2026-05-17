/**
 * MiniCartPill — Polish B (V4 Driver tick 35).
 *
 * Top-right CSS-absolute overlay rendered above the Konva Stage. Shows
 * unique-product count + total in the active display currency. Click
 * toggles the CartDrawer.
 *
 * Konva render + input handlers are NEVER touched (per Konva STABLE
 * LOCK 2026-05-16 + V4-TL-2 closure note). The pill lives in a sibling
 * DOM node above the Stage with `pointer-events-auto` on the pill
 * itself; the surrounding wrapper is `pointer-events-none` so panning /
 * pinch-zoom over empty canvas area still reaches Konva.
 *
 * Brand canon (V4-AU-1): gold `#C0A67E` accent, ink `#0E0E10`, cream
 * `#F5EFE6`. Hidden when the cart is empty so first-time users see a
 * clean canvas. Reappears the instant an item is placed (auto-add via
 * PolB.3).
 */
import { useCart } from '../../store/cartStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useCartUIStore } from '../../store/cartUIStore';
import { formatCurrency } from '../../lib/currency';

export function MiniCartPill() {
  const cart = useCart();
  const currency = useCurrencyStore((s) => s.currency);
  const toggle = useCartUIStore((s) => s.toggle);
  const isDrawerOpen = useCartUIStore((s) => s.isDrawerOpen);

  if (cart.totalItemCount === 0) return null;

  return (
    <div
      className="pointer-events-none absolute right-3 top-3 z-20 flex justify-end"
      data-testid="mini-cart-pill-wrapper"
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={`Open cart — ${cart.uniqueProductCount} unique products, ${cart.totalItemCount} items`}
        aria-expanded={isDrawerOpen}
        data-testid="mini-cart-pill"
        className="pointer-events-auto flex min-h-[40px] items-center gap-2 rounded-full border border-[#C0A67E] bg-[#0E0E10] px-3 py-1.5 text-xs font-semibold text-[#F5EFE6] shadow-lg ring-1 ring-[#C0A67E]/40 hover:bg-[#0E0E10]/90"
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#C0A67E]" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 4h2l1.5 9.5A2 2 0 0 0 8.5 15h6.5a2 2 0 0 0 2-1.5L18 7H6.2l-.4-2.4A1 1 0 0 0 4.8 4H3v0Zm6 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
          />
        </svg>
        <span className="rounded-full bg-[#C0A67E] px-1.5 py-[1px] text-[10px] font-bold text-[#0E0E10]">
          {cart.uniqueProductCount}
        </span>
        <span className="tabular-nums">
          {formatCurrency(cart.subtotal, currency)}
        </span>
      </button>
    </div>
  );
}
