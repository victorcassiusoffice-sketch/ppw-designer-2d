/**
 * Phase 5 — payout ledger read-model tests.
 *   - PURE summarizeLedger: gross/net/commission + per-status breakdown.
 *   - DB fetchMerchantPayoutLedger + fetchAdminLedgerSummary via fake db.
 */

import { describe, it, expect } from 'vitest';
import {
  summarizeLedger,
  fetchMerchantPayoutLedger,
  fetchAdminLedgerSummary,
} from '../lib/payouts/ledger';

function fakeDb(selects: unknown[][]) {
  let si = 0;
  const chain = () => {
    const c: Record<string, unknown> = {};
    const self = () => c;
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'groupBy']) c[m] = self;
    c.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(selects[si++] ?? []).then(res, rej);
    return c;
  };
  return { select: () => chain() } as never;
}

describe('pure: summarizeLedger', () => {
  it('derives commission = gross − net (5% slice) + per-status', () => {
    const payouts = [
      { amountMinor: 95000, currency: 'MUR', status: 'queued' },
      { amountMinor: 95000, currency: 'MUR', status: 'sent' },
    ];
    const items = [
      { lineTotalMinor: 100000, currency: 'MUR' },
      { lineTotalMinor: 100000, currency: 'MUR' },
    ];
    const t = summarizeLedger(payouts, items);
    expect(t.currency).toBe('MUR');
    expect(t.grossMinor).toBe(200000);
    expect(t.netMinor).toBe(190000);
    expect(t.commissionMinor).toBe(10000);
    expect(t.commissionRatePct).toBe(5);
    expect(t.payoutCount).toBe(2);
    expect(t.byStatus.queued).toEqual({ count: 1, amountMinor: 95000 });
    expect(t.byStatus.sent).toEqual({ count: 1, amountMinor: 95000 });
  });

  it('empty → zeroes, default MUR, commission clamped ≥0', () => {
    const t = summarizeLedger([], []);
    expect(t).toMatchObject({ grossMinor: 0, netMinor: 0, commissionMinor: 0, currency: 'MUR' });
  });

  it('ignores mismatched-currency payout lines (single-currency assumption)', () => {
    const t = summarizeLedger(
      [
        { amountMinor: 95000, currency: 'MUR', status: 'queued' },
        { amountMinor: 5000, currency: 'USD', status: 'queued' },
      ],
      [{ lineTotalMinor: 100000, currency: 'MUR' }],
    );
    expect(t.currency).toBe('MUR');
    expect(t.netMinor).toBe(95000);
    expect(t.payoutCount).toBe(1);
  });
});

describe('db: fetchMerchantPayoutLedger', () => {
  it('400 for bad merchant id', async () => {
    const r = await fetchMerchantPayoutLedger(0, fakeDb([]));
    expect(r.status).toBe(400);
  });
  it('returns payouts + derived totals', async () => {
    const db = fakeDb([
      [{ amountMinor: 95000, currency: 'MUR', status: 'queued' }],
      [{ lineTotalMinor: 100000, currency: 'MUR' }],
    ]);
    const r = await fetchMerchantPayoutLedger(7, db);
    expect(r.ok).toBe(true);
    expect(r.payouts).toHaveLength(1);
    expect(r.totals?.commissionMinor).toBe(5000);
  });
  it('schema-missing → empty + flag (resilient)', async () => {
    const db = { select: () => { throw new Error('relation "payout_queue" does not exist'); } } as never;
    const r = await fetchMerchantPayoutLedger(7, db);
    expect(r.ok).toBe(true);
    expect(r.schemaMissing).toBe(true);
    expect(r.payouts).toEqual([]);
  });
});

describe('db: fetchAdminLedgerSummary', () => {
  it('returns platform totals', async () => {
    const db = fakeDb([
      [{ amountMinor: 190000, currency: 'MUR', status: 'queued' }],
      [{ lineTotalMinor: 200000, currency: 'MUR' }],
    ]);
    const t = await fetchAdminLedgerSummary(db);
    expect(t?.commissionMinor).toBe(10000);
  });
  it('null when schema missing', async () => {
    const db = { select: () => { throw new Error('42P01 undefined_table'); } } as never;
    expect(await fetchAdminLedgerSummary(db)).toBeNull();
  });
});
