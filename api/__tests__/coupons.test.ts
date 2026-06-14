/**
 * Phase 6 — coupon engine tests.
 *   - PURE: create schema, validateCoupon rejections, applyCouponToSplit
 *     (percent/fixed, platform-wide/merchant-scoped, exact distribution).
 *   - DB via injectable fake: create (201/400/409), list, deactivate,
 *     fetch-by-code, incrementRedemption (dark, atomic guard).
 */

import { describe, it, expect } from 'vitest';
import {
  couponCreateSchema,
  validateCoupon,
  applyCouponToSplit,
  toCouponView,
  createCoupon,
  listCoupons,
  deactivateCoupon,
  fetchCouponByCode,
  incrementRedemption,
  type CouponView,
} from '../lib/coupons/coupons';
import type { CartSplitResult } from '../lib/cart/split';

const NOW = new Date('2026-06-14T00:00:00.000Z');

function coupon(over: Partial<CouponView> = {}): CouponView {
  return {
    code: 'SAVE10',
    merchantId: null,
    type: 'percent',
    value: 10,
    currency: null,
    minSubtotal: null,
    startsAt: null,
    expiresAt: null,
    maxRedemptions: null,
    redemptions: 0,
    active: true,
    ...over,
  };
}

const split: CartSplitResult = {
  ok: true,
  currency: 'MUR',
  totalMinor: 300000,
  merchantBreakdown: [
    { merchantId: 1, supplierId: null, currency: 'MUR', itemCount: 1, subtotalMinor: 200000, items: [] },
    { merchantId: 2, supplierId: null, currency: 'MUR', itemCount: 1, subtotalMinor: 100000, items: [] },
  ],
};

function fakeDb(cfg: { selects?: unknown[][]; inserts?: unknown[][]; updates?: unknown[][]; throwOnInsert?: Error }) {
  let si = 0, ii = 0, ui = 0;
  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) c[m] = self;
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve((cfg.selects ?? [])[si++] ?? []).then(res, rej);
    return c;
  };
  return {
    select: () => chain(),
    insert: () => ({
      values: () => ({
        returning: () => {
          if (cfg.throwOnInsert) return Promise.reject(cfg.throwOnInsert);
          return Promise.resolve((cfg.inserts ?? [])[ii++] ?? []);
        },
      }),
    }),
    update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve((cfg.updates ?? [])[ui++] ?? []) }) }) }),
  } as never;
}

