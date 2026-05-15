/**
 * GET /api/admin/products
 *
 * Admin-gated product listing. Returns ALL products including draft +
 * archived, with optional filters. Joins on merchants for display name.
 *
 * Query params:
 *   - status     : product_status filter
 *   - category   : optional
 *   - merchantId : optional numeric
 *   - limit      : default 50, max 200
 *   - offset     : default 0
 */

import { drizzleMerchantStore } from '../../../db/merchantStore.js';
import { authoriseAdminWithLive } from '../../adminAuth.js';
import { getDb, schema } from '../../../db/client.js';
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

export interface AdminProductFilters {
  status: string | null;
  category: string | null;
  merchantId: number | null;
  limit: number;
  offset: number;
}

export function parseAdminProductFilters(
  q: Record<string, string | string[] | undefined>,
): AdminProductFilters {
  const merchantIdRaw = pickStr(q, 'merchantId');
  const merchantId =
    merchantIdRaw && /^\d+$/.test(merchantIdRaw) ? Number(merchantIdRaw) : null;
  return {
    status: pickStr(q, 'status'),
    category: pickStr(q, 'category'),
    merchantId,
    limit: pickInt(q, 'limit', 50, 200) || 50,
    offset: pickInt(q, 'offset', 0, 1_000_000),
  };
}

export interface AdminProductsListResult {
  items: Array<Record<string, unknown>>;
  total: number;
  filters: AdminProductFilters;
  schemaMissing: boolean;
}

export async function fetchAdminProducts(
  filters: AdminProductFilters,
): Promise<AdminProductsListResult> {
  const db = getDb();
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filters.status) {
    conds.push(eq(schema.products.status, filters.status as 'draft' | 'active' | 'archived' | 'out_of_stock'));
  }
  if (filters.category) conds.push(eq(schema.products.category, filters.category));
  if (filters.merchantId !== null) conds.push(eq(schema.products.merchantId, filters.merchantId));
  const whereClause = conds.length ? and(...conds) : undefined;

  try {
    const items = await db
      .select({
        id: schema.products.id,
        merchantId: schema.products.merchantId,
        merchantBrandName: schema.merchants.brandName,
        sku: schema.products.sku,
        name: schema.products.name,
        category: schema.products.category,
        status: schema.products.status,
        priceMinor: schema.products.priceMinor,
        currency: schema.products.currency,
        imageUrl: schema.products.imageUrl,
        region: schema.products.region,
        createdAt: schema.products.createdAt,
        updatedAt: schema.products.updatedAt,
      })
      .from(schema.products)
      .leftJoin(schema.merchants, eq(schema.merchants.id, schema.products.merchantId))
      .where(whereClause as never)
      .orderBy(sql`products.created_at DESC`)
      .limit(filters.limit)
      .offset(filters.offset);

    const countRes = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(schema.products)
      .where(whereClause as never);
    const total = countRes[0]?.c ?? 0;

    return { items, total, filters, schemaMissing: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*products.* does not exist|42P01|undefined_table/i.test(msg)) {
      return { items: [], total: 0, filters, schemaMissing: true };
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

  const filters = parseAdminProductFilters(req.query ?? {});
  try {
    const result = await fetchAdminProducts(filters);
    if (result.schemaMissing) res.setHeader('X-Schema-Missing', 'products');
    res.status(200);
    res.json({
      admin: { email: auth.admin.email, role: auth.admin.role },
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'admin products query failed';
    res.status(500);
    res.json({ error: msg });
  }
}
