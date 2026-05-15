import { describe, it, expect, vi } from 'vitest';
import { __testing } from '../lib/admin/merchants/detail';

describe('admin/merchants/detail — pickSlug', () => {
  it('reads slug from query.slug', () => {
    expect(__testing.pickSlug({ headers: {}, query: { slug: 'aurora' } })).toBe('aurora');
  });

  it('falls back to query.id', () => {
    expect(__testing.pickSlug({ headers: {}, query: { id: '42' } })).toBe('42');
  });

  it('falls back to the last URL segment when query is empty', () => {
    expect(
      __testing.pickSlug({
        headers: {},
        query: {},
        url: '/api/admin/merchants/aurora-co?ignored=true',
      }),
    ).toBe('aurora-co');
  });

  it('returns null when slug is the literal "merchants"', () => {
    expect(__testing.pickSlug({ headers: {}, query: {}, url: '/api/admin/merchants' })).toBe(null);
  });

  it('decodes URL-encoded slugs', () => {
    expect(
      __testing.pickSlug({ headers: {}, query: {}, url: '/api/admin/merchants/foo%20bar' }),
    ).toBe('foo bar');
  });

  it('returns null when nothing is provided', () => {
    expect(__testing.pickSlug({ headers: {} })).toBe(null);
  });
});

describe('admin/merchants/detail — fetchStripeAccount', () => {
  it('returns null when STRIPE_SECRET_KEY is unset', async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const out = await __testing.fetchStripeAccount('acct_test');
      expect(out).toBe(null);
    } finally {
      if (prev !== undefined) process.env.STRIPE_SECRET_KEY = prev;
    }
  });
});

// Auth-gate integration test — we route the live handler through a
// captured spy by mocking authoriseAdminWithLive. The handler itself
// uses live deps; we just verify the 401 path doesn't leak data.
describe('admin/merchants/detail — auth gate', () => {
  it('returns 401 when Authorization header is missing', async () => {
    // Import handler lazily so we can swap the auth helper first.
    const mod = await import('../lib/admin/merchants/detail');
    const handler = mod.handler;

    const calls: Array<{ status: number; body: unknown }> = [];
    let lastStatus = 0;
    const res = {
      setHeader: vi.fn(),
      status(code: number) {
        lastStatus = code;
        return res as unknown as { json: (b: unknown) => void; end: () => void; status: (c: number) => unknown; setHeader: (n: string, v: string) => void };
      },
      end: vi.fn(),
      json(body: unknown) {
        calls.push({ status: lastStatus, body });
      },
    };

    // No CLERK_SECRET_KEY → authoriseAdminWithLive throws inside
    // verifyClerkSessionToken. The handler should still produce a
    // structured 401-ish response, not a 5xx leak.
    const prevClerk = process.env.CLERK_SECRET_KEY;
    const prevDb = process.env.DATABASE_URL;
    process.env.CLERK_SECRET_KEY = 'sk_test_dummy';
    process.env.DATABASE_URL = 'postgres://test:test@localhost/test';
    try {
      await handler({ method: 'GET', headers: {}, query: { slug: 'x' } }, res as never);
    } finally {
      if (prevClerk === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = prevClerk;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }

    expect(calls[0]?.status).toBe(401);
  });

  it('returns 405 for non-GET', async () => {
    const mod = await import('../lib/admin/merchants/detail');
    const handler = mod.handler;
    const allowSpy = vi.fn();
    let lastStatus = 0;
    let ended = false;
    const res = {
      setHeader(name: string, value: string) {
        allowSpy(name, value);
      },
      status(code: number) {
        lastStatus = code;
        return res as never;
      },
      end() {
        ended = true;
      },
      json: vi.fn(),
    };
    await handler({ method: 'POST', headers: {} }, res as never);
    expect(lastStatus).toBe(405);
    expect(ended).toBe(true);
    expect(allowSpy).toHaveBeenCalledWith('Allow', 'GET, OPTIONS');
  });
});
