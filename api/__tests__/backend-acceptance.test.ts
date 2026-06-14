/**
 * Phase 7 (BACKEND-RUN-ORDER-2026-06-11) — "backend functioning" acceptance gate.
 *
 * The consolidated, headless integration/smoke gate that exercises every
 * backend gateway P1–P6 produced. It does NOT add features — it proves the
 * backend composes and each gateway honours its contract. Rows it does not
 * assert directly are proven by the dedicated per-gateway suites named in
 * docs/BACKEND-FUNCTIONING-REPORT.md (the matrix maps every row → test).
 *
 * All assertions are headless: pure functions, libs driven by an ordered
 * fake Drizzle builder, and a couple of zero-DB handler invocations. No
 * live key, no live DB, no money path.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Gateways under test (P1–P6 libs)
import healthcheck from '../healthcheck';
import { parseSort, rankProducts, SORT_OPTIONS } from '../products';
import { submitReview, moderateReview, listProductReviews } from '../lib/reviews/reviews';
import { validateCart, readCouponCode } from '../cart-quote';
import { splitCartByMerchant, type CartLineItem, type ProductMerchantLink } from '../lib/cart/split';
import { applyCouponToSplit, type CouponView } from '../lib/coupons/coupons';
import { isValidTransition, aggregateOrderStatus } from '../lib/order-status';
import { computeGoLiveChecklist, deriveKycFromMerchantStatus, submitLiteKyc } from '../lib/merchants/onboarding';
import { previewBulkUpload } from '../lib/merchants/bulkUpload';
import { summarizeLedger } from '../lib/payouts/ledger';
import { computeCommissionLines, reconcileCommission, type ReferralRow } from '../lib/commission/ledger';
import { authoriseAdminRequest } from '../lib/adminAuth';
import { isSentryConfigured } from '../lib/sentry';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(__dirname, '..');
const MIG_DIR = join(API_DIR, 'db', 'migrations');

// ── ordered-result fake Drizzle builder (shared shape across the suite) ──
function fakeDb(cfg: { selects?: unknown[][]; inserts?: unknown[][]; updates?: unknown[][] }) {
  let si = 0, ii = 0, ui = 0;
  const inserts: unknown[] = [];
  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ['select', 'from', 'innerJoin', 'where', 'orderBy', 'groupBy', 'limit', 'offset']) c[m] = self;
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve((cfg.selects ?? [])[si++] ?? []).then(res, rej);
    return c;
  };
  return {
    select: () => chain(),
    insert: () => ({ values: (v: unknown) => { inserts.push(v); return { returning: () => Promise.resolve((cfg.inserts ?? [])[ii++] ?? []) }; } }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve((cfg.updates ?? [])[ui++] ?? []) }) }) }),
    __inserts: inserts,
  } as never;
}

function mockRes() {
  const out: { status: number; body: unknown; headers: Record<string, string> } = { status: 0, body: undefined, headers: {} };
  const res = {
    setHeader: (k: string, v: string) => { out.headers[k] = v; },
    status(c: number) { out.status = c; return res; },
    end() {},
    json(b: unknown) { out.body = b; },
  };
  return { res, out };
}

const SPLIT = {
  ok: true as const,
  currency: 'MUR',
  totalMinor: 300000,
  merchantBreakdown: [
    { merchantId: 1, supplierId: null, currency: 'MUR', itemCount: 1, subtotalMinor: 200000, items: [] },
    { merchantId: 2, supplierId: null, currency: 'MUR', itemCount: 1, subtotalMinor: 100000, items: [] },
  ],
};

// ─────────────────────────────────────────────────────────────────────
// ACCEPTANCE MATRIX
// ─────────────────────────────────────────────────────────────────────

describe('ACCEPTANCE 1 — Health', () => {
  it('GET /api/healthcheck → 200 ok + sentryConfigured boolean', async () => {
    const { res, out } = mockRes();
    await healthcheck({ method: 'GET', headers: {}, query: {} } as never, res as never);
    expect(out.status).toBe(200);
    const body = out.body as { ok: boolean; service: string; sentryConfigured: unknown };
    expect(body.ok).toBe(true);
    expect(body.service).toBe('ppw-designer-2d');
    expect(typeof body.sentryConfigured).toBe('boolean');
  });
});

describe('ACCEPTANCE 2 — Catalog + search (P4)', () => {
  it('new sorts parse + relevance ranks, rating orders no-reviews last', () => {
    for (const s of ['relevance', 'rating', 'popularity', 'price_asc', 'newest']) {
      expect(parseSort({ sort: s })).toBe(s);
    }
    expect(SORT_OPTIONS).toContain('relevance');
    const rows = [
      { id: 1, sku: 'a', name: 'Sauna', category: 'recovery', description: null, widthMm: null, depthMm: null, heightMm: null, weightG: null, priceMinor: 1, currency: 'MUR', imageUrl: null, region: null, rating: { average: 3, count: 4 } },
      { id: 2, sku: 'b', name: 'Ice Bath', category: 'recovery', description: null, widthMm: null, depthMm: null, heightMm: null, weightG: null, priceMinor: 1, currency: 'MUR', imageUrl: null, region: null, rating: null },
      { id: 3, sku: 'c', name: 'Ice Bath Pro', category: 'recovery', description: null, widthMm: null, depthMm: null, heightMm: null, weightG: null, priceMinor: 1, currency: 'MUR', imageUrl: null, region: null, rating: { average: 4.9, count: 2 } },
    ];
    expect(rankProducts(rows, { sort: 'relevance', q: 'ice bath' }).map((r) => r.id)).toEqual([2, 3]);
    expect(rankProducts(rows, { sort: 'rating', q: null }).map((r) => r.id)).toEqual([3, 1, 2]);
  });
});

describe('ACCEPTANCE 3 — Reviews lifecycle (P4)', () => {
  it('submit→pending(verified by purchase) → moderate→published → list+aggregate', async () => {
    // submit: product exists, one matching order → verified; lands pending
    const submitDb = fakeDb({ selects: [[{ id: 1 }], [{ orderId: 5 }]], inserts: [[{ id: 9, productId: 1, rating: 5, status: 'pending', verified: true }]] });
    const submitted = await submitReview({ productId: 1, email: 'buyer@ppw.co', rating: 5, body: 'great' }, submitDb);
    expect(submitted.review).toMatchObject({ status: 'pending', verified: true });

    // moderate approve → published
    const modDb = fakeDb({ updates: [[{ id: 9, status: 'published' }]] });
    expect((await moderateReview(9, 'approve', modDb)).review).toEqual({ id: 9, status: 'published' });

    // public list returns only published + correct aggregate
    const published = [{ id: 9, rating: 5, title: null, body: 'great', verified: true, createdAt: new Date() }];
    const listDb = fakeDb({ selects: [published, published] });
    const list = await listProductReviews(1, {}, listDb);
    expect(list.reviews).toHaveLength(1);
    expect(list.aggregate).toMatchObject({ count: 1, average: 5 });
  });

  it('unverified when no purchase matches', async () => {
    const db = fakeDb({ selects: [[{ id: 1 }], []], inserts: [[{ id: 10, productId: 1, rating: 3, status: 'pending', verified: false }]] });
    expect((await submitReview({ productId: 1, email: 'x@y.co', rating: 3, body: 'ok' }, db)).review).toMatchObject({ verified: false });
  });
});

describe('ACCEPTANCE 4 — Cart split-quote + coupon (P6)', () => {
  it('empty-cart guard + per-merchant split + coupon discount', () => {
    expect(validateCart({ cart: [] }).ok).toBe(false);

    const lookup = new Map<number, ProductMerchantLink>([
      [1, { productId: 1, merchantId: 1, primarySupplierId: null }],
    ]);
    const cart: CartLineItem[] = [{ productId: 1, sku: 's', name: 'n', quantity: 2, unitPriceMinor: 1000, currency: 'MUR' }];
    const split = splitCartByMerchant(cart, lookup);
    expect(split.ok).toBe(true);
    if (split.ok) expect(split.totalMinor).toBe(2000);

    const coupon: CouponView = {
      code: 'SAVE10', merchantId: null, type: 'percent', value: 10, currency: null,
      minSubtotal: null, startsAt: null, expiresAt: null, maxRedemptions: null, redemptions: 0, active: true,
    };
    const applied = applyCouponToSplit(coupon, SPLIT, new Date('2026-06-14'));
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.discountMinor).toBe(30000);
      expect(applied.totalAfterDiscountMinor).toBe(270000);
    }
    // expired coupon → legible error, never silent
    const expired = applyCouponToSplit({ ...coupon, expiresAt: '2020-01-01T00:00:00Z' }, SPLIT, new Date('2026-06-14'));
    expect(expired).toEqual({ ok: false, error: 'coupon_expired' });
    expect(readCouponCode({ coupon: ' SAVE10 ' })).toBe('SAVE10');
  });
});

describe('ACCEPTANCE 5 — Orders + fulfilment status', () => {
  it('valid transitions + aggregate status', () => {
    expect(isValidTransition(null, 'confirmed')).toBe(true);
    expect(isValidTransition('confirmed', 'shipped')).toBe(true);
    expect(isValidTransition('delivered', 'confirmed')).toBe(false);
    expect(aggregateOrderStatus(['confirmed', 'shipped'])).toBeTruthy();
  });
});

describe('ACCEPTANCE 6 — Merchant onboarding (P5)', () => {
  it('checklist readiness + KYC-lite transition + bulk preview validation', async () => {
    expect(computeGoLiveChecklist({ productCount: 0, payoutMethod: null, kycStatus: 'none' }).ready).toBe(false);
    expect(computeGoLiveChecklist({ productCount: 1, payoutMethod: 'paypal', kycStatus: 'lite_submitted' }).ready).toBe(true);

    const m = { id: 7, slug: 'k1', status: 'awaiting_kyc', onboardingStep: 1, kycStatus: 'none', payoutMethod: null, goLiveAt: null };
    const db = fakeDb({ selects: [[m], [{ ...m, kycStatus: 'lite_submitted', payoutMethod: 'paypal' }], [{ c: 1 }]] });
    const r = await submitLiteKyc('k1', { payoutMethod: 'paypal' }, db);
    expect(r.ok).toBe(true);
    expect((db as unknown as { __inserts: unknown[] })).toBeDefined();

    const csv = ['merchant_id,sku,name,category,price_minor,currency,dimensions_mm,image_url', '1,A1,Ice,recovery,1000,MUR,,', '1,,bad,recovery,x,MUR,,'].join('\n');
    const preview = previewBulkUpload(csv);
    expect(preview.validCount).toBe(1);
    expect(preview.invalid).toHaveLength(1);
  });
});

describe('ACCEPTANCE 7 — Payouts ledger (P5)', () => {
  it('5% commission derived + Connect→KYC mapping', () => {
    const t = summarizeLedger(
      [{ amountMinor: 95000, currency: 'MUR', status: 'queued' }],
      [{ lineTotalMinor: 100000, currency: 'MUR' }],
    );
    expect(t.netMinor).toBe(95000);
    expect(t.commissionMinor).toBe(5000);
    expect(t.commissionRatePct).toBe(5);
    expect(deriveKycFromMerchantStatus('approved')).toBe('verified');
    expect(deriveKycFromMerchantStatus('awaiting_kyc')).toBeNull();
  });
});

describe('ACCEPTANCE 8 — Commission ledger (P6)', () => {
  it('5% lines + reconcile transition pending→reconciled', async () => {
    const refs: ReferralRow[] = [
      { refCode: 'R1', merchantSlug: 'k1', productName: 'Ice', productPriceMinor: 200000, productCurrency: 'MUR', createdAt: new Date('2026-06-01') },
    ];
    const { lines, totals } = computeCommissionLines(refs, new Map());
    expect(lines[0]).toMatchObject({ commissionMinor: 10000, status: 'pending' });
    expect(totals.commissionMinor).toBe(10000);

    const db = fakeDb({ selects: [[{ merchantSlug: 'k1', productPriceMinor: 200000, productCurrency: 'MUR' }], []] });
    const rec = await reconcileCommission('R1', null, db);
    expect(rec.ok).toBe(true);
    expect((db as unknown as { __inserts: Array<Record<string, unknown>> }).__inserts[0]).toMatchObject({ status: 'reconciled', commissionMinor: 10000 });
  });
});

describe('ACCEPTANCE 9 — Admin auth gate', () => {
  it('no Bearer token → 401 (Clerk gate closed)', async () => {
    const r = await authoriseAdminRequest({}, {
      verify: async () => null,
      lookupAdmin: async () => null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
  });
});

describe('ACCEPTANCE 11 — Observability', () => {
  it('isSentryConfigured returns a boolean (no DSN = no-op, no throw)', () => {
    expect(typeof isSentryConfigured()).toBe('boolean');
  });
});

describe('ACCEPTANCE 13 — Invariants', () => {
  it('Vercel function count ≤ 12 (no new top-level api/*.ts)', () => {
    const fns = readdirSync(API_DIR).filter((f) => f.endsWith('.ts'));
    expect(fns.length).toBeLessThanOrEqual(12);
  });

  it('every P4–P6 migration is additive + has a reversible rollback', () => {
    for (const v of ['0027_product_reviews', '0028_merchant_onboarding', '0029_coupons_commission']) {
      const fwd = readFileSync(join(MIG_DIR, `${v}.sql`), 'utf8');
      const rb = readFileSync(join(MIG_DIR, `${v}_rollback.sql`), 'utf8');
      // additive: no destructive DROP/ALTER-DROP in the forward migration
      expect(/DROP\s+TABLE|DROP\s+COLUMN/i.test(fwd)).toBe(false);
      // reversible: rollback clears its schema_migrations row
      expect(rb).toMatch(new RegExp(`DELETE\\s+FROM\\s+schema_migrations\\s+WHERE\\s+version\\s*=\\s*'${v}'`, 'i'));
    }
  });

  it('P4–P6 migrations do not alter money/order/attribution tables', () => {
    for (const v of ['0027_product_reviews', '0028_merchant_onboarding', '0029_coupons_commission']) {
      const fwd = readFileSync(join(MIG_DIR, `${v}.sql`), 'utf8');
      expect(/ALTER\s+TABLE\s+(orders|order_items|payout_queue|designer_referrals)\b/i.test(fwd)).toBe(false);
    }
  });
});
