/**
 * /order/track/:orderRef — OMS Wave 1.3 surface.
 *
 * Reads from /api/orders/:ref + polls /api/orders/:ref/status every 30s.
 * Renders the order's aggregate status + per-item status + tracking
 * data per item (from order_item_events).
 *
 * Phase 0 money-path (IMPL-1 defect 1a): this page is ALSO the PayPal
 * return leg for the marketplace rail. When PayPal redirects back with
 * `?token=<paypalOrderId>` we capture the funds via
 * /api/capturePaypalOrder BEFORE loading the order, clear the
 * marketplace cart on success (defect 4), strip the round-trip query
 * params, and resume normal polling. On failure a retry button
 * re-invokes the capture (idempotent server-side).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMarketplaceCart } from '../store/marketplaceCartStore';
import {
  readPaypalReturnParams,
  runPaypalReturnCapture,
  stripPaypalReturnParams,
} from '../lib/paypalReturn';
import {
  readGumroadReturnFlag,
  stripGumroadReturnParams,
  clearGumroadPendingRef,
} from '../lib/gumroadCheckout';

interface OrderItem {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
  merchantId: number;
  status: string | null;
  events: Array<{
    eventType: string;
    trackingNumber: string | null;
    carrier: string | null;
    note: string | null;
    createdAt: string;
  }>;
}

interface OrderDetail {
  orderRef: string;
  customerEmail: string;
  currency: string;
  totalMinor: number;
  paymentStatus: string;
  paymentRail: string;
  orderStatus: string;
  createdAt: string;
  items: OrderItem[];
}

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function statusColor(status: string | null): string {
  switch (status) {
    case 'delivered':
      return '#16a34a';
    case 'in_transit':
    case 'shipped':
      return '#2563eb';
    case 'confirmed':
      return '#0891b2';
    case 'failed':
    case 'returned':
      return '#dc2626';
    default:
      return '#6b7280';
  }
}

type CaptureState = 'idle' | 'capturing' | 'failed' | 'done';

export default function OrderTrackPage(): JSX.Element {
  const { orderRef } = useParams<{ orderRef: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const clearMarketplaceCart = useMarketplaceCart((s) => s.clear);

  // Read the PayPal return token ONCE — it is stripped from the URL after
  // a successful capture, so it must not be re-read from location.
  const paypalTokenRef = useRef<string | null>(
    typeof window !== 'undefined'
      ? readPaypalReturnParams(window.location.search).token
      : null,
  );
  const [captureState, setCaptureState] = useState<CaptureState>(
    paypalTokenRef.current ? 'capturing' : 'done',
  );
  const [captureError, setCaptureError] = useState<string | null>(null);

  // Gumroad return leg (?rail=gumroad): the order row already exists
  // (written pending at create-order time) — no client-side capture call.
  // The Ping webhook flips it pending → captured; we just poll faster and
  // show a "confirming payment" state until it lands.
  const gumroadReturnRef = useRef<boolean>(
    typeof window !== 'undefined' ? readGumroadReturnFlag(window.location.search) : false,
  );
  const [gumroadSettled, setGumroadSettled] = useState(false);

  const runCapture = useCallback(async () => {
    const token = paypalTokenRef.current;
    if (!token || !orderRef) {
      setCaptureState('done');
      return;
    }
    setCaptureState('capturing');
    setCaptureError(null);
    await runPaypalReturnCapture({
      token,
      orderRef,
      onSuccess: () => {
        // Cart is cleared ONLY now — after a confirmed capture
        // (IMPL-1 defect 4).
        clearMarketplaceCart();
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
  }, [orderRef, clearMarketplaceCart]);

  useEffect(() => {
    if (paypalTokenRef.current) void runCapture();
    // Run once on mount — retries go through the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!orderRef) return;
    // Hold off order loading until the capture settles — the order row is
    // written by the capture, so an early fetch would just 404.
    if (captureState === 'capturing') return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function loadDetail() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderRef!)}`);
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((j as { error?: string }).error ?? `HTTP ${res.status}`);
          setOrder(null);
        } else {
          setOrder(j as OrderDetail);
          setError(null);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Order lookup failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function pollStatus() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderRef!)}/status`);
        if (!res.ok) return;
        const j = (await res.json()) as {
          orderStatus: string;
          paymentStatus: string;
          items: Array<{ id: number; status: string | null }>;
        };
        if (cancelled) return;
        setOrder((prev) => {
          if (!prev) return prev;
          const itemMap = new Map(j.items.map((i) => [i.id, i.status]));
          return {
            ...prev,
            orderStatus: j.orderStatus,
            paymentStatus: j.paymentStatus,
            items: prev.items.map((it) => ({
              ...it,
              status: itemMap.get(it.id) ?? it.status,
            })),
          };
        });
      } catch {
        // Polling errors are silent — the next tick will retry.
      }
    }

    void loadDetail();
    // Gumroad return: the Ping webhook flips pending → captured server-side
    // (typically seconds after redirect) — poll fast until it settles.
    const pollMs = gumroadReturnRef.current && !gumroadSettled ? 5_000 : 30_000;
    interval = setInterval(() => void pollStatus(), pollMs);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [orderRef, captureState, gumroadSettled]);

  // Gumroad settle: once the webhook marks the order captured, clear the
  // marketplace cart (same only-after-confirmed-payment rule as PayPal),
  // drop the pending ref and strip the round-trip query params.
  useEffect(() => {
    if (!gumroadReturnRef.current || gumroadSettled) return;
    if (order?.paymentStatus === 'captured') {
      clearMarketplaceCart();
      clearGumroadPendingRef();
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', stripGumroadReturnParams(window.location.href));
      }
      setGumroadSettled(true);
    }
  }, [order?.paymentStatus, gumroadSettled, clearMarketplaceCart]);

  if (captureState === 'capturing') {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <p>Confirming your payment with PayPal…</p>
      </div>
    );
  }

  if (captureState === 'failed') {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <h1>Payment not confirmed yet</h1>
        <p style={{ color: '#6b7280' }}>
          Your PayPal approval went through but we could not confirm the
          capture{captureError ? ` (${captureError})` : ''}. No money is
          taken until the capture completes — please retry.
        </p>
        <button
          type="button"
          onClick={() => void runCapture()}
          style={{
            marginTop: 16,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            background: '#0891b2',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Retry payment confirmation
        </button>
        <p style={{ marginTop: 16 }}>
          <Link to="/marketplace/checkout">← Back to checkout</Link>
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
        <p>Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <h1>Order not found</h1>
        <p style={{ color: '#6b7280' }}>{error}</p>
        <p style={{ marginTop: 12 }}>
          <Link to="/products">← Back to marketplace</Link>
        </p>
      </div>
    );
  }

  const gumroadConfirming =
    gumroadReturnRef.current && !gumroadSettled && order.paymentStatus === 'pending';

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {gumroadConfirming && (
        <section
          role="status"
          style={{
            padding: 16,
            background: '#ecfeff',
            border: '1px solid #a5f3fc',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <strong>Confirming your payment…</strong>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#374151' }}>
            Gumroad is notifying us of your payment. This usually takes a few
            seconds — the page updates automatically. No further action needed.
          </p>
        </section>
      )}
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Order {order.orderRef}</h1>
        <p style={{ color: '#6b7280', margin: '4px 0 0' }}>
          {order.customerEmail} · {new Date(order.createdAt).toLocaleString()}
        </p>
      </header>

      <section
        style={{
          padding: 16,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Order status</p>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 600, color: statusColor(order.orderStatus) }}>
            {order.orderStatus.replace('_', ' ')}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Payment</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {order.paymentStatus} · {order.paymentRail}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>Total</p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {formatPrice(order.totalMinor, order.currency)}
          </p>
        </div>
      </section>

      <h2 style={{ fontSize: 18, margin: '24px 0 12px' }}>Items</h2>
      {order.items.length === 0 ? (
        <p style={{ color: '#6b7280' }}>
          Items not yet split. Re-check in a moment — split happens after payment confirmation.
        </p>
      ) : (
        order.items.map((item) => (
          <article
            key={item.id}
            style={{
              padding: 16,
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              marginBottom: 12,
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 8,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <strong>{item.name}</strong>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  SKU {item.sku} · ×{item.quantity} · supplier #{item.merchantId}
                </p>
              </div>
              <span
                style={{
                  padding: '2px 8px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: '#f3f4f6',
                  color: statusColor(item.status),
                  borderRadius: 999,
                }}
              >
                {(item.status ?? 'pending').replace('_', ' ')}
              </span>
            </header>
            {item.events.length > 0 && (
              <ol
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  fontSize: 12,
                  color: '#374151',
                  borderTop: '1px solid #f3f4f6',
                  paddingTop: 8,
                }}
              >
                {item.events.map((e, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ minWidth: 110, color: '#6b7280' }}>
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                    <span>
                      <strong>{e.eventType}</strong>
                      {e.carrier ? ` · ${e.carrier}` : ''}
                      {e.trackingNumber ? ` · ${e.trackingNumber}` : ''}
                      {e.note ? ` — ${e.note}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))
      )}

      <p style={{ fontSize: 11, color: '#6b7280', marginTop: 16 }}>
        Status updates every 30 seconds while this page is open.
      </p>
    </div>
  );
}
