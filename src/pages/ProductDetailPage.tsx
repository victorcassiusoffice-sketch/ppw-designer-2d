/**
 * /products/:id — public product detail page (WD rework Phase 2).
 *
 * Reads a single product via GET /api/products?id=:id (reuses the list
 * endpoint's single-product filter, so imagery enrichment + coalescing are
 * identical to the grid). Add-to-cart uses the same marketplace cart as the
 * storefront grid, so a customer can buy directly without the designer.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
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
  schemaMissing: boolean;
}

function formatPrice(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function formatDims(p: PublicProduct): string | null {
  if (p.widthMm == null || p.depthMm == null) return null;
  const cm = (mm: number | null) => (mm == null ? '—' : (mm / 10).toFixed(0));
  const base = `${cm(p.widthMm)} × ${cm(p.depthMm)}`;
  return p.heightMm != null ? `${base} × ${cm(p.heightMm)} cm (W×D×H)` : `${base} cm (W×D)`;
}

export default function ProductDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const addToCart = useMarketplaceCart((s) => s.addItem);
  const cartItems = useMarketplaceCart((s) => s.items);
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/products?id=${encodeURIComponent(id ?? '')}&limit=1`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as ProductListResponse;
        if (!cancelled) setProduct(j.products[0] ?? null);
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
  }, [id]);

  const dims = product ? formatDims(product) : null;

  return (
    <div className="soft-page">
    <div style={{ padding: '28px 24px 48px', maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Link to="/products" className="soft-pill soft-pill--sm">
          ← Back to shop
        </Link>
        <Link to="/marketplace/cart" className="soft-pill soft-pill--primary soft-pill--sm">
          Cart{cartCount > 0 ? ` (${cartCount})` : ''}
        </Link>
      </header>

      {loading && <p className="soft-muted">Loading…</p>}
      {error && <p className="soft-alert soft-alert--error">{error}</p>}
      {!loading && !error && !product && (
        <p className="soft-muted" style={{ textAlign: 'center', padding: 48 }}>
          Product not found. <Link to="/products">Browse the shop</Link>.
        </p>
      )}

      {product && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
          <div className="soft-card" style={{ overflow: 'hidden', alignSelf: 'start' }}>
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'contain', background: '#fff', display: 'block', borderRadius: 19 }} />
            ) : (
              <div className="soft-product-img soft-product-img--empty">No image</div>
            )}
          </div>

          <div>
            <p className="soft-muted" style={{ fontSize: 13, margin: '0 0 4px', textTransform: 'capitalize' }}>{product.category}</p>
            <h1 style={{ fontSize: 26, margin: '0 0 12px', letterSpacing: '-0.01em' }}>{product.name}</h1>
            <p style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px' }}>{formatPrice(product.priceMinor, product.currency)}</p>

            {product.description && (
              <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>{product.description}</p>
            )}

            <dl style={{ margin: '0 0 20px', fontSize: 13 }}>
              {dims && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <dt className="soft-muted" style={{ minWidth: 90 }}>Dimensions</dt>
                  <dd style={{ margin: 0 }}>{dims}</dd>
                </div>
              )}
              {product.region && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <dt className="soft-muted" style={{ minWidth: 90 }}>Region</dt>
                  <dd style={{ margin: 0 }}>{product.region}</dd>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <dt className="soft-muted" style={{ minWidth: 90 }}>SKU</dt>
                <dd style={{ margin: 0 }}>{product.sku}</dd>
              </div>
            </dl>

            <button
              type="button"
              data-testid="product-detail-add"
              className="soft-pill soft-pill--primary"
              style={{ padding: '13px 28px', fontSize: 15 }}
              onClick={() => {
                addToCart({
                  productId: product.id,
                  sku: product.sku,
                  name: product.name,
                  category: product.category,
                  unitPriceMinor: product.priceMinor,
                  currency: product.currency,
                  imageUrl: product.imageUrl,
                });
                setAdded(true);
              }}
            >
              Add to cart
            </button>
            {added && (
              <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 600, color: '#2e6b57' }}>
                Added ✓ <Link to="/marketplace/cart">View cart</Link>
              </span>
            )}

            {/* Trust strip — facts only (supplier fulfils, PPW handles billing). */}
            <div className="soft-card" style={{ marginTop: 22, padding: '12px 16px', borderRadius: 16, fontSize: 12.5 }}>
              <p style={{ margin: 0 }}>
                Sold and shipped by an approved Peak Performance Wellness supplier.
              </p>
              <p className="soft-muted" style={{ margin: '4px 0 0' }}>
                PPW handles billing · shipping quoted at checkout · placeable to exact scale in the room designer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
