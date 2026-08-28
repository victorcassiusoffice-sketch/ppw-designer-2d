/**
 * cartStore - Week 3 unit tests (regression of Week 2.5 + new FX path).
 *
 * M6 (2026-05-20): retargeted from the retired demo seed
 * (plunge-all-in / sansevieria / tamarin-areca-palm) to the K1-Sport
 * seed shipped in `src/data/products.json` v2.0.0-k1-seed. Three K1
 * SKUs anchor the cross-product math:
 *   • k1-nordictrack-2450      → MUR 150,000 (treadmill)
 *   • k1-schwinn-700ic         → MUR  29,000 (indoor bike, mid-tier)
 *   • k1-bench-adjustable-fid  → MUR  11,000 (bench, entry-tier)
 * All three are MUR-priced (the K1 catalogue is Mauritius-domestic),
 * which keeps the FX conversion test deterministic against the
 * fallback rate map.
 */
import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import { deriveCart, MUR_PER_USD } from '../cartStore';
import type { Property } from '../propertyStore';
import { roomFloorOrders } from '../../designer/floorTiles';
import { rectToPolygon } from '../../lib/geometry';
import { FALLBACK_RATES_USD, type FxSnapshot } from '../../lib/fx';

const STUB_FX: FxSnapshot = {
  fetchedAt: 0,
  rates: { ...FALLBACK_RATES_USD },
  fallback: true,
};

const EMPTY_MUT = { qtyOverrides: {}, removedProductIds: [] };

const NT2450_ID = 'k1-nordictrack-2450';
const NT2450_MUR = 150_000;
const SCHWINN_ID = 'k1-schwinn-700ic';
const SCHWINN_MUR = 29_000;
const BENCH_ID = 'k1-bench-adjustable-fid';
const BENCH_MUR = 11_000;

function makeProperty(roomItems: Array<Array<{ productId: string }>>): Property {
  const rooms = roomItems.map((items, i) => ({
    id: `r${i}`,
    name: `Room ${i}`,
    polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
    placedItems: items.map((p) => ({
      instanceId: nanoid(8),
      productId: p.productId,
      x: 0,
      y: 0,
      rotation: 0,
    })),
  }));
  return {
    id: 'p',
    name: 'Test Property',
    activeRoomId: rooms[0]?.id ?? 'r0',
    rooms,
  };
}

