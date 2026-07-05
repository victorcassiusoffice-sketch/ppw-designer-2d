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

import { z } from 'zod';

import { withSentry, type MinReq, type MinRes } from './_lib/sentry.js';
import { getDb, schema } from './_db/client.js';
import { and, eq, gte, gt, isNull, lte, notLike, sql, inArray, type SQL } from 'drizzle-orm';
import { drizzleAuditWriter } from './_lib/auditLog.js';
import { verifyMerchantSession } from './_lib/merchantSession.js';
import { buildSeedImageryMap, enrichImagery } from './_lib/products/seedImagery.js';
import productsSeed from '../src/data/products.json' with { type: 'json' };

// P0-2: SKU → real top-down asset + description, built once from the bundled
// seed catalog. Used to enrich live rows whose image is still a placeholder.
const SEED_IMAGERY = buildSeedImageryMap(
  (productsSeed as { products: Array<{ sku?: string; topdown_image_url?: string | null; notes?: string | null }> }).products,
);

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
  /** Demo/placeholder SKUs (DEMO-*) are hidden from the public catalog
   *  unless `include_demo=1` — Mauritius-focus catalog hygiene 2026-07-05. */
  includeDemo: boolean;
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
    includeDemo: pickBool(q, 'include_demo'),
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
  // V4 M9.B.4 — exclude soft-deleted products everywhere (retired_at IS NULL).
  const conds = [eq(schema.products.status, 'active'), isNull(schema.products.retiredAt)];
  if (!filters.includeDemo) conds.push(notLike(schema.products.sku, 'DEMO-%'));
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
      products: enrichImagery(rows, SEED_IMAGERY),
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
  if (!filters.includeDemo) baseConds.push(notLike(schema.products.sku, 'DEMO-%'));
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

/**
 * Wellness-Designer-App chain (c) part 2 — merchant-self-service CREATE
 * schema. Every required column has a required field; widthMm/depthMm/
 * heightMm/weightG/imageUrl/description/region are optional. SKU is
 * auto-generated from `<slug>-<random8>` if absent (merchants shouldn't
 * have to invent SKUs).
 *
 * The form on /merchant/:slug/products/new posts here with the blobKey
 * URL returned by the part-1 upload-image endpoint (or omits imageUrl
 * if the merchant chose no image).
 */
export const productCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(80),
    priceMinor: z.number().int().nonnegative(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((s) => s.toUpperCase()),
    description: z.string().trim().max(5000).optional().nullable(),
    widthMm: z.number().int().nonnegative().optional().nullable(),
    depthMm: z.number().int().nonnegative().optional().nullable(),
    heightMm: z.number().int().nonnegative().optional().nullable(),
    weightG: z.number().int().nonnegative().optional().nullable(),
    imageUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    ecoCertLevel: z.enum(ECO_CERT_LEVELS).optional(),
    region: z.string().trim().max(40).optional().nullable(),
    sku: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[A-Za-z0-9._-]+$/)
      .optional(),
    inStockQty: z.number().int().nonnegative().optional(),
  })
  .strict();

export type ProductCreatePayload = z.infer<typeof productCreateSchema>;

export interface CreateProductResult {
  ok: boolean;
  status: number;
  error?: string;
  product?: {
    id: number;
    sku: string;
    name: string;
    category: string;
    priceMinor: number;
    currency: string;
    imageUrl: string | null;
    ecoCertLevel: string;
  };
}

/**
 * Generate a SKU when the merchant didn't supply one. Format:
 * `<SLUG-UPPER>-<8-hex>`. Uniqueness is enforced by the
 * `products_merchant_sku_idx` unique index at the DB layer.
 */
function generateSku(slug: string): string {
  const uuid = globalThis.crypto.randomUUID();
  const hex = uuid.replace(/-/g, '').slice(0, 8).toUpperCase();
  const slugPart = slug.toUpperCase().slice(0, 20);
  return `${slugPart}-${hex}`;
}

