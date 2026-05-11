/**
 * /order/cancelled — landing page after the user backs out of Stripe.
 *
 * No charge has happened; reassure the user and link back to the cart.
 */

import { Link } from 'react-router-dom';
import { CartPageHeader } from '../components/CartPageHeader';

export default function OrderCancelledPage() {
  return (
    <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
      <CartPageHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-4 md:p-6">
        <div className="rounded-xl border border-ppw-stone bg-white p-6 shadow-sm">
          <p className="text-2xl font-bold">Order cancelled.</p>
          <p className="mt-2 text-sm text-ppw-slate">
            No charge was made. Your cart and design are exactly as you left them.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/cart"
              className="rounded-md bg-ppw-teal px-4 py-2 text-sm font-semibold text-white hover:bg-ppw-teal/90"
            >
              Back to cart
            </Link>
            <Link
              to="/"
              className="rounded-md border border-ppw-stone bg-white px-4 py-2 text-sm font-semibold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
            >
              Keep designing
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
