/**
 * CartPage — Week 3.
 *
 * Full-screen cart view at `/cart`. Aggregates products across every
 * room in the active Property and exposes qty +/-, remove, and a
 * per-room breakdown panel.
 *
 * Layout:
 *   Desktop (md+): two-column — line items on the left, order summary
 *   sticky on the right.
 *   Mobile: stacked. Order summary sits below the lines.
 */

import { Link, useNavigate } from 'react-router-dom';
import { useCart, useCartMutations } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { usePropertyStore } from '../store/propertyStore';
import { CartPageHeader } from '../components/CartPageHeader';
import { CATEGORY_LABELS, thumbnailFor } from '../data/products';
import { formatCurrency } from '../lib/currency';
import { useState } from 'react';

export default function CartPage() {
  const cart = useCart();
  const property = usePropertyStore((s) => s.property);
  const currency = useCurrencyStore((s) => s.currency);
  const setQuantity = useCartMutations((s) => s.setQuantity);
  const removeProduct = useCartMutations((s) => s.removeProduct);
  const navigate = useNavigate();
  const [breakdownOpen, setBreakdownOpen] = useState(true);

  if (cart.totalItemCount === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
        <CartPageHeader />
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-2xl font-semibold">Your cart is empty.</p>
          <p className="mt-2 text-sm text-ppw-slate">
            Drag products onto your room canvas to start building your wellness setup.
          </p>
          <Link
            to="/"
            className="mt-6 rounded-md bg-ppw-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-ppw-teal/90"
          >
            ← Continue designing
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
      <CartPageHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:flex-row md:p-6">
        {/* Lines column */}
        <section className="flex-1 space-y-3">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Your cart</h1>
            <span className="text-xs text-ppw-slate">
              {cart.uniqueProductCount} product{cart.uniqueProductCount === 1 ? '' : 's'} ·{' '}
              {cart.totalItemCount} unit{cart.totalItemCount === 1 ? '' : 's'} ·{' '}
              {property.rooms.length} room{property.rooms.length === 1 ? '' : 's'}
            </span>
          </header>

          <ul className="space-y-3">
            {cart.lines.map((line) => (
              <li
                key={line.productId}
                className="flex flex-col gap-3 rounded-lg border border-ppw-stone bg-white p-3 md:flex-row md:items-center"
              >
                <div
                  className="h-16 w-16 shrink-0 rounded-md bg-ppw-sand p-1"
                  dangerouslySetInnerHTML={{ __html: thumbnailFor(line.product.category) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ppw-ink">
                    {line.product.name}
                  </p>
                  <p className="text-[11px] text-ppw-slate">
                    {CATEGORY_LABELS[line.product.category]} · {line.product.supplier}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ppw-slate">
                    Unit: {formatCurrency(line.unitPriceDisplay, currency)}
                    {line.unitCurrency !== currency && (
                      <span className="ml-1 text-[10px]">
                        ({formatCurrency(line.unitPrice, line.unitCurrency)})
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.productId, line.quantity - 1)}
                    className="h-7 w-7 rounded-md border border-ppw-stone bg-white text-sm font-bold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal disabled:opacity-30"
                    disabled={line.quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setQuantity(line.productId, parseInt(e.target.value, 10) || 1)
                    }
                    className="w-12 rounded-md border border-ppw-stone bg-white px-1 py-1 text-center text-sm focus:border-ppw-teal focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(line.productId, line.quantity + 1)}
                    className="h-7 w-7 rounded-md border border-ppw-stone bg-white text-sm font-bold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>

                <div className="text-right md:w-32">
                  <p className="text-sm font-bold text-ppw-ink">
                    {formatCurrency(line.lineTotalDisplay, currency)}
                  </p>
                  {line.placedCount !== line.quantity && (
                    <p className="text-[10px] text-ppw-slate">
                      ({line.placedCount} placed)
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => removeProduct(line.productId)}
                    className="mt-1 text-[11px] text-ppw-coral hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* Per-room breakdown */}
          <section className="rounded-lg border border-ppw-stone bg-white">
            <button
              type="button"
              onClick={() => setBreakdownOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-ppw-slate"
            >
              <span>Per-room breakdown</span>
              <span>{breakdownOpen ? '▾' : '▸'}</span>
            </button>
            {breakdownOpen && (
              <div className="border-t border-ppw-stone p-3 text-xs">
                {property.rooms.map((room) => {
                  const itemsInRoom: Array<{ name: string; count: number }> = [];
                  for (const line of cart.lines) {
                    const entry = line.perRoom.find((p) => p.roomId === room.id);
                    if (entry) itemsInRoom.push({ name: line.product.name, count: entry.count });
                  }
                  return (
                    <div key={room.id} className="mb-2 border-b border-ppw-stone/40 pb-2 last:border-b-0 last:pb-0">
                      <p className="font-semibold text-ppw-ink">{room.name}</p>
                      {itemsInRoom.length === 0 ? (
                        <p className="text-ppw-slate">No items in this room.</p>
                      ) : (
                        <ul className="ml-3 list-disc text-ppw-slate">
                          {itemsInRoom.map((i) => (
                            <li key={i.name}>
                              {i.name} <span className="text-[10px]">× {i.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex items-center gap-3 pt-2">
            <Link
              to="/"
              className="text-xs font-medium text-ppw-slate hover:text-ppw-teal"
            >
              ← Continue designing
            </Link>
          </div>
        </section>

        {/* Order summary column */}
        <aside className="md:w-80 md:shrink-0">
          <div className="sticky top-4 rounded-lg border border-ppw-stone bg-white p-4 shadow-sm">
            <p className="text-sm font-bold text-ppw-ink">Order summary</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-ppw-slate">
                <dt>Subtotal</dt>
                <dd className="text-ppw-ink">
                  {formatCurrency(cart.subtotal, currency)}
                </dd>
              </div>
              <div className="flex justify-between text-ppw-slate">
                <dt>Shipping</dt>
                <dd className="italic">Calculated at checkout</dd>
              </div>
              <div className="flex justify-between text-ppw-slate">
                <dt>Tax</dt>
                <dd className="italic">VAT/duties may apply</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-ppw-stone pt-3">
              <span className="text-sm font-bold text-ppw-ink">Total (est.)</span>
              <span className="text-lg font-bold text-ppw-ink">
                {formatCurrency(cart.subtotal, currency)}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-ppw-slate">
              ≈{' '}
              {(['USD', 'MUR', 'EUR', 'GBP'] as const)
                .filter((c) => c !== currency)
                .map((c) => formatCurrency(cart.subtotalByCurrency[c], c))
                .join(' · ')}
            </p>

            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="mt-4 block w-full rounded-md bg-ppw-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-ppw-teal/90"
            >
              Checkout →
            </button>

            <p className="mt-3 text-[10px] leading-relaxed text-ppw-slate">
              You will not be charged until the Peak Performance Wellness install team
              has confirmed availability + shipping for your region. Stripe is used for
              final payment.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
