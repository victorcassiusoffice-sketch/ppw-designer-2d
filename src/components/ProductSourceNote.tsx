import type { Product } from '../data/products.schema';

/** Catalogue observations are not a live supplier feed or a delivery promise. */
export function ProductSourceNote({ product }: { product: Product }) {
  const snapshot = product.price_snapshot;
  if (!snapshot) return product.price_on_request ? <p className="product-source-note">Supplier quote required. Confirm current availability and specification with {product.supplier}. Shared 2D and 3D dimensions are documented; visual details are illustrative.</p> : null;
  return <p className="product-source-note">Price per {snapshot.unit} · {snapshot.tax === 'included' ? 'VAT included' : 'Check tax basis'} · source checked {snapshot.observedAt}. Confirm current price and availability with {product.supplier}. 2D and 3D share the published envelope; model details are illustrative.</p>;
}
