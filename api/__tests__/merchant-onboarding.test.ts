/**
 * Phase 5 — merchant onboarding core tests.
 *   - PURE: checklist readiness, KYC-status derive, lite-KYC schema.
 *   - DB wrappers via injectable fake: state read + KYC reflection,
 *     lite-KYC transition (none→lite_submitted), go-live not-ready guard.
 */

import { describe, it, expect } from 'vitest';
import {
  computeGoLiveChecklist,
  deriveKycFromMerchantStatus,
  liteKycSchema,
  getOnboardingState,
  submitLiteKyc,
  markGoLive,
  PAYOUT_METHODS,
} from '../lib/merchants/onboarding';

function fakeDb(cfg: { selects?: unknown[][] }) {
  let si = 0;
  const updateSets: Record<string, unknown>[] = [];
  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'groupBy', 'offset']) c[m] = self;
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve((cfg.selects ?? [])[si++] ?? []).then(res, rej);
    return c;
  };
  const db = {
    select: () => chain(),
    update: () => ({
      set: (v: Record<string, unknown>) => {
        updateSets.push(v);
        return { where: () => ({ returning: () => Promise.resolve([]) }) };
      },
    }),
    __updateSets: updateSets,
  };
  return db as never;
}

const merchant = (over: Record<string, unknown> = {}) => ({
  id: 7,
  slug: 'k1-sport',
  status: 'approved',
  onboardingStep: 1,
  kycStatus: 'none',
  payoutMethod: null,
  goLiveAt: null,
  ...over,
});

describe('pure: computeGoLiveChecklist', () => {
  it('not ready when missing product / payout / kyc', () => {
    const r = computeGoLiveChecklist({ productCount: 0, payoutMethod: null, kycStatus: 'none' });
    expect(r.ready).toBe(false);
    expect(r.missing).toEqual(['has_product', 'payout_method', 'kyc_lite']);
  });
  it('ready when all done', () => {
    const r = computeGoLiveChecklist({ productCount: 3, payoutMethod: 'paypal', kycStatus: 'lite_submitted' });
    expect(r.ready).toBe(true);
    expect(r.missing).toEqual([]);
  });
});

describe('pure: deriveKycFromMerchantStatus + schema', () => {
  it('approved / pending_admin_approval → verified; else null', () => {
    expect(deriveKycFromMerchantStatus('approved')).toBe('verified');
    expect(deriveKycFromMerchantStatus('pending_admin_approval')).toBe('verified');
    expect(deriveKycFromMerchantStatus('awaiting_kyc')).toBeNull();
    expect(deriveKycFromMerchantStatus('pending_signup')).toBeNull();
  });
  it('liteKycSchema requires a known payout method', () => {
    expect(liteKycSchema.safeParse({ payoutMethod: 'paypal' }).success).toBe(true);
    expect(liteKycSchema.safeParse({ payoutMethod: 'bitcoin' }).success).toBe(false);
    expect(liteKycSchema.safeParse({}).success).toBe(false);
    expect(PAYOUT_METHODS).toContain('mcb_juice');
  });
});

describe('db: getOnboardingState', () => {
  it('returns state + checklist; reflects verified KYC from approved status', async () => {
    // merchant approved + has product + payout set → checklist ready, kyc verified
    const db = fakeDb({ selects: [[merchant({ payoutMethod: 'paypal', kycStatus: 'lite_submitted' })], [{ c: 2 }]] });
    const r = await getOnboardingState('k1-sport', db);
    expect(r.ok).toBe(true);
    expect(r.state?.kycStatus).toBe('verified'); // derived from status='approved'
    expect(r.state?.productCount).toBe(2);
    expect(r.checklist?.ready).toBe(true);
  });
  it('404 when merchant not found', async () => {
    const r = await getOnboardingState('ghost', fakeDb({ selects: [[]] }));
    expect(r.status).toBe(404);
  });
  it('503 on schema-missing', async () => {
    const db = { select: () => { throw new Error('relation "merchants" does not exist'); } } as never;
    const r = await getOnboardingState('k1-sport', db);
    expect(r.status).toBe(503);
  });
});

describe('db: submitLiteKyc — transition none→lite_submitted', () => {
  it('400 on invalid payout method (no db write)', async () => {
    const r = await submitLiteKyc('k1-sport', { payoutMethod: 'gold' }, fakeDb({}));
    expect(r.status).toBe(400);
  });
  it('writes kyc_status=lite_submitted + payout method', async () => {
    // selects: [loadMerchant(submit), loadMerchant(state read), count]
    const db = fakeDb({
      selects: [[merchant({ status: 'awaiting_kyc' })], [merchant({ status: 'awaiting_kyc', kycStatus: 'lite_submitted', payoutMethod: 'paypal' })], [{ c: 1 }]],
    });
    const r = await submitLiteKyc('k1-sport', { payoutMethod: 'paypal' }, db);
    expect(r.ok).toBe(true);
    const sets = (db as unknown as { __updateSets: Record<string, unknown>[] }).__updateSets;
    expect(sets[0]).toMatchObject({ kycStatus: 'lite_submitted', payoutMethod: 'paypal' });
    expect(r.state?.kycStatus).toBe('lite_submitted');
  });
});

describe('db: markGoLive — readiness guard', () => {
  it('409 not_ready when checklist incomplete', async () => {
    const db = fakeDb({ selects: [[merchant({ payoutMethod: null, kycStatus: 'none' })], [{ c: 0 }]] });
    const r = await markGoLive('k1-sport', db);
    expect(r.status).toBe(409);
    expect(r.error).toBe('not_ready');
    expect(r.checklist?.ready).toBe(false);
  });
});
