/**
 * GET /api/admin/suppliers
 *
 * Admin-gated supplier list with optional filters.
 *
 * Query params:
 *   - status     : supplier_status filter
 *   - merchantId : optional numeric
 *   - limit      : default 50, max 200
 *   - offset     : default 0
 */

import { drizzleMerchantStore } from '../../../_db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { getDb, schema } from '../../../_db/client.js';
import { and, eq, sql } from 'drizzle-orm';

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

function pickInt(
  q: Record<string, string | string[] | undefined>,
  key: string,
  def: number,
  max: number,
): number {
  const raw = pickStr(q, key);
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

export interface AdminSupplierFilters {
  status: string | null;
  merchantId: number | null;
  limit: number;
  offset: number;
}

export function parseAdminSupplierFilters(
  q: Record<string, string | string[] | undefined>,
): AdminSupplierFilters {
  const merchantIdRaw = pickStr(q, 'merchantId');
  const merchantId = merchantIdRaw && /^\d+$/.test(merchantIdRaw) ? Number(merchantIdRaw) : null;
  return {
    status: pickStr(q, 'status'),
    merchantId,
    limit: pickInt(q, 'limit', 50, 200) || 50,
    offset: pickInt(q, 'offset', 0, 1_000_000),
  };
}

export interface AdminSuppliersListResult {
  items: Array<Record<string, unknown>>;
  total: number;
  filters: AdminSupplierFilters;
  schemaMissing: boolean;
}

export async function fetchAdminSuppliers(
  filters: AdminSupplierFilters,
): Promise<AdminSuppliersListResult> {
  const db = getDb();
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filters.status) {
    conds.push(eq(schema.suppliers.status, filters.status as 'pending' | 'active' | 'suspended'));
  }
  if (filters.merchantId !== null) conds.push(eq(schema.suppliers.merchantId, filters.merchantId));
  const whereClause = conds.length ? and(...conds) : undefined;

  try {
    const items = await db
      .select({
        id: schema.suppliers.id,
        merchantId: schema.suppliers.merchantId,
        merchantBrandName: schema.merchants.brandName,
        name: schema.suppliers.name,
        contactEmail: schema.suppliers.contactEmail,
        contactPhone: schema.suppliers.contactPhone,
        country: schema.suppliers.country,
        status: schema.suppliers.status,
        notes: schema.suppliers.notes,
        createdAt: schema.suppliers.createdAt,
        updatedAt: schema.suppliers.updatedAt,
      })
      .from(schema.suppliers)
      .leftJoin(schema.merchants, eq(schema.merchants.id, schema.suppliers.merchantId))
      .where(whereClause as never)
      .orderBy(sql`suppliers.created_at DESC`)
      .limit(filters.limit)
      .offset(filters.offset);

    const countRes = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(schema.suppliers)
      .where(whereClause as never);
    const total = countRes[0]?.c ?? 0;

    return { items, total, filters, schemaMissing: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*suppliers.* does not exist|42P01|undefined_table/i.test(msg)) {
      return { items: [], total: 0, filters, schemaMissing: true };
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

  const filters = parseAdminSupplierFilters(req.query ?? {});
  try {
    const result = await fetchAdminSuppliers(filters);
    if (result.schemaMissing) res.setHeader('X-Schema-Missing', 'suppliers');
    res.status(200);
    res.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      ...result,
    });
  } catch (err) {
    res.status(500);
    res.json({ error: err instanceof Error ? err.message : 'admin suppliers query failed' });
  }
}
