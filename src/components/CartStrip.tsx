/**
 * CartStrip - Week 3 build.
 *
 * 2026-08-25 (Vic complaint 2): the desktop full-width bottom strip is
 * GONE. It was the single most expensive piece of chrome on the canvas —
 * 209 px of always-expanded line-item table that dropped the drawing
 * surface from 94.8 % to 75.5 % of viewport height the moment one product
 * was placed. It is now a floating PILL at bottom-right (above the Sims
 * dock) at EVERY width; clicking it expands the exact same cart UI as a
 * sheet. Nothing was removed — the table, the FX line, View cart and
 * Checkout are all still one tap away.
 *
 * "Checkout" button at the right edge jumps straight to /checkout.
 *
 * fix/mobile-ux-v1 (May 2026): safe-area-inset-bottom padding on the
 * floating Cart chip + bottom-sheet so the Android Chrome nav bar
 * doesn't clip them. Tap targets ≥44px.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { CATEGORY_LABELS } from '../data/products';
import { formatCurrency } from '../lib/currency';

export function CartStrip() {
  const cart = useCart();
  const currency = useCurrencyStore((s) => s.currency);
  const navigate = useNavigate();
  // The sheet is opened deliberately, so show the line items straight away.
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (cart.totalItemCount === 0) {
    return null;
  }

  const altCurrency = currency === 'MUR' ? 'USD' : 'MUR';

  const body = (
    <div className="flex w-full flex-col">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] items-center justify-between px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-ppw-teal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Cart
          </span>
          <span className="text-ppw-slate">
            <b className="text-ppw-ink">{cart.uniqueProductCount}</b> unique - <b className="text-ppw-ink">{cart.totalItemCount}</b> placed
          </span>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-ppw-ink">
            {formatCurrency(cart.subtotal, currency)}
          </span>
          <span className="hidden sm:inline text-[11px] text-ppw-slate">
            ~ {formatCurrency(cart.subtotalByCurrency[altCurrency], altCurrency)}
          </span>
          <span className="text-[10px] text-ppw-slate">{expanded ? 'v' : '>'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-ppw-stone bg-ppw-sand px-3 py-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-ppw-slate">
                <th className="py-1">Product</th>
                <th className="py-1">Cat.</th>
                <th className="py-1 text-right">Qty</th>
                <th className="py-1 text-right">Unit</th>
                <th className="py-1 text-right">Line</th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map((l) => (
                <tr key={l.productId} className="border-t border-ppw-stone/60">
                  <td className="py-1 pr-2 font-medium text-ppw-ink truncate max-w-[200px]">
                    {l.product.name}
                  </td>
                  <td className="py-1 pr-2 text-ppw-slate">
                    {CATEGORY_LABELS[l.product.category]}
                  </td>
                  <td className="py-1 text-right text-ppw-ink">{l.quantity}</td>
                  <td className="py-1 text-right text-ppw-slate">
                    {formatCurrency(l.unitPriceDisplay, currency)}
                  </td>
                  <td className="py-1 text-right font-semibold text-ppw-ink">
                    {formatCurrency(l.lineTotalDisplay, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ppw-ink text-[11px]">
                <td className="py-1.5" colSpan={3}></td>
                <td className="py-1.5 text-right uppercase tracking-wide text-ppw-slate text-[10px]">
                  Subtotal
                </td>
                <td className="py-1.5 text-right font-bold text-ppw-ink">
                  {formatCurrency(cart.subtotal, currency)}
                </td>
              </tr>
              <tr>
                <td colSpan={3}></td>
                <td className="py-0.5 text-right uppercase tracking-wide text-ppw-slate text-[10px]">
                  ~ {altCurrency}
                </td>
                <td className="py-0.5 text-right text-ppw-slate text-[11px]">
                  {formatCurrency(cart.subtotalByCurrency[altCurrency], altCurrency)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-ppw-slate">
              Shipping + tax calculated at checkout. FX live-fetched daily.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/cart'); }}
                className="min-h-[40px] rounded-md border border-ppw-stone bg-white px-3 text-xs font-medium text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
              >
                View cart
              </button>
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/checkout'); }}
                className="min-h-[40px] rounded-md bg-ppw-teal px-3 text-xs font-semibold text-white hover:bg-ppw-teal/90"
              >
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Collapsed state: a pill. Parked bottom-right, clear of the Sims
          dock (desktop `--sims-dock-h`) and the mobile toolbar
          (`--sims-toolbar-h`), both published by those components and 0 px
          when they are not mounted. */}
      <button
        type="button"
        data-testid="cart-pill"
        onClick={() => setMobileOpen(true)}
        aria-label={`Open cart — ${cart.totalItemCount} items, ${formatCurrency(cart.subtotal, currency)}`}
        aria-expanded={mobileOpen}
        className={`fixed right-4 z-30 flex min-h-[44px] items-center gap-2 rounded-full bg-ppw-ink px-3.5 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/20 transition hover:brightness-110 ${
          mobileOpen ? 'hidden' : ''
        }`}
        style={{
          bottom:
            'calc(max(1rem, env(safe-area-inset-bottom)) + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px))',
        }}
      >
        <svg viewBox="0 0 20 20" className="h-4 w-4 text-[#FFBB58]" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 4h2l1.5 9.5A2 2 0 0 0 8.5 15h6.5a2 2 0 0 0 2-1.5L18 7H6.2l-.4-2.4A1 1 0 0 0 4.8 4H3v0Zm6 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
          />
        </svg>
        <span className="rounded-full bg-[#FFBB58] px-1.5 py-[1px] text-[10px] font-bold text-ppw-ink">
          {cart.totalItemCount}
        </span>
        <span className="tabular-nums">{formatCurrency(cart.subtotal, currency)}</span>
      </button>

      {/* Expanded state: the SAME cart body, as a bottom sheet. */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div
            data-testid="cart-sheet"
            className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-ppw-stone bg-white shadow-2xl md:left-auto md:w-[min(96vw,720px)] md:rounded-t-2xl"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="float-right m-2 min-h-[36px] rounded-md border border-ppw-stone bg-white px-2 text-xs text-ppw-slate"
            >
              Close
            </button>
            {body}
          </div>
        </>
      )}
    </>
  );
}
