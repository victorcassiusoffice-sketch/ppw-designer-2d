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
 *   GET /api/cron/escalate-orders   → flag stuck order_items
 *
 * Future cron jobs (dep audit, KV cleanups, etc.) fold into this same
 * file to stay under the Vercel Hobby 12-fn cap.
 */

import { sql } from 'drizzle-orm';
import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import { getDb } from './db/client.js';
import { recordAudit } from './lib/auditLog.js';
import { emailMerchantApproved } from './lib/merchantEmails.js';

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

  res.status(404);
  res.json({ error: `unknown cron action: ${action ?? '(empty)'}` });
}

export default withSentry(rawHandler);
