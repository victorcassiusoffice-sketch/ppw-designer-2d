/**
 * Wellness-Designer-App (f) part 2 — order_items recorder tests.
 *
 * Three layers covered:
 *   1. `paypalItemTotalMinor` pure-fn — unit/line/currency math
 *   2. `recordOrderItemsForOrder` DB path with mock builder —
 *      order lookup, product-SKU batch lookup, per-row insert
 *   3. Skip + error paths (missing order, no items, unknown SKU,
 *      schema missing)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertedRows: unknown[] = [];

vi.mock('../db/client.js', () => {
  const builder = {
    _orderLookup: [] as unknown[],
    _productLookup: [] as unknown[],
    _activeTable: '',
    _nextSelectMode: 'order' as 'order' | 'products',
    select(_cols?: unknown) {
      return this;
    },
    from(t: { _name: string }) {
      builder._activeTable = t._name;
      if (t._name === 'orders') builder._nextSelectMode = 'order';
      else if (t._name === 'products') builder._nextSelectMode = 'products';
      return builder;
    },
    where(_pred: unknown) {
      if (builder._nextSelectMode === 'products') {
        return Promise.resolve(builder._productLookup);
      }
      return builder;
    },
    limit(_n: number) {
      return Promise.resolve(builder._orderLookup);
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
      products: { _name: 'products', id: {}, sku: {}, merchantId: {}, name: {} },
      orderItems: { _name: 'order_items' },
    },
    __fake: { builder },
  };
});

import {
  recordOrderItemsForOrder,
  paypalItemTotalMinor,
} from '../lib/payouts/recordOrderItemsForOrder';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeDb: any = await import('../db/client.js').then((m) => (m as any).__fake);

describe('paypalItemTotalMinor', () => {
  it('parses USD decimal value × quantity into minor units', () => {
    const r = paypalItemTotalMinor({
      unit_amount: { currency_code: 'USD', value: '29.99' },
      quantity: 2,
    });
    expect(r).toEqual({ unitMinor: 2999, lineMinor: 5998, currency: 'USD', quantity: 2 });
  });

  it('treats MUR as integer rupees (no ×100)', () => {
    const r = paypalItemTotalMinor({
      unit_amount: { currency_code: 'MUR', value: '1500' },
      quantity: 1,
    });
    expect(r).toEqual({ unitMinor: 1500, lineMinor: 1500, currency: 'MUR', quantity: 1 });
  });

  it('accepts quantity as a string (PayPal format)', () => {
    const r = paypalItemTotalMinor({
      unit_amount: { currency_code: 'EUR', value: '10.00' },
      quantity: '3',
    });
    expect(r?.lineMinor).toBe(3000);
  });

  it('returns null on negative price', () => {
    const r = paypalItemTotalMinor({
      unit_amount: { currency_code: 'USD', value: '-5' },
      quantity: 1,
    });
    expect(r).toBeNull();
  });

  it('returns null on quantity 0', () => {
    const r = paypalItemTotalMinor({
      unit_amount: { currency_code: 'USD', value: '10' },
      quantity: 0,
    });
    expect(r).toBeNull();
  });

  it('defaults currency to USD when missing', () => {
    const r = paypalItemTotalMinor({ unit_amount: { value: '10' }, quantity: 1 });
    expect(r?.currency).toBe('USD');
  });
});

describe('recordOrderItemsForOrder DB path', () => {
  beforeEach(() => {
    insertedRows.length = 0;
    fakeDb.builder._orderLookup = [];
    fakeDb.builder._productLookup = [];
  });

  it('returns inserted:0 + order_not_found when ppwOrderId is empty', async () => {
    const r = await recordOrderItemsForOrder('', { purchase_units: [{ items: [] }] });
    expect(r.inserted).toBe(0);
    expect(r.skippedReason).toBe('order_not_found');
  });

  it('returns inserted:0 + no_items_in_capture when no items in payload', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    const r = await recordOrderItemsForOrder('PPW-EMPTY', {});
    expect(r.inserted).toBe(0);
    expect(r.skippedReason).toBe('no_items_in_capture');
  });

  it('skips items without an SKU', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    const r = await recordOrderItemsForOrder('PPW-NOSKU', {
      purchase_units: [
        {
          items: [
            { name: 'No SKU item', unit_amount: { currency_code: 'USD', value: '10' }, quantity: 1 },
          ],
        },
      ],
    });
    expect(r.inserted).toBe(0);
  });

  it('inserts one row per item whose SKU resolves in products', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._productLookup = [
      { id: 100, sku: 'K1-A', merchantId: 1, name: 'Treadmill' },
      { id: 200, sku: 'K1-B', merchantId: 1, name: 'Bike' },
    ];
    const r = await recordOrderItemsForOrder('PPW-HAPPY', {
      purchase_units: [
        {
          items: [
            { sku: 'K1-A', name: 'Treadmill', unit_amount: { currency_code: 'MUR', value: '250000' }, quantity: 1 },
            { sku: 'K1-B', name: 'Bike', unit_amount: { currency_code: 'MUR', value: '90000' }, quantity: 2 },
          ],
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.inserted).toBe(2);
    expect(insertedRows.length).toBe(2);
    const second = insertedRows[1] as { lineTotalMinor: number; merchantId: number; productId: number; sku: string };
    expect(second.lineTotalMinor).toBe(180_000); // 90k × 2
    expect(second.merchantId).toBe(1);
    expect(second.productId).toBe(200);
    expect(second.sku).toBe('K1-B');
  });

  it('records skippedSkus when a SKU is not in the products table', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._productLookup = [
      { id: 100, sku: 'K1-A', merchantId: 1, name: 'Treadmill' },
    ];
    const r = await recordOrderItemsForOrder('PPW-UNKNOWN', {
      purchase_units: [
        {
          items: [
            { sku: 'K1-A', unit_amount: { currency_code: 'MUR', value: '100' }, quantity: 1 },
            { sku: 'GHOST-SKU', unit_amount: { currency_code: 'MUR', value: '50' }, quantity: 1 },
          ],
        },
      ],
    });
    expect(r.inserted).toBe(1);
    expect(r.skippedSkus).toEqual(['GHOST-SKU']);
  });

  it('returns schema_missing when products table is undefined', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    const insertSpy = vi
      .spyOn(fakeDb.builder, 'select')
      .mockImplementationOnce(() => fakeDb.builder)
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () =>
            Promise.reject(
              new Error('relation "products" does not exist (SQLSTATE 42P01)'),
            ),
        }),
      }));
    const r = await recordOrderItemsForOrder('PPW-NOSCHEMA', {
      purchase_units: [
        { items: [{ sku: 'K1-A', unit_amount: { currency_code: 'USD', value: '1' }, quantity: 1 }] },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.skippedReason).toBe('schema_missing');
    insertSpy.mockRestore();
  });

  it('flattens items from multiple purchase_units', async () => {
    fakeDb.builder._orderLookup = [{ id: 42 }];
    fakeDb.builder._productLookup = [
      { id: 100, sku: 'A', merchantId: 1, name: 'A' },
      { id: 200, sku: 'B', merchantId: 2, name: 'B' },
    ];
    const r = await recordOrderItemsForOrder('PPW-MULTI', {
      purchase_units: [
        { items: [{ sku: 'A', unit_amount: { currency_code: 'USD', value: '1' }, quantity: 1 }] },
        { items: [{ sku: 'B', unit_amount: { currency_code: 'USD', value: '2' }, quantity: 1 }] },
      ],
    });
    expect(r.inserted).toBe(2);
  });
});
