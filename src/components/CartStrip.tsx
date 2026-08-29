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
 * 2026-08-29 toolbar contract: the pill is the ink-on-paper pressed state
 * (`CHROME_ACTIVE_BG` fill, paper text) with the gold count badge — the
 * one pill-shaped thing in the chrome. The sheet is chrome ground, radius
 * 12, hairline rim, popover shadow; 48 px header row; 40 px buttons:
 * View cart = outlined ink, Checkout = ink primary (NOT gold — the gold
 * CTA in the designer is Request quote). No text below 11 px.
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

// Chrome recipe (toolbar contract 2026-08-29) — same strings as the
// DetailsPanel so the two surfaces are one control set.
const CTRL_BASE =
  'inline-flex h-11 md:h-10 items-center justify-center rounded-lg px-3 text-[12px] font-medium leading-none ' +
  'transition-colors duration-[120ms] ease-out motion-reduce:transition-none ' +
  'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] ' +
  'active:shadow-[inset_0_1px_2px_rgba(42,41,38,0.18)] disabled:opacity-40';
const CTRL_REST =
  `${CTRL_BASE} border border-ppw-rim bg-ppw-chrome text-ppw-charcoal ` +
  'hover:bg-[#f3f1ec] hover:border-[rgba(42,41,38,0.35)]';
/** Outlined ink: secondary action on a chrome sheet. */
const CTRL_OUTLINE_INK =
  `${CTRL_BASE} border border-ppw-inkDeep bg-ppw-chrome text-ppw-inkDeep ` +
  'hover:bg-[#f3f1ec]';
