/**
 * OMS Phase 7 — admin dashboard stats aggregator.
 *
 * Pulls counts + sums from the live tables for the /admin/dashboard
 * page. Read-only — no mutations.
 *
 * Output shape locks the dashboard contract; new fields can be added
 * but existing fields must not change shape (admin UI is currency-strict).
 */

import { drizzleMerchantStore } from '../../_db/merchantStore.js';
import { authoriseAdminWithLive } from '../adminAuth.js';
import { getDb } from '../../_db/client.js';
import { sql } from 'drizzle-orm';

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

export interface DashboardStats {
  merchants: { total: number; byStatus: Record<string, number> };
  products: { total: number; byStatus: Record<string, number> };
  suppliers: { total: number; byStatus: Record<string, number> };
  orders: { total: number; byStatus: Record<string, number> };
  payouts: { total: number; byStatus: Record<string, number> };
  revenue: { totalMinor: number; byCurrency: Record<string, number> };
  /** OMS Wave 1.8 — sparkline data: ISO date → count (or minor). */
  timeSeries: {
    ordersPerDay30d: Array<{ date: string; count: number }>;
    revenuePerDay30d: Array<{ date: string; currency: string; totalMinor: number }>;
    signupsPerWeek12w: Array<{ weekStart: string; count: number }>;
  };
  generatedAt: string;
  schemaMissing: string[];
}

interface CountByStatus {
  status: string;
  count: number;
}

