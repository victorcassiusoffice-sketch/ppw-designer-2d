/**
 * Catch-all cron router — single Vercel function for /api/cron/*.
 *
 * Wave 1.9 — order escalation cron.
 *
 * Auth: every request must carry `Authorization: Bearer ${CRON_SECRET}`
 * or `?key=${CRON_SECRET}` (Vercel cron sends Bearer; manual smoke can
 * use the query string).
 *
 * Routes:
 *   GET /api/cron/escalate-orders          → flag stuck order_items
 *   GET /api/cron/refresh-supplier-rating  → W0.D.9 watermark backfill
 *   GET /api/cron/email-send-reconcile     → M9.A.recon.1 catch missed sends
 *   GET /api/cron/disburse-payouts         → payout scaffold: dry-run report
 *                                            (flag-gated, no rail adapters,
 *                                            unscheduled — see disbursePayouts.ts)
 *   GET /api/cron/gumroad-reconcile        → recover lost Gumroad pings +
 *                                            expire abandoned pending orders
 *                                            (cancellations are never pinged)
 *
 * Future cron jobs (dep audit, KV cleanups, etc.) fold into this same
 * file to stay under the Vercel Hobby 12-fn cap.
 */

import { sql } from 'drizzle-orm';
import { withSentry, type MinReq, type MinRes } from './_lib/sentry.js';
import { getDb } from './_db/client.js';
import { recordAudit } from './_lib/auditLog.js';
import { emailMerchantApproved } from './_lib/merchantEmails.js';
import { refreshSupplierRatingBatch } from './_lib/cron/refreshSupplierRating.js';
import { reconcileEmailSendsBatch } from './_lib/cron/reconcileEmailSends.js';
import { disbursePayoutsBatch } from './_lib/cron/disbursePayouts.js';
import { reconcileGumroadPendingBatch } from './_lib/cron/reconcileGumroadPending.js';
// NOTE (2026-07-26): `generateTopdownsBatch` is deliberately NOT imported.
// It pulls in `sharp` + `@imgly/background-removal-node` (onnx runtime),
// which ballooned this lambda to 553 MB — over Vercel's 250 MB uncompressed
// limit — and FAILED the production deploy. Top-down generation runs
// OUT-OF-BAND instead (session/script batch → footprint-exact PNGs committed
// to public/products/topdown/, served via enrichImagery). The module stays on
// disk for `scripts/` + session use; it must never be imported by an api/*
// entrypoint again. See api/_lib/cron/generateTopdowns.ts header.

interface RouterReq extends MinReq {
  body?: unknown;
}

function authorised(req: RouterReq): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const headerVal = req.headers.authorization;
  const header = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (typeof header === 'string') {
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (m && m[1] === secret) return true;
  }
  const url = req.url ?? '';
  const idx = url.indexOf('key=');
  if (idx >= 0) {
    const tail = url.slice(idx + 4);
    const candidate = tail.split('&')[0] ?? '';
    if (candidate === secret) return true;
  }
  return false;
}

interface StuckItem {
  orderItemId: number;
  merchantId: number;
  merchantSlug: string;
  merchantEmail: string;
  ppwOrderId: string;
  reason: 'confirmed_stale' | 'shipped_stale';
  ageHours: number;
}

