/**
 * OMS Phase 4 — cart-split helper.
 *
 * Pure logic: takes a cart of line items + a product → merchant lookup,
 * returns per-merchant subtotals + payout-queue entries.
 *
 * Used by /api/cart/quote (preview) and /api/cart/checkout (commit).
 *
 * Currency: caller guarantees all line items share the same currency
 * (validated upstream). This helper just sums per-merchant.
 */

export interface CartLineItem {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
}

export interface ProductMerchantLink {
  productId: number;
  merchantId: number;
  primarySupplierId: number | null;
}

export interface MerchantSubtotal {
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

export interface CartSplitResult {
  ok: true;
  currency: string;
  totalMinor: number;
  merchantBreakdown: MerchantSubtotal[];
}

export interface CartSplitError {
  ok: false;
  error: string;
}

/**
 * Validate + split a cart by merchant.
 *
 * Returns a per-merchant breakdown. If any line item references a
 * product that has no merchant link in the lookup, returns
 * `{ ok: false, error: "..." }`.
 */
export function splitCartByMerchant(
  cart: CartLineItem[],
  productMerchantLookup: Map<number, ProductMerchantLink>,
): CartSplitResult | CartSplitError {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { ok: false, error: 'Cart is empty.' };
  }

  const currencies = new Set(cart.map((li) => li.currency));
  if (currencies.size > 1) {
    return { ok: false, error: 'Cart contains mixed currencies — not supported in Phase 4.' };
  }
  const currency = cart[0]!.currency;

  // Validate each line item has a merchant link.
  const buckets = new Map<number, MerchantSubtotal>();
  for (const li of cart) {
    if (li.quantity <= 0 || !Number.isInteger(li.quantity)) {
      return { ok: false, error: `Invalid quantity for SKU ${li.sku}.` };
    }
    if (li.unitPriceMinor < 0 || !Number.isInteger(li.unitPriceMinor)) {
      return { ok: false, error: `Invalid unitPriceMinor for SKU ${li.sku}.` };
    }
    const link = productMerchantLookup.get(li.productId);
    if (!link) {
      return { ok: false, error: `Product ${li.productId} (SKU ${li.sku}) has no merchant link.` };
    }
    const lineTotal = li.unitPriceMinor * li.quantity;
    const existing = buckets.get(link.merchantId) ?? {
      merchantId: link.merchantId,
      supplierId: link.primarySupplierId,
      currency,
      itemCount: 0,
      subtotalMinor: 0,
      items: [],
    };
    existing.itemCount += li.quantity;
    existing.subtotalMinor += lineTotal;
    existing.items.push({
      productId: li.productId,
      sku: li.sku,
      name: li.name,
      quantity: li.quantity,
      unitPriceMinor: li.unitPriceMinor,
      lineTotalMinor: lineTotal,
    });
    buckets.set(link.merchantId, existing);
  }

  const merchantBreakdown = Array.from(buckets.values()).sort(
    (a, b) => a.merchantId - b.merchantId,
  );
  const totalMinor = merchantBreakdown.reduce((sum, m) => sum + m.subtotalMinor, 0);

  return {
    ok: true,
    currency,
    totalMinor,
    merchantBreakdown,
  };
}
