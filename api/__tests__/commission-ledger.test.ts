/**
 * Phase 6 — Pattern-C commission ledger tests.
 *   - PURE: commissionOf (5%), computeCommissionLines + status overlay.
 *   - DB via fake: fetchCommissionLedger, reconcileCommission
 *     (insert + update branches, not-found).
 */

import { describe, it, expect } from 'vitest';
import {
  commissionOf,
  computeCommissionLines,
  fetchCommissionLedger,
  reconcileCommission,
  type ReferralRow,
} from '../lib/commission/ledger';

function fakeDb(cfg: { selects?: unknown[][] }) {
  let si = 0;
  const inserts: unknown[] = [];
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
    insert: () => ({ values: (v: unknown) => { inserts.push(v); return { returning: () => Promise.resolve([]) }; } }),
    update: () => ({ set: () => ({ where: () => Promise.resolve([]) }) }),
    __inserts: inserts,
  } as never;
}

const refs: ReferralRow[] = [
  { refCode: 'R1', merchantSlug: 'k1-sport', productName: 'Ice Bath', productPriceMinor: 200000, productCurrency: 'MUR', createdAt: new Date('2026-06-01') },
  { refCode: 'R2', merchantSlug: 'k1-sport', productName: null, productPriceMinor: null, productCurrency: 'MUR', createdAt: new Date('2026-06-02') },
];

describe('pure: commissionOf + computeCommissionLines', () => {
  it('commissionOf = 5% rounded', () => {
    expect(commissionOf(200000)).toBe(10000);
    expect(commissionOf(99)).toBe(5); // round(4.95)
    expect(commissionOf(0)).toBe(0);
  });
  it('builds lines + totals, overlays reconciled status', () => {
    const overlay = new Map([['R1', { status: 'reconciled' as const, reconciledAt: '2026-06-10T00:00:00.000Z' }]]);
    const { lines, totals } = computeCommissionLines(refs, overlay);
    expect(lines[0]).toMatchObject({ refCode: 'R1', commissionMinor: 10000, status: 'reconciled' });
    expect(lines[1]).toMatchObject({ refCode: 'R2', grossMinor: 0, commissionMinor: 0, status: 'pending' });
    expect(totals.grossMinor).toBe(200000);
    expect(totals.commissionMinor).toBe(10000);
    expect(totals.byStatus.reconciled).toEqual({ count: 1, commissionMinor: 10000 });
    expect(totals.byStatus.pending).toEqual({ count: 1, commissionMinor: 0 });
  });
});

describe('db: fetchCommissionLedger', () => {
  it('computes lines from referrals + overlay rows', async () => {
    const db = fakeDb({
      selects: [
        refs, // referral rows
        [{ refCode: 'R1', status: 'reconciled', reconciledAt: new Date('2026-06-10') }], // ledger overlay
      ],
    });
    const r = await fetchCommissionLedger({}, db);
    expect(r.ok).toBe(true);
    expect(r.lines).toHaveLength(2);
    expect(r.lines?.find((l) => l.refCode === 'R1')?.status).toBe('reconciled');
    expect(r.totals?.commissionMinor).toBe(10000);
  });
  it('schema-missing → empty + flag', async () => {
    const db = { select: () => { throw new Error('relation "designer_referrals" does not exist'); } } as never;
    const r = await fetchCommissionLedger({}, db);
    expect(r.ok).toBe(true);
    expect(r.schemaMissing).toBe(true);
    expect(r.lines).toEqual([]);
  });
});

describe('db: reconcileCommission', () => {
  it('404 when the referral is unknown', async () => {
    const r = await reconcileCommission('NOPE', null, fakeDb({ selects: [[]] }));
    expect(r.status).toBe(404);
  });
  it('inserts a ledger row when none exists (pending→reconciled)', async () => {
    // selects: [referral found, existing ledger NONE]
    const db = fakeDb({ selects: [[{ merchantSlug: 'k1-sport', productPriceMinor: 200000, productCurrency: 'MUR' }], []] });
    const r = await reconcileCommission('R1', 'matched K1 export', db);
    expect(r.ok).toBe(true);
    expect(r.refCode).toBe('R1');
    const inserts = (db as unknown as { __inserts: Array<Record<string, unknown>> }).__inserts;
    expect(inserts[0]).toMatchObject({ refCode: 'R1', status: 'reconciled', commissionMinor: 10000 });
  });
  it('updates when a ledger row already exists', async () => {
    const db = fakeDb({ selects: [[{ merchantSlug: 'k1-sport', productPriceMinor: 200000, productCurrency: 'MUR' }], [{ id: 5 }]] });
    const r = await reconcileCommission('R1', null, db);
    expect(r.ok).toBe(true);
    // no insert on the update branch
    expect((db as unknown as { __inserts: unknown[] }).__inserts).toHaveLength(0);
  });
});