export async function createMerchantProduct(
  slug: string,
  rawBody: unknown,
): Promise<CreateProductResult> {
  if (!slug) {
    return { ok: false, status: 400, error: 'slug required' };
  }
  const parsed = productCreateSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((iss) => `${iss.path.join('.') || 'body'}: ${iss.message}`)
      .join('; ');
    return { ok: false, status: 400, error: msg };
  }
  const fields = parsed.data;

  const db = getDb();
  try {
    const merchantRows = await db
      .select({ id: schema.merchants.id })
      .from(schema.merchants)
      .where(eq(schema.merchants.slug, slug))
      .limit(1);
    const merchant = merchantRows[0];
    if (!merchant) {
      return { ok: false, status: 404, error: 'merchant_not_found' };
    }
    const merchantId = Number(merchant.id);

    const sku = fields.sku ?? generateSku(slug);

    const inserted = await db
      .insert(schema.products)
      .values({
        merchantId,
        sku,
        name: fields.name,
        category: fields.category,
        description: fields.description ?? null,
        widthMm: fields.widthMm ?? null,
        depthMm: fields.depthMm ?? null,
        heightMm: fields.heightMm ?? null,
        weightG: fields.weightG ?? null,
        priceMinor: fields.priceMinor,
        currency: fields.currency,
        imageUrl: fields.imageUrl ?? null,
        ecoCertLevel: fields.ecoCertLevel ?? 'none',
        region: fields.region ?? null,
        inStockQty: fields.inStockQty ?? 0,
        status: 'active',
      })
      .returning({
        id: schema.products.id,
        sku: schema.products.sku,
        name: schema.products.name,
        category: schema.products.category,
        priceMinor: schema.products.priceMinor,
        currency: schema.products.currency,
        imageUrl: schema.products.imageUrl,
        ecoCertLevel: schema.products.ecoCertLevel,
      });
    const row = inserted[0];
    if (!row) {
      return { ok: false, status: 500, error: 'insert_returned_no_row' };
    }

    try {
      const audit = drizzleAuditWriter();
      await audit.record({
        actorEmail: `merchant:${slug}`,
        action: 'products.create',
        targetType: 'product',
        targetId: String(row.id),
        payload: { merchantId, slug, sku },
      });
    } catch {
      // Audit failure must not change the CREATE verdict.
    }

    return {
      ok: true,
      status: 201,
      product: {
        id: Number(row.id),
        sku: row.sku,
        name: row.name,
        category: row.category,
        priceMinor: row.priceMinor,
        currency: row.currency,
        imageUrl: row.imageUrl,
        ecoCertLevel: row.ecoCertLevel,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/duplicate key value|products_merchant_sku_idx|23505/i.test(msg)) {
      return { ok: false, status: 409, error: 'sku_conflict' };
    }
    if (/relation .*(products|merchants).* does not exist|column .* does not exist|42P01|42703/i.test(msg)) {
      return { ok: false, status: 503, error: 'schema_missing' };
    }
    throw err;
  }
}

/**
 * Helper — extract + verify the merchant magic-link session bearer
 * token from an HTTP request. Returns the verified payload on success;
 * an HTTP-shaped error response on failure.
 */
export interface SessionAuthOk {
  ok: true;
  email: string;
}
export interface SessionAuthErr {
  ok: false;
  status: 401 | 403;
  error: 'missing_session' | 'invalid_session' | 'slug_mismatch';
}

export function authoriseMerchantSession(
  headers: Record<string, string | string[] | undefined> | undefined,
  slug: string,
): SessionAuthOk | SessionAuthErr {
  const raw = headers?.authorization ?? headers?.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header || typeof header !== 'string') {
    return { ok: false, status: 401, error: 'missing_session' };
  }
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    return { ok: false, status: 401, error: 'missing_session' };
  }
  const token = match[1].trim();
  const result = verifyMerchantSession(token, slug);
  if (!result.ok) {
    if (result.reason === 'slug_mismatch') {
      return { ok: false, status: 403, error: 'slug_mismatch' };
    }
    return { ok: false, status: 401, error: 'invalid_session' };
  }
  return { ok: true, email: result.payload.email };
}

/**
 * V4 M9.B.3 — merchant-editable PATCH schema. Every field optional;
 * at least ONE must be present (else 400 no_fields). SKU + merchantId
 * + status + retired_at + supplier_rating + supplier_rating_refreshed_at
 * + createdAt + updatedAt are intentionally NOT editable here:
 *   - sku is immutable; merchants delete + recreate
 *   - merchantId would let a slug bridge to another merchant's product
 *   - status changes go through DELETE (retire) or admin path
 *   - retired_at goes through DELETE
 *   - supplier_rating + refreshed_at are computed by W0.D.9 cron
 *   - createdAt / updatedAt are system-managed
 */
export const productPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    priceMinor: z.number().int().nonnegative().optional(),
    currency: z
      .string()
      .trim()
      .length(3)
      .transform((s) => s.toUpperCase())
      .optional(),
    imageUrl: z
      .string()
      .trim()
      .url()
      .max(500)
      .nullable()
      .optional()
      .or(z.literal('').transform(() => null)),
    inStockQty: z.number().int().nonnegative().optional(),
    ecoCertLevel: z.enum(ECO_CERT_LEVELS).optional(),
    category: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export type ProductPatchPayload = z.infer<typeof productPatchSchema>;

