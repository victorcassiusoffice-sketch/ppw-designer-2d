/**
 * Phase 4 — verified-purchase reviews core tests.
 *
 *   - PURE helpers: hashEmail, computeAggregate, decideVerification,
 *     scoreRelevance, rankBySearch, parseSearchSort, submission schema.
 *   - DB wrappers via an injectable fake `db` (no module mock): submit
 *     (verified vs unverified, pending status, product-missing,
 *     schema-missing), public list + aggregate, admin list, moderation.
 */

import { describe, it, expect } from 'vitest';
import {
  hashEmail,
  normalizeEmail,
  computeAggregate,
  decideVerification,
  scoreRelevance,
  rankBySearch,
  parseSearchSort,
  reviewSubmissionSchema,
  submitReview,
  listProductReviews,
  fetchReviewAggregates,
  listReviewsForAdmin,
  moderateReview,
  moderationTargetStatus,
} from '../lib/reviews/reviews';

// Minimal ordered-result fake of the Drizzle builder. Each top-level
// db.select() consumes the next entry in `selects`; insert/update likewise.
type Rows = unknown[];
function fakeDb(cfg: { selects?: Rows[]; inserts?: Rows[]; updates?: Rows[] }) {
  let si = 0;
  let ii = 0;
  let ui = 0;
  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ['select', 'from', 'innerJoin', 'where', 'orderBy', 'groupBy', 'limit', 'offset']) {
      c[m] = self;
    }
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve((cfg.selects ?? [])[si++] ?? []).then(res, rej);
    return c;
  };
  return {
    select: () => chain(),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve((cfg.inserts ?? [])[ii++] ?? []) }) }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve((cfg.updates ?? [])[ui++] ?? []) }) }),
    }),
  } as never;
}

