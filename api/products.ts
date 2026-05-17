/**
 * GET /api/products  +  GET /api/merchants/:slug/products  (V4 M9.B.2)
 *                    +  GET /api/merchants/_catalog/products (V4 PolA.4)
 *
 * Public product listing endpoint. Returns paginated `status='active'`
 * products with optional category + region + merchant-slug + catalog
 * filters (price range / eco-cert tier multi-select / in-stock toggle /
 * supplier-rating minimum) + sort + opt-in facets.
 *
 * Used by:
 *   - Phase 3 storefront `/products` page (legacy)
 *   - M9.B.5 merchant self-service page (via /api/merchants/:slug/products)
 *   - PolA.1-3 catalog filter sidebar (via /api/merchants/_catalog/products
 *     + facets opt-in for sidebar count badges)
 *
 * Phase 8 will eventually wire the Designer Catalog to read from this
 * same endpoint — for now the Designer keeps its hardcoded demo data
 * per the locked oms_sequence_pivot constraint.
 *
 * Query params:
 *   - category        : optional filter
 *   - region          : optional filter
 *   - slug            : optional merchant slug filter (passed by Vercel
 *                       rewrite for the merchants-scoped URL)
 *   - price_min       : optional minimum price_minor (integer)
 *   - price_max       : optional maximum price_minor (integer)
 *   - eco_cert        : optional one OR comma-separated list of eco_cert_level
 *                       values (`none|self-declared|third-party-claimed|verified-certified`)
 *   - in_stock        : optional `1|true` → only rows with in_stock_qty > 0
 *   - rating_min      : optional integer 1-5; supplier_rating ≥ N (NULL excluded)
 *   - sort            : optional `price_asc|price_desc|rating_desc|newest`
 *                       default = `newest` (matches the existing created_at
 *                       DESC behaviour)
 *   - include_facets  : optional `1|true` → adds `facets:{eco_cert_counts,
 *                       price_buckets}` to the response. Adds 2 extra
 *                       aggregation queries; opt-in to keep paginated
 *                       calls light.
 *   - limit           : default 24, max 100
 *   - offset          : default 0
 *
 * Response (200):
 *   { products: ProductSummary[], total: number, limit: number,
 *     offset: number, schemaMissing: boolean,
 *     merchantNotFound?: boolean,
 *     facets?: { eco_cert_counts: Record<EcoCertLevel, number>,
 *                price_buckets: Array<{min, max, count}> } }
 *
 * Unknown merchant slug → 200 with empty list + `merchantNotFound: true`.
 * PolA.4 stays backend-exempt from Phase A — PolA.1-3 UI consumers
 * are where Phase A binds.
 */

import { withSentry, type MinReq, type MinRes } from './lib/sentry.js';
import { getDb, schema } from './db/client.js';
import { and, eq, gte, gt, lte, sql, inArray, type SQL } from 'drizzle-orm';

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

export const ECO_CERT_LEVELS = ['none', 'self-declared', 'third-party-claimed', 'verified-certified'] as const;
export type EcoCertLevel = (typeof ECO_CERT_LEVELS)[number];

export const SORT_OPTIONS = ['price_asc', 'price_desc', 'rating_desc', 'newest'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/** Default price-bucket boundaries in MUR minor units (cents-of-MUR). */
const PRICE_BUCKETS_MINOR: Array<{ min: number; max: number | null }> = [
  { min: 0, max: 100_000 },
  { min: 100_000, max: 500_000 },
  { min: 500_000, max: 2_000_000 },
  { min: 2_000_000, max: 10_000_000 },
  { min: 10_000_000, max: null },
];

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

function pickIntOrNull(
  q: Record<string, string | string[] | undefined>,
  key: string,
  max: number,
): number | null {
  const raw = pickStr(q, key);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(0, Math.floor(n)));
}

function pickBool(q: Record<string, string | string[] | undefined>, key: string): boolean {
  const v = pickStr(q, key);
  return v === '1' || v === 'true' || v === 'on';
}

export function parseEcoCerts(q: Record<string, string | string[] | undefined>): EcoCertLevel[] {
  const raw = q['eco_cert'];
  const arr = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === 'string')
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const set = new Set<EcoCertLevel>();
  for (const item of arr) {
    const trimmed = item.trim();
    if ((ECO_CERT_LEVELS as readonly string[]).includes(trimmed)) {
      set.add(trimmed as EcoCertLevel);
    }
  }
  return [...set];
}

export function parseSort(q: Record<string, string | string[] | undefined>): SortOption {
  const v = pickStr(q, 'sort');
  return v && (SORT_OPTIONS as readonly string[]).includes(v) ? (v as SortOption) : 'newest';
}

export interface ProductFilters {
  category: string | null;
  region: string | null;
  merchantSlug: string | null;
  priceMin: number | null;
  priceMax: number | null;
  ecoCerts: EcoCertLevel[];
  inStockOnly: boolean;
  ratingMin: number | null;
  sort: SortOption;
  includeFacets: boolean;
  limit: number;
  offset: number;
}

