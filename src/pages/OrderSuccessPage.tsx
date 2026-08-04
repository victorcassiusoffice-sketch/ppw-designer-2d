/**
 * /order/success - landing page after a successful Stripe payment.
 *
 * Stripe redirects here with `?cs={CHECKOUT_SESSION_ID}` (or `?id=`
 * fall-through if our local flow needs it).
 *
 * Week 4a: on mount we:
 *   1. Find the matching order in `ordersStore` (localStorage).
 *   2. Read the room-by-room snapshot stashed by CheckoutPage.
 *   3. Generate the plan PDF (jsPDF, fully vector since Hotfix 5).
 *   4. Trigger an auto-download AND surface a "Download again" button.
 */

import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CartPageHeader } from '../components/CartPageHeader';
import { useOrdersStore } from '../store/ordersStore';
import { useCartMutations } from '../store/cartStore';
import { formatCurrency } from '../lib/currency';
import { generatePlanPdf, triggerPdfDownload } from '../lib/planPdf';
import { readLastOrderSnapshot, type LastOrderSnapshot } from '../lib/orderSnapshot';
import { runPaypalReturnCapture, stripPaypalReturnParams } from '../lib/paypalReturn';

type CaptureState = 'capturing' | 'failed' | 'done';

export default function OrderSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('id');
  const orders = useOrdersStore((s) => s.orders);
  const updateStatus = useOrdersStore((s) => s.updateStatus);
  const resetCart = useCartMutations((s) => s.resetCart);

  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const downloadedOnce = useRef(false);

  // PayPal return leg (IMPL-1 defect 1b): PayPal redirects back with
  // ?token=<paypalOrderId>&rail=paypal — the funds are only AUTHORISED
  // at that point. Capture BEFORE marking the local order paid. Read
  // once (the params are stripped after a successful capture).
  const paypalReturnRef = useRef<{ token: string; orderRef: string } | null>(
    (() => {
      const token = params.get('token');
      const rail = params.get('rail');
      const id = params.get('id');
      return token && rail === 'paypal' && id ? { token, orderRef: id } : null;
    })(),
  );
  const [captureState, setCaptureState] = useState<CaptureState>(
    paypalReturnRef.current ? 'capturing' : 'done',
  );
  const [captureError, setCaptureError] = useState<string | null>(null);

  const order = useMemo(() => {
    if (orderId) return orders.find((o) => o.id === orderId);
    return orders[0]; // newest first
  }, [orders, orderId]);

  const runCapture = useCallback(async () => {
    const ret = paypalReturnRef.current;
    if (!ret) {
      setCaptureState('done');
      return;
    }
    setCaptureState('capturing');
    setCaptureError(null);
    await runPaypalReturnCapture({
      token: ret.token,
      orderRef: ret.orderRef,
      onSuccess: () => {
        if (typeof window !== 'undefined') {
          window.history.replaceState(
            null,
            '',
            stripPaypalReturnParams(window.location.href),
          );
        }
        setCaptureState('done');
      },
      onFailure: (msg) => {
        setCaptureError(msg);
        setCaptureState('failed');
      },
    });
  }, []);

  useEffect(() => {
    if (paypalReturnRef.current) void runCapture();
    // Run once on mount — retries go through the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark paid + wipe cart mutations only once the payment is settled —
  // a failed PayPal capture must NOT mark the order paid or wipe the cart.
  useEffect(() => {
    if (captureState !== 'done') return;
    if (order && order.status !== 'paid') updateStatus(order.id, 'paid');
    resetCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureState]);

  // Build the PDF once we know which order to use (and payment settled).
  useEffect(() => {
    if (captureState !== 'done') return;
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
  }, [order?.id, captureState]);

  function downloadAgain() {
    if (pdfBlob && order) triggerPdfDownload(pdfBlob, `PPWellness-Plan-${order.id}.pdf`);
  }

  if (captureState === 'capturing') {
    return (
      <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
        <CartPageHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-xl font-semibold">Confirming your payment with PayPal…</p>
          <p className="mt-2 text-xs text-ppw-slate">Please keep this page open.</p>
        </main>
      </div>
    );
  }

  if (captureState === 'failed') {
    return (
      <div className="flex min-h-screen flex-col bg-ppw-sand text-ppw-ink">
        <CartPageHeader />
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-xl font-semibold">Payment not confirmed yet</p>
          <p className="mt-2 max-w-md text-sm text-ppw-slate">
            Your PayPal approval went through but we could not confirm the
            capture{captureError ? ` (${captureError})` : ''}. No money is
            taken until the capture completes — please retry.
          </p>
          <button
            type="button"
            onClick={() => void runCapture()}
            className="mt-4 rounded-md bg-ppw-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-ppw-teal/90"
          >
            Retry payment confirmation
          </button>
          <Link
            to="/checkout"
            className="mt-3 text-xs font-medium text-ppw-slate hover:text-ppw-teal"
          >
            Back to checkout
          </Link>
        </main>
      </div>
    );
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
  // Preferred path: snapshot carries polygon + placedItems geometry so
  // the PDF can vector-render the floor plan.
  if (snap && snap.orderId === order.id && snap.rooms.length > 0) {
    return {
      orderId: snap.orderId,
      date: snap.date,
      customerName: snap.customerName,
      customerEmail: snap.customerEmail,
      customerAddress: snap.customerAddress,
      currency: snap.currency,
      total: snap.total,
      shipping: snap.shipping,
      property: {
        name: snap.propertyName,
        rooms: snap.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          polygon: r.polygon ?? [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
          ],
          placedItems: (r.placedItems ?? []).map((it) => ({
            xM: it.xM,
            yM: it.yM,
            lengthM: it.lengthM,
            widthM: it.widthM,
            rotation: it.rotation,
            productId: it.productId,
            productName: it.productName,
            category: it.category,
            dimensionsLabel: it.dimensionsLabel,
            sku: it.sku,
          })),
          products: r.products.map((p) => ({
            sku: p.sku,
            name: p.name,
            quantity: p.quantity,
            dimensions: p.dimensions,
            supplier: p.supplier,
            unitPriceDisplay: p.unitPriceDisplay,
            lineTotalDisplay: p.lineTotalDisplay,
          })),
        })),
      },
    };
  }

  // Fallback path: no snapshot. Build a single placeholder room from
  // the order lines so the PDF still ships something useful.
  const products = order.lines.map((l) => ({
    sku: l.productId,
    name: l.name,
    quantity: l.quantity,
    dimensions: '-',
    unitPriceDisplay: l.unitPriceDisplay,
    lineTotalDisplay: l.lineTotalDisplay,
  }));
  const addressParts = [
    order.customer.addressLine1,
    order.customer.addressLine2,
    order.customer.city,
    order.customer.postcode,
    order.customer.country,
  ]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
  return {
    orderId: order.id,
    date: order.timestamp,
    customerName: order.customer.name,
    customerEmail: order.customer.email,
    customerAddress: addressParts.join(', '),
    currency: order.currency,
    total: order.total,
    property: {
      name: order.property?.name ?? 'Wellness Property',
      rooms: [
        {
          id: 'all',
          name: 'All rooms',
          polygon: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 4 },
            { x: 0, y: 4 },
          ],
          placedItems: [],
          products,
        },
      ],
    },
  };
}
