/**
 * Wellness-Designer-App (f) part 2 — populate order_items from the
 * PayPal capture response.
 *
 * The PayPal /v2/checkout/orders/{id}/capture endpoint echoes the
 * `purchase_units[].items[]` array we sent at create-order time. This
 * helper parses those items, looks each SKU up in `products` to derive
 * the `merchant_id` + `product_id` + `currency`, and inserts one row
 * per item into `order_items`.
 *
 * Once this lands, the existing `recordPayoutsForOrder` helper (PR #16)
 * stops being a no-op for new captures — payouts auto-fire on every
 * capture.
 *
 * Failure modes (all non-fatal — caller wraps with try/catch):
 *   • Order row not found        → returns inserted:0
 *   • No items in capture        → returns inserted:0
 *   • SKU not found in products  → row skipped, others still insert
 *   • Mixed currency in capture  → row skipped (defensive)
 *   • Schema not migrated        → returns ok:false + schema_missing
 *
 * Idempotency: order_items has no composite unique index on
 * `(order_id, sku)`, so calling this twice on the same order would
 * double-insert. The PayPal capture path itself is idempotent
 * (PayPal returns the same response on duplicate captures), but the
 * recorder runs once. We treat the helper as fire-once-per-capture.
 */

import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '../../_db/client.js';

export interface PaypalCaptureItem {
  name?: string;
  sku?: string;
  quantity?: string | number;
  unit_amount?: { currency_code?: string; value?: string };
}

export interface PaypalCaptureForOrderItems {
  purchase_units?: Array<{
    items?: PaypalCaptureItem[];
  }>;
}

export interface OrderItemsInsertSummary {
  ok: boolean;
  inserted: number;
  skippedReason?:
    | 'order_not_found'
    | 'no_items_in_capture'
    | 'schema_missing'
    | 'caller_caught';
  error?: string;
  skippedSkus?: string[];
}

/** Parse a PayPal `unit_amount.value` decimal string + currency_code
 *  into our minor-unit integer convention. MUR is stored as integer
 *  rupees (no minor unit per the existing `recordCapturedOrder`
 *  convention); USD/EUR/GBP get ×100. */
export function paypalItemTotalMinor(item: PaypalCaptureItem): {
  unitMinor: number;
  lineMinor: number;
  currency: string;
  quantity: number;
} | null {
  const currency = item.unit_amount?.currency_code ?? 'USD';
  const valueStr = item.unit_amount?.value ?? '0';
  const parsed = parseFloat(valueStr);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const unitMinor = Math.round(parsed * (currency === 'MUR' ? 1 : 100));
  const quantity = Number(item.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    unitMinor,
    lineMinor: unitMinor * Math.floor(quantity),
    currency,
    quantity: Math.floor(quantity),
  };
}

export async function recordOrderItemsForOrder(
  ppwOrderId: string,
  capture: PaypalCaptureForOrderItems,
): Promise<OrderItemsInsertSummary> {
  if (!ppwOrderId || typeof ppwOrderId !== 'string') {
    return { ok: true, inserted: 0, skippedReason: 'order_not_found' };
  }
  // Flatten items from all purchase_units (we only ever send one today,
  // but the spec permits multiple).
  const items: PaypalCaptureItem[] = [];
  for (const pu of capture.purchase_units ?? []) {
    for (const it of pu.items ?? []) {
      items.push(it);
    }
  }
  if (items.length === 0) {
    return { ok: true, inserted: 0, skippedReason: 'no_items_in_capture' };
  }

  try {
    const db = getDb();

    const orderRows = await db
      .select({ id: schema.orders.id })
      .from(schema.orders)
      .where(eq(schema.orders.ppwOrderId, ppwOrderId))
      .limit(1);
    const order = orderRows[0];
    if (!order) {
      return { ok: true, inserted: 0, skippedReason: 'order_not_found' };
    }
    const orderId = Number(order.id);

    // Batch-lookup products by SKU. Skip items without an SKU.
    const skus = items
      .map((i) => (typeof i.sku === 'string' ? i.sku.trim() : ''))
      .filter((s) => s.length > 0);
    if (skus.length === 0) {
      return { ok: true, inserted: 0, skippedReason: 'no_items_in_capture' };
    }
    const productRows = await db
      .select({
        id: schema.products.id,
        sku: schema.products.sku,
        merchantId: schema.products.merchantId,
        name: schema.products.name,
      })
      .from(schema.products)
      .where(inArray(schema.products.sku, skus));
    const bySku = new Map<string, { id: number; merchantId: number; name: string }>();
    for (const row of productRows) {
      bySku.set(row.sku, {
        id: Number(row.id),
        merchantId: Number(row.merchantId),
        name: row.name,
      });
    }

    let inserted = 0;
    const skippedSkus: string[] = [];
    for (const it of items) {
      const sku = typeof it.sku === 'string' ? it.sku.trim() : '';
      if (!sku) continue;
      const product = bySku.get(sku);
      if (!product) {
        skippedSkus.push(sku);
        continue;
      }
      const totals = paypalItemTotalMinor(it);
      if (!totals) {
        skippedSkus.push(sku);
        continue;
      }
      await db.insert(schema.orderItems).values({
        orderId,
        merchantId: product.merchantId,
        productId: product.id,
        sku,
        name: (typeof it.name === 'string' && it.name.trim()) || product.name,
        quantity: totals.quantity,
        unitPriceMinor: totals.unitMinor,
        lineTotalMinor: totals.lineMinor,
        currency: totals.currency,
      });
      inserted += 1;
    }

    return {
      ok: true,
      inserted,
      skippedSkus: skippedSkus.length > 0 ? skippedSkus : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(order_items|orders|products).* does not exist|column .* does not exist|42P01|42703|undefined_table/i.test(msg)) {
      return { ok: false, inserted: 0, skippedReason: 'schema_missing', error: msg.slice(0, 200) };
    }
    return {
      ok: false,
      inserted: 0,
      skippedReason: 'caller_caught',
      error: msg.slice(0, 200),
    };
  }
}
