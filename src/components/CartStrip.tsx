/**
 * CartStrip - Week 3 build.
 *
 * Bottom strip on desktop, floating chip on mobile. Shows aggregated
 * cart in the user's selected display currency and links through to
 * the full /cart page.
 *
 * "Checkout" button at the right edge jumps straight to /checkout.
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
        className="flex items-center justify-between px-3 py-2 text-xs"
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
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-ppw-slate">
              Shipping + tax calculated at checkout. FX live-fetched daily.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/cart'); }}
                className="rounded-md border border-ppw-stone bg-white px-2.5 py-1 text-xs font-medium text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
              >
                View cart
              </button>
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/checkout'); }}
                className="rounded-md bg-ppw-teal px-3 py-1 text-xs font-semibold text-white hover:bg-ppw-teal/90"
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
      <div className="hidden md:flex shrink-0 flex-col border-t border-ppw-stone bg-white">
        {body}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed bottom-4 right-4 z-30 rounded-full bg-ppw-ink px-3 py-2 text-xs font-semibold text-white shadow-lg ring-1 ring-white/20 ${mobileOpen ? 'hidden' : ''}`}
      >
        Cart - {cart.totalItemCount} - {formatCurrency(cart.subtotal, currency)}
      </button>

      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-ppw-stone bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="float-right m-2 rounded-md border border-ppw-stone bg-white px-2 py-0.5 text-xs text-ppw-slate"
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