describe('deriveCart - empty / edge cases', () => {
  it('returns zero totals for an empty property', () => {
    const cart = deriveCart(makeProperty([[]]), EMPTY_MUT, STUB_FX, 'MUR');
    expect(cart.lines).toEqual([]);
    expect(cart.uniqueProductCount).toBe(0);
    expect(cart.totalItemCount).toBe(0);
    expect(cart.subtotal).toBe(0);
    expect(cart.subtotalByCurrency.MUR).toBe(0);
    expect(cart.subtotalByCurrency.USD).toBe(0);
  });

  it('skips items whose productId is missing from the catalog', () => {
    const cart = deriveCart(
      makeProperty([[{ productId: 'does-not-exist' }, { productId: NT2450_ID }]]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.uniqueProductCount).toBe(1);
    expect(cart.totalItemCount).toBe(1);
    expect(cart.lines[0].productId).toBe(NT2450_ID);
  });

  it('handles a property with zero rooms gracefully', () => {
    const cart = deriveCart(
      { id: 'x', name: 'x', activeRoomId: '', rooms: [] },
      EMPTY_MUT,
      STUB_FX,
      'USD',
    );
    expect(cart.totalItemCount).toBe(0);
    expect(cart.subtotal).toBe(0);
  });
});

describe('deriveCart - aggregation across rooms', () => {
  it('groups duplicates of the same product across rooms', () => {
    const cart = deriveCart(
      makeProperty([
        [{ productId: BENCH_ID }, { productId: BENCH_ID }],
        [{ productId: BENCH_ID }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].productId).toBe(BENCH_ID);
    expect(cart.lines[0].quantity).toBe(3);
    expect(cart.lines[0].placedCount).toBe(3);
    expect(cart.totalItemCount).toBe(3);
    expect(cart.subtotal).toBeCloseTo(BENCH_MUR * 3, 4);
    expect(cart.subtotalByCurrency.MUR).toBeCloseTo(BENCH_MUR * 3, 4);
    expect(cart.subtotalByCurrency.USD).toBeCloseTo((BENCH_MUR * 3) / MUR_PER_USD, 4);
  });

  it('records per-room breakdown', () => {
    const cart = deriveCart(
      makeProperty([
        [{ productId: BENCH_ID }, { productId: BENCH_ID }],
        [{ productId: BENCH_ID }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.lines[0].perRoom).toHaveLength(2);
    const total = cart.lines[0].perRoom.reduce((a, r) => a + r.count, 0);
    expect(total).toBe(3);
  });

  it('handles a mix of products and currencies', () => {
    const cart = deriveCart(
      makeProperty([
        [{ productId: NT2450_ID }],
        [{ productId: BENCH_ID }, { productId: SCHWINN_ID }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.uniqueProductCount).toBe(3);
    expect(cart.totalItemCount).toBe(3);
    const expectedMUR = NT2450_MUR + BENCH_MUR + SCHWINN_MUR;
    expect(cart.subtotal).toBeCloseTo(expectedMUR, 0);
    expect(cart.subtotalByCurrency.USD).toBeCloseTo(expectedMUR / MUR_PER_USD, 0);
  });

  it('sorts lines by display-currency total descending', () => {
    const cart = deriveCart(
      makeProperty([
        [{ productId: BENCH_ID }, { productId: NT2450_ID }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'USD',
    );
    expect(cart.lines[0].productId).toBe(NT2450_ID);
    expect(cart.lines[1].productId).toBe(BENCH_ID);
  });
});

describe('deriveCart - currency switching', () => {
  it('displays subtotal in the chosen currency', () => {
    const property = makeProperty([[{ productId: NT2450_ID }]]);
    const inUsd = deriveCart(property, EMPTY_MUT, STUB_FX, 'USD');
    const inMur = deriveCart(property, EMPTY_MUT, STUB_FX, 'MUR');
    expect(inMur.subtotal).toBeCloseTo(NT2450_MUR, 4);
    expect(inUsd.subtotal).toBeCloseTo(NT2450_MUR / MUR_PER_USD, 4);
  });

  it('cross-currency subtotals match', () => {
    const property = makeProperty([[{ productId: NT2450_ID }]]);
    const c = deriveCart(property, EMPTY_MUT, STUB_FX, 'EUR');
    // NT2450 source = MUR. Convert MUR → USD → EUR via FALLBACK_RATES_USD.
    const inUsd = NT2450_MUR / MUR_PER_USD;
    expect(c.subtotal).toBeCloseTo(inUsd * 0.92, 4);
    expect(c.subtotalByCurrency.USD).toBeCloseTo(inUsd, 4);
  });
});

describe('deriveCart - cart mutations', () => {
  it('qty override overrides placed count', () => {
    const property = makeProperty([[{ productId: NT2450_ID }]]);
    const cart = deriveCart(
      property,
      { qtyOverrides: { [NT2450_ID]: 2 }, removedProductIds: [] },
      STUB_FX,
      'MUR',
    );
    expect(cart.lines[0].quantity).toBe(2);
    expect(cart.lines[0].placedCount).toBe(1);
    expect(cart.subtotal).toBeCloseTo(NT2450_MUR * 2, 4);
  });

  it('removedProductIds drops the line', () => {
    const property = makeProperty([
      [{ productId: NT2450_ID }, { productId: BENCH_ID }],
    ]);
    const cart = deriveCart(
      property,
      { qtyOverrides: {}, removedProductIds: [NT2450_ID] },
      STUB_FX,
      'MUR',
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].productId).toBe(BENCH_ID);
  });
});

describe('deriveCart - MUR_PER_USD constant', () => {
  it('exposes the static fallback rate', () => {
    expect(MUR_PER_USD).toBe(45);
  });
});

describe('deriveCart - painted floors become cart lines', () => {
  // eva-combat: 1×1 m tile, MUR 850/tile. Two whole tiles well inside a
  // 5×4 m room (no cuts → no surplus) makes the math deterministic.
  const FLOOR_MAT = 'eva-combat';
  const FLOOR_PRICE = 850;

  function propertyWithPaintedFloor(): Property {
    return {
      id: 'p',
      name: 'Floor Test',
      activeRoomId: 'r0',
      rooms: [
        {
          id: 'r0',
          name: 'Studio',
          polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
          placedItems: [],
          floorTiles: [
            {
              materialId: FLOOR_MAT,
              tileWm: 1,
              tileHm: 1,
              originM: { x: 0, y: 0 },
              // row 1, cols 1..2 → tiles at x[1,3] y[1,2], fully inside.
              runs: [1, 1, 2],
            },
          ],
        },
      ],
    };
  }

  it('emits one floor line matching roomFloorOrders, with the material price', () => {
    const property = propertyWithPaintedFloor();
    const expected = roomFloorOrders(property.rooms[0]);
    expect(expected).toHaveLength(1);
    const expectedUnits = expected[0].order.unitsToOrder;

    const cart = deriveCart(property, EMPTY_MUT, STUB_FX, 'MUR');
    expect(cart.floorLines).toHaveLength(1);
    const line = cart.floorLines[0];
    expect(line.materialId).toBe(FLOOR_MAT);
    expect(line.unit).toBe('tile');
    expect(line.unitsToOrder).toBe(expectedUnits);
    expect(line.unitPriceMur).toBe(FLOOR_PRICE);
    // In MUR display, line total = units * price, exactly.
    expect(line.lineTotalDisplay).toBe(expectedUnits * FLOOR_PRICE);
    // surplus is the offcut allowance: units beyond whole + cut.
    expect(line.surplusUnits).toBe(
      Math.max(0, line.unitsToOrder - line.wholeTiles - line.cutTiles),
    );
    // These two whole tiles have no cuts, so no surplus is forced.
    expect(line.cutTiles).toBe(0);
    expect(line.surplusUnits).toBe(0);
  });

  it('folds the floor subtotal into the cart subtotal', () => {
    const property = propertyWithPaintedFloor();
    const cart = deriveCart(property, EMPTY_MUT, STUB_FX, 'MUR');
    expect(cart.floorSubtotal).toBeGreaterThan(0);
    // No products placed, so the whole subtotal is the floor subtotal.
    expect(cart.subtotal).toBe(cart.floorSubtotal);
    expect(cart.subtotal).toBe(cart.floorLines[0].lineTotalDisplay);
  });

  it('is additive: a property with no painted floor has no floor lines', () => {
    const cart = deriveCart(makeProperty([[{ productId: BENCH_ID }]]), EMPTY_MUT, STUB_FX, 'MUR');
    expect(cart.floorLines).toHaveLength(0);
    expect(cart.floorSubtotal).toBe(0);
    // product subtotal is untouched by the floor machinery.
    expect(cart.subtotal).toBe(cart.lines[0].lineTotalDisplay);
  });

  it('aggregates one material painted across two rooms into a single line', () => {
    const property = propertyWithPaintedFloor();
    // second room, same material painted.
    property.rooms.push({
      id: 'r1',
      name: 'Annex',
      polygon: rectToPolygon({ lengthM: 5, widthM: 4 }),
      placedItems: [],
      floorTiles: [
        {
          materialId: FLOOR_MAT,
          tileWm: 1,
          tileHm: 1,
          originM: { x: 0, y: 0 },
          runs: [1, 1, 1],
        },
      ],
    });
    const cart = deriveCart(property, EMPTY_MUT, STUB_FX, 'MUR');
    expect(cart.floorLines).toHaveLength(1);
    expect(cart.floorLines[0].perRoom).toHaveLength(2);
  });
});