async function safeCountByStatus(
  query: () => Promise<CountByStatus[]>,
  table: string,
  schemaMissing: string[],
): Promise<{ total: number; byStatus: Record<string, number> }> {
  try {
    const rows = await query();
    const byStatus: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byStatus[r.status] = r.count;
      total += r.count;
    }
    return { total, byStatus };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/relation .* does not exist|42P01|undefined_table/i.test(msg)) {
      schemaMissing.push(table);
      return { total: 0, byStatus: {} };
    }
    throw err;
  }
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const db = getDb();
  const schemaMissing: string[] = [];

  const merchants = await safeCountByStatus(
    async () => {
      const rows = (await db.execute(
        sql`SELECT status::text AS status, COUNT(*)::int AS count FROM merchants GROUP BY status`,
      )) as unknown as { rows?: CountByStatus[] } | CountByStatus[];
      return Array.isArray(rows) ? rows : (rows.rows ?? []);
    },
    'merchants',
    schemaMissing,
  );

  const products = await safeCountByStatus(
    async () => {
      const rows = (await db.execute(
        sql`SELECT status::text AS status, COUNT(*)::int AS count FROM products GROUP BY status`,
      )) as unknown as { rows?: CountByStatus[] } | CountByStatus[];
      return Array.isArray(rows) ? rows : (rows.rows ?? []);
    },
    'products',
    schemaMissing,
  );

  const suppliers = await safeCountByStatus(
    async () => {
      const rows = (await db.execute(
        sql`SELECT status::text AS status, COUNT(*)::int AS count FROM suppliers GROUP BY status`,
      )) as unknown as { rows?: CountByStatus[] } | CountByStatus[];
      return Array.isArray(rows) ? rows : (rows.rows ?? []);
    },
    'suppliers',
    schemaMissing,
  );

  const orders = await safeCountByStatus(
    async () => {
      const rows = (await db.execute(
        sql`SELECT payment_status::text AS status, COUNT(*)::int AS count FROM orders GROUP BY payment_status`,
      )) as unknown as { rows?: CountByStatus[] } | CountByStatus[];
      return Array.isArray(rows) ? rows : (rows.rows ?? []);
    },
    'orders',
    schemaMissing,
  );

  const payouts = await safeCountByStatus(
    async () => {
      const rows = (await db.execute(
        sql`SELECT status::text AS status, COUNT(*)::int AS count FROM payout_queue GROUP BY status`,
      )) as unknown as { rows?: CountByStatus[] } | CountByStatus[];
      return Array.isArray(rows) ? rows : (rows.rows ?? []);
    },
    'payout_queue',
    schemaMissing,
  );

  // Revenue from captured orders only.
  let revenue = { totalMinor: 0, byCurrency: {} as Record<string, number> };
  try {
    const rows = (await db.execute(
      sql`SELECT currency, COALESCE(SUM(total_minor),0)::int AS total FROM orders WHERE payment_status = 'captured' GROUP BY currency`,
    )) as unknown as { rows?: Array<{ currency: string; total: number }> } | Array<{ currency: string; total: number }>;
    const r = Array.isArray(rows) ? rows : (rows.rows ?? []);
    for (const row of r) {
      revenue.byCurrency[row.currency] = row.total;
      revenue.totalMinor += row.total;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (/relation .* does not exist|42P01|undefined_table/i.test(msg)) {
      schemaMissing.push('orders.revenue');
    } else {
      throw err;
    }
  }

  // OMS Wave 1.8 — sparkline series.
  const timeSeries: DashboardStats['timeSeries'] = {
    ordersPerDay30d: [],
    revenuePerDay30d: [],
    signupsPerWeek12w: [],
  };
  try {
    const rows = (await db.execute(
      sql`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
          FROM orders
          WHERE created_at >= now() - interval '30 days'
          GROUP BY 1 ORDER BY 1`,
    )) as unknown as { rows?: Array<{ date: string; count: number }> } | Array<{ date: string; count: number }>;
    timeSeries.ordersPerDay30d = Array.isArray(rows) ? rows : rows.rows ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!/relation .* does not exist|42P01/i.test(msg)) throw err;
  }
  try {
    const rows = (await db.execute(
      sql`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
                 currency,
                 COALESCE(SUM(total_minor),0)::int AS "totalMinor"
          FROM orders
          WHERE created_at >= now() - interval '30 days'
            AND payment_status = 'captured'
          GROUP BY 1, 2 ORDER BY 1`,
    )) as unknown as
      | { rows?: Array<{ date: string; currency: string; totalMinor: number }> }
      | Array<{ date: string; currency: string; totalMinor: number }>;
    timeSeries.revenuePerDay30d = Array.isArray(rows) ? rows : rows.rows ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!/relation .* does not exist|42P01/i.test(msg)) throw err;
  }
  try {
    const rows = (await db.execute(
      sql`SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS "weekStart",
                 COUNT(*)::int AS count
          FROM merchants
          WHERE created_at >= now() - interval '84 days'
          GROUP BY 1 ORDER BY 1`,
    )) as unknown as
      | { rows?: Array<{ weekStart: string; count: number }> }
      | Array<{ weekStart: string; count: number }>;
    timeSeries.signupsPerWeek12w = Array.isArray(rows) ? rows : rows.rows ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    if (!/relation .* does not exist|42P01/i.test(msg)) throw err;
  }

  return {
    merchants,
    products,
    suppliers,
    orders,
    payouts,
    revenue,
    timeSeries,
    generatedAt: new Date().toISOString(),
    schemaMissing,
  };
}

export async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).end();
    return;
  }

  let store;
  try {
    store = drizzleMerchantStore();
  } catch {
    res.status(500);
    res.json({ error: 'Database unavailable.' });
    return;
  }

  const auth = await authoriseAdminWithLive(req.headers, store);
  if (!auth.ok) {
    res.status(auth.status);
    res.json({ error: auth.error });
    return;
  }

  try {
    const stats = await fetchDashboardStats();
    if (stats.schemaMissing.length > 0) {
      res.setHeader('X-Schema-Missing', stats.schemaMissing.join(','));
    }
    res.status(200);
    res.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      ...stats,
    });
  } catch (err) {
    res.status(500);
    res.json({ error: err instanceof Error ? err.message : 'stats query failed' });
  }
}