describe('pure: hashEmail / normalizeEmail', () => {
  it('normalizes case + whitespace', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com');
  });
  it('is deterministic + 64 hex chars + case-insensitive', () => {
    const a = hashEmail('Vic@PPW.co');
    const b = hashEmail(' vic@ppw.co ');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('pure: computeAggregate', () => {
  it('empty → zeroes', () => {
    expect(computeAggregate([])).toEqual({
      average: 0,
      count: 0,
      distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
    });
  });
  it('computes 1-decimal average, count, distribution', () => {
    const agg = computeAggregate([5, 4, 5, 3, 1]);
    expect(agg.count).toBe(5);
    expect(agg.average).toBe(3.6); // 18/5
    expect(agg.distribution).toEqual({ '1': 1, '2': 0, '3': 1, '4': 1, '5': 2 });
  });
  it('ignores out-of-range ratings', () => {
    const agg = computeAggregate([5, 0, 6, 3]);
    expect(agg.count).toBe(2);
    expect(agg.average).toBe(4); // (5+3)/2
  });
});

describe('pure: decideVerification', () => {
  it('no matching orders → unverified', () => {
    expect(decideVerification([])).toEqual({ verified: false, orderId: null });
  });
  it('matching orders → verified, links earliest order', () => {
    expect(decideVerification([7, 3, 9])).toEqual({ verified: true, orderId: 3 });
  });
});

describe('pure: scoreRelevance + rankBySearch', () => {
  const items = [
    { id: 1, name: 'Ice Bath Pro', category: 'recovery', description: 'cold plunge' },
    { id: 2, name: 'Sauna Cabin', category: 'recovery', description: 'infrared heat for ice recovery' },
    { id: 3, name: 'Yoga Mat', category: 'mobility', description: 'non-slip' },
  ];
  it('exact name beats prefix beats contains', () => {
    expect(scoreRelevance(items[0], 'Ice Bath Pro')).toBeGreaterThan(scoreRelevance(items[0], 'Ice'));
  });
  it('ranks by relevance, drops non-matches', () => {
    const ranked = rankBySearch(items, 'ice');
    expect(ranked.map((r) => r.id)).toEqual([1, 2]); // 3 has no "ice" anywhere
  });
  it('empty query returns input unchanged', () => {
    expect(rankBySearch(items, '  ').map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe('pure: parseSearchSort + submission schema', () => {
  it('accepts known sorts, rejects junk', () => {
    expect(parseSearchSort('relevance')).toBe('relevance');
    expect(parseSearchSort('popularity')).toBe('popularity');
    expect(parseSearchSort('nope')).toBeNull();
    expect(parseSearchSort(undefined)).toBeNull();
  });
  it('validates rating 1-5 + non-empty body', () => {
    expect(reviewSubmissionSchema.safeParse({ productId: 1, email: 'a@b.co', rating: 5, body: 'great' }).success).toBe(true);
    expect(reviewSubmissionSchema.safeParse({ productId: 1, email: 'a@b.co', rating: 6, body: 'x' }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ productId: 1, email: 'a@b.co', rating: 5, body: '' }).success).toBe(false);
    expect(reviewSubmissionSchema.safeParse({ productId: 1, email: 'bad', rating: 5, body: 'x' }).success).toBe(false);
  });
  it('moderationTargetStatus maps action → status', () => {
    expect(moderationTargetStatus('approve')).toBe('published');
    expect(moderationTargetStatus('reject')).toBe('rejected');
  });
});

describe('db: submitReview', () => {
  const goodBody = { productId: 1, email: 'buyer@ppw.co', rating: 5, body: 'excellent' };

  it('verified=true when an order matches; lands pending', async () => {
    const db = fakeDb({
      selects: [[{ id: 1 }], [{ orderId: 42 }]], // product exists; one matching order
      inserts: [[{ id: 100, productId: 1, rating: 5, status: 'pending', verified: true }]],
    });
    const r = await submitReview(goodBody, db);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(201);
    expect(r.review).toMatchObject({ status: 'pending', verified: true });
  });

  it('verified=false when no order matches', async () => {
    const db = fakeDb({
      selects: [[{ id: 1 }], []], // product exists; NO matching order
      inserts: [[{ id: 101, productId: 1, rating: 4, status: 'pending', verified: false }]],
    });
    const r = await submitReview({ ...goodBody, rating: 4 }, db);
    expect(r.ok).toBe(true);
    expect(r.review).toMatchObject({ verified: false, status: 'pending' });
  });

  it('404 when the product does not exist', async () => {
    const db = fakeDb({ selects: [[]] });
    const r = await submitReview(goodBody, db);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
  });

  it('400 on invalid payload (no DB touched)', async () => {
    const db = fakeDb({});
    const r = await submitReview({ productId: 1, email: 'x', rating: 9, body: '' }, db);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('503 when schema is missing', async () => {
    const db = {
      select: () => {
        throw new Error('relation "product_reviews" does not exist');
      },
    } as never;
    const r = await submitReview(goodBody, db);
    expect(r.status).toBe(503);
  });
});

describe('db: listProductReviews', () => {
  it('returns published rows + correct aggregate', async () => {
    const reviewRows = [
      { id: 1, rating: 5, title: 'A', body: 'b', verified: true, createdAt: new Date() },
      { id: 2, rating: 3, title: null, body: 'c', verified: false, createdAt: new Date() },
    ];
    const db = fakeDb({ selects: [reviewRows, reviewRows] }); // page, then all-ratings
    const r = await listProductReviews(1, {}, db);
    expect(r.ok).toBe(true);
    expect(r.reviews).toHaveLength(2);
    expect(r.aggregate).toMatchObject({ count: 2, average: 4 });
  });

  it('400 for a bad product id', async () => {
    const r = await listProductReviews(0, {}, fakeDb({}));
    expect(r.status).toBe(400);
  });

  it('degrades to empty + schemaMissing when table absent', async () => {
    const db = {
      select: () => {
        throw new Error('42P01 undefined_table');
      },
    } as never;
    const r = await listProductReviews(1, {}, db);
    expect(r.ok).toBe(true);
    expect(r.schemaMissing).toBe(true);
    expect(r.reviews).toEqual([]);
  });
});

describe('db: fetchReviewAggregates', () => {
  it('maps product_id → {average,count}', async () => {
    const db = fakeDb({ selects: [[{ productId: 1, avg: 4.5, cnt: 2 }, { productId: 2, avg: 3, cnt: 1 }]] });
    const map = await fetchReviewAggregates([1, 2], db);
    expect(map.get(1)).toEqual({ average: 4.5, count: 2 });
    expect(map.get(2)).toEqual({ average: 3, count: 1 });
  });
  it('empty input → empty map (no query)', async () => {
    const map = await fetchReviewAggregates([], fakeDb({}));
    expect(map.size).toBe(0);
  });
  it('schema-missing → empty map (resilient)', async () => {
    const db = {
      select: () => {
        throw new Error('relation "product_reviews" does not exist');
      },
    } as never;
    const map = await fetchReviewAggregates([1], db);
    expect(map.size).toBe(0);
  });
});

describe('db: admin list + moderate', () => {
  it('lists pending by default with total', async () => {
    const items = [{ id: 1, productId: 1, rating: 5, title: null, body: 'x', status: 'pending', verified: true, createdAt: new Date() }];
    const db = fakeDb({ selects: [items, [{ c: 1 }]] });
    const r = await listReviewsForAdmin({}, db);
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(1);
  });

  it('approve → published', async () => {
    const db = fakeDb({ updates: [[{ id: 5, status: 'published' }]] });
    const r = await moderateReview(5, 'approve', db);
    expect(r.ok).toBe(true);
    expect(r.review).toEqual({ id: 5, status: 'published' });
  });

  it('reject → rejected', async () => {
    const db = fakeDb({ updates: [[{ id: 6, status: 'rejected' }]] });
    const r = await moderateReview(6, 'reject', db);
    expect(r.review).toEqual({ id: 6, status: 'rejected' });
  });

  it('404 when the review id is unknown', async () => {
    const db = fakeDb({ updates: [[]] });
    const r = await moderateReview(999, 'approve', db);
    expect(r.status).toBe(404);
  });

  it('400 on a bad action', async () => {
    const r = await moderateReview(1, 'delete' as never, fakeDb({}));
    expect(r.status).toBe(400);
  });
});
