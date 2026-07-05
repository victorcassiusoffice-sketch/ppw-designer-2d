import { describe, it, expect, vi } from 'vitest';
import { validateCreate, validateUpdate } from '../_lib/admin/products/write';

describe('admin products validateCreate', () => {
  const valid = {
    merchantId: 1,
    sku: 'ABC-001',
    name: 'Ice Bath Pro',
    category: 'ice_baths',
    priceMinor: 12500,
    currency: 'USD',
  };

  it('accepts a minimal valid payload', () => {
    const r = validateCreate(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.status).toBe('draft');
      expect(r.data.currency).toBe('USD');
    }
  });

  it('uppercases currency', () => {
    const r = validateCreate({ ...valid, currency: 'mur' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.currency).toBe('MUR');
  });

  it('rejects negative priceMinor', () => {
    const r = validateCreate({ ...valid, priceMinor: -1 });
    expect(r.ok).toBe(false);
  });

  it('rejects fractional priceMinor', () => {
    const r = validateCreate({ ...valid, priceMinor: 12.5 });
    expect(r.ok).toBe(false);
  });

  it('rejects empty sku', () => {
    const r = validateCreate({ ...valid, sku: '' });
    expect(r.ok).toBe(false);
  });

  it('rejects sku >80 chars', () => {
    const r = validateCreate({ ...valid, sku: 'x'.repeat(81) });
    expect(r.ok).toBe(false);
  });

  it('rejects 4-letter currency', () => {
    const r = validateCreate({ ...valid, currency: 'EURO' });
    expect(r.ok).toBe(false);
  });

  it('rejects negative merchantId', () => {
    const r = validateCreate({ ...valid, merchantId: -1 });
    expect(r.ok).toBe(false);
  });

  it('rejects bad status', () => {
    const r = validateCreate({ ...valid, status: 'frozen' as never });
    expect(r.ok).toBe(false);
  });

  it('floors fractional dimensions', () => {
    const r = validateCreate({ ...valid, widthMm: 1500.7, depthMm: 800.2, heightMm: 600 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.widthMm).toBe(1500);
      expect(r.data.depthMm).toBe(800);
      expect(r.data.heightMm).toBe(600);
    }
  });
});

describe('admin products validateUpdate', () => {
  it('rejects empty payload', () => {
    expect(validateUpdate({}).ok).toBe(false);
  });

  it('accepts a single status field', () => {
    const r = validateUpdate({ status: 'active' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe('active');
  });

  it('rejects bad status', () => {
    expect(validateUpdate({ status: 'frozen' as never }).ok).toBe(false);
  });

  it('rejects negative priceMinor on update', () => {
    expect(validateUpdate({ priceMinor: -50 }).ok).toBe(false);
  });

  it('uppercases currency on update', () => {
    const r = validateUpdate({ currency: 'gbp' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.currency).toBe('GBP');
  });
});

describe('admin products write handler — auth + method gate', () => {
  it('returns 405 for GET', async () => {
    const mod = await import('../_lib/admin/products/write');
    const handler = mod.handler;
    let status = 0;
    let ended = false;
    const res = {
      setHeader: vi.fn(),
      status(c: number) { status = c; return res as never; },
      end() { ended = true; },
      json: vi.fn(),
    };
    await handler({ method: 'GET', headers: {} }, res as never);
    expect(status).toBe(405);
    expect(ended).toBe(true);
  });

  it('returns 401 without Bearer for POST', async () => {
    const mod = await import('../_lib/admin/products/write');
    const handler = mod.handler;
    let status = 0;
    const res = {
      setHeader: vi.fn(),
      status(c: number) { status = c; return res as never; },
      end: vi.fn(),
      json: vi.fn(),
    };
    const prevClerk = process.env.CLERK_SECRET_KEY;
    const prevDb = process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
    try {
      await handler({ method: 'POST', headers: {}, body: {} }, res as never);
    } finally {
      if (prevClerk === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = prevClerk;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
    expect(status).toBe(401);
  });
});
