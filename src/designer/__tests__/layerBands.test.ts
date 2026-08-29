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
  BAND_WALL,
  BAND_CEILING,
} from '../layerBands';
import { getAllProducts } from '../../data/products';

const ALL = getAllProducts();
const flooring = ALL.filter((p) => p.category === 'flooring');
// Sims world (2026-08-29): wall- and ceiling-mounted items have their own
// bands, so "equipment" here means floor-standing (or surface) products.
const equipment = ALL.filter(
  (p) => p.category !== 'flooring' && p.placement !== 'wall' && p.placement !== 'ceiling',
);
const wallMounted = ALL.filter((p) => p.placement === 'wall');
const ceilingHung = ALL.filter((p) => p.placement === 'ceiling');

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

  it('puts every floor-standing / surface product in the freestanding band', () => {
    for (const p of equipment) expect(bandForProduct(p.id)).toBe(BAND_FREESTANDING);
  });

  it('puts wall-mounted products in the wall band and ceiling-hung ones in the ceiling band', () => {
    expect(wallMounted.length).toBeGreaterThan(0);
    expect(ceilingHung.length).toBeGreaterThan(0);
    for (const p of wallMounted) expect(bandForProduct(p.id)).toBe(BAND_WALL);
    for (const p of ceilingHung) expect(bandForProduct(p.id)).toBe(BAND_CEILING);
  });

  it('keeps the bands strictly ordered and spaced', () => {
    expect(BAND_FLOOR_COVERING).toBe(200);
    expect(BAND_FREESTANDING).toBe(300);
    expect(BAND_WALL).toBe(350);
    expect(BAND_CEILING).toBe(400);
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

  it('a sconce over a console and a pendant over a treadmill never collide', () => {
    expect(bandsCollide(wallMounted[0].id, equipment[0].id)).toBe(false);
    expect(bandsCollide(ceilingHung[0].id, equipment[0].id)).toBe(false);
    expect(bandsCollide(ceilingHung[0].id, wallMounted[0].id)).toBe(false);
    expect(bandsCollide(ceilingHung[0].id, flooring[0].id)).toBe(false);
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

  it('a floor product only has to avoid floor items even when wall/ceiling items are passed in', () => {
    const mixed = [
      { productId: wallMounted[0].id, instanceId: 'sconce' },
      { productId: ceilingHung[0].id, instanceId: 'pendant' },
      { productId: flooring[0].id, instanceId: 'mat' },
      { productId: equipment[0].id, instanceId: 'bike' },
    ];
    expect(obstaclesFor(equipment[1].id, mixed).map((o) => o.instanceId)).toEqual(['bike']);
    expect(obstaclesFor(ceilingHung[0].id, mixed).map((o) => o.instanceId)).toEqual(['pendant']);
  });
});
