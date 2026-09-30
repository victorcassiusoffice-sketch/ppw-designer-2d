import { useCart } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { formatCurrency } from '../lib/currency';

/** A reserved footer, so the cart never covers analysis inputs on a phone. */
export function AnalysisCartSummary() {
  const cart = useCart();
  const units = cart.totalItemCount + cart.floorLines.reduce((sum, line) => sum + line.unitsToOrder, 0) + cart.wallPaintLines.reduce((sum, line) => sum + line.tins.reduce((n, tin) => n + tin.count, 0), 0) + cart.claddingLines.reduce((sum, line) => sum + line.packs, 0);
  const currency = useCurrencyStore(s => s.currency);
  return <footer className="analysis-cart-summary"><span>Product estimate<strong>{formatCurrency(cart.subtotal, currency)}</strong></span><button disabled={units === 0} onClick={() => window.dispatchEvent(new CustomEvent('ppw:open-design-cart'))} aria-label="Open products and estimate">▣ <span>{units}</span> units</button></footer>;
}
