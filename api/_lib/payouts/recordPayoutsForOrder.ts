/**
 * Wellness-Designer-App (f) — payout_queue recorder.
 *
 * Given a `ppwOrderId` (post-PayPal-capture), this helper:
 *   1. Looks up the order row + sums per-merchant subtotals from
 *      `order_items` (one INNER JOIN to derive the per-merchant slice)
 *   2. For each unique merchant: computes the merchant's net share
 *      (subtotal × (1 - commissionRate)) and inserts ONE row into
 *      `payout_queue` with `status='queued'`, `scheduled_for=now+14d`
 *      (the 14-day refund hold stated on the merchants signup page),
 *      and `note` carrying the source ppwOrderId for traceability
 *
 * No-op when:
 *   • Order row not found                             → returns {inserted:0}
 *   • No order_items rows yet for the order           → returns {inserted:0}
 *   • Schema not yet migrated                         → returns {ok:false, ...}
 *
 * Errors NEVER propagate — capture is the authoritative outcome and
 * payouts are a downstream bookkeeping concern. The caller wraps with
 * the same try/catch pattern used for the merchant-email dispatch
 * loop.
 */

import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../_db/client.js';
import { captureException } from '../sentry.js';

/** Default platform commission rate (Vic-decision #6 — chain spec 5%
 *  vs existing UI 7%; foundation defaults to chain spec 0.05). The
 *  rate can be overridden at call-time once a per-merchant
 *  `commission_pct` column lands.
 */
export const PPW_PAYOUT_COMMISSION_DEFAULT = 0.05;

/** 14-day refund hold — matches the merchants/onboard copy. */
export const PAYOUT_HOLD_MS = 14 * 24 * 60 * 60 * 1000;

export interface PayoutInsertSummary {
  ok: boolean;
  inserted: number;
  skippedReason?: 'order_not_found' | 'no_order_items' | 'schema_missing' | 'caller_caught';
  error?: string;
  rows?: Array<{
    merchantId: number;
    amountMinor: number;
    currency: string;
  }>;
}

export interface RecordPayoutsDeps {
  /** Stable clock — defaults to Date.now. Injected for tests. */
  now?: () => number;
  /** Per-call override of the platform commission rate (0–1). */
  commissionRate?: number;
}

export async function recordPayoutsForOrder(
  ppwOrderId: string,
  deps: RecordPayoutsDeps = {},
): Promise<PayoutInsertSummary> {
  if (!ppwOrderId || typeof ppwOrderId !== 'string') {
    return { ok: true, inserted: 0, skippedReason: 'order_not_found' };
  }
  const commissionRate =
    typeof deps.commissionRate === 'number' && deps.commissionRate >= 0 && deps.commissionRate < 1
      ? deps.commissionRate
      : PPW_PAYOUT_COMMISSION_DEFAULT;
  const nowMs = (deps.now ?? Date.now)();
  const scheduledFor = new Date(nowMs + PAYOUT_HOLD_MS);

  try {
    const db = getDb();

    const orderRows = await db
      .select({
        id: schema.orders.id,
        currency: schema.orders.currency,
        paymentRail: schema.orders.paymentRail,
      })
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
        lineTotalMinor: schema.orderItems.lineTotalMinor,
        currency: schema.orderItems.currency,
      })
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, Number(order.id)));

    if (itemRows.length === 0) {
      return { ok: true, inserted: 0, skippedReason: 'no_order_items' };
    }

    // Group per merchant + sum.
    const byMerchant = new Map<number, { subtotalMinor: number; currency: string }>();
    for (const row of itemRows) {
      const mid = Number(row.merchantId);
      const cur = row.currency || order.currency;
      const existing = byMerchant.get(mid);
      if (existing) {
        if (existing.currency !== cur) {
          // Mixed-currency lines for the same merchant shouldn't happen
          // — the cart-quote endpoint validates this upstream. Skip the
          // payout for this merchant rather than insert a bad row, but
          // NEVER silently: the merchant would otherwise get no payout
          // and no one would know.
          // eslint-disable-next-line no-console
          console.error(
            `[payout-record] mixed currency for merchant ${mid} on order ${ppwOrderId}: ${existing.currency} vs ${cur} — payout row skipped`,
          );
          captureException(new Error('payout skipped: mixed currency for merchant'), {
            ppwOrderId,
            merchantId: mid,
            currencies: `${existing.currency},${cur}`,
          });
          continue;
        }
        existing.subtotalMinor += row.lineTotalMinor;
      } else {
        byMerchant.set(mid, { subtotalMinor: row.lineTotalMinor, currency: cur });
      }
    }

    const inserted: Array<{ merchantId: number; amountMinor: number; currency: string }> = [];
    for (const [merchantId, { subtotalMinor, currency }] of byMerchant) {
      const merchantShareMinor = Math.round(subtotalMinor * (1 - commissionRate));
      if (merchantShareMinor <= 0) continue;
      await db.insert(schema.payoutQueue).values({
        merchantId,
        amountMinor: merchantShareMinor,
        currency,
        rail: order.paymentRail,
        status: 'queued',
        scheduledFor,
        note: `wellness-designer-app(f): order ${ppwOrderId} merchant share (gross ${subtotalMinor} - ${(commissionRate * 100).toFixed(0)}% commission)`,
      });
      inserted.push({ merchantId, amountMinor: merchantShareMinor, currency });
    }

    return { ok: true, inserted: inserted.length, rows: inserted };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(orders|order_items|payout_queue|merchants).* does not exist|column .* does not exist|42P01|42703|undefined_table/i.test(msg)) {
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
