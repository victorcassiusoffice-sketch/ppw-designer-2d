/**
 * /order/success - landing page after a successful Stripe payment.
 *
 * Stripe redirects here with `?cs={CHECKOUT_SESSION_ID}` (or `?id=`
 * fall-through if our local flow needs it).
 *
 * Week 4a: on mount we:
 *   1. Find the matching order in `ordersStore` (localStorage).
 *   2. Read the room-by-room snapshot stashed by CheckoutPage.
 *   3. Generate the plan PDF (jsPDF).
 *   4. Trigger an auto-download AND surface a "Download again" button.
 */

import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CartPageHeader } from '../components/CartPageHeader';
import { useOrdersStore } from '../store/ordersStore';
import { useCartMutations } from '../store/cartStore';
import { formatCurrency } from '../lib/currency';
import { generatePlanPdf, triggerPdfDownload } from '../lib/planPdf';
import { readLastOrderSnapshot, type LastOrderSnapshot } from '../lib/orderSnapshot';

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('id');
  const orders = useOrdersStore((s) => s.orders);
  const updateStatus = useOrdersStore((s) => s.updateStatus);
  const resetCart = useCartMutations((s) => s.resetCart);

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const downloadedOnce = useRef(false);

  const order = useMemo(() => {
    if (orderId) return orders.find((o) => o.id === orderId);
    return orders[0]; // newest first
  }, [orders, orderId]);

  // Mark paid + wipe cart mutations once on mount.
  useEffect(() => {
    if (order && order.status !== 'paid') updateStatus(order.id, 'paid');
    resetCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build the PDF once we know which order to use.
  useEffect(() => {
    if (!order) return;
    const snap = readLastOrderSnapshot();
    try {
      const input = buildPdfInput(order, snap);
      const blob = generatePlanPdf(input);
      setPdfBlob(blob);
      if (!downloadedOnce.current) {
        downloadedOnce.current = true;
        triggerPdfDownload(blob, `PPWellness-Plan-${order.id}.pdf`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPdfError(msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  function downloadAgain() {
    if (pdfBlob && order) triggerPdfDownload(pdfBlob, `PPWellness-Plan-${order.id}.pdf`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
      <CartPageHeader rightLabel={order && <span className="hidden md:inline text-ppw-slate text-[11px]">#{order.id}</span>} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-4 md:p-6">
        <div className="rounded-xl border border-ppw-teal bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ppw-teal text-white">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">Order received.</p>
              <p className="text-xs text-ppw-slate">Thank you. We are on it.</p>
            </div>
          </div>

          {order ? (
            <dl className="mt-5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-ppw-slate">Confirmation number</dt>
                <dd className="font-mono font-semibold">{order.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ppw-slate">Total</dt>
                <dd className="font-semibold">{formatCurrency(order.total, order.currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ppw-slate">Customer</dt>
                <dd>{order.customer.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ppw-slate">Email</dt>
                <dd>{order.customer.email}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-ppw-slate">
              No matching order found in this browser history.
            </p>
          )}

          <section className="mt-5 rounded-md bg-ppw-sand p-3 text-xs">
            <p className="font-semibold text-ppw-ink">Your plan PDF</p>
            {pdfError && (
              <p className="mt-1 text-ppw-coral">
                Could not generate the PDF automatically ({pdfError}). The install team will email
                you a copy.
              </p>
            )}
            {!pdfError && pdfBlob && (
              <p className="mt-1 text-ppw-slate">
                Your plan downloaded automatically. If your browser blocked it, use the button
                below.
              </p>
            )}
            {!pdfError && !pdfBlob && (
              <p className="mt-1 text-ppw-slate">Preparing your plan...</p>
            )}
            {pdfBlob && (
              <button
                type="button"
                onClick={downloadAgain}
                className="mt-2 rounded-md border border-ppw-teal bg-white px-3 py-1.5 text-xs font-semibold text-ppw-teal hover:bg-ppw-teal hover:text-white"
              >
                Download plan PDF again
              </button>
            )}
          </section>

          <section className="mt-5 rounded-md bg-ppw-sand p-3 text-xs">
            <p className="font-semibold text-ppw-ink">What happens next</p>
            <ol className="mt-1 ml-5 list-decimal space-y-1 text-ppw-slate">
              <li>The Peak Performance Wellness install team will email you within 24 hours.</li>
              <li>You will receive a delivery timeline tailored to your region.</li>
              <li>Installation is scheduled once your products land in country.</li>
              <li>Your floor plan is on file - we will bring it on install day.</li>
            </ol>
          </section>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/"
              className="rounded-md bg-ppw-teal px-4 py-2 text-sm font-semibold text-white hover:bg-ppw-teal/90"
            >
              Back to design
            </Link>
            <Link
              to="/orders"
              className="rounded-md border border-ppw-stone bg-white px-4 py-2 text-sm font-semibold text-ppw-slate hover:border-ppw-teal hover:text-ppw-teal"
            >
              View order history
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Merge the order (from ordersStore) with the per-room snapshot (from
 * orderSnapshot localStorage) into the shape generatePlanPdf wants.
 */
function buildPdfInput(
  order: NonNullable<ReturnType<typeof useOrdersStore.getState>['orders'][number]>,
  snap: LastOrderSnapshot | null,
) {
  if (snap && snap.orderId === order.id && snap.rooms.length > 0) {
    return {
      orderId: snap.orderId,
      date: snap.date,
      customerName: snap.customerName,
      customerEmail: snap.customerEmail,
      currency: snap.currency,
      total: snap.total,
      property: {
        name: snap.propertyName,
        rooms: snap.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          floorPlanDataUrl: r.floorPlanDataUrl,
          products: r.products,
        })),
      },
    };
  }
  const products = order.lines.map((l) => ({
    sku: l.productId,
    name: l.name,
    quantity: l.quantity,
    dimensions: '-',
    unitPriceDisplay: l.unitPriceDisplay,
    lineTotalDisplay: l.lineTotalDisplay,
  }));
  return {
    orderId: order.id,
    date: order.timestamp,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    currency: order.currency,
    total: order.total,
    property: {
      name: order.property?.name ?? 'Wellness Property',
      rooms: [{ id: 'all', name: 'All rooms', products }],
    },
  };
}
