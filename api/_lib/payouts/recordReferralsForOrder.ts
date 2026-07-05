/**
 * Wellness-Designer-App (f) closure — `designer_referrals` rows for
 * cart purchases (inbound Pattern-B attribution).
 *
 * The existing `/api/k1/redirect` handler writes one `designer_referrals`
 * row per *outbound* Pattern-C click (customer clicks BUY → redirected
 * to k1-sport.com with a `PPW-K1-…` ref-code). The chain spec's (f)
 * requirement also wants a row for *inbound* cart purchases — the
 * customer paid PPW directly via PayPal and the merchant gets paid from
 * `payout_queue`.
 *
 * This helper closes that gap: after PayPal capture, walks the order's
 * `order_items` rows, and INSERTs one `designer_referrals` row per item
 * with `outboundUrl` set to the local order-tracking URL (the customer
 * never left PPW for this purchase, so there's no merchant URL to
 * record — the tracking URL is the equivalent provenance anchor).
 *
 * No-ops cleanly when:
 *   • Order row not found
 *   • No `order_items` rows for the order (Pattern-B hasn't kicked in)
 *   • Schema missing
 *
 * Idempotency: ref codes are minted from `(merchantSlug, ppwOrderId, sku)`
 * with no random suffix, so the same (order, sku) tuple produces the
 * same code. The DB-side `ref_code` UNIQUE constraint then makes second
 * calls a no-op via `ON CONFLICT DO NOTHING`-equivalent (the
 * Drizzle insert layer raises a 23505 we catch and treat as skip).
 */

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../_db/client.js';

export interface ReferralInsertSummary {
  ok: boolean;
  inserted: number;
  skippedReason?:
    | 'order_not_found'
    | 'no_order_items'
    | 'schema_missing'
    | 'caller_caught';
  error?: string;
  /** Returned ref-codes (for observability). */
  refCodes?: string[];
}

/** Deterministic ref code for a cart purchase: `PPW-<MERCHANT>-<ORDERID>-<SKU>`.
 *  Truncated to fit the 80-char column. Uppercase + safe-char only. */
export function deriveCartRefCode(merchantSlug: string, ppwOrderId: string, sku: string): string {
  const safe = (s: string, max: number): string => {
    const cleaned = (s ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    // Strip trailing dashes after slicing to avoid double-dashes in the
    // final composed code when slice() lands on a separator.
    return cleaned.slice(0, max).replace(/-+$/, '') || 'NA';
  };
  const m = safe(merchantSlug, 10);
  const o = safe(ppwOrderId, 24);
  const k = safe(sku, 24);
  // 7 + 10 + 24 + 24 + 3 separators = max 68 chars (< 80)
  return `PPW-${m}-${o}-${k}`;
}

export async function recordReferralsForOrder(
  ppwOrderId: string,
): Promise<ReferralInsertSummary> {
  if (!ppwOrderId || typeof ppwOrderId !== 'string') {
    return { ok: true, inserted: 0, skippedReason: 'order_not_found' };
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

    const itemRows = await db
      .select({
        merchantId: schema.orderItems.merchantId,
        merchantSlug: schema.merchants.slug,
        productId: schema.orderItems.productId,
        sku: schema.orderItems.sku,
        name: schema.orderItems.name,
        unitPriceMinor: schema.orderItems.unitPriceMinor,
        currency: schema.orderItems.currency,
      })
      .from(schema.orderItems)
      .innerJoin(schema.merchants, eq(schema.orderItems.merchantId, schema.merchants.id))
      .where(eq(schema.orderItems.orderId, Number(order.id)));

    if (itemRows.length === 0) {
      return { ok: true, inserted: 0, skippedReason: 'no_order_items' };
    }

    const trackingUrl = `https://designer.ppwellness.co/order/track/${encodeURIComponent(ppwOrderId)}`;

    let inserted = 0;
    const refCodes: string[] = [];
    for (const row of itemRows) {
      const refCode = deriveCartRefCode(row.merchantSlug, ppwOrderId, row.sku);
      try {
        await db.insert(schema.designerReferrals).values({
          refCode,
          designId: ppwOrderId,
          merchantSlug: row.merchantSlug,
          productId: row.productId ? String(row.productId) : null,
          productSku: row.sku,
          productName: row.name,
          productPriceMinor: row.unitPriceMinor,
          productCurrency: row.currency,
          outboundUrl: trackingUrl,
        });
        inserted += 1;
        refCodes.push(refCode);
      } catch (insertErr) {
        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
        if (/duplicate key value|designer_referrals.*ref_code|23505/i.test(msg)) {
          // Idempotency: already recorded — skip silently.
          continue;
        }
        throw insertErr;
      }
    }

    return { ok: true, inserted, refCodes: refCodes.length > 0 ? refCodes : undefined };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(orders|order_items|designer_referrals|merchants).* does not exist|column .* does not exist|42P01|42703|undefined_table/i.test(msg)) {
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
