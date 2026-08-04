/**
 * Gumroad Ping handler core — the interim rail's webhook (2026-08-04).
 *
 * POST /api/gumroad/ping  (folded into api/orders.ts — 12-fn cap; the
 * account-level Ping URL is set ONCE in Gumroad Settings → Advanced and
 * routed internally by product_id, per the gumroad-gateway-build skill §3).
 *
 * Gumroad POSTs x-www-form-urlencoded on every SALE (and only sales —
 * refunds/cancellations are NOT pinged; see the stale-pending cron).
 * Relevant fields: sale_id, product_id, price (USD cents actually paid),
 * email, refunded, test, url_params[order_ref] (our passthrough).
 *
 * Security model:
 *   • Pings carry no signature — the payload is UNTRUSTED. The handler
 *     verifies every sale server-side via GET /v2/sales/:sale_id with
 *     GUMROAD_ACCESS_TOKEN and uses ONLY the verified sale's fields.
 *   • Unknown product_id → 200 no-op (other products on the account).
 *   • Unknown / missing order_ref → 400 (rejected, logged).
 *   • paid < expected USD total (PWYW floor risk — buyer edited the
 *     pre-filled price down) → order marked 'underpaid', NOT fulfilled.
 *   • Idempotent: an already-captured order acks 200 without re-running
 *     the finalize chain; recordOrderItemsForOrder's `already_recorded`
 *     guard backstops races.
 *   • TEST sales (sale.test — $0 collected) capture + email for the
 *     smoke test, but NEVER queue merchant payouts or referral
 *     commissions (see finalizeGumroadOrder).
 */

import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '../../_db/client.js';
import { readGumroadEnv, GumroadNotConfiguredError, type GumroadEnv } from './env.js';
import { buildCaptureShapeFromCartMeta, type CartMetaItem } from '../stripe/recordStripeOrder.js';
import { recordOrderItemsForOrder } from '../payouts/recordOrderItemsForOrder.js';
import { recordPayoutsForOrder } from '../payouts/recordPayoutsForOrder.js';
import { recordReferralsForOrder } from '../payouts/recordReferralsForOrder.js';
import { dispatchOrderConfirmedEmail } from '../email/dispatch.js';

// ─────────────────────────────────────────────────────────────────────
// Ping parsing.
// ─────────────────────────────────────────────────────────────────────

export interface GumroadPingFields {
  saleId: string;
  productId: string;
  /** USD cents actually paid (verification anchor for PWYW). */
  priceUsdMinor: number;
  orderRef: string | null;
  email: string | null;
  refunded: boolean;
  test: boolean;
}

function asRecord(body: unknown): Record<string, unknown> | null {
  if (body === null || body === undefined) return null;
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const text = Buffer.isBuffer(body) ? body.toString('utf8') : body;
    const out: Record<string, unknown> = {};
    for (const [k, v] of new URLSearchParams(text)) out[k] = v;
    return out;
  }
  if (typeof body === 'object') return body as Record<string, unknown>;
  return null;
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}

function truthy(v: unknown): boolean {
  return v === true || v === 'true' || v === '1' || v === 1;
}

/** Extract our order_ref passthrough — Gumroad returns arbitrary checkout
 *  URL params in the Ping's `url_params` dict. Depending on the body
 *  parser that arrives either as a nested object (`url_params.order_ref`)
 *  or as a flat bracketed key (`url_params[order_ref]`). */
export function extractOrderRef(body: Record<string, unknown>): string | null {
  const nested = body.url_params;
  if (nested && typeof nested === 'object') {
    const ref = str((nested as Record<string, unknown>).order_ref);
    if (ref) return ref;
  }
  const flat = str(body['url_params[order_ref]']);
  if (flat) return flat;
  return str(body.order_ref);
}

export function parseGumroadPing(rawBody: unknown): GumroadPingFields | null {
  const body = asRecord(rawBody);
  if (!body) return null;
  const saleId = str(body.sale_id);
  const productId = str(body.product_id);
  if (!saleId || !productId) return null;
  const priceRaw = Number(body.price);
  return {
    saleId,
    productId,
    priceUsdMinor: Number.isFinite(priceRaw) ? Math.round(priceRaw) : 0,
    orderRef: extractOrderRef(body),
    email: str(body.email),
    refunded: truthy(body.refunded),
    test: truthy(body.test),
  };
}

// ─────────────────────────────────────────────────────────────────────
// Server-side sale verification (GET /v2/sales/:id).
// ─────────────────────────────────────────────────────────────────────

export interface VerifiedGumroadSale {
  saleId: string;
  productId: string;
  priceUsdMinor: number;
  email: string | null;
  refunded: boolean;
  test: boolean;
}

