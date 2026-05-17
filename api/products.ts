/**
 * GET /api/products  +  GET /api/merchants/:slug/products  (V4 M9.B.2)
 *
 * Public product listing endpoint. Returns paginated `status='active'`
 * products with optional category + region + merchant-slug filters.
 * Used by the Phase 3 storefront `/products` page AND (via the
 * `/api/merchants/:slug/products` rewrite) by the M9.B.5 merchant
 * self-service page.
 *
 * Phase 8 will eventually wire the Designer Catalog to read from this
 * same endpoint — for now the Designer keeps its hardcoded demo data
 * per the locked oms_sequence_pivot constraint.
 *
 * Query params:
 *   - category   : optional filter
 *   - region     : optional filter
 *   - slug       : optional merchant slug filter (passed by Vercel
 *                  rewrite for the merchants-scoped URL; safe to use
 *                  directly too)
 *   - limit      : default 24, max 100
 *   - offset     : default 0
 *
 * Response (200):
 *   { products: ProductSummary[], total: number, limit: number,
 *     offset: number, schemaMissing: boolean, merchantNotFound?: boolean }
 *
 * Unknown merchant slug → 200 with empty list + `merchantNotFound: true`
 * (no 404; consumer surfaces the empty state). M9.B.2 stays backend-
 * exempt from Phase A — the M9.B.5 merchant page is where Phase A binds.
 */

import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import { getDb, schema } from './db/client.js';
import { and, eq, sql } from 'drizzle-orm';

type ProductsReq = MinReq & { query?: Record<string, string | string[] | undefined> };

interface ProductSummary {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string | null;
  widthMm: number | null;
  depthMm: number | null;
  heightMm: number | null;
  weightG: number | null;
  priceMinor: number;
  currency: string;
  imageUrl: string | null;
  region: string | null;
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

export interface ProductFilters {
  category: string | null;
  region: string | null;
  merchantSlug: string | null;
  limit: number;
  offset: number;
}

export function parseProductFilters(
  q: Record<string, string | string[] | undefined>,
): ProductFilters {
  return {
    category: pickStr(q, 'category'),
    region: pickStr(q, 'region'),
    merchantSlug: pickStr(q, 'slug'),
    limit: pickInt(q, 'limit', 24, 100) || 24,
    offset: pickInt(q, 'offset', 0, 100000),
  };
}

export interface ProductListResult {
  products: ProductSummary[];
  total: number;
  limit: number;
  offset: number;
  schemaMissing: boolean;
  merchantNotFound?: boolean;
}

export async function fetchActiveProducts(filters: ProductFilters): Promise<ProductListResult> {
  const db = getDb();
  const conds = [eq(schema.products.status, 'active')];
  if (filters.category) conds.push(eq(schema.products.category, filters.category));
  if (filters.region) conds.push(eq(schema.products.region, filters.region));

  try {
    if (filters.merchantSlug) {
      const merchantRows = await db
        .select({ id: schema.merchants.id })
        .from(schema.merchants)
        .where(eq(schema.merchants.slug, filters.merchantSlug))
        .limit(1);
      const merchantRow = merchantRows[0];
      if (!merchantRow) {
        return {
          products: [],
          total: 0,
          limit: filters.limit,
          offset: filters.offset,
          schemaMissing: false,
          merchantNotFound: true,
        };
      }
      conds.push(eq(schema.products.merchantId, Number(merchantRow.id)));
    }

    const rows = await db
      .select({
        id: schema.products.id,
        sku: schema.products.sku,
        name: schema.products.name,
        category: schema.products.category,
        description: schema.products.description,
        widthMm: schema.products.widthMm,
        depthMm: schema.products.depthMm,
        heightMm: schema.products.heightMm,
        weightG: schema.products.weightG,
        priceMinor: schema.products.priceMinor,
        currency: schema.products.currency,
        imageUrl: schema.products.imageUrl,
        region: schema.products.region,
      })
      .from(schema.products)
      .where(and(...conds))
      .orderBy(sql`created_at DESC`)
      .limit(filters.limit)
      .offset(filters.offset);

    const countRes = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(schema.products)
      .where(and(...conds));
    const total = countRes[0]?.c ?? 0;

    return {
      products: rows,
      total,
      limit: filters.limit,
      offset: filters.offset,
      schemaMissing: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(products|merchants).* does not exist|42P01|undefined_table/i.test(msg)) {
      return {
        products: [],
        total: 0,
        limit: filters.limit,
        offset: filters.offset,
        schemaMissing: true,
      };
    }
    throw err;
  }
}

async function handler(req: ProductsReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    res.status(405).end();
    return;
  }

  const filters = parseProductFilters(req.query ?? {});

  try {
    const result = await fetchActiveProducts(filters);
    if (result.schemaMissing) {
      res.setHeader('X-Schema-Missing', 'products');
    }
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
    res.status(200);
    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'products query failed';
    res.status(500);
    res.json({ error: msg });
  }
}

export default withSentry(handler);