describe('pure: couponCreateSchema', () => {
  it('accepts a percent coupon, uppercases the code', () => {
    const r = couponCreateSchema.safeParse({ code: 'save10', type: 'percent', value: 10 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe('SAVE10');
  });
  it('rejects percent >100 + fixed without currency', () => {
    expect(couponCreateSchema.safeParse({ code: 'X1', type: 'percent', value: 150 }).success).toBe(false);
    expect(couponCreateSchema.safeParse({ code: 'X2', type: 'fixed', value: 5000 }).success).toBe(false);
    expect(couponCreateSchema.safeParse({ code: 'X3', type: 'fixed', value: 5000, currency: 'MUR' }).success).toBe(true);
  });
});

describe('pure: validateCoupon rejections', () => {
  const ctx = { applicableMinor: 100000, currency: 'MUR', now: NOW };
  it('inactive / expired / not-started', () => {
    expect(validateCoupon(coupon({ active: false }), ctx)).toEqual({ ok: false, error: 'coupon_inactive' });
    expect(validateCoupon(coupon({ expiresAt: '2020-01-01T00:00:00Z' }), ctx)).toEqual({ ok: false, error: 'coupon_expired' });
    expect(validateCoupon(coupon({ startsAt: '2030-01-01T00:00:00Z' }), ctx)).toEqual({ ok: false, error: 'coupon_not_started' });
  });
  it('max redemptions / below min / currency mismatch', () => {
    expect(validateCoupon(coupon({ maxRedemptions: 5, redemptions: 5 }), ctx).ok).toBe(false);
    expect(validateCoupon(coupon({ minSubtotal: 200000 }), ctx)).toEqual({ ok: false, error: 'coupon_below_min_subtotal' });
    expect(validateCoupon(coupon({ type: 'fixed', currency: 'USD', value: 1000 }), ctx)).toEqual({ ok: false, error: 'coupon_currency_mismatch' });
  });
  it('valid passes', () => {
    expect(validateCoupon(coupon(), ctx)).toEqual({ ok: true });
  });
});

describe('pure: applyCouponToSplit', () => {
  it('percent platform-wide discounts whole cart, distributes exactly', () => {
    const r = applyCouponToSplit(coupon({ value: 10 }), split, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.discountMinor).toBe(30000);
    expect(r.totalAfterDiscountMinor).toBe(270000);
    expect(r.perMerchant).toEqual([
      { merchantId: 1, discountMinor: 20000 },
      { merchantId: 2, discountMinor: 10000 },
    ]);
    expect(r.perMerchant.reduce((s, m) => s + m.discountMinor, 0)).toBe(r.discountMinor);
  });
  it('fixed coupon caps at applicable + distributes with exact remainder', () => {
    const r = applyCouponToSplit(coupon({ type: 'fixed', value: 5001, currency: 'MUR' }), split, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.discountMinor).toBe(5001);
    expect(r.perMerchant.reduce((s, m) => s + m.discountMinor, 0)).toBe(5001); // remainder absorbed
  });
  it('merchant-scoped only discounts that merchant', () => {
    const r = applyCouponToSplit(coupon({ merchantId: 2, value: 10 }), split, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.applicableMinor).toBe(100000);
    expect(r.discountMinor).toBe(10000);
    expect(r.perMerchant).toEqual([{ merchantId: 2, discountMinor: 10000 }]);
  });
  it('merchant-scoped coupon for a merchant not in cart → not applicable', () => {
    const r = applyCouponToSplit(coupon({ merchantId: 99 }), split, NOW);
    expect(r).toEqual({ ok: false, error: 'coupon_not_applicable_to_cart' });
  });
});

describe('db: coupon CRUD', () => {
  it('createCoupon 201 on valid', async () => {
    const db = fakeDb({ inserts: [[{ id: 1, code: 'SAVE10', type: 'percent', value: 10 }]] });
    const r = await createCoupon({ code: 'save10', type: 'percent', value: 10 }, db);
    expect(r.status).toBe(201);
    expect(r.coupon).toMatchObject({ code: 'SAVE10' });
  });
  it('createCoupon 400 on invalid', async () => {
    const r = await createCoupon({ code: 'x', type: 'percent', value: 999 }, fakeDb({}));
    expect(r.status).toBe(400);
  });
  it('createCoupon 409 on duplicate code', async () => {
    const db = fakeDb({ throwOnInsert: new Error('duplicate key value violates unique constraint "coupons_code"') });
    const r = await createCoupon({ code: 'DUP', type: 'percent', value: 10 }, db);
    expect(r.status).toBe(409);
  });
  it('listCoupons returns items', async () => {
    const db = fakeDb({ selects: [[{ id: 1, code: 'A' }, { id: 2, code: 'B' }]] });
    const r = await listCoupons({}, db);
    expect(r.items).toHaveLength(2);
  });
  it('deactivateCoupon 200 / 404', async () => {
    expect((await deactivateCoupon('SAVE10', fakeDb({ updates: [[{ id: 1, code: 'SAVE10', active: false }]] }))).status).toBe(200);
    expect((await deactivateCoupon('NOPE', fakeDb({ updates: [[]] }))).status).toBe(404);
  });
  it('fetchCouponByCode returns the row', async () => {
    const db = fakeDb({ selects: [[{ id: 1, code: 'SAVE10' }]] });
    const row = await fetchCouponByCode('save10', db);
    expect(row).toMatchObject({ code: 'SAVE10' });
  });
});

describe('db: incrementRedemption (dark, atomic)', () => {
  it('ok when a row was incremented', async () => {
    const r = await incrementRedemption('SAVE10', fakeDb({ updates: [[{ id: 1 }]] }));
    expect(r.ok).toBe(true);
  });
  it('409 when the guard blocked it (max reached)', async () => {
    const r = await incrementRedemption('SAVE10', fakeDb({ updates: [[]] }));
    expect(r.status).toBe(409);
  });
});

describe('toCouponView', () => {
  it('maps a DB row to the pure view', () => {
    const v = toCouponView({
      id: 1, code: 'SAVE10', merchantId: null, type: 'percent', value: 10, currency: null,
      minSubtotal: null, startsAt: null, expiresAt: null, maxRedemptions: null, redemptions: 2,
      active: true, createdAt: new Date(),
    } as never);
    expect(v).toMatchObject({ code: 'SAVE10', type: 'percent', value: 10, redemptions: 2 });
  });
});
