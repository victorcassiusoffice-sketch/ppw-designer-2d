/**
 * /order/pending — fallback when Stripe is not yet configured.
 *
 * Shows the order summary and a mailto: link that prefills an email to
 * victor@ppwellness.co with the order JSON so Vic can manually finalise
 * payment + delivery with the customer.
 */

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CartPageHeader } from '../components/CartPageHeader';
import { useOrdersStore } from '../store/ordersStore';
import { formatCurrency } from '../lib/currency';

const VIC_EMAIL = 'victor@ppwellness.co';

export default function OrderPendingPage() {
  const [params] = useSearchParams();
  const orderId = params.get('id');
  const orders = useOrdersStore((s) => s.orders);
  const order = useMemo(() => {
    if (orderId) return orders.find((o) => o.id === orderId);
    return orders[0];
  }, [orders, orderId]);

  const mailtoHref = useMemo(() => {
    if (!order) return `mailto:${VIC_EMAIL}`;
    const subject = `[PPW Designer] New order ${order.id}`;
    const summary = order.lines
      .map(
        (l) =>
          `- ${l.name} × ${l.quantity} = ${formatCurrency(l.lineTotalDisplay, order.currency)}`,
      )
      .join('\n');
    const body = [
      `Hi Vic,`,
      ``,
      `New order from the Wellness Room Designer.`,
      ``,
      `Order ID: ${order.id}`,
      `Total: ${formatCurrency(order.total, order.currency)}`,
      ``,
      `Customer:`,
      `  Name: ${order.customer.name}`,
      `  Email: ${order.customer.email}`,
      `  Phone: ${order.customer.phone}`,
      `  Address: ${order.customer.addressLine1}${order.customer.addressLine2 ? ', ' + order.customer.addressLine2 : ''}, ${order.customer.city}, ${order.customer.postcode}, ${order.customer.country}`,
      ``,
      `Items:`,
      summary,
      ``,
      `Notes:`,
      order.customer.notes || '(none)',
      ``,
      `--- Full payload (JSON) ---`,
      JSON.stringify(order, null, 2),
    ].join('\n');
    return `mailto:${VIC_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [order]);

  return (
    <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
      <CartPageHeader rightLabel={order && <span className="hidden md:inline text-ppw-slate text-[11px]">#{order.id}</span>} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-4 md:p-6">
        <div className="rounded-xl border border-ppw-stone bg-white p-6 shadow-sm">
          <p className="text-2xl font-bold">Order received.</p>
          <p className="mt-2 text-sm text-ppw-slate">
            Vic will contact you within 24 hours to finalise payment and delivery.
            Live Stripe checkout will be enabled shortly.
          </p>

          {order ? (
            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ppw-slate">Confirmation number</dt>
                <dd className="font-mono font-semibold">{order.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ppw-slate">Total (estimate)</dt>
                <dd className="font-semibold">{formatCurrency(order.total, order.currency)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ppw-slate">
              No matching order found. <Link to="/cart" className="text-ppw-teal underline">Back to cart</Link>.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-2 md:flex-row">
            <a
              href={mailtoHref}
              className="rounded-md bg-ppw-teal px-4 py-2 text-center text-sm font-semibold text-white hover:bg-ppw-teal/90"
            >
              Email order to Vic
            </a>
            <Link
              to="/orders"
              className="rounded-md border border-ppw-stone bg-white px-4 py-2 text-center text-sm font-semibold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
            >
              View my orders
            </Link>
            <Link
              to="/"
              className="rounded-md border border-ppw-stone bg-white px-4 py-2 text-center text-sm font-semibold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
            >
              Back to designer
            </Link>
          </div>

          <p className="mt-4 text-[10px] leading-relaxed text-ppw-slate">
            This is the Week-3 manual-handover path. Once Stripe is live (Week 4) you'll
            be redirected to Stripe Checkout to pay securely with card or bank transfer.
          </p>
        </div>
      </main>
    </div>
  );
}