export type SaleVerifier = (
  saleId: string,
  env: GumroadEnv,
) => Promise<{ ok: true; sale: VerifiedGumroadSale } | { ok: false; error: string }>;

export const GUMROAD_API_BASE = 'https://api.gumroad.com';

export function makeSaleVerifier(fetchFn: typeof fetch = fetch): SaleVerifier {
  return async (saleId, env) => {
    try {
      const res = await fetchFn(
        `${GUMROAD_API_BASE}/v2/sales/${encodeURIComponent(saleId)}`,
        { headers: { Authorization: `Bearer ${env.accessToken}` } },
      );
      if (!res.ok) return { ok: false, error: `Gumroad sale lookup failed: ${res.status}` };
      const json = (await res.json()) as {
        success?: boolean;
        sale?: {
          id?: string;
          product_id?: string;
          price?: number;
          email?: string;
          refunded?: boolean;
          test?: boolean;
        };
      };
      if (!json.success || !json.sale) {
        return { ok: false, error: 'Gumroad sale lookup returned no sale.' };
      }
      const s = json.sale;
      return {
        ok: true,
        sale: {
          saleId: s.id ?? saleId,
          productId: s.product_id ?? '',
          priceUsdMinor: Number.isFinite(Number(s.price)) ? Math.round(Number(s.price)) : 0,
          email: typeof s.email === 'string' ? s.email : null,
          refunded: s.refunded === true,
          test: s.test === true,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 200) : 'sale lookup failed';
      return { ok: false, error: msg };
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// Order access + settlement.
// ─────────────────────────────────────────────────────────────────────

export interface PendingGumroadOrderRow {
  ppwOrderId: string;
  customerEmail: string;
  currency: string;
  totalMinor: number;
  paymentRail: string;
  paymentStatus: string;
  expectedUsdMinor: number;
  cartMeta: CartMetaItem[];
}

export type OrderLoader = (orderRef: string) => Promise<PendingGumroadOrderRow | null>;

export async function loadGumroadOrder(orderRef: string): Promise<PendingGumroadOrderRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.ppwOrderId, orderRef))
    .limit(1);
  const o = rows[0];
  if (!o) return null;
  const raw = (o.rawPayload ?? {}) as {
    expectedUsdMinor?: number;
    cart?: Array<{ s?: string; q?: number; u?: number }>;
  };
  const cartMeta: CartMetaItem[] = Array.isArray(raw.cart)
    ? raw.cart
        .filter(
          (it): it is { s: string; q: number; u: number } =>
            !!it && typeof it.s === 'string' && typeof it.q === 'number' && typeof it.u === 'number',
        )
        .map((it) => ({ sku: it.s, quantity: it.q, unitMinor: it.u }))
    : [];
  return {
    ppwOrderId: o.ppwOrderId,
    customerEmail: o.customerEmail,
    currency: o.currency,
    totalMinor: o.totalMinor,
    paymentRail: o.paymentRail,
    paymentStatus: o.paymentStatus,
    expectedUsdMinor:
      typeof raw.expectedUsdMinor === 'number' && Number.isFinite(raw.expectedUsdMinor)
        ? Math.round(raw.expectedUsdMinor)
        : 0,
    cartMeta,
  };
}

export type OrderStatusWriter = (
  orderRef: string,
  status: 'captured' | 'underpaid',
  sale: VerifiedGumroadSale,
) => Promise<{ ok: boolean; error?: string }>;

export async function writeGumroadOrderStatus(
  orderRef: string,
  status: 'captured' | 'underpaid',
  sale: VerifiedGumroadSale,
): Promise<{ ok: boolean; error?: string }> {
  const salePatch = JSON.stringify({
    gumroadSaleId: sale.saleId,
    paidUsdMinor: sale.priceUsdMinor,
    testSale: sale.test,
    settledAt: new Date().toISOString(),
  });
  const db = getDb();
  try {
    await db.execute(sql`
      UPDATE orders
         SET payment_status = ${status},
             payment_rail_order_id = ${sale.saleId},
             raw_payload = COALESCE(raw_payload, '{}'::jsonb) || ${salePatch}::jsonb,
             updated_at = NOW()
       WHERE ppw_order_id = ${orderRef}
    `);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 200) : 'DB write failed';
    // 'underpaid' needs migration 0028 — degrade to 'failed' (order is
    // still NOT fulfilled; the paid/expected mismatch lives in payload).
    if (status === 'underpaid' && /invalid input value for enum/i.test(message)) {
      try {
        await db.execute(sql`
          UPDATE orders
             SET payment_status = 'failed',
                 payment_rail_order_id = ${sale.saleId},
                 raw_payload = COALESCE(raw_payload, '{}'::jsonb) || ${salePatch}::jsonb || '{"underpaid":true}'::jsonb,
                 updated_at = NOW()
           WHERE ppw_order_id = ${orderRef}
        `);
        return { ok: true };
      } catch (err2) {
        return { ok: false, error: err2 instanceof Error ? err2.message.slice(0, 200) : 'DB write failed' };
      }
    }
    return { ok: false, error: message };
  }
}

