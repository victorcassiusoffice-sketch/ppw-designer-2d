import type { CartTotals } from '../store/cartStore';

export const QUOTED_PRODUCTS_NOTICE = 'Supplier-quoted products are excluded from the estimate. Confirm their price with the supplier before checkout, or remove them from the cart to order the priced products.';

export function hasQuotedProducts(cart: Pick<CartTotals, 'lines'>): boolean {
  return cart.lines.some(line => line.product.price_on_request);
}

/** A known subtotal must not read as a free or fully priced design when quotes are outstanding. */
export function quoteAwareAmount(cart: Pick<CartTotals, 'lines'>, amount: number, formatted: string): string {
  if (!hasQuotedProducts(cart)) return formatted;
  return amount > 0 ? `${formatted} + quote` : 'Quote required';
}

/** Quote-only planning products must never become zero-price payment items. */
export function assertCartIsPriced(cart: Pick<CartTotals, 'lines'>): void {
  if (hasQuotedProducts(cart)) throw new Error(QUOTED_PRODUCTS_NOTICE);
}
