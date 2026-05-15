import { describe, it, expect, vi } from 'vitest';
import { parsePayoutFilters } from '../admin/payouts/list';

describe('parsePayoutFilters', () => {
  it('defaults', () => {
    expect(parsePayoutFilters({})).toEqual({
      page: 1,
      perPage: 25,
      status: null,
      merchantId: null,
    });
  });

  it('preserves numeric merchantId', () => {
    expect(parsePayoutFilters({ merchantId: '42' }).merchantId).toBe(42);
  });

  it('rejects non-numeric merchantId', () => {
    expect(parsePayoutFilters({ merchantId: 'abc' }).merchantId).toBe(null);
  });

  it('clamps perPage to 100', () => {
    expect(parsePayoutFilters({ perPage: '99999' }).perPage).toBe(100);
  });
});

describe('GET /api/admin/payouts — handler shape', () => {
  it('returns 405 for non-GET', async () => {
    const mod = await import('../admin/payouts/list');
    const handler = mod.default;
    let status = 0;
    const res = {
      setHeader: vi.fn(),
      status(c: number) {
        status = c;
        return res as never;
      },
      end: vi.fn(),
      json: vi.fn(),
    };
    await handler({ method: 'DELETE', headers: {} }, res as never);
    expect(status).toBe(405);
  });

  it('returns 401 without a Bearer token', async () => {
    const mod = await import('../admin/payouts/list');
    const handler = mod.default;
    let status = 0;
    const res = {
      setHeader: vi.fn(),
      status(c: number) {
        status = c;
        return res as never;
      },
      end: vi.fn(),
      json: vi.fn(),
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
  });
});

describe('fetchPayoutsPage — empty fixture (schema-missing)', () => {
  it('returns empty page when relation does not exist', async () => {
    vi.resetModules();
    vi.doMock('../db/client.js', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  offset: async () => {
                    throw new Error('relation "payout_queue" does not exist');
                  },
                }),
              }),
            }),
          }),
        }),
        execute: async () => {
          throw new Error('relation "payout_queue" does not exist');
        },
      }),
      schema: {
        payoutQueue: {
          status: {},
          merchantId: {},
          scheduledFor: {},
        },
      },
    }));
    const { fetchPayoutsPage } = await import('../admin/payouts/list');
    const out = await fetchPayoutsPage({
      page: 1,
      perPage: 25,
      status: null,
      merchantId: null,
    });
    expect(out.schemaMissing).toBe(true);
    expect(out.items).toEqual([]);
    expect(out.total).toBe(0);
    vi.doUnmock('../db/client.js');
    vi.resetModules();
  });
});
