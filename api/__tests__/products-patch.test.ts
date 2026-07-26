/**
 * V4 M9.B.3 — PATCH product unit tests.
 *
 * Zod-validation paths cover the per-field accept/reject contract
 * without a DB. The handler-level DB-touching branches reuse the
 * same mock-builder pattern as products-soft-delete.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_db/client.js', () => {
  const builder = {
    _lastResult: [] as unknown[],
    _updatedReturning: [] as unknown[],
    select(_cols?: unknown) {
      return this;
    },
    from(_t: unknown) {
      return this;
    },
    where(_pred: unknown) {
      return this;
    },
    limit(_n: number) {
      return Promise.resolve(builder._lastResult);
    },
    update(_t: unknown) {
      return {
        set(_values: unknown) {
          return {
            where(_pred: unknown) {
              return {
                returning(_cols?: unknown) {
                  return Promise.resolve(builder._updatedReturning);
                },
              };
            },
          };
        },
      };
    },
  };
  return {
    getDb: () => builder,
    schema: {
      merchants: { _name: 'merchants', id: {}, slug: {} },
      products: {
        _name: 'products',
        id: {},
        merchantId: {},
        retiredAt: {},
        updatedAt: {},
        name: {},
        priceMinor: {},
        currency: {},
        inStockQty: {},
        ecoCertLevel: {},
      },
    },
    __fake: { builder },
  };
});

vi.mock('../_lib/auditLog.js', () => ({
  drizzleAuditWriter: () => ({ record: vi.fn(async () => ({ ok: true })) }),
  recordAudit: vi.fn(async () => ({ ok: true })),
}));

import { patchProduct, productPatchSchema, handler } from '../products';
import { signMerchantSession } from '../_lib/merchantSession';
import * as dbClient from '../_db/client.js';

/** Minimal MinRes mock capturing status + json for handler-level tests. */
function mockRes() {
  const out: { status: number | null; body: unknown; ended: boolean } = {
    status: null,
    body: undefined,
    ended: false,
  };
  const res = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(payload: unknown) {
      out.body = payload;
      return res;
    },
    end() {
      out.ended = true;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return { res, out };
}

interface FakeCtx {
  builder: {
    _lastResult: unknown[];
    _updatedReturning: unknown[];
    limit: (n: number) => Promise<unknown[]>;
  };
}

const fake = (dbClient as unknown as { __fake: FakeCtx }).__fake;

describe('productPatchSchema (Zod gate)', () => {
  it('accepts a single name update', () => {
    const r = productPatchSchema.safeParse({ name: 'New name' });
    expect(r.success).toBe(true);
  });

  it('uppercases currency', () => {
    const r = productPatchSchema.safeParse({ currency: 'usd' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.currency).toBe('USD');
  });

  it('rejects negative priceMinor', () => {
    expect(productPatchSchema.safeParse({ priceMinor: -1 }).success).toBe(false);
  });

  it('rejects non-integer priceMinor', () => {
    expect(productPatchSchema.safeParse({ priceMinor: 12.5 }).success).toBe(false);
  });

  it('rejects unknown sku field (sku is immutable)', () => {
    expect(productPatchSchema.safeParse({ sku: 'NEW-SKU' }).success).toBe(false);
  });

  it('rejects unknown status field (status changes go through DELETE)', () => {
    expect(productPatchSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('rejects unknown merchantId field (no cross-merchant moves)', () => {
    expect(productPatchSchema.safeParse({ merchantId: 99 }).success).toBe(false);
  });

  it('rejects unknown supplierRating field (system-managed by W0.D.9 cron)', () => {
    expect(productPatchSchema.safeParse({ supplierRating: 5 }).success).toBe(false);
  });

  it('accepts an eco-cert level enum value', () => {
    expect(productPatchSchema.safeParse({ ecoCertLevel: 'verified-certified' }).success).toBe(true);
  });

  it('rejects unknown eco-cert tier', () => {
    expect(productPatchSchema.safeParse({ ecoCertLevel: 'fake-tier' }).success).toBe(false);
  });

  it('treats empty imageUrl as null (clears the image)', () => {
    const r = productPatchSchema.safeParse({ imageUrl: '' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.imageUrl).toBeNull();
  });

  it('rejects non-URL imageUrl', () => {
    expect(productPatchSchema.safeParse({ imageUrl: 'not a url' }).success).toBe(false);
  });
});

describe('patchProduct (M9.B.3 helper)', () => {
  beforeEach(() => {
    fake.builder._lastResult = [];
    fake.builder._updatedReturning = [];
    fake.builder.limit = async (_n: number) => fake.builder._lastResult;
  });

  it('rejects empty slug → 400', async () => {
    const r = await patchProduct('', 1, { name: 'x' });
    expect(r.status).toBe(400);
  });

  it('rejects non-positive productId → 400', async () => {
    const r = await patchProduct('acme', 0, { name: 'x' });
    expect(r.status).toBe(400);
  });

  it('rejects empty body (no_fields) → 400', async () => {
    const r = await patchProduct('acme', 1, {});
    expect(r.status).toBe(400);
    expect(r.error).toBe('no_fields');
  });

  it('rejects Zod-invalid body → 400 with concatenated error', async () => {
    const r = await patchProduct('acme', 1, { priceMinor: -5 });
    expect(r.status).toBe(400);
    expect(r.error).toMatch(/priceMinor/);
  });

  it('returns 404 merchant_not_found when slug unknown', async () => {
    fake.builder.limit = async () => [];
    const r = await patchProduct('ghost', 1, { name: 'x' });
    expect(r.status).toBe(404);
    expect(r.error).toBe('merchant_not_found');
  });

  it('returns 404 product_not_found when product missing', async () => {
    let call = 0;
    fake.builder.limit = async () => {
      call += 1;
      return call === 1 ? [{ id: 5 }] : [];
    };
    const r = await patchProduct('acme', 99, { name: 'x' });
    expect(r.status).toBe(404);
    expect(r.error).toBe('product_not_found');
  });

  it('returns 403 forbidden when product belongs to different merchant', async () => {
    let call = 0;
    fake.builder.limit = async () => {
      call += 1;
      if (call === 1) return [{ id: 5 }];
      return [{ id: 99, merchantId: 8, retiredAt: null }];
    };
    const r = await patchProduct('acme', 99, { name: 'x' });
    expect(r.status).toBe(403);
  });

  it('returns 409 product_retired when product already soft-deleted', async () => {
    let call = 0;
    fake.builder.limit = async () => {
      call += 1;
      if (call === 1) return [{ id: 5 }];
      return [{ id: 99, merchantId: 5, retiredAt: new Date() }];
    };
    const r = await patchProduct('acme', 99, { name: 'x' });
    expect(r.status).toBe(409);
    expect(r.error).toBe('product_retired');
  });

  it('happy path: returns 200 + updated product subset', async () => {
    let call = 0;
    fake.builder.limit = async () => {
      call += 1;
      if (call === 1) return [{ id: 5 }];
      return [{ id: 99, merchantId: 5, retiredAt: null }];
    };
    fake.builder._updatedReturning = [
      {
        id: 99,
        name: 'Renamed',
        priceMinor: 25000,
        currency: 'MUR',
        inStockQty: 12,
        ecoCertLevel: 'self-declared',
      },
    ];
    const r = await patchProduct('acme', 99, { name: 'Renamed', priceMinor: 25000 });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect(r.product?.id).toBe(99);
    expect(r.product?.name).toBe('Renamed');
    expect(r.product?.priceMinor).toBe(25000);
  });

  it('returns 503 schema_missing on relation/column missing', async () => {
    fake.builder.limit = async () => {
      throw new Error('column "eco_cert_level" does not exist');
    };
    const r = await patchProduct('acme', 1, { name: 'x' });
    expect(r.status).toBe(503);
    expect(r.error).toBe('schema_missing');
  });
});

describe('handler auth gate — PATCH/DELETE require a merchant session (IDOR fix 2026-07-24)', () => {
  it('PATCH without an Authorization header → 401 (no DB write)', async () => {
    fake.builder._updatedReturning = [{ id: 1 }];
    const { res, out } = mockRes();
    await handler(
      { method: 'PATCH', query: { slug: 'acme', id: '1' }, headers: {}, body: { priceMinor: 999 } } as never,
      res as never,
    );
    expect(out.status).toBe(401);
  });

  it('DELETE without an Authorization header → 401', async () => {
    const { res, out } = mockRes();
    await handler(
      { method: 'DELETE', query: { slug: 'acme', id: '1' }, headers: {}, body: undefined } as never,
      res as never,
    );
    expect(out.status).toBe(401);
  });

  it('PATCH for a DIFFERENT merchant than the token → 403 (slug mismatch)', async () => {
    const token = signMerchantSession({ slug: 'other-merchant', email: 'm@x.co', exp: Date.now() + 60_000 });
    const { res, out } = mockRes();
    await handler(
      {
        method: 'PATCH',
        query: { slug: 'acme', id: '1' },
        headers: { authorization: `Bearer ${token}` },
        body: { priceMinor: 999 },
      } as never,
      res as never,
    );
    expect(out.status).toBe(403);
  });

  it('PATCH with a valid session for the slug passes the auth gate (not 401/403)', async () => {
    // Past auth, the fake DB returns no merchant row → 404, proving auth passed.
    fake.builder._lastResult = [];
    const token = signMerchantSession({ slug: 'acme', email: 'm@x.co', exp: Date.now() + 60_000 });
    const { res, out } = mockRes();
    await handler(
      {
        method: 'PATCH',
        query: { slug: 'acme', id: '1' },
        headers: { authorization: `Bearer ${token}` },
        body: { priceMinor: 999 },
      } as never,
      res as never,
    );
    expect(out.status).not.toBe(401);
    expect(out.status).not.toBe(403);
  });
});
