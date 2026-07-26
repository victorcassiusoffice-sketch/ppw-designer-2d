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
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <header style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <Link to="/products" style={{ textDecoration: 'none', color: '#0a0a0a', fontWeight: 600 }}>
          ← Back to shop
        </Link>
        <Link
          to="/marketplace/cart"
          style={{ padding: '8px 14px', background: '#0a0a0a', color: 'white', borderRadius: 6, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}
        >
          Cart{cartCount > 0 ? ` (${cartCount})` : ''}
        </Link>
      </header>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>{error}</p>}
      {!loading && !error && !product && (
        <p style={{ textAlign: 'center', padding: 48, color: '#6b7280' }}>
          Product not found. <Link to="/products">Browse the shop</Link>.
        </p>
      )}

      {product && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: 'white' }}>
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'contain', background: '#fff', display: 'block' }} />
            ) : (
              <div style={{ width: '100%', aspectRatio: '4/3', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                No image
              </div>
            )}
          </div>

          <div>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 4px', textTransform: 'capitalize' }}>{product.category}</p>
            <h1 style={{ fontSize: 26, margin: '0 0 12px' }}>{product.name}</h1>
            <p style={{ fontSize: 24, fontWeight: 700, margin: '0 0 16px' }}>{formatPrice(product.priceMinor, product.currency)}</p>

            {product.description && (
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#374151', margin: '0 0 16px' }}>{product.description}</p>
            )}

            <dl style={{ margin: '0 0 20px', fontSize: 13, color: '#374151' }}>
              {dims && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <dt style={{ color: '#6b7280', minWidth: 90 }}>Dimensions</dt>
                  <dd style={{ margin: 0 }}>{dims}</dd>
                </div>
              )}
              {product.region && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <dt style={{ color: '#6b7280', minWidth: 90 }}>Region</dt>
                  <dd style={{ margin: 0 }}>{product.region}</dd>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <dt style={{ color: '#6b7280', minWidth: 90 }}>SKU</dt>
                <dd style={{ margin: 0 }}>{product.sku}</dd>
              </div>
            </dl>

            <button
              type="button"
              data-testid="product-detail-add"
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
              style={{ padding: '12px 24px', background: '#0a0a0a', color: 'white', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
            >
              Add to cart
            </button>
            {added && (
              <span style={{ marginLeft: 12, fontSize: 14, color: '#15803d', fontWeight: 600 }}>
                Added ✓ <Link to="/marketplace/cart" style={{ color: '#0a0a0a' }}>View cart</Link>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
