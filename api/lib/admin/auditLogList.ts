/**
 * GET /api/admin/audit-log
 *
 * OMS Wave 4.11 — Audit log query interface.
 *
 * Returns the last 200 audit_log rows (most recent first) with optional
 * filters: action=<exact-match>, actor=<email-substring>. Vic uses this
 * to answer "who did what" questions without trawling Sentry / DB logs.
 */

import { drizzleMerchantStore } from '../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../adminAuth.js';
import { getDb, schema } from '../../db/client.js';
import { desc, ilike, eq, and, type SQL } from 'drizzle-orm';

interface MinimalReq {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

const MAX_ROWS = 200;

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

  const db = getDb();
  const url = new URL(req.url ?? '/', 'http://x');
  const actionFilter = url.searchParams.get('action');
  const actorFilter = url.searchParams.get('actor');

  try {
    const conditions: SQL[] = [];
    if (actionFilter) conditions.push(eq(schema.auditLog.action, actionFilter));
    if (actorFilter) conditions.push(ilike(schema.auditLog.actorEmail, `%${actorFilter}%`));

    const baseQuery = db.select().from(schema.auditLog);
    const query =
      conditions.length === 1
        ? baseQuery.where(conditions[0]!)
        : conditions.length > 1
          ? baseQuery.where(and(...conditions))
          : baseQuery;
    const rows = await query.orderBy(desc(schema.auditLog.createdAt)).limit(MAX_ROWS);

    res.status(200);
    res.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      total: rows.length,
      truncated: rows.length === MAX_ROWS,
      rows,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'audit query failed';
    if (/relation .*audit_log.* does not exist|42P01/i.test(msg)) {
      res.status(503);
      res.json({ error: 'audit_log table not migrated.' });
      return;
    }
    res.status(500);
    res.json({ error: msg });
  }
}
