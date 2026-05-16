/**
 * Tests for the W0.D.4 withApi HOF (CQ §05.1).
 *
 * Each path is exercised end-to-end against an in-memory req/res pair
 * with injectable adminDeps, rateLimit, and idempotency.deps so no
 * KV / Clerk / Sentry network calls happen.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { withApi, type WithApiErrorBody } from '../lib/withApi';
import type { CachedResult } from '../lib/idempotency';

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  ended: boolean;
  setHeader(name: string, value: string): void;
  status(code: number): MockRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

function makeRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {},
    body: undefined,
    ended: false,
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    end(payload?: string) {
      this.ended = true;
      if (payload !== undefined && this.body === undefined) this.body = payload;
    },
    json(body: unknown) {
      this.body = body;
      this.ended = true;
    },
  };
  return res;
}

function makeReq(opts: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  return {
    method: opts.method ?? 'POST',
    url: opts.url ?? '/api/test',
    headers: opts.headers ?? {},
    body: opts.body,
  };
}

describe('withApi — request id + handler invocation', () => {
  it('passes raw body when no schema is configured + sets x-request-id', async () => {
    const seen: unknown[] = [];
    const handler = withApi(
      {},
      async (ctx) => {
        seen.push(ctx.body);
        expect(ctx.requestId).toMatch(/^req_/);
        ctx.res.status(200).json({ ok: true, requestId: ctx.requestId });
      },
    );
    const req = makeReq({ body: { foo: 'bar' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(seen).toEqual([{ foo: 'bar' }]);
    expect(res.headers['x-request-id']).toMatch(/^req_/);
  });
});

describe('withApi — method gate', () => {
  it('returns 405 when method is not allowed', async () => {
    const handler = withApi({ method: 'POST' }, async () => {
      throw new Error('handler should not run');
    });
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    const body = res.body as WithApiErrorBody;
    expect(body.code).toBe('method_not_allowed');
    expect(res.headers['allow']).toBe('POST');
  });

  it('accepts multiple allowed methods', async () => {
    const handler = withApi({ method: ['POST', 'PATCH'] }, async (ctx) => {
      ctx.res.status(200).json({ ok: true });
    });
    const req = makeReq({ method: 'PATCH' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
  });
});

describe('withApi — rate limit', () => {
  it('returns 429 when limiter rejects', async () => {
    const handler = withApi(
      {
        rateLimit: {
          keyFn: () => 'ip:1.2.3.4',
          check: async () => ({ success: false, retryAfterSec: 42, limit: 3 }),
        },
      },
      async () => {
        throw new Error('handler should not run');
      },
    );
    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('42');
    const body = res.body as WithApiErrorBody;
    expect(body.code).toBe('rate_limited');
    expect(body.requestId).toMatch(/^req_/);
  });

  it('uses Math.max(1, retryAfterSec) so a zero retry never sends Retry-After: 0', async () => {
    const handler = withApi(
      {
        rateLimit: {
          keyFn: () => 'ip:1',
          check: async () => ({ success: false, retryAfterSec: 0, limit: 1 }),
        },
      },
      async () => {},
    );
    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);
    expect(res.headers['retry-after']).toBe('1');
  });

  it('passes through when limiter allows', async () => {
    let ran = false;
    const handler = withApi(
      {
        rateLimit: {
          keyFn: () => 'ip:1',
          check: async () => ({ success: true, retryAfterSec: 0, limit: 100 }),
        },
      },
      async (ctx) => {
        ran = true;
        ctx.res.status(200).json({ ok: true });
      },
    );
    const req = makeReq({});
    const res = makeRes();
    await handler(req, res);
    expect(ran).toBe(true);
    expect(res.statusCode).toBe(200);
  });
});

describe('withApi — admin auth', () => {
  const okDeps = {
    verify: async (_token: string) => ({ sub: 'user_1', email: 'admin@ppwellness.co' }),
    lookupAdmin: async () => null,
  };

  it('returns 500 when auth=admin but adminDeps missing', async () => {
    const handler = withApi({ auth: 'admin' }, async () => {});
    const req = makeReq({ headers: { authorization: 'Bearer t' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect((res.body as WithApiErrorBody).code).toBe('internal_error');
  });

  it('returns 401 when Bearer token is missing', async () => {
    const handler = withApi({ auth: 'admin', adminDeps: okDeps }, async () => {});
    const req = makeReq({ headers: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect((res.body as WithApiErrorBody).code).toBe('unauthorized');
  });

  it('returns 403 when token verifies but email is not on the allowlist and not in admins table', async () => {
    const handler = withApi(
      {
        auth: 'admin',
        adminDeps: {
          verify: async () => ({ sub: 'user_2', email: 'random@example.com' }),
          lookupAdmin: async () => null,
        },
      },
      async () => {},
    );
    const req = makeReq({ headers: { authorization: 'Bearer t' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(403);
    expect((res.body as WithApiErrorBody).code).toBe('forbidden');
  });

  it('hands the AuthorisedAdmin to the handler on success', async () => {
    let captured: unknown = null;
    const handler = withApi(
      {
        auth: 'admin',
        adminDeps: {
          verify: async () => ({ sub: 'user_3', email: 'victor@ppwellness.co' }),
          lookupAdmin: async () => null,
        },
      },
      async (ctx) => {
        captured = ctx.admin;
        ctx.res.status(200).json({ ok: true });
      },
    );
    const req = makeReq({ headers: { authorization: 'Bearer t' } });
    const res = makeRes();
    await handler(req, res);
    expect(captured).toMatchObject({
      clerkUserId: 'user_3',
      email: 'victor@ppwellness.co',
      source: 'allowlist',
      role: 'super_admin',
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('withApi — Zod validation', () => {
  const schema = z.object({ name: z.string().min(2), count: z.number().int().positive() });

  it('returns 400 with flattened details on schema mismatch', async () => {
    const handler = withApi({ schema }, async () => {});
    const req = makeReq({ body: { name: 'a', count: -1 } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    const body = res.body as WithApiErrorBody;
    expect(body.code).toBe('validation_error');
    expect(body.details).toBeDefined();
  });

  it('passes parsed (typed) body to handler', async () => {
    const handler = withApi({ schema }, async (ctx) => {
      // ctx.body is typed as { name: string; count: number }
      ctx.res.status(200).json({ name: ctx.body.name, count: ctx.body.count });
    });
    const req = makeReq({ body: { name: 'Aurora', count: 2 } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ name: 'Aurora', count: 2 });
  });
});

describe('withApi — idempotency', () => {
  const endpoint = 'test-endpoint';
  const cachedResult: CachedResult = {
    status: 201,
    body: { ok: true, id: 'order_123' },
    bodyHash: 'fake-hash',
  };

  it('replays the cached response on replay verdict', async () => {
    const check = vi.fn().mockResolvedValue({ kind: 'replay', cached: cachedResult });
    const store = vi.fn();
    const handler = withApi(
      { idempotency: { endpoint, deps: { check, store } } },
      async () => {
        throw new Error('handler should not run on replay');
      },
    );
    const req = makeReq({
      headers: { 'idempotency-key': 'idk-12345678' },
      body: { foo: 'bar' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, id: 'order_123' });
    expect(check).toHaveBeenCalledTimes(1);
    expect(store).not.toHaveBeenCalled();
  });

  it('returns 409 on conflict verdict', async () => {
    const check = vi.fn().mockResolvedValue({ kind: 'conflict' });
    const store = vi.fn();
    const handler = withApi(
      { idempotency: { endpoint, deps: { check, store } } },
      async () => {
        throw new Error('handler should not run on conflict');
      },
    );
    const req = makeReq({
      headers: { 'idempotency-key': 'idk-12345678' },
      body: { foo: 'bar' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(409);
    expect((res.body as WithApiErrorBody).code).toBe('idempotency_conflict');
    expect(store).not.toHaveBeenCalled();
  });

  it('stores the captured response on fresh verdict', async () => {
    const check = vi.fn().mockResolvedValue({ kind: 'fresh' });
    const store = vi.fn().mockResolvedValue(undefined);
    const handler = withApi(
      { idempotency: { endpoint, deps: { check, store } } },
      async (ctx) => {
        ctx.res.status(201).json({ ok: true, id: 'order_42' });
      },
    );
    const req = makeReq({
      headers: { 'idempotency-key': 'idk-12345678' },
      body: { foo: 'bar' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ ok: true, id: 'order_42' });
    expect(store).toHaveBeenCalledTimes(1);
    const [calledEndpoint, calledKey, calledResult] = store.mock.calls[0];
    expect(calledEndpoint).toBe(endpoint);
    expect(calledKey).toBe('idk-12345678');
    expect((calledResult as CachedResult).status).toBe(201);
    expect((calledResult as CachedResult).body).toEqual({ ok: true, id: 'order_42' });
  });

  it('skips idempotency entirely on GET requests', async () => {
    const check = vi.fn();
    const handler = withApi(
      { idempotency: { endpoint, deps: { check, store: vi.fn() } } },
      async (ctx) => {
        ctx.res.status(200).json({ ok: true });
      },
    );
    const req = makeReq({ method: 'GET', headers: { 'idempotency-key': 'idk-12345678' } });
    const res = makeRes();
    await handler(req, res);
    expect(check).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('skips idempotency when no Idempotency-Key header is present', async () => {
    const check = vi.fn();
    const handler = withApi(
      { idempotency: { endpoint, deps: { check, store: vi.fn() } } },
      async (ctx) => {
        ctx.res.status(201).json({ ok: true });
      },
    );
    const req = makeReq({ headers: {}, body: { x: 1 } });
    const res = makeRes();
    await handler(req, res);
    expect(check).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(201);
  });

  it('does not block the response when the store call throws', async () => {
    const check = vi.fn().mockResolvedValue({ kind: 'fresh' });
    const store = vi.fn().mockRejectedValue(new Error('redis down'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handler = withApi(
      { idempotency: { endpoint, deps: { check, store } } },
      async (ctx) => {
        ctx.res.status(200).json({ ok: true });
      },
    );
    const req = makeReq({
      headers: { 'idempotency-key': 'idk-12345678' },
      body: { foo: 'bar' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('withApi — composition order', () => {
  it('rate limit fires before auth (abusive callers do not pay for token verification)', async () => {
    const verifyMock = vi.fn();
    const handler = withApi(
      {
        auth: 'admin',
        adminDeps: { verify: verifyMock as never, lookupAdmin: async () => null },
        rateLimit: {
          keyFn: () => 'ip:1',
          check: async () => ({ success: false, retryAfterSec: 30, limit: 3 }),
        },
      },
      async () => {},
    );
    const req = makeReq({ headers: { authorization: 'Bearer t' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('idempotency replay short-circuits before Zod validation', async () => {
    const cached: CachedResult = { status: 200, body: { cached: true }, bodyHash: 'h' };
    const check = vi.fn().mockResolvedValue({ kind: 'replay', cached });
    const schema = z.object({ required: z.string() });
    const handler = withApi(
      {
        schema,
        idempotency: { endpoint: 'x', deps: { check, store: vi.fn() } },
      },
      async () => {
        throw new Error('handler should not run');
      },
    );
    // Body does NOT satisfy schema — but replay wins first.
    const req = makeReq({
      headers: { 'idempotency-key': 'idk-12345678' },
      body: { random: 'not-required' },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ cached: true });
  });
});
