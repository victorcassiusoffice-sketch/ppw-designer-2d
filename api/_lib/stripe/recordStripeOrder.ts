/**
 * Stripe checkout.session.completed → Neon orders row (IMPL-1 defect 6).
 *
 * Before this module the Stripe webhook ONLY sent emails — a paid Stripe
 * checkout left NO orders / order_items / payout_queue / referral rows,
 * so the whole downstream pipeline (tracking page, payouts, commission)
 * was PayPal-only. This mirrors the PayPal capture recorder:
 *
 *   1. Upsert `orders` keyed on ppw_order_id (metadata.orderId →
 *      client_reference_id → session.id), idempotent via ON CONFLICT.
 *   2. Rebuild order line items from the compact `metadata.cart`
 *      snapshot ({s: sku, q: qty, u: unitMinor}[]) written by
 *      create-checkout-session, shaped like a PayPal capture so the
 *      existing recordOrderItemsForOrder helper is reused as-is.
 *   3. Fire payouts + referrals recorders (both no-op safely when
 *      order_items is empty).
 *
 * Event-level idempotency is the caller's job (`webhook_events` dedupe in
 * api/stripe-webhook.ts) — a deduped retry never reaches this module, so
 * the fire-once contract of recordOrderItemsForOrder holds.
 *
 * All failures are non-fatal to the webhook 200 — errors are returned
 * for logging, never thrown.
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../../_db/client.js';
import {
  recordOrderItemsForOrder,
  type PaypalCaptureForOrderItems,
} from '../payouts/recordOrderItemsForOrder.js';
import { recordPayoutsForOrder } from '../payouts/recordPayoutsForOrder.js';
import { recordReferralsForOrder } from '../payouts/recordReferralsForOrder.js';

export interface StripeSessionLike {
  id: string;
  amount_total?: number | null;
  currency?: string | null;
  customer_email?: string | null;
  client_reference_id?: string | null;
  customer_details?: { email?: string | null } | null;
  metadata?: Record<string, string> | null;
}

/** ppw_order_id precedence: our metadata orderId → client_reference_id →
 *  the session id itself (always present, keeps the upsert keyed). */
export function resolvePpwOrderId(session: StripeSessionLike): string {
  const md = session.metadata ?? {};
  const fromMeta = typeof md.orderId === 'string' ? md.orderId.trim() : '';
  if (fromMeta) return fromMeta;
  const fromRef = (session.client_reference_id ?? '').trim();
  if (fromRef) return fromRef;
  return session.id;
}

export interface CartMetaItem {
  sku: string;
  quantity: number;
  unitMinor: number;
}

/** Parse the compact `metadata.cart` snapshot. Returns [] on anything
 *  malformed — order_items population is best-effort. */
export function parseCartMetadata(raw: string | null | undefined): CartMetaItem[] {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: CartMetaItem[] = [];
  for (const it of parsed) {
    if (!it || typeof it !== 'object') continue;
    const r = it as { s?: unknown; q?: unknown; u?: unknown };
    if (typeof r.s !== 'string' || r.s.length === 0) continue;
    if (typeof r.q !== 'number' || !Number.isFinite(r.q) || r.q <= 0) continue;
    if (typeof r.u !== 'number' || !Number.isFinite(r.u) || r.u < 0) continue;
    out.push({ sku: r.s, quantity: Math.floor(r.q), unitMinor: Math.round(r.u) });
  }
  return out;
}

/** Shape the cart snapshot like a PayPal capture so the existing
 *  order_items recorder can consume it. unit_amount.value is a 2-decimal
 *  major string (minor ÷ 100 — Phase 0 wire-contract, all currencies). */
export function buildCaptureShapeFromCartMeta(
  items: CartMetaItem[],
  currency: string,
): PaypalCaptureForOrderItems {
  return {
    purchase_units: [
      {
        items: items.map((it) => ({
          sku: it.sku,
          quantity: String(it.quantity),
          unit_amount: {
            currency_code: currency,
            value: (it.unitMinor / 100).toFixed(2),
          },
        })),
      },
    ],
  };
}

export interface StripeOrderRecordSummary {
  ok: boolean;
  ppwOrderId: string;
  orderUpserted: boolean;
  itemsInserted: number;
  error?: string;
}

export async function recordStripeCheckoutOrder(
  session: StripeSessionLike,
): Promise<StripeOrderRecordSummary> {
  const ppwOrderId = resolvePpwOrderId(session);
  const currency = (session.currency ?? 'usd').toUpperCase();
  // Stripe amount_total is already minor units for every currency we
  // support (MUR is a 2-decimal currency in Stripe).
  const totalMinor = Math.round(session.amount_total ?? 0);
  const customerEmail =
    session.customer_details?.email || session.customer_email || '';

  let orderUpserted = false;
  try {
    const db = getDb();
    await db.execute(sql`
      INSERT INTO orders (ppw_order_id, customer_email, currency, total_minor, payment_rail, payment_rail_order_id, payment_status, raw_payload)
      VALUES (${ppwOrderId}, ${customerEmail}, ${currency}, ${totalMinor}, ${'stripe'}, ${session.id}, ${'captured'}, ${JSON.stringify(session)}::jsonb)
      ON CONFLICT (ppw_order_id) DO UPDATE
        SET payment_status = EXCLUDED.payment_status,
            payment_rail_order_id = EXCLUDED.payment_rail_order_id,
            customer_email = CASE
              WHEN orders.customer_email IS NULL OR orders.customer_email = ''
                THEN EXCLUDED.customer_email
              ELSE orders.customer_email
            END,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
    `);
    orderUpserted = true;
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'DB write failed';
    return { ok: false, ppwOrderId, orderUpserted: false, itemsInserted: 0, error: message };
  }

  let itemsInserted = 0;
  try {
    const cartItems = parseCartMetadata(session.metadata?.cart);
    if (cartItems.length > 0) {
      const shape = buildCaptureShapeFromCartMeta(cartItems, currency);
      const summary = await recordOrderItemsForOrder(ppwOrderId, shape);
      itemsInserted = summary.inserted;
      if (!summary.ok) {
        // eslint-disable-next-line no-console
        console.error(
          '[stripe-order-record] order-items failed:',
          summary.error ?? summary.skippedReason,
        );
      }
    }
  } catch (itemsErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[stripe-order-record] order-items unexpected:',
      itemsErr instanceof Error ? itemsErr.message : String(itemsErr),
    );
  }

  try {
    const payoutSummary = await recordPayoutsForOrder(ppwOrderId);
    if (!payoutSummary.ok) {
      // eslint-disable-next-line no-console
      console.error(
        '[stripe-order-record] payout-record failed:',
        payoutSummary.error ?? payoutSummary.skippedReason,
      );
    }
  } catch (payoutErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[stripe-order-record] payout-record unexpected:',
      payoutErr instanceof Error ? payoutErr.message : String(payoutErr),
    );
  }

  try {
    const refSummary = await recordReferralsForOrder(ppwOrderId);
    if (!refSummary.ok) {
      // eslint-disable-next-line no-console
      console.error(
        '[stripe-order-record] referral-record failed:',
        refSummary.error ?? refSummary.skippedReason,
      );
    }
  } catch (refErr) {
    // eslint-disable-next-line no-console
    console.error(
      '[stripe-order-record] referral-record unexpected:',
      refErr instanceof Error ? refErr.message : String(refErr),
    );
  }

  return { ok: true, ppwOrderId, orderUpserted, itemsInserted };
}
