/**
 * GET /api/admin/payouts
 *
 * Phase 4 stub. Phase 2 ships the table (`payout_queue`) + viewer; the
 * row population happens later when the disbursement worker lands.
 *
 * Query params:
 *   - status: queued | processing | sent | failed
 *   - merchantId: filter to one merchant
 *   - page / perPage: pagination (default 1 / 25, max 100)
 *
 * Until the worker is wired this endpoint will return zero rows in
 * production — that's expected and the admin UI surfaces an
 * explanatory message instead of treating it as an error.
 */

import { drizzleMerchantStore } from '../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../lib/adminAuth.js';
import { getDb, schema } from '../../db/client.js';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';

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

export interface PayoutListFilters {
  page: number;
  perPage: number;
  status: string | null;
  merchantId: number | null;
}

export function parsePayoutFilters(
  q: Record<string, string | string[] | undefined>,
): PayoutListFilters {
  const rawPage = Number(pickStr(q, 'page') ?? '1');
  const rawPer = Number(pickStr(q, 'perPage') ?? '25');
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const perPage = Number.isFinite(rawPer) ? Math.min(100, Math.max(1, Math.floor(rawPer))) : 25;
  const rawMid = pickStr(q, 'merchantId');
  const merchantId = rawMid && /^\d+$/.test(rawMid) ? Number(rawMid) : null;
  return {
    page,
    perPage,
    status: pickStr(q, 'status'),
    merchantId,
  };
}

const VALID_STATUS = new Set(['queued', 'processing', 'sent', 'failed']);

export async function fetchPayoutsPage(filters: PayoutListFilters): Promise<{
  items: Array<typeof schema.payoutQueue.$inferSelect>;
  page: number;
  perPage: number;
  total: number;
  schemaMissing: boolean;
}> {
  const db = getDb();
  const offset = (filters.page - 1) * filters.perPage;

  const conditions: SQL[] = [];
  if (filters.status && VALID_STATUS.has(filters.status)) {
    conditions.push(eq(schema.payoutQueue.status, filters.status as 'queued'));
  }
  if (filters.merchantId !== null) {
    conditions.push(eq(schema.payoutQueue.merchantId, filters.merchantId));
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  try {
    const items = await db
      .select()
      .from(schema.payoutQueue)
      .where(whereClause)
      .orderBy(desc(schema.payoutQueue.scheduledFor))
      .limit(filters.perPage)
      .offset(offset);

    const countRes = (await db.execute(
      sql`SELECT COUNT(*)::int AS c FROM payout_queue${
        whereClause ? sql` WHERE ${whereClause}` : sql``
      }`,
    )) as unknown as { rows?: Array<{ c: number }> } | Array<{ c: number }>;
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
    if (/relation .*payout_queue.* does not exist|42P01|undefined_table/i.test(msg)) {
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

export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
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

  const filters = parsePayoutFilters(req.query ?? {});

  try {
    const result = await fetchPayoutsPage(filters);
    if (result.schemaMissing) {
      res.setHeader('X-Schema-Missing', 'payout_queue');
    }
    res.status(200);
    res.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      filters,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'payouts query failed';
    res.status(500);
    res.json({ error: msg });
  }
}
