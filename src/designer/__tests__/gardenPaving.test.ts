import { describe, expect, it } from 'vitest';
import { estimateGardenPaving } from '../gardenPaving';
import { normaliseGarden } from '../garden';

describe('sourced garden paving estimates', () => {
  it('counts the actual rectangular slab grid, including whole pieces needed at cut edges', () => {
    const exact = estimateGardenPaving({ kind: 'path', pavingProductId: 'em-ubp-rusclaord001', widthM: 4, depthM: 2.5 });
    expect(exact).toMatchObject({ columns: 8, rows: 10, pieces: 80, areaM2: 10, purchasedAreaM2: 10, totalMur: 14880 });
    const cut = estimateGardenPaving({ kind: 'path', pavingProductId: 'em-ubp-rusclaord001', widthM: 1.1, depthM: 0.4 });
    expect(cut).toMatchObject({ columns: 3, rows: 2, pieces: 6, totalMur: 1116 });
  });

  it('avoids an extra row at exact decimal multiples and never prices generic or unknown products', () => {
    const patch = { kind: 'path' as const, pavingProductId: 'em-ubp-vorslacol001', widthM: 0.99, depthM: 0.99 };
    expect(estimateGardenPaving(patch)?.pieces).toBe(9);
    expect(estimateGardenPaving({ ...patch, pavingProductId: undefined })).toBeNull();
    expect(estimateGardenPaving({ ...patch, pavingProductId: 'saved-future-product' })).toBeNull();
    expect(estimateGardenPaving({ ...patch, kind: 'concrete' })).toBeNull();
    expect(estimateGardenPaving({ ...patch, widthM: Infinity })).toBeNull();
    expect(estimateGardenPaving({ ...patch, depthM: 0 })).toBeNull();
  });

  it('preserves future saved product IDs and plain concrete through garden normalization', () => {
    const surface = { id: 'paving', kind: 'path', x: 2, y: 3, widthM: 4, depthM: 3, elevationM: 0, pavingProductId: 'saved-future-product' };
    const clean = normaliseGarden({ surfaces: [surface, { ...surface, id: 'terrace', kind: 'concrete', pavingProductId: undefined }], fences: [] });
    expect(clean?.surfaces[0].pavingProductId).toBe('saved-future-product');
    expect(clean?.surfaces[1].kind).toBe('concrete');
    expect(clean?.surfaces[1].pavingProductId).toBeUndefined();
    expect(normaliseGarden({ surfaces: [{ ...surface, pavingProductId: ' '.repeat(120) }] })?.surfaces[0].pavingProductId).toBeUndefined();
  });

});
