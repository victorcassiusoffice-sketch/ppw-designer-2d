/**
 * V4 M9.B.4 — soft-delete handler tests.
 *
 * Input-validation paths can run without a DB (handler short-circuits
 * the bad inputs before any drizzle call). DB-touching branches mock
 * `getDb()` + `drizzleAuditWriter()` to cover the four state
 * transitions: merchant-not-found, product-not-found, slug-mismatch,
 * success.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_db/client.js', () => {
  const fakeMerchants = new Map<string, { id: number }>();
  const fakeProducts = new Map<number, { id: number; merchantId: number; retiredAt: Date | null }>();
  const updates: Array<{ id: number; merchantId: number; retiredAt: Date }> = [];

  const builder = {
    _table: '' as 'merchants' | 'products',
    _filters: {} as Record<string, unknown>,
    select(_cols?: unknown) {
      return this;
    },
    from(t: { _name?: string }) {
      this._table = t._name === 'products' ? 'products' : 'merchants';
      return this;
    },
    where(_pred: unknown) {
      // The actual predicate is opaque here — the test seeds query
      // intent through helpers below.
      return this;
    },
    limit(_n: number) {
      return Promise.resolve(builder._lastResult);
    },
    _lastResult: [] as unknown[],
    update(_t: { _name?: string }) {
      return {
        set(values: { retiredAt: Date }) {
          return {
            where(_pred: unknown) {
              updates.push({ id: builder._updateId, merchantId: builder._updateMerchantId, retiredAt: values.retiredAt });
              return Promise.resolve(undefined);
            },
          };
        },
      };
    },
    _updateId: 0,
    _updateMerchantId: 0,
  };

  return {
    getDb: () => builder,
    schema: {
      merchants: { _name: 'merchants', id: {}, slug: {} },
      products: { _name: 'products', id: {}, merchantId: {}, retiredAt: {}, updatedAt: {} },
    },
    __fake: { fakeMerchants, fakeProducts, updates, builder },
  };
});

vi.mock('../_lib/auditLog.js', () => ({
  drizzleAuditWriter: () => ({ record: vi.fn(async () => ({ ok: true })) }),
  recordAudit: vi.fn(async () => ({ ok: true })),
}));

// Import AFTER mocks so the module sees the mocked client.
import { softDeleteProduct } from '../products';
import * as dbClient from '../_db/client.js';

interface FakeContext {
  builder: {
    _lastResult: unknown[];
    _updateId: number;
    _updateMerchantId: number;
  };
}

const fake = (dbClient as unknown as { __fake: FakeContext }).__fake;

describe('softDeleteProduct (M9.B.4)', () => {
  beforeEach(() => {
    fake.builder._lastResult = [];
  });

  it('rejects empty slug with 400', async () => {
    const r = await softDeleteProduct('', 1);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });

  it('rejects non-positive productId with 400', async () => {
    const r = await softDeleteProduct('acme', 0);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
    const r2 = await softDeleteProduct('acme', -3);
    expect(r2.status).toBe(400);
  });

  it('returns 404 merchant_not_found when slug has no row', async () => {
    fake.builder._lastResult = []; // merchant query → empty
    const r = await softDeleteProduct('ghost', 7);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(404);
    expect(r.error).toBe('merchant_not_found');
  });

  it('returns 404 product_not_found when product missing', async () => {
    let call = 0;
    const origLimit = fake.builder._lastResult;
    const builder = fake.builder as unknown as { limit: (n: number) => Promise<unknown[]> };
    builder.limit = async (_n: number) => {
      call += 1;
      if (call === 1) return [{ id: 5 }]; // merchant exists
      return []; // product missing
    };
    const r = await softDeleteProduct('acme', 999);
    expect(r.status).toBe(404);
    expect(r.error).toBe('product_not_found');
    // restore default
    builder.limit = async () => origLimit;
  });

  it('returns 403 forbidden when product belongs to a different merchant', async () => {
    let call = 0;
    const builder = fake.builder as unknown as { limit: (n: number) => Promise<unknown[]> };
    builder.limit = async () => {
      call += 1;
      if (call === 1) return [{ id: 5 }];
      return [{ id: 999, merchantId: 8 /* different */, retiredAt: null }];
    };
    const r = await softDeleteProduct('acme', 999);
    expect(r.status).toBe(403);
    expect(r.error).toBe('forbidden');
  });

  it('returns 204 idempotent when product already retired', async () => {
    let call = 0;
    const existingRetiredAt = new Date('2026-01-01T00:00:00Z');
    const builder = fake.builder as unknown as { limit: (n: number) => Promise<unknown[]> };
    builder.limit = async () => {
      call += 1;
      if (call === 1) return [{ id: 5 }];
      return [{ id: 999, merchantId: 5, retiredAt: existingRetiredAt }];
    };
    const r = await softDeleteProduct('acme', 999);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(204);
    expect(r.retiredAt).toEqual(existingRetiredAt);
  });

  it('soft-deletes a live product owned by the slug merchant — returns 204 + sets retiredAt', async () => {
    let call = 0;
    const builder = fake.builder as unknown as { limit: (n: number) => Promise<unknown[]> };
    builder.limit = async () => {
      call += 1;
      if (call === 1) return [{ id: 5 }];
      return [{ id: 999, merchantId: 5, retiredAt: null }];
    };
    const r = await softDeleteProduct('acme', 999);
    expect(r.ok).toBe(true);
    expect(r.status).toBe(204);
    expect(r.retiredAt).toBeInstanceOf(Date);
  });

  it('returns 503 schema_missing when the table/column does not exist', async () => {
    const builder = fake.builder as unknown as { limit: (n: number) => Promise<unknown[]> };
    builder.limit = async () => {
      throw new Error('relation "products" does not exist');
    };
    const r = await softDeleteProduct('acme', 999);
    expect(r.status).toBe(503);
    expect(r.error).toBe('schema_missing');
  });
});
