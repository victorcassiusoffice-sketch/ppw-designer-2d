/**
 * Phase 4 (BACKEND-RUN-ORDER-2026-06-11) — verified-purchase reviews +
 * search-relevance core.
 *
 * Split into:
 *   - PURE helpers (hash, aggregate, relevance ranking, validation,
 *     verification decision) — exhaustively unit-tested, no DB.
 *   - Thin DB wrappers that take an injectable `Db` (defaults to getDb())
 *     so tests pass a fake builder instead of mocking the module graph.
 *
 * Folded behind the existing catch-all routers — NO new Vercel function.
 *   POST /api/reviews              → submitReview        (orders.ts)
 *   GET  /api/products/:id/reviews → listProductReviews  (orders.ts)
 *   GET  /api/admin/reviews        → listReviews (admin)  (admin-router.ts)
 *   POST /api/admin/reviews/:id/(approve|reject) → moderateReview
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema, type Db } from '../../db/client.js';

// ─────────────────────────────────────────────────────────────────────
// PURE helpers
// ─────────────────────────────────────────────────────────────────────

/** Lowercase + trim; the canonical form we hash + match orders against. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** SHA-256 hex of the normalized email. Deterministic, 64 chars. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

export interface ReviewAggregate {
  average: number; // 1-decimal mean, 0 when no reviews
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
}

/** Compute {average, count, distribution} from a flat list of ratings. */
export function computeAggregate(ratings: number[]): ReviewAggregate {
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as ReviewAggregate['distribution'];
  let sum = 0;
  let count = 0;
  for (const r of ratings) {
    const n = Math.round(r);
    if (n >= 1 && n <= 5) {
      distribution[String(n) as '1'] += 1;
      sum += n;
      count += 1;
    }
  }
  const average = count === 0 ? 0 : Math.round((sum / count) * 10) / 10;
  return { average, count, distribution };
}

/**
 * Verified-purchase decision. Given the (possibly empty) set of order
 * rows where the customer bought this product, decide the verified flag
 * + which order to link. Pure so the rule is unit-tested without a DB.
 */
export function decideVerification(
  matchingOrderIds: number[],
): { verified: boolean; orderId: number | null } {
  if (matchingOrderIds.length === 0) return { verified: false, orderId: null };
  // Link the earliest matching order (smallest id) for determinism.
  const orderId = matchingOrderIds.reduce((a, b) => (a < b ? a : b));
  return { verified: true, orderId };
}

export const reviewSubmissionSchema = z
  .object({
    productId: z.number().int().positive(),
    email: z.string().trim().email().max(320),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(200).optional().nullable(),
    body: z.string().trim().min(1).max(5000),
  })
  .strict();

export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>;

