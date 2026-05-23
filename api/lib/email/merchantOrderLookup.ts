/**
 * Wellness-Designer-App (g) — merchant-side order-confirmed DB lookup.
 *
 * Given a `ppwOrderId`, walks `orders → order_items → merchants` and
 * returns one row per unique merchant: contact info + that merchant's
 * order lines + their subtotal.
 *
 * Why split this from `dispatch.ts`: keeps the dispatcher pure (template
 * + transport, no DB) and isolates the JOIN here so it can be mocked
 * independently in `captureOrder` integration tests. Mirrors the
 * separation between `email/templates.ts` and `email/dispatch.ts`.
 *
 * Failure modes:
 *   • Order not found              → returns []
 *   • No order_items rows yet       → returns []  (capture happened but
 *                                       per-merchant breakdown not yet
 *                                       populated — caller logs + moves on)
 *   • Drizzle / schema-missing      → throws; caller swallows
 */

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../db/client.js';
import type { MerchantNotifyRow } from './dispatch.js';

export async function fetchMerchantNotifyRowsForOrder(
  ppwOrderId: string,
): Promise<MerchantNotifyRow[]> {
  if (!ppwOrderId || typeof ppwOrderId !== 'string') return [];
  const db = getDb();

  const orderRows = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(eq(schema.orders.ppwOrderId, ppwOrderId))
    .limit(1);
  const order = orderRows[0];
  if (!order) return [];
  const orderId = Number(order.id);

  // Pull all order_items joined to merchants in one round-trip.
  const itemRows = await db
    .select({
      merchantId: schema.orderItems.merchantId,
      merchantName: schema.merchants.businessName,
      merchantContactName: schema.merchants.contactName,
      merchantContactEmail: schema.merchants.contactEmail,
      sku: schema.orderItems.sku,
      name: schema.orderItems.name,
      quantity: schema.orderItems.quantity,
      lineTotalMinor: schema.orderItems.lineTotalMinor,
    })
    .from(schema.orderItems)
    .innerJoin(schema.merchants, eq(schema.orderItems.merchantId, schema.merchants.id))
    .where(eq(schema.orderItems.orderId, orderId));

  if (itemRows.length === 0) return [];

  // Group by merchantId.
  const byMerchant = new Map<number, MerchantNotifyRow>();
  for (const row of itemRows) {
    const mid = Number(row.merchantId);
    const existing = byMerchant.get(mid);
    const line = {
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      lineTotalMinor: row.lineTotalMinor,
    };
    if (existing) {
      existing.lines.push(line);
      existing.subtotalMinor += row.lineTotalMinor;
    } else {
      byMerchant.set(mid, {
        merchantName: row.merchantName,
        contactName: row.merchantContactName,
        contactEmail: row.merchantContactEmail,
        lines: [line],
        subtotalMinor: row.lineTotalMinor,
      });
    }
  }

  return [...byMerchant.values()];
}
