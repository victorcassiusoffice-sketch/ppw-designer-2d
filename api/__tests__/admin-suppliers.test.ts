import { describe, it, expect, vi } from 'vitest';
import { parseAdminSupplierFilters } from '../lib/admin/suppliers/list';
import { validateCreate, validateUpdate } from '../lib/admin/suppliers/write';

describe('parseAdminSupplierFilters', () => {
  it('defaults', () => {
    expect(parseAdminSupplierFilters({})).toEqual({
      status: null,
      merchantId: null,
      limit: 50,
      offset: 0,
    });
  });

  it('clamps limit to 200', () => {
    expect(parseAdminSupplierFilters({ limit: '500' }).limit).toBe(200);
  });

  it('parses numeric merchantId', () => {
    expect(parseAdminSupplierFilters({ merchantId: '7' }).merchantId).toBe(7);
  });
});

describe('admin suppliers validateCreate', () => {
  const valid = {
    merchantId: 1,
    name: 'Acme Fulfilment',
    contactEmail: 'ops@acme.example',
    country: 'mu',
  };

  it('accepts valid payload + uppercases country', () => {
    const r = validateCreate(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.country).toBe('MU');
      expect(r.data.status).toBe('pending');
    }
  });

  it('lowercases email', () => {
    const r = validateCreate({ ...valid, contactEmail: 'OPS@ACME.EXAMPLE' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.contactEmail).toBe('ops@acme.example');
  });

  it('rejects bad email', () => {
    expect(validateCreate({ ...valid, contactEmail: 'not-an-email' }).ok).toBe(false);
  });

  it('rejects 3-letter country', () => {
    expect(validateCreate({ ...valid, country: 'MUS' }).ok).toBe(false);
  });

  it('rejects empty name', () => {
    expect(validateCreate({ ...valid, name: '' }).ok).toBe(false);
  });

  it('rejects bad status', () => {
    expect(validateCreate({ ...valid, status: 'frozen' as never }).ok).toBe(false);
  });
});

describe('admin suppliers validateUpdate', () => {
  it('rejects empty payload', () => {
    expect(validateUpdate({}).ok).toBe(false);
  });

  it('accepts single status', () => {
    const r = validateUpdate({ status: 'active' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe('active');
  });

  it('uppercases country on update', () => {
    const r = validateUpdate({ country: 'gb' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.country).toBe('GB');
  });
});

describe('admin suppliers handler gates', () => {
  it('list returns 405 for non-GET', async () => {
    const mod = await import('../lib/admin/suppliers/list');
    const handler = mod.default;
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

  it('write returns 405 for GET', async () => {
    const mod = await import('../lib/admin/suppliers/write');
    const handler = mod.default;
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

  it('list returns 401 without Bearer', async () => {
    const mod = await import('../lib/admin/suppliers/list');
    const handler = mod.default;
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
      await handler({ method: 'GET', headers: {}, query: {} }, res as never);
    } finally {
      if (prevClerk === undefined) delete process.env.CLERK_SECRET_KEY;
      else process.env.CLERK_SECRET_KEY = prevClerk;
      if (prevDb === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = prevDb;
    }
    expect(status).toBe(401);
  });

  it('write returns 401 without Bearer for POST', async () => {
    const mod = await import('../lib/admin/suppliers/write');
    const handler = mod.default;
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
