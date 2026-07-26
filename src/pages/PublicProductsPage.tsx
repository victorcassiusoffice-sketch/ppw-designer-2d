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
import '../styles/soft-shop.css';

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
    <div className="soft-page">
    <div style={{ padding: '28px 24px 48px', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            className="soft-card"
            aria-hidden="true"
            style={{ width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
          >
            <img src="/brand/ppw-mark-512.png" alt="" width={34} height={34} style={{ display: 'block' }} />
          </span>
          <div>
            <h1 style={{ fontSize: 26, margin: 0, letterSpacing: '-0.01em' }}>PPWellness Shop</h1>
            <p className="soft-muted" style={{ margin: '2px 0 0', fontSize: 13.5 }}>
              Browse and buy wellness equipment from approved Peak Performance Wellness suppliers.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Directive 5: the designer is an optional extra mode, entered from
              the shop — not the landing page. */}
          <Link to="/designer" data-testid="enter-designer" className="soft-pill">
            Design a room
          </Link>
          <Link to="/marketplace/cart" className="soft-pill soft-pill--primary">
            Cart{cartCount > 0 ? ` (${cartCount})` : ''}
          </Link>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement | null;
          setQuery({ search: input?.value.trim() ?? '', offset: '0' });
        }}
        style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}
      >
        <input
          name="q"
          type="search"
          placeholder="Search products…"
          // key tied to the applied term so the box remounts + re-reads the
          // value when ?search changes without typing (Clear filters, browser
          // Back) — otherwise the uncontrolled input keeps a stale term.
          key={search}
          defaultValue={search}
          aria-label="Search products"
          className="soft-input"
          style={{ minWidth: 260, flex: '1 1 260px', maxWidth: 480 }}
        />
        <button type="submit" className="soft-pill soft-pill--primary">
          Search
        </button>
      </form>

      <div style={{ display: 'flex', gap: 10, marginBottom: 26, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Filter by category"
          // key re-syncs the uncontrolled input to the applied param on
          // Clear/Back (same fix as the search box).
          key={`cat-${category}`}
          defaultValue={category}
          onBlur={(e) => setQuery({ category: e.target.value, offset: '0' })}
          className="soft-input"
          style={{ minWidth: 190 }}
        />
        <input
          placeholder="Filter by region"
          key={`region-${region}`}
          defaultValue={region}
          onBlur={(e) => setQuery({ region: e.target.value, offset: '0' })}
          className="soft-input"
          style={{ minWidth: 190 }}
        />
        {(search || category || region) && (
          <button type="button" className="soft-chip" onClick={() => setQuery({ search: '', category: '', region: '', offset: '0' })}>
            ✕ Clear filters
          </button>
        )}
      </div>

      {loading && <p className="soft-muted">Loading…</p>}
      {error && <p className="soft-alert soft-alert--error">{error}</p>}
      {data?.schemaMissing && (
        <div className="soft-alert soft-alert--warn" style={{ marginBottom: 16 }}>
          Product catalog migration not yet applied — the storefront is empty by design.
        </div>
      )}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 22 }}>
            {data.products.map((p) => (
              <article key={p.id} className="soft-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <Link to={`/products/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} className="soft-product-img" />
                  ) : (
                    <div className="soft-product-img soft-product-img--empty">No image</div>
                  )}
                </Link>
                <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontSize: 15.5, margin: '0 0 2px', lineHeight: 1.35 }}>
                    <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {p.name}
                    </Link>
                  </h3>
                  <p className="soft-muted" style={{ fontSize: 12, margin: '0 0 8px', textTransform: 'capitalize' }}>{p.category}</p>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>{formatPrice(p.priceMinor, p.currency)}</p>
                  <button
                    type="button"
                    className="soft-pill soft-pill--primary soft-pill--sm"
                    style={{ width: '100%', marginTop: 'auto' }}
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
                  >
                    Add to cart
                  </button>
                </div>
              </article>
            ))}
          </div>

          {data.products.length === 0 && !loading && !data.schemaMissing && (
            <p className="soft-muted" style={{ textAlign: 'center', padding: 48 }}>
              No products match these filters yet.
            </p>
          )}

          {totalPages > 1 && (
            <nav style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 28, alignItems: 'center' }}>
              <button type="button" className="soft-pill soft-pill--sm" disabled={currentPage <= 1} onClick={() => gotoPage(currentPage - 1)}>
                ← Previous
              </button>
              <span className="soft-muted" style={{ fontSize: 13.5 }}>
                Page {currentPage} of {totalPages}
              </span>
              <button type="button" className="soft-pill soft-pill--sm" disabled={currentPage >= totalPages} onClick={() => gotoPage(currentPage + 1)}>
                Next →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
    </div>
  );
}
