/**
 * Phase 4 — search hardening tests for products.ts.
 *   - parseProductFilters parses `q` + the new sorts.
 *   - rankProducts: relevance / rating / popularity ordering (pure).
 *   - fetchSuggestions: typeahead returns ranked matches (injectable db).
 */

import { describe, it, expect } from 'vitest';
import {
  parseProductFilters,
  parseSort,
  rankProducts,
  fetchSuggestions,
  SORT_OPTIONS,
  type ProductSummary,
} from '../products';

function p(id: number, name: string, category: string, rating?: { average: number; count: number } | null): ProductSummary {
  return {
    id,
    sku: `SKU-${id}`,
    name,
    category,
    description: null,
    widthMm: null,
    depthMm: null,
    heightMm: null,
    weightG: null,
    priceMinor: 1000,
    currency: 'MUR',
    imageUrl: null,
    region: 'MU',
    rating: rating ?? null,
  };
}

describe('parseProductFilters — search', () => {
  it('parses q + clamps to 200 chars', () => {
    expect(parseProductFilters({ q: 'ice bath' }).q).toBe('ice bath');
    expect(parseProductFilters({ q: 'x'.repeat(250) }).q).toHaveLength(200);
    expect(parseProductFilters({}).q).toBeNull();
  });
  it('accepts the new sorts', () => {
    for (const s of ['relevance', 'rating', 'popularity']) {
      expect(parseSort({ sort: s })).toBe(s);
    }
  });
  it('SORT_OPTIONS keeps backward-compat entries', () => {
    expect(SORT_OPTIONS).toContain('price_asc');
    expect(SORT_OPTIONS).toContain('rating_desc');
    expect(SORT_OPTIONS).toContain('newest');
  });
});

describe('rankProducts', () => {
  it('relevance drops non-matches + orders by score', () => {
    const rows = [p(1, 'Sauna', 'recovery'), p(2, 'Ice Bath', 'recovery'), p(3, 'Ice Bath Pro', 'recovery')];
    const ranked = rankProducts(rows, { sort: 'relevance', q: 'ice bath' });
    expect(ranked.map((r) => r.id)).toEqual([2, 3]); // exact "ice bath" first, then contains; Sauna dropped
  });
  it('relevance with no query is a pass-through', () => {
    const rows = [p(1, 'A', 'x'), p(2, 'B', 'y')];
    expect(rankProducts(rows, { sort: 'relevance', q: null }).map((r) => r.id)).toEqual([1, 2]);
  });
  it('rating orders by average desc, no-reviews last', () => {
    const rows = [p(1, 'A', 'x', { average: 3, count: 5 }), p(2, 'B', 'y', null), p(3, 'C', 'z', { average: 4.8, count: 2 })];
    expect(rankProducts(rows, { sort: 'rating', q: null }).map((r) => r.id)).toEqual([3, 1, 2]);
  });
  it('popularity orders by review count desc', () => {
    const rows = [p(1, 'A', 'x', { average: 5, count: 1 }), p(2, 'B', 'y', { average: 3, count: 9 }), p(3, 'C', 'z', null)];
    expect(rankProducts(rows, { sort: 'popularity', q: null }).map((r) => r.id)).toEqual([2, 1, 3]);
  });
});

// Minimal fake builder for fetchSuggestions (single select chain).
function fakeDb(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ['select', 'from', 'where', 'limit']) chain[m] = self;
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rows).then(res, rej);
  return chain as never;
}

describe('fetchSuggestions', () => {
  it('empty query → [] without touching the db', async () => {
    const r = await fetchSuggestions('   ', 8, fakeDb([]));
    expect(r.suggestions).toEqual([]);
  });
  it('returns ranked typeahead matches (minimal fields)', async () => {
    const rows = [
      { id: 1, name: 'Yoga Mat', category: 'mobility', description: null },
      { id: 2, name: 'Ice Bath', category: 'recovery', description: null },
      { id: 3, name: 'Ice Bath Pro', category: 'recovery', description: null },
    ];
    const r = await fetchSuggestions('ice', 8, fakeDb(rows));
    expect(r.suggestions.map((s) => s.id)).toEqual([2, 3]); // Yoga Mat dropped
    expect(r.suggestions[0]).toEqual({ id: 2, name: 'Ice Bath', category: 'recovery' });
  });
  it('degrades to schemaMissing when products table absent', async () => {
    const db = {
      select: () => {
        throw new Error('relation "products" does not exist');
      },
    } as never;
    const r = await fetchSuggestions('ice', 8, db);
    expect(r.schemaMissing).toBe(true);
    expect(r.suggestions).toEqual([]);
  });
});