export interface PatchProductResult {
  ok: boolean;
  status: number;
  error?: string;
  product?: {
    id: number;
    name: string;
    priceMinor: number;
    currency: string;
    inStockQty: number;
    ecoCertLevel: string;
  };
}

export async function patchProduct(
  slug: string,
  productId: number,
  rawBody: unknown,
): Promise<PatchProductResult> {
  if (!slug || !Number.isFinite(productId) || productId <= 0) {
    return { ok: false, status: 400, error: 'slug + positive integer id required' };
  }
  const parsed = productPatchSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((iss) => `${iss.path.join('.') || 'body'}: ${iss.message}`)
      .join('; ');
    return { ok: false, status: 400, error: msg };
  }
  const fields = parsed.data;
  if (Object.keys(fields).length === 0) {
    return { ok: false, status: 400, error: 'no_fields' };
  }
  const db = getDb();
  try {
    const merchantRows = await db
      .select({ id: schema.merchants.id })
      .from(schema.merchants)
      .where(eq(schema.merchants.slug, slug))
      .limit(1);
    const merchant = merchantRows[0];
    if (!merchant) {
      return { ok: false, status: 404, error: 'merchant_not_found' };
    }
    const merchantId = Number(merchant.id);

    const existing = await db
      .select({
        id: schema.products.id,
        merchantId: schema.products.merchantId,
        retiredAt: schema.products.retiredAt,
      })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);
    const product = existing[0];
    if (!product) {
      return { ok: false, status: 404, error: 'product_not_found' };
    }
    if (Number(product.merchantId) !== merchantId) {
      return { ok: false, status: 403, error: 'forbidden' };
    }
    if (product.retiredAt) {
      return { ok: false, status: 409, error: 'product_retired' };
    }

    const updated = await db
      .update(schema.products)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)))
      .returning({
        id: schema.products.id,
        name: schema.products.name,
        priceMinor: schema.products.priceMinor,
        currency: schema.products.currency,
        inStockQty: schema.products.inStockQty,
        ecoCertLevel: schema.products.ecoCertLevel,
      });
    const row = updated[0];
    if (!row) {
      return { ok: false, status: 404, error: 'product_not_found_post_update' };
    }

    try {
      const audit = drizzleAuditWriter();
      await audit.record({
        actorEmail: `merchant:${slug}`,
        action: 'products.patch',
        targetType: 'product',
        targetId: String(productId),
        payload: { merchantId, slug, fieldsChanged: Object.keys(fields) },
      });
    } catch {
      // Audit failure must not change the PATCH verdict.
    }

    return {
      ok: true,
      status: 200,
      product: {
        id: Number(row.id),
        name: row.name,
        priceMinor: row.priceMinor,
        currency: row.currency,
        inStockQty: row.inStockQty,
        ecoCertLevel: row.ecoCertLevel,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(products|merchants).* does not exist|column .* does not exist|42P01|42703/i.test(msg)) {
      return { ok: false, status: 503, error: 'schema_missing' };
    }
    throw err;
  }
}

/**
 * V4 M9.B.4 — soft-delete a merchant's product.
 * Returns:
 *   { ok: true,  status: 204 }                     — soft-deleted
 *   { ok: false, status: 400, error }              — bad id / missing slug
 *   { ok: false, status: 403, error: 'forbidden' } — product belongs to a different merchant
 *   { ok: false, status: 404, error: 'not_found' } — no such product OR already retired
 *   { ok: false, status: 503, error }              — schema not migrated yet
 */
export interface SoftDeleteResult {
  ok: boolean;
  status: number;
  error?: string;
  retiredAt?: Date;
}

