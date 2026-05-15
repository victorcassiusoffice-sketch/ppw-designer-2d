/**
 * /marketplace/cart — OMS Wave 1.1 surface.
 *
 * Consumes /api/cart-quote (splitCartByMerchant) to render a per-merchant
 * breakdown of the marketplace cart with a PPW commission line + grand
 * total. Distinct from /cart (which is the Designer's room-aware cart).
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMarketplaceCart } from '../store/marketplaceCartStore';

interface MerchantSubtotal {
  merchantId: number;
  supplierId: number | null;
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

// Display-only commission rate. The actual rate lives on the orders
// table per row at fulfilment time; this is a transparency pre-empt.
const PPW_COMMISSION_RATE = 0.07;

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function MarketplaceCartPage(): JSX.Element {
  const items = useMarketplaceCart((s) => s.items);
  const setQuantity = useMarketplaceCart((s) => s.setQuantity);
  const removeItem = useMarketplaceCart((s) => s.removeItem);
  const navigate = useNavigate();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (items.length === 0) {
      setQuote(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
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
          setQuote(null);
        } else {
          setQuote(j as QuoteResponse);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Quote failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteBody, items.length]);

  if (items.length === 0) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <h1>Your marketplace cart is empty.</h1>
        <p style={{ color: '#6b7280', marginTop: 12 }}>
          Browse the <Link to="/products">marketplace catalog</Link> to add items.
        </p>
      </div>
    );
  }

  const commissionMinor = quote ? Math.round(quote.totalMinor * PPW_COMMISSION_RATE) : 0;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, margin: 0 }}>Marketplace cart</h1>
        <p style={{ color: '#6b7280' }}>
          Items grouped by supplier. Each supplier ships separately; PPW handles billing.
        </p>
      </header>

      {loading && <p>Calculating split…</p>}
      {error && (
        <div
          role="alert"
          style={{
            padding: 12,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            marginBottom: 16,
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        <section>
          {quote?.merchantBreakdown.map((m) => (
            <article
              key={m.merchantId}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16,
                marginBottom: 16,
                background: 'white',
              }}
            >
              <header style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
                <strong>Supplier #{m.merchantId}</strong>
                <span style={{ color: '#6b7280', fontSize: 12 }}>
                  {m.itemCount} unit{m.itemCount === 1 ? '' : 's'}
                </span>
              </header>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {m.items.map((line) => {
                  const cartItem = items.find((i) => i.productId === line.productId);
                  return (
                    <li
                      key={line.productId}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      {cartItem?.imageUrl ? (
                        <img
                          src={cartItem.imageUrl}
                          alt={line.name}
                          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4 }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 56,
                            height: 56,
                            background: '#f3f4f6',
                            borderRadius: 4,
                          }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 600 }}>{line.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>SKU {line.sku}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity - 1)}
                          aria-label="Decrease quantity"
                          disabled={line.quantity <= 1}
                          style={{ width: 28, height: 28 }}
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
                          style={{ width: 48, textAlign: 'center' }}
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(line.productId, line.quantity + 1)}
                          aria-label="Increase quantity"
                          style={{ width: 28, height: 28 }}
                        >
                          +
                        </button>
                      </div>
                      <div style={{ width: 100, textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          {formatPrice(line.lineTotalMinor, m.currency)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeItem(line.productId)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: 0,
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#6b7280' }}>
                  Supplier subtotal · shipping calculated at checkout
                </span>
                <strong>{formatPrice(m.subtotalMinor, m.currency)}</strong>
              </div>
            </article>
          ))}
        </section>

        <aside>
          <div
            style={{
              position: 'sticky',
              top: 16,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 16,
              background: 'white',
            }}
          >
            <h2 style={{ fontSize: 16, margin: '0 0 12px' }}>Order summary</h2>
            {quote && (
              <>
                <dl style={{ margin: 0, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <dt style={{ color: '#6b7280' }}>Items subtotal</dt>
                    <dd style={{ margin: 0 }}>{formatPrice(quote.totalMinor, quote.currency)}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <dt style={{ color: '#6b7280' }}>
                      PPW marketplace fee ({Math.round(PPW_COMMISSION_RATE * 100)}%)
                    </dt>
                    <dd style={{ margin: 0 }}>{formatPrice(commissionMinor, quote.currency)}</dd>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <dt style={{ color: '#6b7280' }}>Shipping</dt>
                    <dd style={{ margin: 0, fontStyle: 'italic' }}>Calculated at checkout</dd>
                  </div>
                </dl>
                <div
                  style={{
                    borderTop: '1px solid #e5e7eb',
                    marginTop: 12,
                    paddingTop: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  <span>Total (est.)</span>
                  <span>{formatPrice(quote.totalMinor, quote.currency)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/marketplace/checkout')}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    padding: '10px 16px',
                    background: '#0a0a0a',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Continue to checkout →
                </button>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 8 }}>
                  Each supplier ships separately. Track each item from{' '}
                  <Link to="/orders">your orders page</Link>.
                </p>
              </>
            )}
            {!quote && !loading && !error && (
              <p style={{ color: '#6b7280', fontSize: 13 }}>Loading quote…</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