/** Ink primary: the sheet's main action. */
const CTRL_INK = `${CTRL_BASE} border border-ppw-inkDeep bg-ppw-inkDeep font-semibold text-ppw-paper hover:brightness-110`;
const CAPTION = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ppw-charcoal';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="motion-reduce:transition-none"
      style={{
        transform: open ? 'rotate(180deg)' : 'none',
        transition: 'transform 120ms ease-out',
      }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CartStrip() {
  const cart = useCart();
  const currency = useCurrencyStore((s) => s.currency);
  const navigate = useNavigate();
  // The sheet is opened deliberately, so show the line items straight away.
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Vic 2026-08-29: a painted / whole-room floor with no product yet is
  // STILL a cart — the strip used to hide until the first product landed,
  // which read as "the floor does not cost anything".
  const floorUnits = cart.floorLines.reduce((acc, f) => acc + f.unitsToOrder, 0);
  if (cart.totalItemCount === 0 && cart.floorLines.length === 0) {
    return null;
  }

  const altCurrency = currency === 'MUR' ? 'USD' : 'MUR';

  const body = (
    <div className="flex w-full flex-col">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 text-[12px] font-medium text-ppw-charcoal transition-colors duration-[120ms] ease-out motion-reduce:transition-none hover:bg-[#f3f1ec] focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)]"
      >
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-ppw-inkDeep px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ppw-paper">
            Cart
          </span>
          <span>
            <b className="text-ppw-inkDeep">{cart.uniqueProductCount}</b> unique - <b className="text-ppw-inkDeep">{cart.totalItemCount}</b> placed
            {cart.floorLines.length > 0 && (
              <>
                {' '}- <b className="text-ppw-inkDeep" data-testid="cart-floor-units">{floorUnits}</b> floor units
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-ppw-inkDeep">
            {formatCurrency(cart.subtotal, currency)}
          </span>
          <span className="hidden sm:inline text-[11px] font-medium tabular-nums text-ppw-charcoal">
            ~ {formatCurrency(cart.subtotalByCurrency[altCurrency], altCurrency)}
          </span>
          <Chevron open={expanded} />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-ppw-rim bg-ppw-rail px-4 py-3">
          {/* 390 px phones (polish 2026-08-29): the table used to be a
              440 px-wide grid inside a 358 px scroller, which pushed the
              LINE column and both subtotal amounts off-screen and left the
              SUBTOTAL row reading blank. Below `sm` the Cat. and Unit
              columns are dropped (unit price sits under the product name)
              so Product | Qty | Line fits the sheet with Line as the only
              money column; the subtotal rows are a footer OUTSIDE the
              scroller so they are always visible. */}
          <div className="scroll-pane w-full max-h-[40vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className={`text-left ${CAPTION}`}>
                <th className="py-1 font-semibold">Product</th>
                <th className="hidden py-1 font-semibold sm:table-cell">Cat.</th>
                <th className="py-1 text-right font-semibold">Qty</th>
                <th className="hidden py-1 text-right font-semibold sm:table-cell">Unit</th>
                <th className="py-1 text-right font-semibold">Line</th>
              </tr>
            </thead>
            <tbody>
              {cart.lines.map((l) => (
                <tr key={l.productId} className="border-t border-ppw-rim">
                  <td className="py-1.5 pr-2 font-medium text-ppw-inkDeep max-w-[180px] sm:max-w-[200px]">
                    <span className="block truncate">{l.product.name}</span>
                    <span className="block text-[11px] font-medium tabular-nums text-ppw-charcoal sm:hidden">
                      {formatCurrency(l.unitPriceDisplay, currency)} each · {CATEGORY_LABELS[l.product.category]}
                    </span>
                  </td>
                  <td className="hidden py-1.5 pr-2 text-ppw-charcoal sm:table-cell">
                    {CATEGORY_LABELS[l.product.category]}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-ppw-inkDeep">{l.quantity}</td>
                  <td className="hidden py-1.5 text-right tabular-nums text-ppw-charcoal sm:table-cell">
                    {formatCurrency(l.unitPriceDisplay, currency)}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-ppw-inkDeep whitespace-nowrap">
                    {formatCurrency(l.lineTotalDisplay, currency)}
                  </td>
                </tr>
              ))}
              {/* Floor lines: sold by the unit (tile / roll / pack), so the
                  Qty is units to ORDER incl. the cut-edge surplus. */}
              {cart.floorLines.map((f) => (
                <tr key={f.lineId} className="border-t border-ppw-rim" data-testid="cart-floor-line">
                  <td className="py-1.5 pr-2 font-medium text-ppw-inkDeep max-w-[180px] sm:max-w-[200px]">
                    <span className="block truncate">
                      {f.materialName}
                      {f.surplusUnits > 0 && (
                        <span className="ml-1 text-[11px] font-medium text-ppw-charcoal">
                          (+{f.surplusUnits} for cuts)
                        </span>
                      )}
                    </span>
                    <span className="block text-[11px] font-medium tabular-nums text-ppw-charcoal sm:hidden">
                      {formatCurrency(f.unitPriceDisplay, currency)} each · Floor
                    </span>
                  </td>
                  <td className="hidden py-1.5 pr-2 text-ppw-charcoal sm:table-cell">Floor</td>
                  <td className="py-1.5 text-right tabular-nums text-ppw-inkDeep whitespace-nowrap">
                    {f.unitsToOrder} {f.unit}
                    {f.unitsToOrder === 1 ? '' : 's'}
                  </td>
                  <td className="hidden py-1.5 text-right tabular-nums text-ppw-charcoal sm:table-cell">
                    {formatCurrency(f.unitPriceDisplay, currency)}
                  </td>
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-ppw-inkDeep whitespace-nowrap">
                    {formatCurrency(f.lineTotalDisplay, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {/* Subtotal footer — outside the scroller, always on screen. */}
          <div className="border-t-2 border-ppw-inkDeep">
            <div className="flex items-baseline justify-end gap-4 py-1.5">
              <span className={CAPTION}>Subtotal</span>
              <span className="text-[13px] font-bold tabular-nums text-ppw-inkDeep">
                {formatCurrency(cart.subtotal, currency)}
              </span>
            </div>
            <div className="flex items-baseline justify-end gap-4 py-0.5">
              <span className={CAPTION}>~ {altCurrency}</span>
              <span className="text-[12px] font-medium tabular-nums text-ppw-charcoal">
                {formatCurrency(cart.subtotalByCurrency[altCurrency], altCurrency)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] font-medium text-ppw-charcoal">
              Shipping + tax calculated at checkout. FX live-fetched daily.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/cart'); }}
                className={CTRL_OUTLINE_INK}
              >
                View cart
              </button>
              <button
                type="button"
                onClick={() => { setMobileOpen(false); navigate('/checkout'); }}
                className={CTRL_INK}
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
          when they are not mounted. Ink fill + paper text (the chrome's
          pressed state) with the gold count badge — the only place the
          chrome uses a 9999 radius besides the badges themselves. */}
      <button
        type="button"
        data-testid="cart-pill"
        onClick={() => setMobileOpen(true)}
        aria-label={`Open cart — ${cart.totalItemCount} items, ${formatCurrency(cart.subtotal, currency)}`}
        aria-expanded={mobileOpen}
        className={`fixed right-4 z-30 flex min-h-[44px] md:min-h-[40px] items-center gap-2 rounded-full bg-ppw-inkDeep px-4 py-2 text-[12px] font-semibold text-ppw-paper transition duration-[120ms] ease-out motion-reduce:transition-none hover:brightness-110 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(121,199,173,0.45)] ${
          mobileOpen ? 'hidden' : ''
        }`}
        style={{
          bottom:
            'calc(max(1rem, env(safe-area-inset-bottom)) + var(--sims-dock-h, 0px) + var(--sims-toolbar-h, 0px))',
          boxShadow: '0 12px 32px rgba(42,41,38,0.18)',
        }}
      >
        <svg viewBox="0 0 20 20" width={16} height={16} className="text-ppw-paper" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 4h2l1.5 9.5A2 2 0 0 0 8.5 15h6.5a2 2 0 0 0 2-1.5L18 7H6.2l-.4-2.4A1 1 0 0 0 4.8 4H3v0Zm6 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
          />
        </svg>
        <span className="rounded-full bg-ppw-paper px-1.5 py-[1px] text-[11px] font-bold tabular-nums text-ppw-inkDeep">
          {cart.totalItemCount + floorUnits}
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
            className="fixed bottom-0 left-0 right-0 z-40 rounded-t-xl border-t border-ppw-rim bg-ppw-chrome md:left-auto md:w-[min(96vw,720px)]"
            style={{
              paddingBottom: 'env(safe-area-inset-bottom)',
              boxShadow: '0 -12px 32px rgba(42,41,38,0.18)',
            }}
          >
            <div className="flex justify-end px-2 pt-2">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className={CTRL_REST}
              >
                Close
              </button>
            </div>
            {body}
          </div>
        </>
      )}
    </>
  );
}