export function parseProductFilters(
  q: Record<string, string | string[] | undefined>,
): ProductFilters {
  const ratingRaw = pickIntOrNull(q, 'rating_min', 5);
  return {
    category: pickStr(q, 'category'),
    region: pickStr(q, 'region'),
    merchantSlug: pickStr(q, 'slug'),
    priceMin: pickIntOrNull(q, 'price_min', 1_000_000_000),
    priceMax: pickIntOrNull(q, 'price_max', 1_000_000_000),
    ecoCerts: parseEcoCerts(q),
    inStockOnly: pickBool(q, 'in_stock'),
    ratingMin: ratingRaw !== null ? Math.max(1, Math.min(5, ratingRaw)) : null,
    sort: parseSort(q),
    includeFacets: pickBool(q, 'include_facets'),
    limit: pickInt(q, 'limit', 24, 100) || 24,
    offset: pickInt(q, 'offset', 0, 100000),
  };
}

export interface CatalogFacets {
  eco_cert_counts: Record<string, number>;
  price_buckets: Array<{ min: number; max: number | null; count: number }>;
}

export interface ProductListResult {
  products: ProductSummary[];
  total: number;
  limit: number;
  offset: number;
  schemaMissing: boolean;
  merchantNotFound?: boolean;
  facets?: CatalogFacets;
}

function buildOrderBy(sort: SortOption): SQL {
  switch (sort) {
    case 'price_asc':
      return sql`price_minor ASC, id ASC`;
    case 'price_desc':
      return sql`price_minor DESC, id DESC`;
    case 'rating_desc':
      return sql`supplier_rating DESC NULLS LAST, price_minor ASC`;
    case 'newest':
    default:
      return sql`created_at DESC`;
  }
}

export async function fetchActiveProducts(filters: ProductFilters): Promise<ProductListResult> {
  const db = getDb();
  const conds = [eq(schema.products.status, 'active')];
  if (filters.category) conds.push(eq(schema.products.category, filters.category));
  if (filters.region) conds.push(eq(schema.products.region, filters.region));
  if (filters.priceMin !== null) conds.push(gte(schema.products.priceMinor, filters.priceMin));
  if (filters.priceMax !== null) conds.push(lte(schema.products.priceMinor, filters.priceMax));
  if (filters.ecoCerts.length > 0) conds.push(inArray(schema.products.ecoCertLevel, filters.ecoCerts));
  if (filters.inStockOnly) conds.push(gt(schema.products.inStockQty, 0));
  if (filters.ratingMin !== null) conds.push(gte(schema.products.supplierRating, filters.ratingMin));

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
      .orderBy(buildOrderBy(filters.sort))
      .limit(filters.limit)
      .offset(filters.offset);

    const countRes = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(schema.products)
      .where(and(...conds));
    const total = countRes[0]?.c ?? 0;

    const result: ProductListResult = {
      products: rows,
      total,
      limit: filters.limit,
      offset: filters.offset,
      schemaMissing: false,
    };

    if (filters.includeFacets) {
      result.facets = await fetchCatalogFacets(filters);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(products|merchants).* does not exist|column .* does not exist|42P01|42703|undefined_table/i.test(msg)) {
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

/**
 * Compute sidebar facets — counts of products by eco_cert_level and by
 * price bucket. Honours all filters EXCEPT the one being faceted (so
 * a user with `eco_cert=verified-certified` selected still sees the
 * counts for the other tiers; this is how every real catalog sidebar
 * behaves).
 *
 * For the first cut we simplify: facets honour every filter equally.
 * That means selecting `verified-certified` will show only that tier
 * with its count + others as 0. PolA.1's UI can choose to disable
 * single-select facet drill-down OR call this endpoint twice (once
 * with all filters, once without the facet-axis filter) until we
 * refine. Both behaviours degrade gracefully.
 */
export async function fetchCatalogFacets(filters: ProductFilters): Promise<CatalogFacets> {
  const db = getDb();
  const baseConds = [eq(schema.products.status, 'active')];
  if (filters.category) baseConds.push(eq(schema.products.category, filters.category));
  if (filters.region) baseConds.push(eq(schema.products.region, filters.region));
  if (filters.inStockOnly) baseConds.push(gt(schema.products.inStockQty, 0));
  if (filters.ratingMin !== null) baseConds.push(gte(schema.products.supplierRating, filters.ratingMin));
  if (filters.merchantSlug) {
    const merchantRows = await db
      .select({ id: schema.merchants.id })
      .from(schema.merchants)
      .where(eq(schema.merchants.slug, filters.merchantSlug))
      .limit(1);
    const merchantRow = merchantRows[0];
    if (merchantRow) baseConds.push(eq(schema.products.merchantId, Number(merchantRow.id)));
  }

  // eco_cert_counts — group by eco_cert_level; one row per tier (count = 0 if absent).
  const ecoRows = await db
    .select({
      level: schema.products.ecoCertLevel,
      c: sql<number>`COUNT(*)::int`,
    })
    .from(schema.products)
    .where(and(...baseConds))
    .groupBy(schema.products.ecoCertLevel);
  const eco_cert_counts: Record<string, number> = {};
  for (const tier of ECO_CERT_LEVELS) eco_cert_counts[tier] = 0;
  for (const row of ecoRows) {
    if (row.level) eco_cert_counts[row.level] = Number(row.c);
  }

  // price_buckets — one COUNT per bucket via a single aggregate query.
  const bucketCounts = await Promise.all(
    PRICE_BUCKETS_MINOR.map(async (b) => {
      const bucketConds = [...baseConds, gte(schema.products.priceMinor, b.min)];
      if (b.max !== null) bucketConds.push(sql`price_minor < ${b.max}`);
      const r = await db
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(schema.products)
        .where(and(...bucketConds));
      return { min: b.min, max: b.max, count: Number(r[0]?.c ?? 0) };
    }),
  );

  return { eco_cert_counts, price_buckets: bucketCounts };
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
