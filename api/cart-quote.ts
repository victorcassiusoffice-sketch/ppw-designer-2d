/**
 * POST /api/cart-quote
 *
 * Phase 4 marketplace-cart split preview.
 *
 * Body: { cart: [{productId, sku, name, quantity, unitPriceMinor, currency}] }
 * 200:  { currency, totalMinor, merchantBreakdown: [...] }
 * 400:  { error: '...' }
 *
 * Pure read — does NOT create an order. Used by the cart UI to show
 * per-supplier subtotals before checkout.
 */

import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import { getDb, schema } from './db/client.js';
import { inArray } from 'drizzle-orm';
import { splitCartByMerchant, type CartLineItem, type ProductMerchantLink } from './lib/cart/split.js';

interface QuoteReq extends MinReq {
  body?: unknown;
}

async function readJson(req: QuoteReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { return null; }
  }
  if (Buffer.isBuffer(b)) {
    try { return JSON.parse(b.toString('utf8')); } catch { return null; }
  }
  return null;
}

export function validateCart(payload: unknown): { ok: true; data: CartLineItem[] } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid body.' };
  const p = payload as { cart?: unknown };
  if (!Array.isArray(p.cart) || p.cart.length === 0) {
    return { ok: false, error: 'Cart is empty.' };
  }
  const items: CartLineItem[] = [];
  for (const raw of p.cart) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid line item.' };
    const r = raw as Record<string, unknown>;
    if (typeof r.productId !== 'number' || r.productId <= 0) {
      return { ok: false, error: 'productId must be a positive number.' };
    }
    if (typeof r.sku !== 'string' || !r.sku) return { ok: false, error: 'sku required.' };
    if (typeof r.name !== 'string' || !r.name) return { ok: false, error: 'name required.' };
    if (typeof r.quantity !== 'number' || r.quantity <= 0 || !Number.isInteger(r.quantity)) {
      return { ok: false, error: 'quantity must be a positive integer.' };
    }
    if (typeof r.unitPriceMinor !== 'number' || r.unitPriceMinor < 0 || !Number.isInteger(r.unitPriceMinor)) {
      return { ok: false, error: 'unitPriceMinor must be a non-negative integer.' };
    }
    if (typeof r.currency !== 'string' || r.currency.length !== 3) {
      return { ok: false, error: 'currency must be a 3-letter code.' };
    }
    items.push({
      productId: r.productId,
      sku: r.sku,
      name: r.name,
      quantity: r.quantity,
      unitPriceMinor: r.unitPriceMinor,
      currency: r.currency.toUpperCase(),
    });
  }
  return { ok: true, data: items };
}

export async function buildProductMerchantLookup(
  productIds: number[],
): Promise<Map<number, ProductMerchantLink>> {
  if (productIds.length === 0) return new Map();
  const db = getDb();
  // Get merchant for each product, plus the primary supplier (if any).
  const rows = await db
    .select({
      id: schema.products.id,
      merchantId: schema.products.merchantId,
    })
    .from(schema.products)
    .where(inArray(schema.products.id, productIds));

  const lookup = new Map<number, ProductMerchantLink>();
  for (const r of rows) {
    lookup.set(r.id, {
      productId: r.id,
      merchantId: r.merchantId,
      primarySupplierId: null, // Phase 4 simplification — primary-supplier resolution is Phase 5.
    });
  }
  return lookup;
}

async function rawHandler(req: QuoteReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }

  const body = await readJson(req);
  const v = validateCart(body);
  if (!v.ok) {
    res.status(400);
    res.json({ error: v.error });
    return;
  }

  try {
    const productIds = Array.from(new Set(v.data.map((li) => li.productId)));
    const lookup = await buildProductMerchantLookup(productIds);
    const split = splitCartByMerchant(v.data, lookup);
    if (!split.ok) {
      res.status(400);
      res.json({ error: split.error });
      return;
    }
    res.status(200);
    res.json(split);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'cart-quote failed';
    if (/relation .*products.* does not exist|42P01|undefined_table/i.test(msg)) {
      res.setHeader('X-Schema-Missing', 'products');
      res.status(503);
      res.json({ error: 'Product catalog unavailable — migrations not applied.' });
      return;
    }
    res.status(500);
    res.json({ error: msg });
  }
}

export default withSentry(rawHandler);
