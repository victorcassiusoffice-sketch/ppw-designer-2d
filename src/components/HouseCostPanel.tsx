import { getProductById, productImageUrl } from '../data/products';
import { hasSolarPanelPreview, SOLAR_PANEL_PREVIEW_NOTE } from '../data/solarPreview';
import { formatCurrency } from '../lib/currency';
import { useCart } from '../store/cartStore';

/** A read-only view of the same product and finish lines used by the cart page. */
export function HouseCostPanel({ productId, onEdit, onCart }: {
  productId?: string; onEdit?: () => void; onCart?: () => void;
}) {
  const cart = useCart();
  const product = productId ? getProductById(productId) : undefined;
  const money = (amount: number) => formatCurrency(amount, cart.currency);
  return <div className="house-cost-panel">
    {product && <section className="house-product-detail" aria-label="Selected product description">
      <div className="house-product-heading"><img src={productImageUrl(product)} alt="" /><div><h3>{product.name}</h3><span>{product.supplier}</span><strong>{formatCurrency(product.price.value, product.price.currency)}</strong></div></div>
      <p className="house-product-dimensions">{product.dimensions_cm.length} × {product.dimensions_cm.width} × {product.dimensions_cm.height} cm · L × W × H</p>
      {product.notes && <p>{product.notes}</p>}
      {hasSolarPanelPreview(product) && <p>{SOLAR_PANEL_PREVIEW_NOTE}</p>}
      {onEdit && <button type="button" onClick={onEdit}>Move / rotate / duplicate</button>}
    </section>}
    <section aria-label="Products and finishes in your design">
      <h3>In your design</h3>
      {cart.lines.length + cart.floorLines.length + cart.wallPaintLines.length + cart.claddingLines.length === 0
        ? <p>Add products or finishes to see their quantities and cost here.</p>
        : <ul className="house-cost-lines">
          {cart.lines.map(line => <li key={line.productId}><span>{line.quantity} × {line.product.name}</span><strong>{money(line.lineTotalDisplay)}</strong></li>)}
          {cart.floorLines.map(line => <li key={line.lineId}><span>{line.unitsToOrder} {line.unit}{line.unitsToOrder === 1 ? '' : 's'} · {line.materialName}</span><strong>{money(line.lineTotalDisplay)}</strong></li>)}
          {cart.wallPaintLines.map(line => <li key={line.lineId}><span>{line.paintName}{line.colourName ? ` · ${line.colourName}` : ''}<small>{line.boughtLitres.toFixed(1)} L in whole tins</small></span><strong>{money(line.totalDisplay)}</strong></li>)}
          {cart.claddingLines.map(line => <li key={line.lineId}><span>{line.name}<small>Sample cladding estimate</small></span><strong>{money(line.totalDisplay)}</strong></li>)}
        </ul>}
    </section>
    <div className="house-cost-total"><span>Product estimate</span><strong data-testid="house-cost-total">{money(cart.subtotal)}</strong></div>
    <p className="house-cost-note">Products and finishes only. Building structure, labour and delivery are not included.</p>
    {onCart && <button type="button" className="house-review-cart" onClick={onCart}>Review cart & checkout ↗</button>}
  </div>;
}
