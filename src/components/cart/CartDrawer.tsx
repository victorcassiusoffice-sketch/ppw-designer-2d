/**
 * CartDrawer — Polish B (V4 Driver tick 35).
 *
 * Right-edge 380px slide-in panel rendered above the Konva Stage when
 * MiniCartPill is tapped. Closes on ×, ESC, or backdrop click.
 *
 * V1 (per LIVE-READINESS-PUNCH-LIST.md PolB.2 + V4-UNIFIED-PLAN.md
 * M9.A.2 note): per-merchant grouping uses `product.supplier`; products
 * without a supplier roll up under "Peak Performance Wellness
 * Marketplace". V2 multi-merchant JOIN-on-`order_items` lands after
 * M9.B.1 (agent add_product) starts populating real merchant SKUs.
 *
 * Konva render + input handlers are untouched. The drawer is a sibling
 * DOM overlay over the canvas section.
 *
 * Brand canon (V4-AU-1): gold accent `#C0A67E`, ink `#0E0E10`, cream
 * `#F5EFE6`. Marketplace fee = 5% (locked referral-commission rate,
 * shared constant in src/lib/commission.ts; surfaced here as a
 * transparent line item).
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../store/cartStore';
import type { CartLine } from '../../store/cartStore';
import { useCurrencyStore } from '../../store/currencyStore';
import { useCartUIStore } from '../../store/cartUIStore';
import { formatCurrency } from '../../lib/currency';
import { PPW_COMMISSION_RATE, PPW_COMMISSION_PCT_LABEL } from '../../lib/commission';

const MARKETPLACE_FEE_PCT = PPW_COMMISSION_RATE;
const PPW_MARKETPLACE = 'Peak Performance Wellness Marketplace';

interface MerchantGroup {
  merchant: string;
  lines: CartLine[];
  subtotal: number;
}

function groupLinesByMerchant(lines: CartLine[]): MerchantGroup[] {
  const byMerchant = new Map<string, MerchantGroup>();
  for (const line of lines) {
    const merchant = line.product.supplier?.trim() || PPW_MARKETPLACE;
    const existing = byMerchant.get(merchant);
    if (existing) {
      existing.lines.push(line);
      existing.subtotal += line.lineTotalDisplay;
    } else {
      byMerchant.set(merchant, {
        merchant,
        lines: [line],
        subtotal: line.lineTotalDisplay,
      });
    }
  }
  return Array.from(byMerchant.values()).sort((a, b) => b.subtotal - a.subtotal);
}

export function CartDrawer() {
  const cart = useCart();
  const currency = useCurrencyStore((s) => s.currency);
  const isOpen = useCartUIStore((s) => s.isDrawerOpen);
  const close = useCartUIStore((s) => s.close);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  const groups = groupLinesByMerchant(cart.lines);
  const marketplaceFee = cart.subtotal * MARKETPLACE_FEE_PCT;
  const total = cart.subtotal + marketplaceFee;
  const isEmpty = cart.lines.length === 0;

  function handleCheckout() {
    // Route to the cartStore-backed checkout — the SAME store this drawer
    // reads (useCart). Previously navigated to /marketplace/checkout, which
    // reads a DIFFERENT store (marketplaceCartStore), so the customer's
    // placed-item cart arrived empty (2026-07-24 fix). Matches CartStrip.
    close();
    navigate('/checkout');
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={close}
        aria-hidden="true"
        data-testid="cart-drawer-backdrop"
      />
      <aside
        role="dialog"
        aria-label="Cart"
        aria-modal="true"
        data-testid="cart-drawer"
        className="fixed right-0 top-0 z-50 flex h-full w-[min(380px,100vw)] flex-col border-l border-[#C0A67E]/40 bg-[#F5EFE6] shadow-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <header className="flex items-center justify-between border-b border-[#C0A67E]/30 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[#0E0E10]">Your wellness room</p>
            <p className="text-[11px] text-[#0E0E10]/60">
              {cart.uniqueProductCount} unique · {cart.totalItemCount} placed
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close cart"
            data-testid="cart-drawer-close"
            className="rounded-md border border-[#C0A67E]/40 bg-white px-2 py-1 text-xs text-[#0E0E10] hover:border-[#C0A67E]"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-[#0E0E10]">Cart is empty</p>
              <p className="mt-1 text-xs text-[#0E0E10]/60">
                Drag a product onto the canvas — we'll add it here automatically.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {groups.map((g) => (
                <li key={g.merchant} data-testid="merchant-group">
                  <div className="flex items-baseline justify-between border-b border-[#C0A67E]/30 pb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#C0A67E]">
                      {g.merchant}
                    </p>
                    <p className="text-[11px] font-medium text-[#0E0E10]">
                      {formatCurrency(g.subtotal, currency)}
                    </p>
                  </div>
                  <ul className="mt-1.5 space-y-1.5">
                    {g.lines.map((l) => (
                      <li
                        key={l.productId}
                        className="flex items-baseline justify-between text-xs"
                        data-testid="cart-line"
                      >
                        <span className="truncate pr-2 text-[#0E0E10]">
                          <b className="text-[#0E0E10]">{l.quantity}</b>{' '}
                          <span className="text-[#0E0E10]/80">×</span> {l.product.name}
                        </span>
                        <span className="tabular-nums text-[#0E0E10]/80">
                          {formatCurrency(l.lineTotalDisplay, currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!isEmpty && (
          <div className="border-t border-[#C0A67E]/30 bg-white px-4 py-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[#0E0E10]/70">Subtotal</span>
              <span className="tabular-nums font-medium text-[#0E0E10]">
                {formatCurrency(cart.subtotal, currency)}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-[#0E0E10]/70">Marketplace fee ({PPW_COMMISSION_PCT_LABEL})</span>
              <span
                className="tabular-nums text-[#0E0E10]/80"
                data-testid="marketplace-fee"
              >
                {formatCurrency(marketplaceFee, currency)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-[#C0A67E]/20 pt-2 text-sm">
              <span className="font-semibold text-[#0E0E10]">Total</span>
              <span
                className="tabular-nums font-bold text-[#0E0E10]"
                data-testid="cart-drawer-total"
              >
                {formatCurrency(total, currency)}
              </span>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-[#0E0E10]/60">
              Shipping + tax calculated at checkout. P.S. your fascia thanks you — the right
              environment is half the protocol.
            </p>
          </div>
        )}

        <footer className="flex gap-2 border-t border-[#C0A67E]/30 bg-[#F5EFE6] px-4 py-3">
          <button
            type="button"
            onClick={close}
            className="flex-1 rounded-md border border-[#C0A67E]/40 bg-white px-3 py-2 text-xs font-medium text-[#0E0E10] hover:border-[#C0A67E]"
          >
            Keep designing
          </button>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isEmpty}
            data-testid="cart-drawer-checkout"
            className="flex-1 rounded-md bg-[#0E0E10] px-3 py-2 text-xs font-semibold text-[#F5EFE6] ring-1 ring-[#C0A67E] hover:bg-[#0E0E10]/90 disabled:opacity-50"
          >
            Checkout
          </button>
        </footer>
      </aside>
    </>
  );
}