export async function findStuckOrderItems(): Promise<StuckItem[]> {
  const db = getDb();
  // No confirmed event within 24h of order creation
  // OR no shipped event within 72h of confirmed event.
  const rows = (await db.execute(
    sql`
      WITH latest_event AS (
        SELECT oie.order_item_id,
               oie.event_type,
               oie.created_at
        FROM order_item_events oie
        INNER JOIN (
          SELECT order_item_id, MAX(created_at) AS max_t
          FROM order_item_events
          GROUP BY order_item_id
        ) m
          ON m.order_item_id = oie.order_item_id
         AND m.max_t = oie.created_at
      )
      SELECT
        oi.id AS "orderItemId",
        oi.merchant_id AS "merchantId",
        m.slug AS "merchantSlug",
        m.contact_email AS "merchantEmail",
        o.ppw_order_id AS "ppwOrderId",
        CASE
          WHEN le.event_type IS NULL THEN 'confirmed_stale'
          WHEN le.event_type = 'confirmed' THEN 'shipped_stale'
          ELSE 'other'
        END AS reason,
        EXTRACT(EPOCH FROM (now() - COALESCE(le.created_at, oi.created_at))) / 3600.0 AS "ageHours"
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN merchants m ON m.id = oi.merchant_id
      LEFT JOIN latest_event le ON le.order_item_id = oi.id
      WHERE
        (le.event_type IS NULL AND oi.created_at < now() - interval '24 hours')
        OR
        (le.event_type = 'confirmed' AND le.created_at < now() - interval '72 hours')
      LIMIT 200
    `,
  )) as unknown as { rows?: StuckItem[] } | StuckItem[];
  const out = Array.isArray(rows) ? rows : rows.rows ?? [];
  return out.filter((r) => r.reason === 'confirmed_stale' || r.reason === 'shipped_stale');
}

