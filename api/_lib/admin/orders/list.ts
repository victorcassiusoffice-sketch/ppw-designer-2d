/**
 * GET /api/admin/orders
 *
 * Paginated orders feed for the admin portal. Reads from the `orders`
 * table created by the PayPal slice migration (0002_payment_rails.sql).
 *
 * Slice ordering: Phase 2 admin and the PayPal slice land independently.
 * If 0002 hasn't been applied yet, the SELECT will fail with
 * `relation "orders" does not exist`. We catch that, return an empty
 * page, and set an `X-Schema-Missing: orders` response header so the
 * admin UI can show "PayPal slice not yet deployed" instead of an error.
 *
 * Query params:
 *   - page         : 1-indexed (default 1)
 *   - perPage      : default 25, max 100
 *   - rail         : optional filter (stripe | paypal | ...)
 *   - status       : optional filter
 *   - from/to      : ISO date range on created_at
 *
 * Auth: same Bearer-token gate as the merchant endpoints.
 */

import { drizzleMerchantStore } from '../../../_db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { getDb } from '../../../_db/client.js';
import { sql } from 'drizzle-orm';

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

function pickStr(q: Record<string, string | string[] | undefined>, key: string): string | null {
  const v = q[key];
  if (Array.isArray(v)) return v[0] ?? null;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export interface OrdersListFilters {
  page: number;
  perPage: number;
  rail: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
}

export function parseOrdersFilters(
  q: Record<string, string | string[] | undefined>,
): OrdersListFilters {
  const rawPage = Number(pickStr(q, 'page') ?? '1');
  const rawPer = Number(pickStr(q, 'perPage') ?? '25');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const perPage = Number.isFinite(rawPer) ? Math.min(100, Math.max(1, Math.floor(rawPer))) : 25;
  return {
    page,
    perPage,
    rail: pickStr(q, 'rail'),
    status: pickStr(q, 'status'),
    from: pickStr(q, 'from'),
    to: pickStr(q, 'to'),
  };
}

export interface OrdersListResult {
  items: Array<Record<string, unknown>>;
  page: number;
  perPage: number;
  total: number;
  schemaMissing: boolean;
}

export async function fetchOrdersPage(filters: OrdersListFilters): Promise<OrdersListResult> {
  const db = getDb();
  const offset = (filters.page - 1) * filters.perPage;

  const conds: Array<ReturnType<typeof sql>> = [];
  if (filters.rail) conds.push(sql`rail = ${filters.rail}`);
  if (filters.status) conds.push(sql`status = ${filters.status}`);
  if (filters.from) conds.push(sql`created_at >= ${filters.from}::timestamptz`);
  if (filters.to) conds.push(sql`created_at <= ${filters.to}::timestamptz`);
  const where = conds.length
    ? sql.join([sql` WHERE `, sql.join(conds, sql` AND `)])
    : sql``;

  try {
    const itemsRes = (await db.execute(
      sql`SELECT * FROM orders${where} ORDER BY created_at DESC LIMIT ${filters.perPage} OFFSET ${offset}`,
    )) as unknown as { rows?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const countRes = (await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM orders${where}`,
    )) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;

    const items = Array.isArray(itemsRes) ? itemsRes : (itemsRes.rows ?? []);
    const countRows = Array.isArray(countRes) ? countRes : (countRes.rows ?? []);
    const total = countRows[0]?.c ?? 0;

    return {
      items,
      page: filters.page,
      perPage: filters.perPage,
      total,
      schemaMissing: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 42P01 = undefined_table. Postgres error text varies, so match
    // permissively. Any other DB error re-throws.
    if (/relation .*orders.* does not exist|42P01|undefined_table/i.test(msg)) {
      return {
        items: [],
        page: filters.page,
        perPage: filters.perPage,
        total: 0,
        schemaMissing: true,
      };
    }
    throw err;
  }
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

  const filters = parseOrdersFilters(req.query ?? {});

  try {
    const result = await fetchOrdersPage(filters);
    if (result.schemaMissing) {
      res.setHeader('X-Schema-Missing', 'orders');
    }
    res.status(200);
    res.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      filters,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'orders query failed';
    res.status(500);
    res.json({ error: msg });
  }
}
