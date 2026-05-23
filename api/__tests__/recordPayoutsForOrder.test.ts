/**
 * Wellness-Designer-App (f) — payout_queue recorder tests.
 *
 * Mock-builder covers the orders lookup, order_items lookup, and
 * payout_queue insert. The pure-fn structure of `recordPayoutsForOrder`
 * lets us verify commission math + per-merchant grouping without
 * spinning up Postgres.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertedRows: unknown[] = [];

vi.mock('../db/client.js', () => {
  const builder = {
    _orderLookup: [] as unknown[],
    _itemRows: [] as unknown[],
    _activeTable: '',
    select(_cols?: unknown) {
      return this;
    },
    from(t: { _name: string }) {
      builder._activeTable = t._name;
      return builder;
    },
    where(_pred: unknown) {
      return builder;
    },
    limit(_n: number) {
      return Promise.resolve(builder._orderLookup);
    },
    then(resolve: (v: unknown[]) => void) {
      resolve(builder._itemRows);
      return undefined;
    },
    insert(_t: unknown) {
      return {
        values(v: unknown) {
          insertedRows.push(v);
          return Promise.resolve();
        },
      };
    },
  };
  return {
    getDb: () => builder,
    schema: {
      orders: { _name: 'orders', id: {}, ppwOrderId: {}, currency: {}, paymentRail: {} },
      orderItems: {
        _name: 'order_items',
        orderId: {},
        merchantId: {},
        lineTotalMinor: {},
        currency: {},
      },
      payoutQueue: { _name: 'payout_queue' },
    },
    __fake: { builder },
  };
});

import {
  recordPayoutsForOrder,
  PPW_PAYOUT_COMMISSION_DEFAULT,
  PAYOUT_HOLD_MS,
} from '../lib/payouts/recordPayoutsForOrder';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeDb: any = await import('../db/client.js').then((m) => (m as any).__fake);

describe('Wellness-Designer-App (f) / recordPayoutsForOrder', () => {
  beforeEach(() => {
    insertedRows.length = 0;
    fakeDb.builder._orderLookup = [];
    fakeDb.builder._itemRows = [];
  });

  it('defaults commission rate to 5% per chain spec', () => {
    expect(PPW_PAYOUT_COMMISSION_DEFAULT).toBe(0.05);
  });

  it('holds payouts for 14 days', () => {
    expect(PAYOUT_HOLD_MS).toBe(14 * 24 * 60 * 60 * 1000);
  });

  it('returns inserted:0 + order_not_found when ppwOrderId is empty', async () => {
    const result = await recordPayoutsForOrder('');
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.skippedReason).toBe('order_not_found');
  });

  it('returns inserted:0 + order_not_found when the order row is missing', async () => {
    fakeDb.builder._orderLookup = [];
    const result = await recordPayoutsForOrder('PPW-GHOST');
    expect(result.inserted).toBe(0);
    expect(result.skippedReason).toBe('order_not_found');
  });

  it('returns inserted:0 + no_order_items when order_items is empty', async () => {
    fakeDb.builder._orderLookup = [{ id: 42, currency: 'MUR', paymentRail: 'paypal' }];
    fakeDb.builder._itemRows = [];
    const result = await recordPayoutsForOrder('PPW-EMPTY');
    expect(result.inserted).toBe(0);
    expect(result.skippedReason).toBe('no_order_items');
  });

  it('inserts one payout_queue row per unique merchant with 95% net by default', async () => {
    fakeDb.builder._orderLookup = [{ id: 42, currency: 'MUR', paymentRail: 'paypal' }];
    fakeDb.builder._itemRows = [
      { merchantId: 1, lineTotalMinor: 250_000, currency: 'MUR' },
      { merchantId: 1, lineTotalMinor: 180_000, currency: 'MUR' },
      { merchantId: 2, lineTotalMinor: 30_000, currency: 'MUR' },
    ];
    const result = await recordPayoutsForOrder('PPW-MULTI');
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(2);
    expect(insertedRows.length).toBe(2);
    // K1 subtotal 430000 × 0.95 = 408500
    const k1 = (result.rows ?? []).find((r) => r.merchantId === 1);
    const dec = (result.rows ?? []).find((r) => r.merchantId === 2);
    expect(k1?.amountMinor).toBe(408_500);
    expect(dec?.amountMinor).toBe(28_500);
  });

  it('honours an overridden commission rate', async () => {
    fakeDb.builder._orderLookup = [{ id: 42, currency: 'MUR', paymentRail: 'paypal' }];
    fakeDb.builder._itemRows = [{ merchantId: 1, lineTotalMinor: 100_000, currency: 'MUR' }];
    const result = await recordPayoutsForOrder('PPW-CUSTOM', { commissionRate: 0.10 });
    expect(result.rows?.[0]?.amountMinor).toBe(90_000);
  });

  it('skips a merchant whose lines have mixed currencies', async () => {
    fakeDb.builder._orderLookup = [{ id: 42, currency: 'MUR', paymentRail: 'paypal' }];
    fakeDb.builder._itemRows = [
      { merchantId: 1, lineTotalMinor: 100_000, currency: 'MUR' },
      { merchantId: 1, lineTotalMinor: 100, currency: 'USD' },
    ];
    const result = await recordPayoutsForOrder('PPW-MIXED');
    // Single inserted row at the first-seen currency (MUR), not two.
    expect(result.inserted).toBe(1);
    expect(result.rows?.[0]?.currency).toBe('MUR');
  });

  it('computes scheduledFor as now + 14 days', async () => {
    const FIXED_NOW = 1_700_000_000_000;
    fakeDb.builder._orderLookup = [{ id: 42, currency: 'MUR', paymentRail: 'paypal' }];
    fakeDb.builder._itemRows = [{ merchantId: 1, lineTotalMinor: 100_000, currency: 'MUR' }];
    await recordPayoutsForOrder('PPW-SCHED', { now: () => FIXED_NOW });
    const row = insertedRows[0] as { scheduledFor: Date };
    expect(row.scheduledFor.getTime()).toBe(FIXED_NOW + PAYOUT_HOLD_MS);
  });

  it('returns schema_missing when the table does not exist', async () => {
    fakeDb.builder._orderLookup = [{ id: 42, currency: 'MUR', paymentRail: 'paypal' }];
    fakeDb.builder._itemRows = [{ merchantId: 1, lineTotalMinor: 100_000, currency: 'MUR' }];
    const insertSpy = vi.spyOn(fakeDb.builder, 'insert').mockImplementationOnce(() => ({
      values: () =>
        Promise.reject(new Error('relation "payout_queue" does not exist (SQLSTATE 42P01)')),
    }));
    const result = await recordPayoutsForOrder('PPW-NOSCHEMA');
    expect(result.ok).toBe(false);
    expect(result.skippedReason).toBe('schema_missing');
    insertSpy.mockRestore();
  });
});