export type OrderFinalizer = (
  order: PendingGumroadOrderRow,
  sale: VerifiedGumroadSale,
) => Promise<void>;

/**
 * Post-capture finalisation — mirrors the PayPal finalizeCapturedOrder
 * chain: order_items (rebuilt from the stored cart snapshot, in the
 * ORDER's currency) → buyer email → payouts → referrals. All stages
 * non-fatal; recordOrderItemsForOrder's `already_recorded` guard makes
 * replays skip the payout/referral stages.
 *
 * TEST SALES (`sale.test` — Vic buying his own product, $0 actually
 * collected): the order still captures and order_items + the buyer email
 * still run so the documented smoke test verifies the chain end-to-end,
 * but the PAYOUT and REFERRAL stages are SKIPPED — no money changed
 * hands, so no merchant payout_queue row and no referral commission may
 * be created. `itemsAlreadyRecorded` early-return means a later replay
 * of the same order can never queue them retroactively either.
 */
export async function finalizeGumroadOrder(
  order: PendingGumroadOrderRow,
  sale: VerifiedGumroadSale,
): Promise<void> {
  let itemsAlreadyRecorded = false;
  try {
    if (order.cartMeta.length > 0) {
      const shape = buildCaptureShapeFromCartMeta(order.cartMeta, order.currency);
      const summary = await recordOrderItemsForOrder(order.ppwOrderId, shape);
      itemsAlreadyRecorded = summary.skippedReason === 'already_recorded';
      if (!summary.ok) {
        // eslint-disable-next-line no-console
        console.error('[gumroad-finalize] order-items failed:', summary.error ?? summary.skippedReason);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gumroad-finalize] order-items unexpected:', err instanceof Error ? err.message : String(err));
  }
  if (itemsAlreadyRecorded) return;

  try {
    const dispatch = await dispatchOrderConfirmedEmail({
      ppwOrderId: order.ppwOrderId,
      customerEmail: order.customerEmail || null,
      totalMinor: order.totalMinor,
      currency: order.currency,
    });
    if (dispatch.skippedReason === 'caller_caught') {
      // eslint-disable-next-line no-console
      console.error('[gumroad-finalize] order-confirmed-email caught:', dispatch.error);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gumroad-finalize] email unexpected:', err instanceof Error ? err.message : String(err));
  }

  if (sale.test) {
    // eslint-disable-next-line no-console
    console.warn(
      `[gumroad-finalize] TEST sale ${sale.saleId} on order ${order.ppwOrderId}: payouts + referrals SKIPPED ($0 collected)`,
    );
    return;
  }

  try {
    const payoutSummary = await recordPayoutsForOrder(order.ppwOrderId);
    if (!payoutSummary.ok) {
      // eslint-disable-next-line no-console
      console.error('[gumroad-finalize] payout-record failed:', payoutSummary.error ?? payoutSummary.skippedReason);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gumroad-finalize] payout-record unexpected:', err instanceof Error ? err.message : String(err));
  }

  try {
    const refSummary = await recordReferralsForOrder(order.ppwOrderId);
    if (!refSummary.ok) {
      // eslint-disable-next-line no-console
      console.error('[gumroad-finalize] referral-record failed:', refSummary.error ?? refSummary.skippedReason);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[gumroad-finalize] referral-record unexpected:', err instanceof Error ? err.message : String(err));
  }
}

// ─────────────────────────────────────────────────────────────────────
// Settlement core (shared by the Ping handler + the stale-pending cron).
// ─────────────────────────────────────────────────────────────────────

export interface SettleDeps {
  markOrder?: OrderStatusWriter;
  finalize?: OrderFinalizer;
}

export type SettleResult =
  | { outcome: 'captured' }
  | { outcome: 'underpaid'; paidUsdMinor: number; expectedUsdMinor: number }
  | { outcome: 'already_captured' }
  | { outcome: 'error'; error: string };

/** Apply a VERIFIED sale to a loaded order row. */
export async function settleVerifiedSale(
  order: PendingGumroadOrderRow,
  sale: VerifiedGumroadSale,
  deps: SettleDeps = {},
): Promise<SettleResult> {
  const markOrder = deps.markOrder ?? writeGumroadOrderStatus;
  const finalize = deps.finalize ?? finalizeGumroadOrder;

  if (order.paymentStatus === 'captured') return { outcome: 'already_captured' };

  // PWYW floor risk: the buyer can lower the pre-filled price down to the
  // product minimum. Paid must cover the expected USD total.
  if (order.expectedUsdMinor > 0 && sale.priceUsdMinor < order.expectedUsdMinor) {
    const marked = await markOrder(order.ppwOrderId, 'underpaid', sale);
    if (!marked.ok) return { outcome: 'error', error: marked.error ?? 'underpaid write failed' };
    return {
      outcome: 'underpaid',
      paidUsdMinor: sale.priceUsdMinor,
      expectedUsdMinor: order.expectedUsdMinor,
    };
  }

  const marked = await markOrder(order.ppwOrderId, 'captured', sale);
  if (!marked.ok) return { outcome: 'error', error: marked.error ?? 'capture write failed' };
  await finalize({ ...order, paymentStatus: 'captured' }, sale);
  return { outcome: 'captured' };
}

// ─────────────────────────────────────────────────────────────────────
// Ping entrypoint.
// ─────────────────────────────────────────────────────────────────────

export interface GumroadPingDeps extends SettleDeps {
  env?: NodeJS.ProcessEnv;
  verifySale?: SaleVerifier;
  loadOrder?: OrderLoader;
}

export type GumroadPingResult =
  | { status: 200; body: Record<string, unknown> }
  | { status: 400 | 502 | 503; body: { error: string } };

export async function processGumroadPing(
  rawBody: unknown,
  deps: GumroadPingDeps = {},
): Promise<GumroadPingResult> {
  const parsed = parseGumroadPing(rawBody);
  if (!parsed) return { status: 400, body: { error: 'Invalid Gumroad ping payload.' } };

  let env: GumroadEnv;
  try {
    env = readGumroadEnv(deps.env ?? process.env);
  } catch (err) {
    const msg = err instanceof GumroadNotConfiguredError ? err.message : 'Gumroad rail not configured';
    return { status: 503, body: { error: msg } };
  }

  // ONE account-level Ping URL — other products' sales are a safe no-op.
  if (parsed.productId !== env.productId) {
    return { status: 200, body: { ok: true, ignored: 'unknown_product' } };
  }

  if (!parsed.orderRef) {
    return { status: 400, body: { error: 'order_ref missing from ping url_params.' } };
  }

  // The ping is unauthenticated — verify the sale server-side and use
  // ONLY the verified fields from here on.
  const verifySale = deps.verifySale ?? makeSaleVerifier();
  const verified = await verifySale(parsed.saleId, env);
  if (!verified.ok) return { status: 502, body: { error: verified.error } };
  const sale = verified.sale;

  if (sale.productId !== env.productId) {
    return { status: 400, body: { error: 'Verified sale product_id mismatch.' } };
  }
  if (sale.refunded) {
    return { status: 200, body: { ok: true, ignored: 'refunded' } };
  }

  const loadOrder = deps.loadOrder ?? loadGumroadOrder;
  let order: PendingGumroadOrderRow | null;
  try {
    order = await loadOrder(parsed.orderRef);
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : 'order lookup failed';
    if (/relation .*orders.* does not exist|42P01/i.test(msg)) {
      return { status: 503, body: { error: 'Orders table not migrated.' } };
    }
    return { status: 502, body: { error: msg } };
  }
  if (!order) {
    return { status: 400, body: { error: `Unknown order_ref: ${parsed.orderRef}` } };
  }
  if (order.paymentRail !== 'gumroad') {
    return { status: 400, body: { error: 'order_ref does not belong to the Gumroad rail.' } };
  }

  const settled = await settleVerifiedSale(order, sale, deps);
  switch (settled.outcome) {
    case 'captured':
      return { status: 200, body: { ok: true, captured: true, test: sale.test } };
    case 'already_captured':
      return { status: 200, body: { ok: true, already: true } };
    case 'underpaid':
      // 200 so Gumroad does not retry — the order is deliberately held.
      // eslint-disable-next-line no-console
      console.warn(
        `[gumroad-ping] UNDERPAID order ${order.ppwOrderId}: paid ${settled.paidUsdMinor} < expected ${settled.expectedUsdMinor} (USD minor)`,
      );
      return {
        status: 200,
        body: {
          ok: true,
          underpaid: true,
          paidUsdMinor: settled.paidUsdMinor,
          expectedUsdMinor: settled.expectedUsdMinor,
        },
      };
    case 'error':
      return { status: 502, body: { error: settled.error } };
  }
}