async function handleEscalate(res: MinRes): Promise<void> {
  let stuck: StuckItem[];
  try {
    stuck = await findStuckOrderItems();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ ok: false, error: 'Orders schema not migrated.' });
      return;
    }
    res.status(500);
    res.json({ ok: false, error: msg });
    return;
  }

  // Email Vic + audit_log. Use the existing merchantApproved transport
  // for now (will refactor to a generic alert template in W4).
  if (stuck.length > 0) {
    await emailMerchantApproved({
      businessName: 'OMS escalation',
      contactName: 'Vic',
      contactEmail: 'victor@ppwellness.co',
      adminUrl: 'https://designer.ppwellness.co/admin/orders',
      merchantPortalUrl: undefined,
      agentUrl: undefined,
      rejectionReason: `${stuck.length} stuck order items — first 5: ${stuck
        .slice(0, 5)
        .map((s) => `#${s.orderItemId} (${s.reason}, ${s.ageHours.toFixed(1)}h)`)
        .join(', ')}`,
    });

    await recordAudit('system:cron', 'orders.escalation', 'orders', String(stuck.length), null, {
      stuckItemIds: stuck.map((s) => s.orderItemId).slice(0, 50),
      reasons: stuck.reduce<Record<string, number>>((acc, s) => {
        acc[s.reason] = (acc[s.reason] ?? 0) + 1;
        return acc;
      }, {}),
    });
  }

  res.status(200);
  res.json({
    ok: true,
    flaggedCount: stuck.length,
    items: stuck.slice(0, 20),
  });
}

async function rawHandler(req: RouterReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!authorised(req)) {
    res.status(401);
    res.json({ error: 'Unauthorized.' });
    return;
  }

  const url = (req.url ?? '').split('?')[0] ?? '';
  const parts = url.split('/').filter(Boolean);
  // ['api', 'cron', 'escalate-orders']
  const action = parts[2];

  if (action === 'escalate-orders') {
    try {
      await handleEscalate(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'escalation failed';
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (action === 'refresh-supplier-rating') {
    try {
      await handleRefreshSupplierRating(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'refresh-supplier-rating failed';
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (action === 'disburse-payouts') {
    try {
      await handleDisbursePayouts(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'disburse-payouts failed';
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (action === 'gumroad-reconcile') {
    try {
      await handleGumroadReconcile(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'gumroad-reconcile failed';
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (action === 'email-send-reconcile') {
    try {
      await handleEmailSendReconcile(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'email-send-reconcile failed';
      res.status(500);
      res.json({ error: msg });
    }
    return;
  }

  if (action === 'generate-topdowns') {
    // Retired from the serverless surface (2026-07-26) — see the import note
    // at the top of this file. Generation is an out-of-band batch.
    res.status(410);
    res.json({
      ok: false,
      error:
        'generate-topdowns is not available as a serverless action (lambda size limit). Run the out-of-band top-down batch instead.',
    });
    return;
  }

  res.status(404);
  res.json({ error: `unknown cron action: ${action ?? '(empty)'}` });
}

// Payout-disbursement scaffold (2026-07-06): dry-run report unless
// PAYOUT_DISBURSE_ENABLED=true, and no rail adapters exist yet, so no
// money can move regardless. NOT in vercel.json crons — manual invoke
// only. See api/_lib/cron/disbursePayouts.ts for the safety layers.
async function handleDisbursePayouts(res: MinRes): Promise<void> {
  let result;
  try {
    result = await disbursePayoutsBatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ ok: false, error: 'payout_queue schema not migrated.' });
      return;
    }
    res.status(500);
    res.json({ ok: false, error: msg });
    return;
  }
  if (result.due > 0) {
    await recordAudit('system:cron', 'payouts.disburse_scan', 'payout_queue', String(result.due), null, {
      mode: result.mode,
      due: result.due,
      disbursed: result.disbursed,
      skippedReasons: result.skipped.slice(0, 20),
    });
  }
  res.status(200);
  res.json({ ok: true, ...result });
}


// Gumroad stale-pending reconcile (2026-08-04): recovers sales whose ping
// never landed and expires abandoned pending orders. Gumroad never pings
// refunds/cancellations — this batch is the required backstop (skill §3).
async function handleGumroadReconcile(res: MinRes): Promise<void> {
  let result;
  try {
    result = await reconcileGumroadPendingBatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*orders.* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ ok: false, error: 'Orders schema not migrated.' });
      return;
    }
    res.status(500);
    res.json({ ok: false, error: msg });
    return;
  }
  if (result.recovered > 0 || result.underpaid > 0 || result.expired > 0) {
    await recordAudit(
      'system:cron',
      'orders.gumroad_reconcile',
      'orders',
      String(result.recovered),
      null,
      {
        scanned: result.scanned,
        recovered: result.recovered,
        underpaid: result.underpaid,
        expired: result.expired,
        skipped: result.skipped.slice(0, 20),
      },
    );
  }
  res.status(200);
  res.json({ ok: true, ...result });
}

async function handleEmailSendReconcile(res: MinRes): Promise<void> {
  let result;
  try {
    result = await reconcileEmailSendsBatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(orders|audit_log).* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ ok: false, error: 'orders/audit_log schema not migrated.' });
      return;
    }
    res.status(500);
    res.json({ ok: false, error: msg });
    return;
  }
  // Silent on green — audit only when something happened.
  if (result.reEnqueued > 0 || result.errors > 0) {
    await recordAudit(
      'system:cron',
      'email.send_reconcile',
      'email',
      String(result.reEnqueued),
      null,
      { ...result } as Record<string, unknown>,
    );
  }
  res.status(200);
  res.json({ ok: true, ...result });
}

async function handleRefreshSupplierRating(res: MinRes): Promise<void> {
  let result;
  try {
    result = await refreshSupplierRatingBatch();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .* does not exist|column .* does not exist|42P01|42703/i.test(msg)) {
      res.status(503);
      res.json({ ok: false, error: 'products/merchants schema not migrated.' });
      return;
    }
    res.status(500);
    res.json({ ok: false, error: msg });
    return;
  }
  // Silent on green when nothing to do; audit row only when something changed.
  if (result.updated > 0 || result.errors > 0) {
    await recordAudit(
      'system:cron',
      'products.refresh_supplier_rating',
      'products',
      String(result.updated),
      null,
      { ...result } as Record<string, unknown>,
    );
  }
  res.status(200);
  res.json({ ok: true, ...result });
}

export default withSentry(rawHandler);
