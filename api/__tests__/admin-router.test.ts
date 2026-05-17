/**
 * OMS Wave 4.3 — admin-router dispatch table tests.
 *
 * Exercises the URL-to-handler mapping at the router level. Each
 * downstream handler is mocked so the test asserts ONLY the routing
 * decision (no DB / auth roundtrips).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/admin/merchants/list.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'merchants:list' });
  }),
}));
vi.mock('../lib/admin/merchants/detail.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'merchants:detail' });
  }),
}));
vi.mock('../lib/admin/merchants/approve.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'merchants:approve' });
  }),
}));
vi.mock('../lib/admin/merchants/reject.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'merchants:reject' });
  }),
}));
vi.mock('../lib/admin/orders/list.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'orders:list' });
  }),
}));
vi.mock('../lib/admin/payouts/list.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'payouts:list' });
  }),
}));
vi.mock('../lib/admin/products/list.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'products:list' });
  }),
}));
vi.mock('../lib/admin/products/write.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'products:write' });
  }),
}));
vi.mock('../lib/admin/products/importCsv.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'products:import-csv' });
  }),
}));
vi.mock('../lib/admin/suppliers/list.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'suppliers:list' });
  }),
}));
vi.mock('../lib/admin/suppliers/write.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'suppliers:write' });
  }),
}));
vi.mock('../lib/admin/stats.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'stats' });
  }),
}));
vi.mock('../lib/admin/auditLogList.js', () => ({
  handler: vi.fn(async (_req: unknown, res: { status: (c: number) => { json: (b: unknown) => void } }) => {
    res.status(200).json({ marker: 'audit-log' });
  }),
}));

import handler from '../admin-router';

interface CapturedRes {
  statusCode: number;
  body: unknown;
}
function makeRes(): {
  setHeader: (n: string, v: string) => void;
  status: (c: number) => unknown;
  end: () => void;
  json: (b: unknown) => void;
  statusCode: number;
  body: unknown;
} {
  const captured: CapturedRes = { statusCode: 0, body: null };
  const res: ReturnType<typeof makeRes> = {
    statusCode: 0,
    body: null as unknown,
    setHeader: () => {},
    status(code: number) {
      captured.statusCode = code;
      res.statusCode = code;
      return res;
    },
    end() {},
    json(b: unknown) {
      captured.body = b;
      res.body = b;
    },
  };
  return res;
}

describe('admin-router dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { url: '/api/admin/merchants', method: 'GET', marker: 'merchants:list' },
    { url: '/api/admin/merchants/acme', method: 'GET', marker: 'merchants:detail' },
    { url: '/api/admin/merchants/acme/approve', method: 'POST', marker: 'merchants:approve' },
    { url: '/api/admin/merchants/acme/reject', method: 'POST', marker: 'merchants:reject' },
    { url: '/api/admin/orders', method: 'GET', marker: 'orders:list' },
    { url: '/api/admin/payouts', method: 'GET', marker: 'payouts:list' },
    { url: '/api/admin/products', method: 'GET', marker: 'products:list' },
    { url: '/api/admin/products', method: 'POST', marker: 'products:write' },
    { url: '/api/admin/products/import-csv', method: 'POST', marker: 'products:import-csv' },
    { url: '/api/admin/suppliers', method: 'GET', marker: 'suppliers:list' },
    { url: '/api/admin/suppliers', method: 'PATCH', marker: 'suppliers:write' },
    { url: '/api/admin/stats', method: 'GET', marker: 'stats' },
    { url: '/api/admin/dashboard', method: 'GET', marker: 'stats' },
    { url: '/api/admin/audit-log', method: 'GET', marker: 'audit-log' },
  ])('routes $method $url → $marker', async ({ url, method, marker }) => {
    const res = makeRes();
    await handler({ method, url, headers: {} } as never, res as never);
    expect(res.body).toEqual({ marker });
  });

  it('returns 404 for unknown resource', async () => {
    const res = makeRes();
    await handler({ method: 'GET', url: '/api/admin/nonsense', headers: {} } as never, res as never);
    expect(res.statusCode).toBe(404);
  });
});
