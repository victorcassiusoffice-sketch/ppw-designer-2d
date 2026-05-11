/**
 * /orders — local-only order history.
 *
 * Reads from `ordersStore` (localStorage `wrd_orders`). Until Phase 2
 * adds a real backend, this is the only place a user can see what they
 * have ordered.
 */

import { Link } from 'react-router-dom';
import { CartPageHeader } from '../components/CartPageHeader';
import { useOrdersStore } from '../store/ordersStore';
import { formatCurrency } from '../lib/currency';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-ppw-stone text-ppw-slate',
  paid: 'bg-ppw-teal text-white',
  cancelled: 'bg-ppw-coral text-white',
};

export default function OrdersPage() {
  const orders = useOrdersStore((s) => s.orders);
  const clearOrders = useOrdersStore((s) => s.clearOrders);

  return (
    <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
      <CartPageHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-4 md:p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Your orders</h1>
            <p className="text-xs text-ppw-slate">
              Stored locally on this device. Phase 2 adds an account-backed history.
            </p>
          </div>
          {orders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Clear local order history? This does NOT cancel any pending orders with PPW.')) {
                  clearOrders();
                }
              }}
              className="text-[11px] text-ppw-slate hover:text-ppw-coral"
            >
              Clear history
            </button>
          )}
        </header>

        {orders.length === 0 ? (
          <div className="rounded-lg border border-ppw-stone bg-white p-6 text-center text-sm text-ppw-slate">
            No orders yet. <Link to="/" className="text-ppw-teal underline">Start designing</Link>.
          </div>
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id} className="rounded-lg border border-ppw-stone bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold">{o.id}</p>
                    <p className="text-[11px] text-ppw-slate">
                      {new Date(o.timestamp).toLocaleString()} · {o.customer.name} · {o.customer.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        STATUS_BADGE[o.status] ?? 'bg-ppw-stone text-ppw-slate'
                      }`}
                    >
                      {o.status}
                    </span>
                    <span className="text-sm font-bold">
                      {formatCurrency(o.total, o.currency)}
                    </span>
                  </div>
                </div>
                <ul className="mt-2 text-xs text-ppw-slate">
                  {o.lines.map((l) => (
                    <li key={l.productId}>
                      {l.name} × {l.quantity} —{' '}
                      <span className="text-ppw-ink">
                        {formatCurrency(l.lineTotalDisplay, o.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
