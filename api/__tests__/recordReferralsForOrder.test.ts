/**
 * Wellness-Designer-App (f) closure — `designer_referrals` for cart
 * purchases tests.
 *
 * Three layers:
 *   1. `deriveCartRefCode` pure-fn — shape, length, char-safety
 *   2. `recordReferralsForOrder` DB path with mock builder — order lookup,
 *      JOIN-grouped insert
 *   3. Idempotency (duplicate-key) + skip + error paths
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertedRows: unknown[] = [];

vi.mock('../db/client.js', () => {
  const builder = {
    _orderLookup: [] as unknown[],
    _itemRows: [] as unknown[],
    select(_cols?: unknown) {
      return this;
    },
    from(_t: unknown) {
      return this;
    },
    innerJoin(_t: unknown, _pred: unknown) {
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
      orders: { _name: 'orders', id: {}, ppwOrderId: {} },
      orderItems: {
        _name: 'order_items',
        orderId: {},
        merchantId: {},
        productId: {},
        sku: {},
        name: {},
        unitPriceMinor: {},
        currency: {},
      },
      merchants: { _name: 'merchants', id: {}, slug: {} },
      designerReferrals: { _name: 'designer_referrals' },
    },
    __fake: { builder },
  };
});

import {
  deriveCartRefCode,
  recordReferralsForOrder,
} from '../lib/payouts/recordReferralsForOrder';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeDb: any = await import('../db/client.js').then((m) => (m as any).__fake);

describe('deriveCartRefCode', () => {
  it('produces a deterministic PPW-<MERCHANT>-<ORDER>-<SKU> shape', () => {
    expect(deriveCartRefCode('k1-sport', 'mp_abc123', 'K1-CDIO-NT2450')).toBe(
      'PPW-K1-SPORT-MP-ABC123-K1-CDIO-NT2450',
    );
  });

  it('strips non-alphanum chars + uppercases', () => {
    expect(deriveCartRefCode('My Merchant!', 'order#42', 'sku.foo')).toBe(
      'PPW-MY-MERCHAN-ORDER-42-SKU-FOO',
    );
  });

  it('falls back to NA on empty segments', () => {
    expect(deriveCartRefCode('', '', '')).toBe('PPW-NA-NA-NA');
  });

  it('truncates very long segments to stay under 80 chars', () => {
    const code = deriveCartRefCode(
      'very-long-merchant-slug-name',
      'mp_very_long_order_reference_id',
      'EXTREMELY-LONG-PRODUCT-SKU-NAME',
    );
    expect(code.length).toBeLessThanOrEqual(80);
    expect(code.startsWith('PPW-')).toBe(true);
  });
});

describe('recordReferralsForOrder DB path', () => {
  beforeEach(() => {
    insertedRows.length = 0;
    fakeDb.builder._orderLookup = [];
    fakeDb.builder._itemRows = [];
  });

  it('returns inserted:0 + order_not_found when ppwOrderId is empty', async () => {
    const r = await recordReferralsForOrder('');
    expect(r.inserted).toBe(0);
    expect(r.skippedReason).toBe('order_not_found');
  });

  it('returns inserted:0 + order_not_found when no order row', async () => {
    fakeDb.builder._orderLookup = [];
    const r = await recordReferralsForOrder('PPW-GHOST');
    expect(r.skippedReason).toBe('order_not_found');
  });

  it('returns inserted:0 + no_order_items when order has no items yet', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._itemRows = [];
    const r = await recordReferralsForOrder('PPW-EMPTY');
    expect(r.skippedReason).toBe('no_order_items');
  });

  it('inserts one designer_referrals row per order_items row', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._itemRows = [
      {
        merchantId: 1,
        merchantSlug: 'k1-sport',
        productId: 100,
        sku: 'K1-A',
        name: 'Treadmill',
        unitPriceMinor: 250_000,
        currency: 'MUR',
      },
      {
        merchantId: 2,
        merchantSlug: 'decathlon-mu',
        productId: 200,
        sku: 'DE-MAT',
        name: 'Yoga Mat',
        unitPriceMinor: 1500,
        currency: 'MUR',
      },
    ];
    const r = await recordReferralsForOrder('mp_abc123');
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(2);
    expect(insertedRows.length).toBe(2);
    expect(r.refCodes).toEqual([
      'PPW-K1-SPORT-MP-ABC123-K1-A',
      'PPW-DECATHLON-MP-ABC123-DE-MAT',
    ]);
    const first = insertedRows[0] as {
      refCode: string;
      merchantSlug: string;
      outboundUrl: string;
      designId: string;
      productSku: string;
    };
    expect(first.outboundUrl).toBe('https://designer.ppwellness.co/order/track/mp_abc123');
    expect(first.designId).toBe('mp_abc123');
  });

  it('treats duplicate-key inserts as idempotent (skip silently)', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._itemRows = [
      {
        merchantId: 1,
        merchantSlug: 'k1-sport',
        productId: 100,
        sku: 'K1-A',
        name: 'Treadmill',
        unitPriceMinor: 250_000,
        currency: 'MUR',
      },
    ];
    const insertSpy = vi
      .spyOn(fakeDb.builder, 'insert')
      .mockImplementationOnce(() => ({
        values: () =>
          Promise.reject(
            new Error('duplicate key value violates unique constraint "designer_referrals_ref_code_key" (SQLSTATE 23505)'),
          ),
      }));
    const r = await recordReferralsForOrder('mp_idem');
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(0);
    insertSpy.mockRestore();
  });

  it('returns schema_missing on undefined-table error', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._itemRows = [
      {
        merchantId: 1,
        merchantSlug: 'k1-sport',
        productId: 100,
        sku: 'K1-A',
        name: 'Treadmill',
        unitPriceMinor: 250_000,
        currency: 'MUR',
      },
    ];
    const insertSpy = vi
      .spyOn(fakeDb.builder, 'insert')
      .mockImplementationOnce(() => ({
        values: () =>
          Promise.reject(
            new Error('relation "designer_referrals" does not exist (SQLSTATE 42P01)'),
          ),
      }));
    const r = await recordReferralsForOrder('mp_schema');
    expect(r.ok).toBe(false);
    expect(r.skippedReason).toBe('schema_missing');
    insertSpy.mockRestore();
  });
});
