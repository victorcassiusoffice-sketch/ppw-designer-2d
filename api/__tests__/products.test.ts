import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseProductFilters,
  parseEcoCerts,
  parseSort,
  ECO_CERT_LEVELS,
  SORT_OPTIONS,
  topdownColumnsEnabled,
  energyColumnsEnabled,
} from '../products';

describe('parseProductFilters', () => {
  it('defaults to limit=24 offset=0 no filters', () => {
    expect(parseProductFilters({})).toEqual({
      category: null,
      region: null,
      search: null,
      productId: null,
      merchantSlug: null,
      priceMin: null,
      priceMax: null,
      ecoCerts: [],
      inStockOnly: false,
      ratingMin: null,
      sort: 'newest',
      includeFacets: false,
      includeDemo: false,
      limit: 24,
      offset: 0,
    });
  });

  it('parses include_demo=1 (DEMO-* SKUs hidden by default)', () => {
    expect(parseProductFilters({}).includeDemo).toBe(false);
    expect(parseProductFilters({ include_demo: '1' }).includeDemo).toBe(true);
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

  describe('topdownColumnsEnabled (migration-0027 gate)', () => {
    const prev = process.env.TOPDOWN_DB_COLUMNS;
    afterEach(() => {
      if (prev === undefined) delete process.env.TOPDOWN_DB_COLUMNS;
      else process.env.TOPDOWN_DB_COLUMNS = prev;
    });

    it('defaults to FALSE so an unmigrated DB cannot empty the catalog', () => {
      delete process.env.TOPDOWN_DB_COLUMNS;
      expect(topdownColumnsEnabled()).toBe(false);
      process.env.TOPDOWN_DB_COLUMNS = '';
      expect(topdownColumnsEnabled()).toBe(false);
      process.env.TOPDOWN_DB_COLUMNS = '0';
      expect(topdownColumnsEnabled()).toBe(false);
    });

    it('enables on 1 / true / on', () => {
      for (const v of ['1', 'true', 'TRUE', 'on']) {
        process.env.TOPDOWN_DB_COLUMNS = v;
        expect(topdownColumnsEnabled()).toBe(true);
      }
    });
  });

  describe('keyword search + single-product (WD rework Phase 2)', () => {
    it('parses ?search= and ?q= (search wins) into a trimmed term', () => {
      expect(parseProductFilters({ search: '  sauna ' }).search).toBe('sauna');
      expect(parseProductFilters({ q: 'ice bath' }).search).toBe('ice bath');
      expect(parseProductFilters({ search: 'a', q: 'b' }).search).toBe('a');
      expect(parseProductFilters({}).search).toBeNull();
    });

    it('parses ?id= into a numeric productId (null when absent/invalid)', () => {
      expect(parseProductFilters({ id: '42' }).productId).toBe(42);
      expect(parseProductFilters({ id: 'abc' }).productId).toBeNull();
      expect(parseProductFilters({}).productId).toBeNull();
    });
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

  describe('PolA.4 catalog filter params', () => {
    it('parses price_min + price_max as positive integers', () => {
      const r = parseProductFilters({ price_min: '100', price_max: '5000' });
      expect(r.priceMin).toBe(100);
      expect(r.priceMax).toBe(5000);
    });

    it('drops non-numeric price_min/price_max to null', () => {
      const r = parseProductFilters({ price_min: 'abc' });
      expect(r.priceMin).toBeNull();
    });

    it('treats in_stock=1 / true / on as truthy', () => {
      expect(parseProductFilters({ in_stock: '1' }).inStockOnly).toBe(true);
      expect(parseProductFilters({ in_stock: 'true' }).inStockOnly).toBe(true);
      expect(parseProductFilters({ in_stock: 'on' }).inStockOnly).toBe(true);
      expect(parseProductFilters({ in_stock: '0' }).inStockOnly).toBe(false);
      expect(parseProductFilters({ in_stock: 'yes' }).inStockOnly).toBe(false);
    });

    it('clamps rating_min to 1-5', () => {
      expect(parseProductFilters({ rating_min: '0' }).ratingMin).toBe(1);
      expect(parseProductFilters({ rating_min: '3' }).ratingMin).toBe(3);
      expect(parseProductFilters({ rating_min: '9' }).ratingMin).toBe(5);
    });

    it('parses include_facets=1 → true', () => {
      expect(parseProductFilters({ include_facets: '1' }).includeFacets).toBe(true);
      expect(parseProductFilters({}).includeFacets).toBe(false);
    });
  });
});

describe('parseEcoCerts', () => {
  it('accepts a single tier string', () => {
    expect(parseEcoCerts({ eco_cert: 'verified-certified' })).toEqual(['verified-certified']);
  });

  it('accepts comma-separated multi-select', () => {
    const r = parseEcoCerts({ eco_cert: 'self-declared,verified-certified' });
    expect(r).toEqual(expect.arrayContaining(['self-declared', 'verified-certified']));
    expect(r).toHaveLength(2);
  });

  it('accepts repeated query param array', () => {
    const r = parseEcoCerts({ eco_cert: ['none', 'self-declared'] });
    expect(r).toEqual(expect.arrayContaining(['none', 'self-declared']));
  });

  it('drops unknown tier values silently', () => {
    expect(parseEcoCerts({ eco_cert: 'verified-certified,fake-tier' })).toEqual(['verified-certified']);
  });

  it('deduplicates tiers', () => {
    expect(parseEcoCerts({ eco_cert: 'none,none,self-declared' })).toEqual(
      expect.arrayContaining(['none', 'self-declared']),
    );
    expect(parseEcoCerts({ eco_cert: 'none,none,self-declared' })).toHaveLength(2);
  });

  it('returns [] for missing param', () => {
    expect(parseEcoCerts({})).toEqual([]);
  });

  it('exports all 4 canonical tiers', () => {
    expect(ECO_CERT_LEVELS).toEqual(['none', 'self-declared', 'third-party-claimed', 'verified-certified']);
  });
});

describe('parseSort', () => {
  it('returns "newest" by default', () => {
    expect(parseSort({})).toBe('newest');
  });

  it('accepts each canonical sort option', () => {
    for (const opt of SORT_OPTIONS) {
      expect(parseSort({ sort: opt })).toBe(opt);
    }
  });

  it('rejects unknown sort values → defaults to "newest"', () => {
    expect(parseSort({ sort: 'invalid' })).toBe('newest');
    expect(parseSort({ sort: 'price_random' })).toBe('newest');
  });
});

describe('GET /api/products handler', () => {
  it('returns 405 for unsupported methods (PUT is not handled; POST/PATCH/DELETE/GET all are)', async () => {
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
    await handler({ method: 'PUT', headers: {} } as never, res as never);
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

describe('energyColumnsEnabled (migration-0029 gate, eco / solar 2026-09-04)', () => {
  const prev = process.env.ENERGY_DB_COLUMNS;
  afterEach(() => {
    if (prev === undefined) delete process.env.ENERGY_DB_COLUMNS;
    else process.env.ENERGY_DB_COLUMNS = prev;
  });

  it('defaults to FALSE so an unmigrated DB cannot empty the catalog', () => {
    delete process.env.ENERGY_DB_COLUMNS;
    expect(energyColumnsEnabled()).toBe(false);
    process.env.ENERGY_DB_COLUMNS = '0';
    expect(energyColumnsEnabled()).toBe(false);
  });

  it('is TRUE for 1 / true / on', () => {
    for (const v of ['1', 'true', 'ON']) {
      process.env.ENERGY_DB_COLUMNS = v;
      expect(energyColumnsEnabled()).toBe(true);
    }
  });
});
