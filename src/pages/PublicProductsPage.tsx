/**
 * /products (+ "/") — public storefront, Amazon-style layout (2026-07-26).
 *
 * Structure mirrors a familiar e-commerce shop on the soft-neumorphic skin:
 *   • top bar: logo tile | dominant search | Design-a-room + Cart actions
 *   • left sidebar: Department (category) + Region filters with live counts
 *   • results bar: result count + sort (price asc/desc, newest)
 *   • dense photo-first product grid → /products/:id detail pages
 *
 * imageUrl on this page is the real product PHOTO (directive 2 — top-downs
 * are designer-canvas assets and never shown on the storefront).
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

const SORT_OPTIONS = [
  { value: '', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest arrivals' },
] as const;

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString('en-MU', { maximumFractionDigits: 2 })}`;
}

function fmtDims(p: PublicProduct): string | null {
  if (!p.widthMm || !p.depthMm) return null;
  const l = Math.round(p.widthMm / 10);
  const w = Math.round(p.depthMm / 10);
  const h = p.heightMm ? Math.round(p.heightMm / 10) : null;
  return h ? `${l} × ${w} × ${h} cm` : `${l} × ${w} cm`;
}

export default function PublicProductsPage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sidebar facet source: one unfiltered fetch, derived client-side. Small
  // catalog today; swap for API facets when it outgrows a single page.
  const [allForFacets, setAllForFacets] = useState<PublicProduct[]>([]);
  const addToCart = useMarketplaceCart((s) => s.addItem);
  const cartItems = useMarketplaceCart((s) => s.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  const search = params.get('search') ?? '';
  const category = params.get('category') ?? '';
  const region = params.get('region') ?? '';
  const sort = params.get('sort') ?? '';
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
        if (sort) qs.set('sort', sort);
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
  }, [search, category, region, sort, offset]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/products?limit=100')
      .then((r) => (r.ok ? (r.json() as Promise<ProductListResponse>) : null))
      .then((j) => {
        if (!cancelled && j?.products) setAllForFacets(j.products);
      })
      .catch(() => {
        /* sidebar counts are progressive enhancement — grid still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of allForFacets) {
      const c = (p.category || '').trim().toLowerCase();
      if (!c) continue;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allForFacets]);

  const regions = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of allForFacets) {
      const r = (p.region || '').trim();
      if (!r) continue;
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allForFacets]);

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

  const anyFilter = Boolean(search || category || region);

  return (
    <div className="soft-page">
      <div style={{ padding: '22px 22px 48px', maxWidth: 1400, margin: '0 auto' }}>
        {/* ---- top bar: logo | search | actions ---- */}
        <header className="shop-topbar">
          <Link
            to="/products"
            aria-label="PPWellness Shop home"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
          >
            <span
              className="soft-card"
              aria-hidden="true"
              style={{ width: 50, height: 50, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
            >
              <img src="/brand/ppw-mark-512.png" alt="" width={32} height={32} style={{ display: 'block' }} />
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>PPWellness Shop</span>
              <span className="soft-muted" style={{ display: 'block', fontSize: 12 }}>Wellness equipment, Mauritius</span>
            </span>
          </Link>

          <form
            className="shop-topbar__search"
            onSubmit={(e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem('q') as HTMLInputElement | null;
              setQuery({ search: input?.value.trim() ?? '', offset: '0' });
            }}
          >
            <input
              name="q"
              type="search"
              placeholder="Search wellness equipment…"
              // key ties the uncontrolled input to the applied term so it
              // re-syncs on Clear filters / browser Back.
              key={search}
              defaultValue={search}
              aria-label="Search products"
              className="soft-input"
            />
            <button type="submit" className="soft-pill soft-pill--primary">
              Search
            </button>
          </form>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/designer" data-testid="enter-designer" className="soft-pill">
              Design a room
            </Link>
            <Link to="/marketplace/cart" className="soft-pill soft-pill--primary">
              Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            </Link>
          </div>
        </header>

        {error && <p className="soft-alert soft-alert--error">{error}</p>}
        {data?.schemaMissing && (
          <div className="soft-alert soft-alert--warn" style={{ marginBottom: 16 }}>
            Product catalog migration not yet applied — the storefront is empty by design.
          </div>
        )}

        <div className="shop-layout">
          {/* ---- sidebar: departments + region ---- */}
          <aside className="soft-card shop-side" aria-label="Filters">
            <p className="shop-side__title">Department</p>
            <button
              type="button"
              className="side-item"
              data-selected={category === '' ? 'true' : 'false'}
              onClick={() => setQuery({ category: '', offset: '0' })}
            >
              <span>All departments</span>
              {allForFacets.length > 0 && <span className="side-item__count">{allForFacets.length}</span>}
            </button>
            {categories.map(([cat, count]) => (
              <button
                key={cat}
                type="button"
                className="side-item"
                data-selected={category === cat ? 'true' : 'false'}
                onClick={() => setQuery({ category: category === cat ? '' : cat, offset: '0' })}
              >
                <span>{cat}</span>
                <span className="side-item__count">{count}</span>
              </button>
            ))}

            {regions.length > 1 && (
              <>
                <p className="shop-side__title">Region</p>
                {regions.map(([r, count]) => (
                  <button
                    key={r}
                    type="button"
                    className="side-item"
                    data-selected={region === r ? 'true' : 'false'}
                    onClick={() => setQuery({ region: region === r ? '' : r, offset: '0' })}
                  >
                    <span>{r}</span>
                    <span className="side-item__count">{count}</span>
                  </button>
                ))}
              </>
            )}

            {anyFilter && (
              <button
                type="button"
                className="soft-chip"
                style={{ marginTop: 10, alignSelf: 'flex-start' }}
                onClick={() => setQuery({ search: '', category: '', region: '', offset: '0' })}
              >
                ✕ Clear all filters
              </button>
            )}
          </aside>

          {/* ---- results ---- */}
          <main>
            <div className="shop-results-bar">
              <span className="soft-badge" aria-live="polite">
                {loading ? 'Loading…' : `${data?.total ?? 0} result${(data?.total ?? 0) === 1 ? '' : 's'}`}
                {category ? ` in “${category}”` : ''}
                {search ? ` for “${search}”` : ''}
              </span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span className="soft-muted" style={{ fontSize: 13 }}>Sort by</span>
                <select
                  className="soft-select"
                  value={sort}
                  aria-label="Sort products"
                  onChange={(e) => setQuery({ sort: e.target.value, offset: '0' })}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {data && (
              <>
                <div className="shop-grid">
                  {data.products.map((p) => {
                    const dims = fmtDims(p);
                    return (
                      <article key={p.id} className="soft-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <Link to={`/products/${p.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} loading="lazy" className="soft-product-img" />
                          ) : (
                            <div className="soft-product-img soft-product-img--empty">No image</div>
                          )}
                        </Link>
                        <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <h3 className="clamp-2" style={{ fontSize: 14.5, margin: '0 0 4px', lineHeight: 1.3, fontWeight: 600 }}>
                            <Link to={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              {p.name}
                            </Link>
                          </h3>
                          {dims && <p className="shop-card-dims">{dims}</p>}
                          <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px' }}>{formatPrice(p.priceMinor, p.currency)}</p>
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
                    );
                  })}
                </div>

                {data.products.length === 0 && !loading && !data.schemaMissing && (
                  <p className="soft-muted" style={{ textAlign: 'center', padding: 48 }}>
                    No products match these filters yet.
                  </p>
                )}

                {totalPages > 1 && (
                  <nav style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26, alignItems: 'center' }}>
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
          </main>
        </div>
      </div>
    </div>
  );
}
