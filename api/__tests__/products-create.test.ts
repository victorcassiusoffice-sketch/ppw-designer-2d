/**
 * Wellness-Designer-App (c) part 2 — merchant product CREATE tests.
 *
 * Three layers exercised:
 *   1. `productCreateSchema` Zod validation (no DB / no session)
 *   2. `authoriseMerchantSession` Bearer-token parser (no DB / pure-fn)
 *   3. `createMerchantProduct` DB-touching insert with a mock builder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../_db/client.js', () => {
  const builder = {
    _merchantLookup: [] as unknown[],
    _insertReturning: [] as unknown[],
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
      return Promise.resolve(builder._merchantLookup);
    },
    insert(_t: unknown) {
      return {
        values(_v: unknown) {
          return {
            returning(_cols?: unknown) {
              return Promise.resolve(builder._insertReturning);
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
        sku: {},
        name: {},
        category: {},
        priceMinor: {},
        currency: {},
        imageUrl: {},
        ecoCertLevel: {},
      },
    },
    __fake: { builder },
  };
});

vi.mock('../_lib/auditLog.js', () => ({
  drizzleAuditWriter: () => ({
    record: vi.fn(async () => ({ ok: true })),
  }),
}));

import {
  productCreateSchema,
  createMerchantProduct,
  authoriseMerchantSession,
} from '../products';
import { signMerchantSession } from '../_lib/merchantSession';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakeDb: any = await import('../_db/client.js').then((m) => (m as any).__fake);

describe('Wellness-Designer-App (c) / productCreateSchema', () => {
  const validBody = {
    name: 'Vision T600E-02',
    category: 'cardio',
    priceMinor: 1_500_000,
    currency: 'mur',
    // Footprint W×D required since the WD-2D top-down rebuild (2026-07-10).
    widthMm: 1830,
    depthMm: 750,
  };

  it('accepts a minimum-valid body + uppercases the currency', () => {
    const parsed = productCreateSchema.safeParse(validBody);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe('MUR');
    }
  });

  it('accepts a full body with image + dims + eco_cert_level', () => {
    const parsed = productCreateSchema.safeParse({
      ...validBody,
      description: 'Premium folding treadmill',
      widthMm: 1830,
      depthMm: 750,
      heightMm: 1400,
      weightG: 65000,
      imageUrl: 'https://blob.vercel-storage.com/merchants/k1-sport/products/foo.png',
      ecoCertLevel: 'verified-certified',
      region: 'MU',
      sku: 'K1-T600E-02',
      inStockQty: 5,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(productCreateSchema.safeParse({}).success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name: _n, ...rest } = validBody;
    expect(productCreateSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing footprint dimensions (widthMm / depthMm required)', () => {
    const { widthMm: _w, depthMm: _d, ...noDims } = validBody;
    expect(productCreateSchema.safeParse(noDims).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...noDims, widthMm: 100 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...validBody, widthMm: 0 }).success).toBe(false);
  });

  it('rejects negative priceMinor', () => {
    expect(productCreateSchema.safeParse({ ...validBody, priceMinor: -1 }).success).toBe(false);
  });

  it('rejects currency of wrong length', () => {
    expect(productCreateSchema.safeParse({ ...validBody, currency: 'MURX' }).success).toBe(false);
  });

  it('rejects an unknown ecoCertLevel', () => {
    expect(
      productCreateSchema.safeParse({ ...validBody, ecoCertLevel: 'platinum' }).success,
    ).toBe(false);
  });

  it('rejects a non-URL imageUrl', () => {
    expect(productCreateSchema.safeParse({ ...validBody, imageUrl: 'not-a-url' }).success).toBe(
      false,
    );
  });

  it('treats empty-string imageUrl as null', () => {
    const parsed = productCreateSchema.safeParse({ ...validBody, imageUrl: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.imageUrl).toBe(null);
  });

  it('rejects an SKU with disallowed characters', () => {
    expect(productCreateSchema.safeParse({ ...validBody, sku: 'K1 BAD SKU!' }).success).toBe(
      false,
    );
  });

  it('rejects unknown extra fields (strict mode)', () => {
    expect(
      productCreateSchema.safeParse({ ...validBody, internalNote: 'foo' }).success,
    ).toBe(false);
  });
});

describe('Wellness-Designer-App (c) / authoriseMerchantSession', () => {
  const SLUG = 'k1-sport';
  const SECRET = 'test-secret-32-chars-long-aaaaaaaaaaaaaa';

  beforeEach(() => {
    process.env.MERCHANT_SESSION_SECRET = SECRET;
  });

  it('returns ok with verified email for a valid Bearer token', () => {
    const token = signMerchantSession(
      { slug: SLUG, email: 'vic@example.com', exp: Date.now() + 60_000 },
      SECRET,
    );
    const result = authoriseMerchantSession({ authorization: `Bearer ${token}` }, SLUG);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.email).toBe('vic@example.com');
  });

  it('returns 401 missing_session for absent header', () => {
    const result = authoriseMerchantSession({}, SLUG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.error).toBe('missing_session');
    }
  });

  it('returns 401 missing_session for non-Bearer scheme', () => {
    const result = authoriseMerchantSession({ authorization: 'Basic abc123' }, SLUG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('missing_session');
  });

  it('returns 401 invalid_session for a tampered token', () => {
    const token = signMerchantSession(
      { slug: SLUG, email: 'vic@example.com', exp: Date.now() + 60_000 },
      SECRET,
    );
    const tampered = token.slice(0, -2) + 'ff';
    const result = authoriseMerchantSession({ authorization: `Bearer ${tampered}` }, SLUG);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('invalid_session');
  });

  it('returns 403 slug_mismatch when the token is for another merchant', () => {
    const token = signMerchantSession(
      { slug: 'aurora-wellness', email: 'vic@example.com', exp: Date.now() + 60_000 },
      SECRET,
    );
    const result = authoriseMerchantSession({ authorization: `Bearer ${token}` }, SLUG);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.error).toBe('slug_mismatch');
    }
  });

  it('accepts case-insensitive Bearer prefix', () => {
    const token = signMerchantSession(
      { slug: SLUG, email: 'vic@example.com', exp: Date.now() + 60_000 },
      SECRET,
    );
    const result = authoriseMerchantSession({ authorization: `bearer ${token}` }, SLUG);
    expect(result.ok).toBe(true);
  });
});

describe('Wellness-Designer-App (c) / createMerchantProduct DB path', () => {
  beforeEach(() => {
    fakeDb.builder._merchantLookup = [];
    fakeDb.builder._insertReturning = [];
  });

  const validBody = {
    name: 'Vision T600E-02',
    category: 'cardio',
    priceMinor: 1_500_000,
    currency: 'MUR',
    widthMm: 1830,
    depthMm: 750,
  };

  it('returns 404 merchant_not_found when the slug is unknown', async () => {
    fakeDb.builder._merchantLookup = [];
    const result = await createMerchantProduct('ghost-merchant', validBody);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toBe('merchant_not_found');
  });

  it('returns 201 + product on a successful insert', async () => {
    fakeDb.builder._merchantLookup = [{ id: 7 }];
    fakeDb.builder._insertReturning = [
      {
        id: 42,
        sku: 'K1-SPORT-AB12CD34',
        name: validBody.name,
        category: validBody.category,
        priceMinor: validBody.priceMinor,
        currency: validBody.currency,
        imageUrl: null,
        ecoCertLevel: 'none',
      },
    ];
    const result = await createMerchantProduct('k1-sport', validBody);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(201);
    expect(result.product?.id).toBe(42);
    expect(result.product?.ecoCertLevel).toBe('none');
  });

  it('returns 400 on Zod validation failure', async () => {
    const result = await createMerchantProduct('k1-sport', { name: '' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
  });

  it('returns 409 sku_conflict on a duplicate-key insert error', async () => {
    fakeDb.builder._merchantLookup = [{ id: 7 }];
    fakeDb.builder._insertReturning = undefined as never;
    const insertSpy = vi
      .spyOn(fakeDb.builder, 'insert')
      .mockImplementationOnce(() => ({
        values: () => ({
          returning: () =>
            Promise.reject(new Error('duplicate key value violates unique constraint "products_merchant_sku_idx" (SQLSTATE 23505)')),
        }),
      }));
    const result = await createMerchantProduct('k1-sport', { ...validBody, sku: 'EXISTING' });
    expect(result.ok).toBe(false);
    expect(result.status).toBe(409);
    expect(result.error).toBe('sku_conflict');
    insertSpy.mockRestore();
  });
});

describe('productCreateSchema — energy fields (eco / solar 2026-09-04)', () => {
  const base = { name: 'Treadmill', category: 'cardio', priceMinor: 100, currency: 'mur', widthMm: 900, depthMm: 600 };
  it('accepts the optional energy figures and the role enum', () => {
    const r = productCreateSchema.safeParse({ ...base, powerW: 1500, dutyHoursPerDay: 1.5, pvWp: 450, batteryWh: 5000, inverterW: 5000, energyRole: 'consumer' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.powerW).toBe(1500);
  });
  it('rejects negatives, non-integers where whole, out-of-range hours and unknown roles', () => {
    expect(productCreateSchema.safeParse({ ...base, powerW: -1 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...base, pvWp: 12.5 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...base, dutyHoursPerDay: 25 }).success).toBe(false);
    expect(productCreateSchema.safeParse({ ...base, energyRole: 'turbine' }).success).toBe(false);
  });
  it('is unchanged without them', () => {
    expect(productCreateSchema.safeParse(base).success).toBe(true);
  });
});
