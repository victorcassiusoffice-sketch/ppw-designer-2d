/**
 * Sims world (2026-08-29) — macro tabs for the Sims dock / bottom toolbar.
 *
 * Pins the tab ORDER (Lighting and Outdoor appended after Decor), the label
 * table, and the `outdoor`-wins routing rule in `macroOf`.
 */
import { describe, it, expect } from 'vitest';
import {
  MACRO_CATEGORY_LABEL,
  MACRO_CATEGORY_ORDER,
  macroOf,
  type MacroCategory,
} from '../../components/mobile/catalogMacros';
import { getAllProducts } from '../products';
import type { Product } from '../products.schema';

function product(overrides: Partial<Product>): Product {
  return {
    id: 'x',
    sku: 'X',
    name: 'X',
    category: 'other',
    supplier: 'PPW Demo',
    dimensions_cm: { length: 100, width: 50, height: 50 },
    weight_kg: 1,
    price: { value: 1, currency: 'MUR' },
    commission_pct: 0.05,
    shopify_ready: false,
    image_url: '',
    designer_status: 'Done',
    delivery_regions: ['MU'],
    notes: '',
    ...overrides,
  };
}

describe('MACRO_CATEGORY_ORDER', () => {
  it('is all, furniture, cardio, recovery, sauna, flooring, walls, decor, lighting, outdoor', () => {
    expect(MACRO_CATEGORY_ORDER).toEqual([
      'all',
      'furniture',
      'cardio',
      'recovery',
      'sauna',
      'flooring',
      'walls',
      'decor',
      'lighting',
      'outdoor',
    ]);
  });

  it('has a non-empty label for every tab', () => {
    for (const mc of MACRO_CATEGORY_ORDER) {
      expect(MACRO_CATEGORY_LABEL[mc].length).toBeGreaterThan(0);
    }
    expect(MACRO_CATEGORY_LABEL.lighting).toBe('Lighting');
    expect(MACRO_CATEGORY_LABEL.outdoor).toBe('Outdoor');
  });
});

describe('macroOf', () => {
  it('routes the lighting category to the Lighting tab', () => {
    expect(macroOf(product({ category: 'lighting' }))).toBe('lighting');
  });

  it('routes any outdoor product to the Outdoor tab, whatever its category', () => {
    expect(macroOf(product({ category: 'plant', outdoor: true }))).toBe('outdoor');
    expect(macroOf(product({ category: 'decor', outdoor: true }))).toBe('outdoor');
    expect(macroOf(product({ category: 'lighting', outdoor: true }))).toBe('outdoor');
  });

  it('keeps indoor products on their category tab', () => {
    expect(macroOf(product({ category: 'plant' }))).toBe('decor');
    expect(macroOf(product({ category: 'plant', outdoor: false }))).toBe('decor');
    expect(macroOf(product({ category: 'fitness' }))).toBe('cardio');
    expect(macroOf(product({ category: 'flooring' }))).toBe('flooring');
    expect(macroOf(product({ category: 'other' }))).toBe('decor');
  });

  it('places every bundled product on a real (non-"all") tab', () => {
    const tabs = new Set<MacroCategory>(MACRO_CATEGORY_ORDER.filter((m) => m !== 'all'));
    for (const p of getAllProducts()) expect(tabs.has(macroOf(p))).toBe(true);
  });

  it('the seed catalog populates both new tabs', () => {
    const all = getAllProducts();
    expect(all.filter((p) => macroOf(p) === 'lighting').map((p) => p.id).sort()).toEqual([
      'demo-floor-lamp',
      'demo-pendant-light',
      'demo-wall-sconce',
    ]);
    expect(all.filter((p) => macroOf(p) === 'outdoor').map((p) => p.id).sort()).toEqual([
      'demo-garden-tree',
      'demo-hedge',
      'demo-outdoor-bench',
    ]);
  });
});
