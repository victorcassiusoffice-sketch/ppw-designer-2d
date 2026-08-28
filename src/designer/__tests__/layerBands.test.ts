/**
 * Layer bands — "people need to place things on top of the flooring."
 *
 * These assert against the REAL product catalog rather than a stub, because
 * the whole mechanism hangs off `category === 'flooring'` in `products.json`.
 * A stub would keep passing if that category were renamed, which is exactly
 * the regression worth catching.
 */
import { describe, it, expect } from 'vitest';
import {
  bandForProduct,
  bandsCollide,
  obstaclesFor,
  BAND_FLOOR_COVERING,
  BAND_FREESTANDING,
} from '../layerBands';
import { getAllProducts } from '../../data/products';

const ALL = getAllProducts();
const flooring = ALL.filter((p) => p.category === 'flooring');
const equipment = ALL.filter((p) => p.category !== 'flooring');

describe('the catalog still has the categories this depends on', () => {
  it('ships flooring SKUs and non-flooring SKUs', () => {
    expect(flooring.length).toBeGreaterThan(0);
    expect(equipment.length).toBeGreaterThan(0);
  });
});

describe('bandForProduct', () => {
  it('puts every flooring SKU in the floor-covering band', () => {
    for (const p of flooring) expect(bandForProduct(p.id)).toBe(BAND_FLOOR_COVERING);
  });

  it('puts everything else in the freestanding band', () => {
    for (const p of equipment) expect(bandForProduct(p.id)).toBe(BAND_FREESTANDING);
  });

  it('treats an unknown product as freestanding rather than throwing', () => {
    expect(bandForProduct('does-not-exist')).toBe(BAND_FREESTANDING);
  });
});

describe('bandsCollide', () => {
  it('equipment does NOT collide with flooring — this is the whole fix', () => {
    expect(bandsCollide(equipment[0].id, flooring[0].id)).toBe(false);
  });

  it('equipment still collides with equipment', () => {
    expect(bandsCollide(equipment[0].id, equipment[1].id)).toBe(true);
  });

  it('flooring still collides with flooring — you cannot lay a mat over a mat', () => {
    expect(bandsCollide(flooring[0].id, flooring[1].id)).toBe(true);
  });
});

describe('obstaclesFor', () => {
  const items = [
    { productId: flooring[0].id, instanceId: 'mat1' },
    { productId: flooring[1].id, instanceId: 'mat2' },
    { productId: equipment[0].id, instanceId: 'bike' },
  ];

  it('a treadmill only has to avoid other equipment', () => {
    const obs = obstaclesFor(equipment[1].id, items);
    expect(obs.map((o) => o.instanceId)).toEqual(['bike']);
  });

  it('a mat only has to avoid other mats', () => {
    const obs = obstaclesFor(flooring[0].id, items);
    expect(obs.map((o) => o.instanceId)).toEqual(['mat1', 'mat2']);
  });

  it('a fully tiled room leaves equipment completely unobstructed', () => {
    // The old behaviour: tile a room and every later product hit
    // "Item won't fit — the room is full."
    const tiled = Array.from({ length: 40 }, (_, i) => ({
      productId: flooring[i % flooring.length].id,
      instanceId: `t${i}`,
    }));
    expect(obstaclesFor(equipment[0].id, tiled)).toEqual([]);
  });

  it('returns a new array and does not mutate the input', () => {
    const before = items.length;
    obstaclesFor(equipment[0].id, items);
    expect(items).toHaveLength(before);
  });
});
