import { describe, it, expect, vi } from 'vitest';
import { parseProductFilters } from '../products';

describe('parseProductFilters', () => {
  it('defaults to limit=24 offset=0 no filters', () => {
    expect(parseProductFilters({})).toEqual({
      category: null,
      region: null,
      merchantSlug: null,
      limit: 24,
      offset: 0,
    });
  });

  it('clamps limit to 100', () => {
    expect(parseProductFilters({ limit: '500' }).limit).toBe(100);
  });

  it('preserves category + region', () => {
    expect(parseProductFilters({ category: 'ice_baths', region: 'MU' })).toMatchObject({
      category: 'ice_baths',
      region: 'MU',
    });
  });

  it('extracts merchant slug from the slug query param (M9.B.2 rewrite)', () => {
    expect(parseProductFilters({ slug: 'acme-ergo' }).merchantSlug).toBe('acme-ergo');
  });

  it('trims whitespace + ignores empty merchant slug', () => {
    expect(parseProductFilters({ slug: '   ' }).merchantSlug).toBeNull();
    expect(parseProductFilters({ slug: '  zen-saunas  ' }).merchantSlug).toBe('zen-saunas');
  });

  it('takes the first value for array slug (Vercel may duplicate on rewrite)', () => {
    expect(parseProductFilters({ slug: ['acme', 'other'] }).merchantSlug).toBe('acme');
  });

  it('rejects non-numeric limit → default', () => {
    expect(parseProductFilters({ limit: 'abc' }).limit).toBe(24);
  });

  it('takes the first value for array query params', () => {
    expect(parseProductFilters({ category: ['a', 'b'] }).category).toBe('a');
  });

  it('caps offset to 100000', () => {
    expect(parseProductFilters({ offset: '999999' }).offset).toBe(100000);
  });
});

describe('GET /api/products handler', () => {
  it('returns 405 for non-GET', async () => {
    const mod = await import('../products');
    const handler = mod.default;
    let status = 0;
    let ended = false;
    const res = {
      setHeader: vi.fn(),
      status(c: number) {
        status = c;
        return res as never;
      },
      end() { ended = true; },
      json: vi.fn(),
    };
    await handler({ method: 'POST', headers: {} } as never, res as never);
    expect(status).toBe(405);
    expect(ended).toBe(true);
  });

  it('returns 204 for OPTIONS', async () => {
    const mod = await import('../products');
    const handler = mod.default;
    let status = 0;
    const res = {
      setHeader: vi.fn(),
      status(c: number) { status = c; return res as never; },
      end: vi.fn(),
      json: vi.fn(),
    };
    await handler({ method: 'OPTIONS', headers: {} } as never, res as never);
    expect(status).toBe(204);
  });
});