export async function softDeleteProduct(slug: string, productId: number): Promise<SoftDeleteResult> {
  if (!slug || !Number.isFinite(productId) || productId <= 0) {
    return { ok: false, status: 400, error: 'slug + positive integer id required' };
  }
  const db = getDb();
  try {
    const merchantRows = await db
      .select({ id: schema.merchants.id })
      .from(schema.merchants)
      .where(eq(schema.merchants.slug, slug))
      .limit(1);
    const merchant = merchantRows[0];
    if (!merchant) {
      return { ok: false, status: 404, error: 'merchant_not_found' };
    }
    const merchantId = Number(merchant.id);

    const existing = await db
      .select({
        id: schema.products.id,
        merchantId: schema.products.merchantId,
        retiredAt: schema.products.retiredAt,
      })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);
    const product = existing[0];
    if (!product) {
      return { ok: false, status: 404, error: 'product_not_found' };
    }
    if (Number(product.merchantId) !== merchantId) {
      return { ok: false, status: 403, error: 'forbidden' };
    }
    if (product.retiredAt) {
      // Idempotent — already soft-deleted; surface 204 not 404 so retried
      // operator scripts stay clean.
      return { ok: true, status: 204, retiredAt: product.retiredAt };
    }

    const now = new Date();
    await db
      .update(schema.products)
      .set({ retiredAt: now, updatedAt: now })
      .where(and(eq(schema.products.id, productId), eq(schema.products.merchantId, merchantId)));

    try {
      const audit = drizzleAuditWriter();
      await audit.record({
        actorEmail: `merchant:${slug}`,
        action: 'products.soft_delete',
        targetType: 'product',
        targetId: String(productId),
        payload: { merchantId, slug },
      });
    } catch {
      // Audit failure must not change the delete verdict.
    }
    return { ok: true, status: 204, retiredAt: now };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/relation .*(products|merchants).* does not exist|column .* does not exist|42P01|42703/i.test(msg)) {
      return { ok: false, status: 503, error: 'schema_missing' };
    }
    throw err;
  }
}

async function handler(req: ProductsReq, res: MinRes): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const q = req.query ?? {};
  const slugRaw = q['slug'];
  const slug = Array.isArray(slugRaw) ? slugRaw[0] : slugRaw;
  const idRaw = q['id'];
  const idStr = Array.isArray(idRaw) ? idRaw[0] : idRaw;

  // Wellness-Designer-App (c) part 2 — POST creates a merchant product.
  // Magic-link session-gated via Authorization: Bearer <merchant-session>.
  if (req.method === 'POST') {
    if (typeof slug !== 'string' || !slug.trim()) {
      res.status(400);
      res.json({ error: 'slug query param required' });
      return;
    }
    const auth = authoriseMerchantSession(req.headers, slug.trim());
    if (!auth.ok) {
      res.status(auth.status);
      res.json({ error: auth.error });
      return;
    }
    const body =
      typeof req.body === 'string'
        ? (() => {
            try {
              return JSON.parse(req.body || '{}');
            } catch {
              return null;
            }
          })()
        : (req.body ?? {});
    if (body === null) {
      res.status(400);
      res.json({ error: 'invalid JSON body' });
      return;
    }
    const result = await createMerchantProduct(slug.trim(), body);
    if (result.ok) {
      res.status(result.status);
      res.json({ product: result.product });
      return;
    }
    res.status(result.status);
    res.json({ error: result.error });
    return;
  }

  // V4 M9.B.3 — PATCH Zod-validated partial update.
  if (req.method === 'PATCH') {
    if (typeof slug !== 'string' || !slug.trim()) {
      res.status(400);
      res.json({ error: 'slug query param required' });
      return;
    }
    if (typeof idStr !== 'string' || !/^\d+$/.test(idStr)) {
      res.status(400);
      res.json({ error: 'numeric id query param required' });
      return;
    }
    const body =
      typeof req.body === 'string'
        ? (() => {
            try {
              return JSON.parse(req.body || '{}');
            } catch {
              return null;
            }
          })()
        : (req.body ?? {});
    if (body === null) {
      res.status(400);
      res.json({ error: 'invalid JSON body' });
      return;
    }
    const result = await patchProduct(slug.trim(), Number(idStr), body);
    if (result.ok) {
      res.status(result.status);
      res.json({ product: result.product });
      return;
    }
    res.status(result.status);
    res.json({ error: result.error });
    return;
  }

  // V4 M9.B.4 — DELETE soft-delete via retired_at.
  if (req.method === 'DELETE') {
    if (typeof slug !== 'string' || !slug.trim()) {
      res.status(400);
      res.json({ error: 'slug query param required' });
      return;
    }
    if (typeof idStr !== 'string' || !/^\d+$/.test(idStr)) {
      res.status(400);
      res.json({ error: 'numeric id query param required' });
      return;
    }
    const result = await softDeleteProduct(slug.trim(), Number(idStr));
    if (result.ok) {
      res.status(204).end();
      return;
    }
    res.status(result.status);
    res.json({ error: result.error });
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.status(405).end();
    return;
  }

  const filters = parseProductFilters(q);

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
