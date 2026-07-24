/**
 * /products — public storefront product listing.
 *
 * NEW route. Does NOT touch the Designer Catalog component
 * (src/components/Catalog.tsx) — that wiring is queued for Phase 8 per
 * the locked oms_sequence_pivot. Customers who want to browse the
 * marketplace catalog use this page; customers who want to design a
 * room use the Designer (which still loads its hardcoded demo
 * products).
 */

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useMarketplaceCart } from '../store/marketplaceCartStore';

interface PublicProduct {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  weightG: number | null;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  region: string | null;
}

interface ProductListResponse {
  products: PublicProduct[];
  total: number;
  limit: number;
  offset: number;
  schemaMissing: boolean;
}

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

export default function PublicProductsPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addToCart = useMarketplaceCart((s) => s.addItem);
  const cartItems = useMarketplaceCart((s) => s.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const region = params.get('region') ?? '';
  const offset = Number(params.get('offset') ?? '0') || 0;
  const limit = 24;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (search) qs.set('search', search);
        if (category) qs.set('category', category);
        if (region) qs.set('region', region);
        qs.set('limit', String(limit));
        qs.set('offset', String(offset));
        const res = await fetch(`/api/products?${qs.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as ProductListResponse;
        if (!cancelled) setData(j);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Load failed.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [search, category, region, offset]);

  const totalPages = useMemo(() => (data ? Math.ceil(data.total / limit) : 0), [data]);
  const currentPage = Math.floor(offset / limit) + 1;

  function setQuery(updates: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(updates)) {
      if (v === '') next.delete(k);
      else next.set(k, v);
    }
    setParams(next);
  }

  function gotoPage(page: number) {
    setQuery({ offset: String((page - 1) * limit) });
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Marketplace</h1>
          <p style={{ color: '#6b7280' }}>Browse products from approved Peak Performance Wellness suppliers.</p>
        </div>
        <Link
          to="/marketplace/cart"
          style={{
            padding: '8px 14px',
            background: '#0a0a0a',
            color: 'white',
            borderRadius: 6,
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Cart{cartCount > 0 ? ` (${cartCount})` : ''}
        </Link>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement | null;
          setQuery({ search: input?.value.trim() ?? '', offset: '0' });
        }}
        style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}
      >
        <input
          name="q"
          type="search"
          placeholder="Search products…"
          defaultValue={search}
          aria-label="Search products"
          style={{ padding: 8, minWidth: 260, flex: '1 1 260px', maxWidth: 480 }}
        />
        <button
          type="submit"
          style={{ padding: '8px 16px', background: '#0a0a0a', color: 'white', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
        >
          Search
        </button>
      </form>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          placeholder="Filter by category"
          defaultValue={category}
          onBlur={(e) => setQuery({ category: e.target.value, offset: '0' })}
          style={{ padding: 8, minWidth: 200 }}
        />
        <input
          placeholder="Filter by region"
          defaultValue={region}
          onBlur={(e) => setQuery({ region: e.target.value, offset: '0' })}
          style={{ padding: 8, minWidth: 200 }}
        />
        {(search || category || region) && (
          <button type="button" onClick={() => setQuery({ search: '', category: '', region: '', offset: '0' })}>
            Clear filters
          </button>
        )}
      </div>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {data?.schemaMissing && (
        <div style={{ padding: 12, background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6, marginBottom: 16 }}>
          Product catalog migration not yet applied — the storefront is empty by design.
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {data.products.map((p) => (
              <article key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
                <Link to={`/products/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                      No image
                    </div>
                  )}
                </Link>
                <div style={{ padding: 12 }}>
                  <h3 style={{ fontSize: 16, margin: '0 0 4px' }}>
                    <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {p.name}
                    </Link>
                  </h3>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>{p.category}</p>
                  <p style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>{formatPrice(p.priceMinor, p.currency)}</p>
                  <button
                    type="button"
                    onClick={() =>
                      addToCart({
                        productId: p.id,
                        sku: p.sku,
                        name: p.name,
                        category: p.category,
                        unitPriceMinor: p.priceMinor,
                        currency: p.currency,
                        imageUrl: p.imageUrl,
                      })
                    }
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: '#0a0a0a',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>

          {data.products.length === 0 && !loading && !data.schemaMissing && (
            <p style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
              No products match these filters yet.
            </p>
          )}

          {totalPages > 1 && (
            <nav style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
              <button type="button" disabled={currentPage <= 1} onClick={() => gotoPage(currentPage - 1)}>
                ← Previous
              </button>
              <span style={{ alignSelf: 'center' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => gotoPage(currentPage + 1)}>
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