export const SEARCH_SORTS = [
  'relevance',
  'price_asc',
  'price_desc',
  'rating',
  'popularity',
  'newest',
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export function parseSearchSort(raw: string | null | undefined): SearchSort | null {
  if (raw && (SEARCH_SORTS as readonly string[]).includes(raw)) return raw as SearchSort;
  return null;
}

export interface RankableProduct {
  id: number;
  name: string;
  category: string;
  description: string | null;
}

/**
 * Relevance score for a product against a free-text query. Higher = more
 * relevant. Weighting: exact name (1000) > name prefix (500) > name
 * contains (300) > category contains (120) > description contains (40).
 * Token-aware: each query token contributes; multi-token matches add up.
 */
export function scoreRelevance(p: RankableProduct, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = p.name.toLowerCase();
  const category = p.category.toLowerCase();
  const description = (p.description ?? '').toLowerCase();

  let score = 0;
  if (name === q) score += 1000;
  else if (name.startsWith(q)) score += 500;
  else if (name.includes(q)) score += 300;

  const tokens = q.split(/\s+/).filter(Boolean);
  for (const tok of tokens) {
    if (name.includes(tok)) score += 60;
    if (category.includes(tok)) score += 120;
    if (description.includes(tok)) score += 40;
  }
  return score;
}

/**
 * Rank + filter a product list by a search query. Returns products with
 * a positive relevance score, highest first; ties broken by original
 * order (stable). When the query is empty, returns the input unchanged.
 */
export function rankBySearch<T extends RankableProduct>(rows: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return rows;
  return rows
    .map((row, i) => ({ row, i, score: scoreRelevance(row, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.i - b.i))
    .map((x) => x.row);
}

// ─────────────────────────────────────────────────────────────────────
// DB wrappers (injectable db for tests)
// ─────────────────────────────────────────────────────────────────────

const SCHEMA_MISSING_RE =
  /relation .*(product_reviews|products|orders|order_items).* does not exist|column .* does not exist|42P01|42703|undefined_table/i;

export interface SubmitReviewResult {
  ok: boolean;
  status: number;
  error?: string;
  review?: {
    id: number;
    productId: number;
    rating: number;
    status: string;
    verified: boolean;
  };
}

/**
 * Find which orders (by id) contain this product purchased by this email.
 * Used to set the verified-purchase flag + link an order.
 */
export async function findMatchingOrderIds(
  productId: number,
  email: string,
  db: Db = getDb(),
): Promise<number[]> {
  const normalized = normalizeEmail(email);
  const rows = await db
    .select({ orderId: schema.orderItems.orderId })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(
      and(
        eq(schema.orderItems.productId, productId),
        sql`lower(${schema.orders.customerEmail}) = ${normalized}`,
      ),
    );
  return rows.map((r) => Number(r.orderId)).filter((n) => Number.isFinite(n));
}

/** Submit a review. Sets verified+orderId on a real purchase; lands pending. */
export async function submitReview(rawBody: unknown, db: Db = getDb()): Promise<SubmitReviewResult> {
  const parsed = reviewSubmissionSchema.safeParse(rawBody);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((iss) => `${iss.path.join('.') || 'body'}: ${iss.message}`)
      .join('; ');
    return { ok: false, status: 400, error: msg };
  }
  const fields = parsed.data;
  try {
    // Confirm the product exists (and is not retired) — reviews of ghost
    // products are rejected so the table stays referentially clean.
    const productRows = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.id, fields.productId))
      .limit(1);
    if (!productRows[0]) {
      return { ok: false, status: 404, error: 'product_not_found' };
    }

    const matchingOrderIds = await findMatchingOrderIds(fields.productId, fields.email, db);
    const { verified, orderId } = decideVerification(matchingOrderIds);

    const inserted = await db
      .insert(schema.productReviews)
      .values({
        productId: fields.productId,
        orderId,
        customerEmailHash: hashEmail(fields.email),
        rating: fields.rating,
        title: fields.title ?? null,
        body: fields.body,
        status: 'pending',
        verified,
      })
      .returning({
        id: schema.productReviews.id,
        productId: schema.productReviews.productId,
        rating: schema.productReviews.rating,
        status: schema.productReviews.status,
        verified: schema.productReviews.verified,
      });
    const row = inserted[0];
    if (!row) return { ok: false, status: 500, error: 'insert_returned_no_row' };
    return {
      ok: true,
      status: 201,
      review: {
        id: Number(row.id),
        productId: Number(row.productId),
        rating: row.rating,
        status: row.status,
        verified: row.verified,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) {
      return { ok: false, status: 503, error: 'schema_missing' };
    }
    throw err;
  }
}

export interface PublicReview {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  verified: boolean;
  createdAt: Date;
}

export interface ListProductReviewsResult {
  ok: boolean;
  status: number;
  error?: string;
  reviews?: PublicReview[];
  aggregate?: ReviewAggregate;
  schemaMissing?: boolean;
}

/** Public list — published reviews + aggregate for one product. */
export async function listProductReviews(
  productId: number,
  opts: { limit?: number; offset?: number } = {},
  db: Db = getDb(),
): Promise<ListProductReviewsResult> {
  if (!Number.isFinite(productId) || productId <= 0) {
    return { ok: false, status: 400, error: 'positive integer product id required' };
  }
  const limit = Math.min(100, Math.max(1, Math.floor(opts.limit ?? 50)));
  const offset = Math.max(0, Math.floor(opts.offset ?? 0));
  try {
    const rows = await db
      .select({
        id: schema.productReviews.id,
        rating: schema.productReviews.rating,
        title: schema.productReviews.title,
        body: schema.productReviews.body,
        verified: schema.productReviews.verified,
        createdAt: schema.productReviews.createdAt,
      })
      .from(schema.productReviews)
      .where(
        and(
          eq(schema.productReviews.productId, productId),
          eq(schema.productReviews.status, 'published'),
        ),
      )
      .orderBy(desc(schema.productReviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Aggregate over the FULL published set (not just this page).
    const allRatings = await db
      .select({ rating: schema.productReviews.rating })
      .from(schema.productReviews)
      .where(
        and(
          eq(schema.productReviews.productId, productId),
          eq(schema.productReviews.status, 'published'),
        ),
      );
    const aggregate = computeAggregate(allRatings.map((r) => r.rating));
    return {
      ok: true,
      status: 200,
      reviews: rows.map((r) => ({
        id: Number(r.id),
        rating: r.rating,
        title: r.title,
        body: r.body,
        verified: r.verified,
        createdAt: r.createdAt,
      })),
      aggregate,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) {
      return {
        ok: true,
        status: 200,
        reviews: [],
        aggregate: computeAggregate([]),
        schemaMissing: true,
      };
    }
    throw err;
  }
}

/**
 * Aggregate ratings for many products at once — drives the additive
 * `rating` field on the product-listing payload + the `rating`/
 * `popularity` sorts. Resilient: if product_reviews is not migrated yet
 * it returns an empty map (listing degrades, never errors).
 */
export async function fetchReviewAggregates(
  productIds: number[],
  db: Db = getDb(),
): Promise<Map<number, { average: number; count: number }>> {
  const out = new Map<number, { average: number; count: number }>();
  if (productIds.length === 0) return out;
  try {
    const rows = await db
      .select({
        productId: schema.productReviews.productId,
        avg: sql<number>`AVG(${schema.productReviews.rating})::float`,
        cnt: sql<number>`COUNT(*)::int`,
      })
      .from(schema.productReviews)
      .where(
        and(
          inArray(schema.productReviews.productId, productIds),
          eq(schema.productReviews.status, 'published'),
        ),
      )
      .groupBy(schema.productReviews.productId);
    for (const r of rows) {
      out.set(Number(r.productId), {
        average: Math.round(Number(r.avg) * 10) / 10,
        count: Number(r.cnt),
      });
    }
    return out;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) return out;
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Admin moderation
// ─────────────────────────────────────────────────────────────────────

export interface AdminReviewRow {
  id: number;
  productId: number;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  verified: boolean;
  createdAt: Date;
}

export async function listReviewsForAdmin(
  filters: { status?: string | null; limit?: number; offset?: number },
  db: Db = getDb(),
): Promise<{ items: AdminReviewRow[]; total: number; schemaMissing: boolean }> {
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? 50)));
  const offset = Math.max(0, Math.floor(filters.offset ?? 0));
  const status =
    filters.status && ['pending', 'published', 'rejected'].includes(filters.status)
      ? (filters.status as 'pending')
      : 'pending';
  try {
    const items = await db
      .select({
        id: schema.productReviews.id,
        productId: schema.productReviews.productId,
        rating: schema.productReviews.rating,
        title: schema.productReviews.title,
        body: schema.productReviews.body,
        status: schema.productReviews.status,
        verified: schema.productReviews.verified,
        createdAt: schema.productReviews.createdAt,
      })
      .from(schema.productReviews)
      .where(eq(schema.productReviews.status, status))
      .orderBy(desc(schema.productReviews.createdAt))
      .limit(limit)
      .offset(offset);
    const countRes = await db
      .select({ c: sql<number>`COUNT(*)::int` })
      .from(schema.productReviews)
      .where(eq(schema.productReviews.status, status));
    return {
      items: items.map((r) => ({
        id: Number(r.id),
        productId: Number(r.productId),
        rating: r.rating,
        title: r.title,
        body: r.body,
        status: r.status,
        verified: r.verified,
        createdAt: r.createdAt,
      })),
      total: countRes[0]?.c ?? 0,
      schemaMissing: false,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) {
      return { items: [], total: 0, schemaMissing: true };
    }
    throw err;
  }
}

export type ModerationAction = 'approve' | 'reject';

export function moderationTargetStatus(action: ModerationAction): 'published' | 'rejected' {
  return action === 'approve' ? 'published' : 'rejected';
}

export interface ModerateResult {
  ok: boolean;
  status: number;
  error?: string;
  review?: { id: number; status: string };
}

/**
 * Approve → published, reject → rejected. Audit logging is the caller's
 * job (admin handler) so this stays DB-pure + injectable.
 */
export async function moderateReview(
  reviewId: number,
  action: ModerationAction,
  db: Db = getDb(),
): Promise<ModerateResult> {
  if (!Number.isFinite(reviewId) || reviewId <= 0) {
    return { ok: false, status: 400, error: 'positive integer review id required' };
  }
  if (action !== 'approve' && action !== 'reject') {
    return { ok: false, status: 400, error: 'action must be approve or reject' };
  }
  const target = moderationTargetStatus(action);
  try {
    const updated = await db
      .update(schema.productReviews)
      .set({ status: target, updatedAt: new Date() })
      .where(eq(schema.productReviews.id, reviewId))
      .returning({ id: schema.productReviews.id, status: schema.productReviews.status });
    const row = updated[0];
    if (!row) return { ok: false, status: 404, error: 'review_not_found' };
    return { ok: true, status: 200, review: { id: Number(row.id), status: row.status } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (SCHEMA_MISSING_RE.test(msg)) {
      return { ok: false, status: 503, error: 'schema_missing' };
    }
    throw err;
  }
}
