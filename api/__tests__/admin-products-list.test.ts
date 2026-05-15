import { describe, it, expect, vi } from 'vitest';
import { parseAdminProductFilters } from '../lib/admin/products/list';

describe('parseAdminProductFilters', () => {
  it('defaults', () => {
    expect(parseAdminProductFilters({})).toEqual({
      status: null,
      category: null,
      merchantId: null,
      limit: 50,
      offset: 0,
    });
  });

  it('clamps limit to 200', () => {
    expect(parseAdminProductFilters({ limit: '500' }).limit).toBe(200);
  });

  it('parses numeric merchantId', () => {
    expect(parseAdminProductFilters({ merchantId: '42' }).merchantId).toBe(42);
  });

  it('rejects non-numeric merchantId', () => {
    expect(parseAdminProductFilters({ merchantId: 'abc' }).merchantId).toBeNull();
  });

  it('preserves status + category', () => {
    expect(parseAdminProductFilters({ status: 'active', category: 'plants' })).toMatchObject({
      status: 'active',
      category: 'plants',
    });
  });
});

describe('GET /api/admin/products handler', () => {
  it('returns 405 for non-GET', async () => {
    const mod = await import('../lib/admin/products/list');
    const handler = mod.handler;
    let status = 0;
    let ended = false;
    const res = {
      setHeader: vi.fn(),
      status(c: number) { status = c; return res as never; },
      end() { ended = true; },
      json: vi.fn(),
    };
    await handler({ method: 'POST', headers: {} }, res as never);
    expect(status).toBe(405);
    expect(ended).toBe(true);
  });

  it('returns 401 without Bearer token', async () => {
    const mod = await import('../lib/admin/products/list');
    const handler = mod.handler;
    let status = 0;
    let body: unknown = null;
    const res = {
      setHeader: vi.fn(),
      status(c: number) { status = c; return res as never; },
      end: vi.fn(),
      json(b: unknown) { body = b; },
    };
    const prevClerk = process.env.CLERK_SECRET_KEY;
    const prevDb = process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
    try {
      await handler({ method: 'GET', headers: {}, query: {} }, res as never);
    } finally {
      if (prevClerk === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = prevClerk;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
    expect(status).toBe(401);
    expect(body).toMatchObject({ error: expect.any(String) });
  });
});
