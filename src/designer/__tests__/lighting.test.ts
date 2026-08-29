/**
 * Sims world (2026-08-29) — light sources, pool radius, plan symbols.
 *
 * Unit cases on hand-built inputs, then the same helpers against the REAL
 * seed catalog so a heuristic false positive (a K1 treadmill that starts
 * glowing) fails here rather than on the canvas.
 */
import { describe, it, expect } from 'vitest';
import {
  emitsLight,
  isOutdoorProduct,
  lightRadiusM,
  looksLikeLight,
  planSymbolOf,
  LIGHT_RADIUS_PER_LONG_SIDE,
  MAX_LIGHT_RADIUS_M,
  MIN_LIGHT_RADIUS_M,
  type LightingInput,
} from '../lighting';
import { getAllProducts, getProductById } from '../../data/products';

function input(overrides: Partial<LightingInput> = {}): LightingInput {
  return { name: 'Thing', category: 'other', ...overrides };
}

describe('looksLikeLight — whole-word, case-insensitive', () => {
  it.each([
    'Floor Lamp',
    'LED strip',
    'Wall light',
    'Paper Lantern',
    'Brass sconce',
    'Rattan pendant',
    'Crystal Chandelier',
    'led',
    'Light commercial treadmill',
  ])('matches %j', (name) => {
    expect(looksLikeLight(name)).toBe(true);
  });

  it.each(['Highlight reel', 'Delighted chair', 'Lighting rig', 'Spotlight', 'Treadmill', 'Sled push', ''])(
    'does not match %j',
    (name) => {
      expect(looksLikeLight(name)).toBe(false);
    },
  );
});

describe('emitsLight', () => {
  it('honours an explicit flag either way', () => {
    expect(emitsLight(input({ emits_light: true }))).toBe(true);
    expect(emitsLight(input({ emits_light: false, category: 'lighting', name: 'Lamp' }))).toBe(false);
  });

  it('treats the lighting category as a light source', () => {
    expect(emitsLight(input({ category: 'lighting', name: 'Rig' }))).toBe(true);
  });

  it('falls back to the name heuristic', () => {
    expect(emitsLight(input({ category: 'decor', name: 'Table lamp' }))).toBe(true);
    expect(emitsLight(input({ category: 'decor', name: 'Table' }))).toBe(false);
  });
});

describe('lightRadiusM', () => {
  it('uses an explicit positive radius', () => {
    expect(lightRadiusM(input({ light_radius_m: 1.8 }))).toBe(1.8);
    expect(lightRadiusM(input({ light_radius_m: 9, dimensions_cm: { length: 10, width: 10, height: 10 } }))).toBe(9);
  });

  it('ignores a zero / negative / non-finite explicit radius', () => {
    const dims = { length: 100, width: 50, height: 10 };
    expect(lightRadiusM(input({ light_radius_m: 0, dimensions_cm: dims }))).toBe(3);
    expect(lightRadiusM(input({ light_radius_m: -1, dimensions_cm: dims }))).toBe(3);
    expect(lightRadiusM(input({ light_radius_m: Number.NaN, dimensions_cm: dims }))).toBe(3);
  });

  it('derives 3 x the long side, floored at 1.2 m and capped at 3.5 m', () => {
    expect(LIGHT_RADIUS_PER_LONG_SIDE).toBe(3);
    expect(MIN_LIGHT_RADIUS_M).toBe(1.2);
    expect(MAX_LIGHT_RADIUS_M).toBe(3.5);
    // 40 cm lamp → 1.2 m (floor)
    expect(lightRadiusM(input({ dimensions_cm: { length: 40, width: 40, height: 160 } }))).toBe(1.2);
    // 1 m fixture → 3 m
    expect(lightRadiusM(input({ dimensions_cm: { length: 50, width: 100, height: 10 } }))).toBe(3);
    // 2 m fixture → capped 3.5 m
    expect(lightRadiusM(input({ dimensions_cm: { length: 200, width: 20, height: 10 } }))).toBe(3.5);
    // height never counts
    expect(lightRadiusM(input({ dimensions_cm: { length: 20, width: 20, height: 500 } }))).toBe(1.2);
  });

  it('returns the floor when there are no dimensions', () => {
    expect(lightRadiusM(input())).toBe(MIN_LIGHT_RADIUS_M);
  });
});

describe('planSymbolOf', () => {
  it('honours an explicit symbol', () => {
    expect(planSymbolOf(input({ plan_symbol: 'bar' }))).toBe('bar');
    expect(planSymbolOf(input({ plan_symbol: 'pendant', category: 'lighting' }))).toBe('pendant');
  });

  it('draws a light for the lighting category', () => {
    expect(planSymbolOf(input({ category: 'lighting' }))).toBe('light');
  });

  it('draws a tree for an outdoor plant only', () => {
    expect(planSymbolOf(input({ category: 'plant', outdoor: true }))).toBe('tree');
    expect(planSymbolOf(input({ category: 'plant' }))).toBeNull();
    expect(planSymbolOf(input({ category: 'decor', outdoor: true }))).toBeNull();
  });

  it('does not use the name heuristic — a photo product named "light" keeps its photo', () => {
    expect(planSymbolOf(input({ category: 'fitness', name: 'Light commercial treadmill' }))).toBeNull();
  });
});

describe('isOutdoorProduct', () => {
  it('is true only for an explicit outdoor flag', () => {
    expect(isOutdoorProduct({ outdoor: true })).toBe(true);
    expect(isOutdoorProduct({ outdoor: false })).toBe(false);
    expect(isOutdoorProduct({})).toBe(false);
  });
});

describe('against the real seed catalog', () => {
  const get = (id: string) => getProductById(id)!;

  it('floor lamp / pendant / sconce are lights with their seeded radii + symbols', () => {
    const lamp = get('demo-floor-lamp');
    expect(emitsLight(lamp)).toBe(true);
    expect(lightRadiusM(lamp)).toBe(1.8);
    expect(planSymbolOf(lamp)).toBe('light');

    const pendant = get('demo-pendant-light');
    expect(emitsLight(pendant)).toBe(true);
    expect(lightRadiusM(pendant)).toBe(2.2);
    expect(planSymbolOf(pendant)).toBe('pendant');

    const sconce = get('demo-wall-sconce');
    expect(emitsLight(sconce)).toBe(true);
    expect(lightRadiusM(sconce)).toBe(1.2);
    expect(planSymbolOf(sconce)).toBe('light');
  });

  it('garden seeds are outdoor with their glyphs and do not glow', () => {
    for (const [id, symbol] of [
      ['demo-garden-tree', 'tree'],
      ['demo-hedge', 'hedge'],
      ['demo-outdoor-bench', 'bench'],
    ] as const) {
      const p = get(id);
      expect(isOutdoorProduct(p)).toBe(true);
      expect(planSymbolOf(p)).toBe(symbol);
      expect(emitsLight(p)).toBe(false);
    }
  });

  it('no pre-existing product emits light or draws a symbol (heuristic false-positive guard)', () => {
    const lights = new Set(['demo-floor-lamp', 'demo-pendant-light', 'demo-wall-sconce']);
    const symbols = new Set([...lights, 'demo-garden-tree', 'demo-hedge', 'demo-outdoor-bench']);
    for (const p of getAllProducts()) {
      expect(emitsLight(p)).toBe(lights.has(p.id));
      expect(planSymbolOf(p) !== null).toBe(symbols.has(p.id));
    }
  });
});
