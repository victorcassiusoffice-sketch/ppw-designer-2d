/**
 * DESIGNER-EXPANSION P2 — per-domain catalog + asset abstraction.
 *
 * Guards the GATE-1 contract:
 *   • the wellness path is byte-for-byte unchanged (default domain),
 *   • airplane + car seeds are non-empty and schema-valid,
 *   • the loader returns the correct per-domain set + category filter.
 */
import { describe, it, expect } from 'vitest';
import {
  getCatalog,
  getAllProducts,
  getProductsByCategory,
} from '../products';
import wellnessJson from '../products.json';
import {
  WellnessCatalogSchema,
  AirplaneCatalogSchema,
  CarCatalogSchema,
} from '../products.validate';

describe('getCatalog(domain) — wellness path unchanged', () => {
  it('no-arg and "wellness-room" return the same catalog', () => {
    expect(getCatalog('wellness-room')).toBe(getCatalog());
  });

  it('wellness catalog deep-equals the bundled products.json (pre-change set)', () => {
    expect(getCatalog('wellness-room')).toEqual(wellnessJson);
  });

  it('getAllProducts() default equals the wellness product set', () => {
    expect(getAllProducts()).toEqual(getAllProducts('wellness-room'));
    expect(getAllProducts()).toEqual(wellnessJson.products);
  });
});

describe('airplane + car seeded catalogs', () => {
  it('airplane catalog is non-empty', () => {
    expect(getAllProducts('airplane').length).toBeGreaterThan(0);
  });

  it('car catalog is non-empty', () => {
    expect(getAllProducts('car').length).toBeGreaterThan(0);
  });

  it('airplane catalog is schema-valid', () => {
    expect(() => AirplaneCatalogSchema.parse(getCatalog('airplane'))).not.toThrow();
  });

  it('car catalog is schema-valid', () => {
    expect(() => CarCatalogSchema.parse(getCatalog('car'))).not.toThrow();
  });

  it('wellness catalog is schema-valid', () => {
    expect(() => WellnessCatalogSchema.parse(getCatalog('wellness-room'))).not.toThrow();
  });

  it('every seeded non-wellness row is clearly marked mock/seed', () => {
    for (const p of getAllProducts('airplane')) {
      expect(p.mock).toBe(true);
      expect(p.provenance).toBe('seed');
      expect(p.domain).toBe('airplane');
    }
    for (const p of getAllProducts('car')) {
      expect(p.mock).toBe(true);
      expect(p.provenance).toBe('seed');
      expect(p.domain).toBe('car');
    }
  });
});

describe('per-domain category filter', () => {
  it('filters airplane products by category', () => {
    const seats = getProductsByCategory('airplane', 'seat');
    expect(seats.length).toBeGreaterThan(0);
    expect(seats.every((p) => p.category === 'seat')).toBe(true);
  });

  it('filters car products by category', () => {
    const models = getProductsByCategory('car', 'model');
    expect(models.length).toBeGreaterThan(0);
    expect(models.every((p) => p.category === 'model')).toBe(true);
  });

  it('filters wellness products by category', () => {
    const fitness = getProductsByCategory('wellness-room', 'fitness');
    expect(fitness.every((p) => p.category === 'fitness')).toBe(true);
  });

  it('does not leak products across domains', () => {
    const airplaneIds = new Set(getAllProducts('airplane').map((p) => p.id));
    const carIds = new Set(getAllProducts('car').map((p) => p.id));
    const wellnessIds = new Set(getAllProducts('wellness-room').map((p) => p.id));
    for (const id of airplaneIds) expect(carIds.has(id)).toBe(false);
    for (const id of airplaneIds) expect(wellnessIds.has(id)).toBe(false);
  });
});
