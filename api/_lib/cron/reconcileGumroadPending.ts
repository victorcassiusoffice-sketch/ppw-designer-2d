/**
 * Gumroad stale-pending reconcile — cron action (2026-08-04).
 *
 * GET /api/cron/gumroad-reconcile  (folded into api/cron-router.ts)
 *
 * Why: Gumroad appends the Ping URL ONLY for `sale` events — refunds and
 * cancellations are never pinged, and a lost/failed ping leaves an order
 * 'pending' forever. This batch closes both gaps:
 *
 *   1. RECOVER — for each pending gumroad order, list recent sales for
 *      the Designer Order product via GET /v2/sales (filtered by the
 *      buyer email + creation date) and match our order_ref in the
 *      sale's url_params. A matching, unrefunded sale is settled through
 *      the same settleVerifiedSale path as the webhook (idempotent,
 *      underpaid-aware).
 *   2. EXPIRE — a pending order older than EXPIRE_HOURS with no matching
 *      sale is marked 'failed' (buyer abandoned checkout / cancelled at
 *      Gumroad — nothing was charged).
 *
 * Best-effort by design: API failures skip the row (retried next run).
 * Not configured (env unset) → clean no-op report, never an error.
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../../_db/client.js';
import { readGumroadEnv, type GumroadEnv } from '../gumroad/env.js';
import {
  GUMROAD_API_BASE,
  settleVerifiedSale,
  loadGumroadOrder,
  type VerifiedGumroadSale,
  type SettleDeps,
  type OrderLoader,
} from '../gumroad/webhook.js';

/** Only look at orders that have had time to complete checkout. */
export const MIN_AGE_MINUTES = 30;
/** Pending + unmatched for this long → expired ('failed'). */
export const EXPIRE_HOURS = 48;
const BATCH_LIMIT = 50;

interface PendingRow {
  ppwOrderId: string;
  customerEmail: string;
  createdAt: string;
  ageHours: number;
}

export interface GumroadSalesLister {
  (args: { email: string; after: string; env: GumroadEnv }): Promise<
    | { ok: true; sales: Array<VerifiedGumroadSale & { orderRef: string | null }> }
    | { ok: false; error: string }
  >;
}

/** Default lister — GET /v2/sales?email=&after=. url_params ride along on
 *  each sale object; we surface order_ref for matching. */
export function makeSalesLister(fetchFn: typeof fetch = fetch): GumroadSalesLister {
  return async ({ email, after, env }) => {
    try {
      const url = new URL(`${GUMROAD_API_BASE}/v2/sales`);
      url.searchParams.set('email', email);
      url.searchParams.set('after', after);
      const res = await fetchFn(url.toString(), {
        headers: { Authorization: `Bearer ${env.accessToken}` },
      });
      if (!res.ok) return { ok: false, error: `Gumroad sales list failed: ${res.status}` };
      const json = (await res.json()) as {
        success?: boolean;
        sales?: Array<{
          id?: string;
          product_id?: string;
          price?: number;
          email?: string;
          refunded?: boolean;
          test?: boolean;
          url_params?: Record<string, string>;
        }>;
      };
      if (!json.success || !Array.isArray(json.sales)) {
        return { ok: false, error: 'Gumroad sales list returned no sales array.' };
      }
      return {
        ok: true,
        sales: json.sales.map((s) => ({
          saleId: s.id ?? '',
          productId: s.product_id ?? '',
          priceUsdMinor: Number.isFinite(Number(s.price)) ? Math.round(Number(s.price)) : 0,
          email: typeof s.email === 'string' ? s.email : null,
          refunded: s.refunded === true,
          test: s.test === true,
          orderRef:
            s.url_params && typeof s.url_params.order_ref === 'string'
              ? s.url_params.order_ref
              : null,
        })),
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message.slice(0, 200) : 'sales list failed' };
    }
  };
}

export interface ReconcileGumroadSummary {
  ok: boolean;
  configured: boolean;
  scanned: number;
  recovered: number;
  underpaid: number;
  expired: number;
  skipped: Array<{ orderRef: string; reason: string }>;
}

export interface ReconcileGumroadDeps extends SettleDeps {
  env?: NodeJS.ProcessEnv;
  listSales?: GumroadSalesLister;
  loadOrder?: OrderLoader;
}

export async function reconcileGumroadPendingBatch(
  deps: ReconcileGumroadDeps = {},
): Promise<ReconcileGumroadSummary> {
  const summary: ReconcileGumroadSummary = {
    ok: true,
    configured: true,
    scanned: 0,
    recovered: 0,
    underpaid: 0,
    expired: 0,
    skipped: [],
  };

  let env: GumroadEnv;
  try {
    env = readGumroadEnv(deps.env ?? process.env);
  } catch {
    return { ...summary, configured: false };
  }

  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT ppw_order_id AS "ppwOrderId",
           customer_email AS "customerEmail",
           created_at::text AS "createdAt",
           EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 AS "ageHours"
      FROM orders
     WHERE payment_rail = 'gumroad'
       AND payment_status = 'pending'
       AND created_at < now() - make_interval(mins => ${MIN_AGE_MINUTES})
     ORDER BY created_at ASC
     LIMIT ${BATCH_LIMIT}
  `)) as unknown as { rows?: PendingRow[] } | PendingRow[];
  const pending = Array.isArray(rows) ? rows : rows.rows ?? [];
  summary.scanned = pending.length;

  const listSales = deps.listSales ?? makeSalesLister();
  const loadOrder = deps.loadOrder ?? loadGumroadOrder;

  for (const row of pending) {
    const after = row.createdAt.slice(0, 10); // YYYY-MM-DD
    const listed = await listSales({ email: row.customerEmail, after, env });
    if (!listed.ok) {
      summary.skipped.push({ orderRef: row.ppwOrderId, reason: listed.error });
      continue;
    }
    const match = listed.sales.find(
      (s) => s.productId === env.productId && s.orderRef === row.ppwOrderId && !s.refunded,
    );
    if (match) {
      const order = await loadOrder(row.ppwOrderId);
      if (!order) {
        summary.skipped.push({ orderRef: row.ppwOrderId, reason: 'order vanished' });
        continue;
      }
      const settled = await settleVerifiedSale(order, match, deps);
      if (settled.outcome === 'captured') summary.recovered += 1;
      else if (settled.outcome === 'underpaid') summary.underpaid += 1;
      else if (settled.outcome === 'error') {
        summary.skipped.push({ orderRef: row.ppwOrderId, reason: settled.error });
      }
      continue;
    }
    // No sale found — expire only once the order is clearly abandoned.
    if (Number(row.ageHours) >= EXPIRE_HOURS) {
      try {
        await db.execute(sql`
          UPDATE orders
             SET payment_status = 'failed',
                 raw_payload = COALESCE(raw_payload, '{}'::jsonb) || '{"expiredBy":"gumroad-reconcile"}'::jsonb,
                 updated_at = NOW()
           WHERE ppw_order_id = ${row.ppwOrderId}
             AND payment_status = 'pending'
        `);
        summary.expired += 1;
      } catch (err) {
        summary.skipped.push({
          orderRef: row.ppwOrderId,
          reason: err instanceof Error ? err.message.slice(0, 120) : 'expire failed',
        });
      }
    }
  }

  return summary;
}
