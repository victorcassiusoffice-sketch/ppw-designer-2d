import { describe, it, expect, vi } from 'vitest';
import { parseOrdersFilters } from '../lib/admin/orders/list';

describe('parseOrdersFilters', () => {
  it('defaults to page 1 / perPage 25 with no filters', () => {
    expect(parseOrdersFilters({})).toEqual({
      page: 1,
      perPage: 25,
      rail: null,
      status: null,
      from: null,
      to: null,
    });
  });

  it('clamps perPage to 100', () => {
    expect(parseOrdersFilters({ perPage: '1000' }).perPage).toBe(100);
  });

  it('floors fractional page numbers', () => {
    expect(parseOrdersFilters({ page: '3.7' }).page).toBe(3);
  });

  it('rejects non-finite page → falls back to 1', () => {
    expect(parseOrdersFilters({ page: 'abc' }).page).toBe(1);
  });

  it('preserves rail/status/from/to', () => {
    const out = parseOrdersFilters({
      rail: 'paypal',
      status: 'paid',
      from: '2026-01-01',
      to: '2026-03-01',
    });
    expect(out.rail).toBe('paypal');
    expect(out.status).toBe('paid');
    expect(out.from).toBe('2026-01-01');
    expect(out.to).toBe('2026-03-01');
  });

  it('takes the first value for array query params', () => {
    expect(parseOrdersFilters({ rail: ['stripe', 'paypal'] }).rail).toBe('stripe');
  });
});

describe('GET /api/admin/orders — handler shape', () => {
  it('returns 405 for non-GET', async () => {
    const mod = await import('../lib/admin/orders/list');
    const handler = mod.default;
    let status = 0;
    let ended = false;
    const res = {
      setHeader: vi.fn(),
      status(c: number) {
        status = c;
        return res as never;
      },
      end() {
        ended = true;
      },
      json: vi.fn(),
    };
    await handler({ method: 'POST', headers: {} }, res as never);
    expect(status).toBe(405);
    expect(ended).toBe(true);
  });

  it('returns 401 without a Bearer token', async () => {
    const mod = await import('../lib/admin/orders/list');
    const handler = mod.default;
    let status = 0;
    let body: unknown = null;
    const res = {
      setHeader: vi.fn(),
      status(c: number) {
        status = c;
        return res as never;
      },
      end: vi.fn(),
      json(b: unknown) {
        body = b;
      },
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

describe('fetchOrdersPage schema-missing fallback', () => {
  it('returns empty page when relation does not exist', async () => {
    // We can't actually run a query here without a DB. Validate by
    // re-importing and stubbing getDb to throw the undefined_table error.
    vi.resetModules();
    vi.doMock('../db/client.js', () => ({
      getDb: () => ({
        execute: async () => {
          throw new Error('relation "orders" does not exist');
        },
      }),
      schema: {},
    }));
    const { fetchOrdersPage } = await import('../lib/admin/orders/list');
    const out = await fetchOrdersPage({
      page: 1,
      perPage: 25,
      rail: null,
      status: null,
      from: null,
      to: null,
    });
    expect(out.schemaMissing).toBe(true);
    expect(out.items).toEqual([]);
    expect(out.total).toBe(0);
    vi.doUnmock('../db/client.js');
    vi.resetModules();
  });
});
