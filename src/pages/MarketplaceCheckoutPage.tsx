/**
 * /marketplace/checkout — OMS Wave 1.2 surface.
 *
 * Renders the per-merchant breakdown coming back from /api/cart-quote
 * with the PPW commission line transparent before checkout. Hands off
 * to the existing PayPal Standard rail (createPaypalOrder).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarketplaceCart } from '../store/marketplaceCartStore';
import '../styles/soft-shop.css';

interface MerchantSubtotal {
  merchantId: number;
  currency: string;
  itemCount: number;
  subtotalMinor: number;
  items: Array<{
    productId: number;
    sku: string;
    name: string;
    quantity: number;
    unitPriceMinor: number;
    lineTotalMinor: number;
  }>;
}

interface QuoteResponse {
  ok: true;
  currency: string;
  totalMinor: number;
  merchantBreakdown: MerchantSubtotal[];
}

const PPW_COMMISSION_RATE = 0.07;

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function MarketplaceCheckoutPage(): JSX.Element {
  const items = useMarketplaceCart((s) => s.items);
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quoteBody = useMemo(
    () => ({
      cart: items.map((i) => ({
        productId: i.productId,
        sku: i.sku,
        name: i.name,
        quantity: i.quantity,
        unitPriceMinor: i.unitPriceMinor,
        currency: i.currency,
      })),
    }),
    [items],
  );

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    fetch('/api/cart-quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(quoteBody),
    })
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError((j as { error?: string }).error ?? `HTTP ${res.status}`);
        } else {
          setQuote(j as QuoteResponse);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Quote failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [quoteBody, items.length]);

  async function payWithPaypal() {
    if (!quote) return;
    if (!customerEmail || !customerEmail.includes('@')) {
      setError('Email required for order tracking.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // PPW order ref is generated client-side so the cart can survive
      // a redirect-and-return — the same ref will be used by the order
      // tracking page.
      const orderRef = `mp_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const origin = window.location.origin;
      const res = await fetch('/api/createPaypalOrder', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cart: items.map((i) => ({
            productId: String(i.productId),
            name: i.name,
            quantity: i.quantity,
            unitAmount: i.unitPriceMinor,
            currency: i.currency,
            imageUrl: i.imageUrl ?? undefined,
          })),
          customer: {
            name: customerEmail.split('@')[0] ?? 'Customer',
            email: customerEmail,
            phone: '',
            addressLine1: '',
            city: '',
            postcode: '',
            country: 'MU',
          },
          currency: quote.currency,
          successUrl: `${origin}/order/track/${orderRef}`,
          cancelUrl: `${origin}/marketplace/checkout`,
          orderId: orderRef,
          notes: `Marketplace cart, ${items.length} SKUs, ${
            quote.merchantBreakdown.length
          } suppliers`,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        approvalUrl?: string;
        paypalOrderId?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      // IMPL-1 defect 4: do NOT clear the cart here. The buyer may cancel
      // at PayPal and come back via cancelUrl — the cart must survive.
      // The cart is cleared on CAPTURE SUCCESS (OrderTrackPage return leg).
      if (j.approvalUrl) {
        window.location.href = j.approvalUrl;
        return;
      }
      navigate(`/order/track/${orderRef}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PayPal handoff failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="soft-page">
        <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h1>No items to check out.</h1>
          <p className="soft-muted" style={{ marginTop: 12 }}>
            <Link to="/products">Browse the marketplace</Link> to get started.
          </p>
          <p style={{ marginTop: 20 }}>
            <Link to="/products" className="soft-pill soft-pill--primary">Back to the shop</Link>
          </p>
        </div>
      </div>
    );
  }

  const commissionMinor = quote ? Math.round(quote.totalMinor * PPW_COMMISSION_RATE) : 0;

  return (
    <div className="soft-page">
    <div style={{ padding: '28px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>Checkout</h1>
          <p className="soft-muted" style={{ margin: '2px 0 0', fontSize: 13.5 }}>
            Review the per-supplier split below before paying. PPW collects the marketplace fee
            transparently — every supplier sees their own subtotal.
          </p>
        </div>
        <Link to="/marketplace/cart" className="soft-pill soft-pill--sm">← Back to cart</Link>
      </header>

      {error && (
        <div role="alert" className="soft-alert soft-alert--error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
        <section>
          {quote?.merchantBreakdown.map((m) => (
            <article
              key={m.merchantId}
              className="soft-card"
              style={{ padding: 18, marginBottom: 18 }}
            >
              <header
                style={{
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <strong>Supplier #{m.merchantId}</strong>
                <span className="soft-muted" style={{ fontSize: 12 }}>{m.itemCount} units</span>
              </header>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {m.items.map((line) => (
                  <li
                    key={line.productId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      fontSize: 13,
                    }}
                  >
                    <span>
                      {line.name} <span className="soft-muted">× {line.quantity}</span>
                    </span>
                    <span>{formatPrice(line.lineTotalMinor, m.currency)}</span>
                  </li>
                ))}
              </ul>
              <div
                style={{
                  borderTop: '1px solid var(--rim)',
                  marginTop: 8,
                  paddingTop: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 14,
                }}
              >
                <span className="soft-muted">Paid to supplier (post-fee)</span>
                <span>
                  {formatPrice(
                    Math.round(m.subtotalMinor * (1 - PPW_COMMISSION_RATE)),
                    m.currency,
                  )}
                </span>
              </div>
            </article>
          ))}
        </section>

        <aside>
          <div className="soft-card" style={{ position: 'sticky', top: 16, padding: 18 }}>
            <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Pay</h2>
            <label className="soft-muted" style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
              Email (for order tracking)
            </label>
            <input
              type="email"
              required
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="you@example.com"
              className="soft-input"
              style={{ width: '100%', marginBottom: 12, boxSizing: 'border-box' }}
            />
            {quote && (
              <>
                <dl style={{ margin: 0, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <dt className="soft-muted">Items subtotal</dt>
                    <dd style={{ margin: 0 }}>{formatPrice(quote.totalMinor, quote.currency)}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <dt className="soft-muted">
                      PPW marketplace fee ({Math.round(PPW_COMMISSION_RATE * 100)}%)
                    </dt>
                    <dd style={{ margin: 0 }}>{formatPrice(commissionMinor, quote.currency)}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <dt className="soft-muted">Shipping</dt>
                    <dd style={{ margin: 0, fontStyle: 'italic' }}>Calculated post-payment</dd>
                  </div>
                </dl>
                <div
                  style={{
                    borderTop: '1px solid var(--rim)',
                    marginTop: 12,
                    paddingTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  <span>Pay now</span>
                  <span>{formatPrice(quote.totalMinor, quote.currency)}</span>
                </div>
                <button
                  type="button"
                  className="soft-pill soft-pill--primary"
                  onClick={payWithPaypal}
                  disabled={submitting}
                  style={{ marginTop: 16, width: '100%', cursor: submitting ? 'wait' : 'pointer' }}
                >
                  {submitting ? 'Redirecting to PayPal…' : 'Pay with PayPal'}
                </button>
                <p className="soft-muted" style={{ fontSize: 11, marginTop: 8 }}>
                  Sandbox / live based on env. Order tracking link will be emailed.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
    </div>
  );
}
