/**
 * cartStore - Week 3 unit tests (regression of Week 2.5 + new FX path).
 */
import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import { deriveCart, MUR_PER_USD } from '../cartStore';
import type { Property } from '../propertyStore';
import { rectToPolygon } from '../../lib/geometry';
import { FALLBACK_RATES_USD, type FxSnapshot } from '../../lib/fx';

const STUB_FX: FxSnapshot = {
  fetchedAt: 0,
  rates: { ...FALLBACK_RATES_USD },
  fallback: true,
};

const EMPTY_MUT = { qtyOverrides: {}, removedProductIds: [] };

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
      makeProperty([[{ productId: 'does-not-exist' }, { productId: 'plunge-all-in' }]]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.uniqueProductCount).toBe(1);
    expect(cart.totalItemCount).toBe(1);
    expect(cart.lines[0].productId).toBe('plunge-all-in');
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
        [{ productId: 'sansevieria-trifasciata-90cm' }, { productId: 'sansevieria-trifasciata-90cm' }],
        [{ productId: 'sansevieria-trifasciata-90cm' }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].productId).toBe('sansevieria-trifasciata-90cm');
    expect(cart.lines[0].quantity).toBe(3);
    expect(cart.lines[0].placedCount).toBe(3);
    expect(cart.totalItemCount).toBe(3);
    expect(cart.subtotal).toBeCloseTo(2550, 4);
    expect(cart.subtotalByCurrency.MUR).toBeCloseTo(2550, 4);
    expect(cart.subtotalByCurrency.USD).toBeCloseTo(2550 / 45, 4);
  });

  it('records per-room breakdown', () => {
    const cart = deriveCart(
      makeProperty([
        [{ productId: 'sansevieria-trifasciata-90cm' }, { productId: 'sansevieria-trifasciata-90cm' }],
        [{ productId: 'sansevieria-trifasciata-90cm' }],
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
        [{ productId: 'plunge-all-in' }],
        [{ productId: 'sansevieria-trifasciata-90cm' }, { productId: 'tamarin-areca-palm-180cm' }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'MUR',
    );
    expect(cart.uniqueProductCount).toBe(3);
    expect(cart.totalItemCount).toBe(3);
    const expectedMUR = 4990 * MUR_PER_USD + 850 + 2400;
    expect(cart.subtotal).toBeCloseTo(expectedMUR, 0);
    expect(cart.subtotalByCurrency.USD).toBeCloseTo(expectedMUR / MUR_PER_USD, 0);
  });

  it('sorts lines by display-currency total descending', () => {
    const cart = deriveCart(
      makeProperty([
        [{ productId: 'sansevieria-trifasciata-90cm' }, { productId: 'plunge-all-in' }],
      ]),
      EMPTY_MUT,
      STUB_FX,
      'USD',
    );
    expect(cart.lines[0].productId).toBe('plunge-all-in');
    expect(cart.lines[1].productId).toBe('sansevieria-trifasciata-90cm');
  });
});

describe('deriveCart - currency switching', () => {
  it('displays subtotal in the chosen currency', () => {
    const property = makeProperty([[{ productId: 'plunge-all-in' }]]);
    const inUsd = deriveCart(property, EMPTY_MUT, STUB_FX, 'USD');
    const inMur = deriveCart(property, EMPTY_MUT, STUB_FX, 'MUR');
    expect(inUsd.subtotal).toBeCloseTo(4990, 4);
    expect(inMur.subtotal).toBeCloseTo(4990 * 45, 4);
  });

  it('cross-currency subtotals match', () => {
    const property = makeProperty([[{ productId: 'plunge-all-in' }]]);
    const c = deriveCart(property, EMPTY_MUT, STUB_FX, 'EUR');
    expect(c.subtotal).toBeCloseTo(4990 * 0.92, 4);
    expect(c.subtotalByCurrency.USD).toBeCloseTo(4990, 4);
  });
});

describe('deriveCart - cart mutations', () => {
  it('qty override overrides placed count', () => {
    const property = makeProperty([[{ productId: 'plunge-all-in' }]]);
    const cart = deriveCart(
      property,
      { qtyOverrides: { 'plunge-all-in': 2 }, removedProductIds: [] },
      STUB_FX,
      'USD',
    );
    expect(cart.lines[0].quantity).toBe(2);
    expect(cart.lines[0].placedCount).toBe(1);
    expect(cart.subtotal).toBeCloseTo(4990 * 2, 4);
  });

  it('removedProductIds drops the line', () => {
    const property = makeProperty([
      [{ productId: 'plunge-all-in' }, { productId: 'sansevieria-trifasciata-90cm' }],
    ]);
    const cart = deriveCart(
      property,
      { qtyOverrides: {}, removedProductIds: ['plunge-all-in'] },
      STUB_FX,
      'MUR',
    );
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].productId).toBe('sansevieria-trifasciata-90cm');
  });
});

describe('deriveCart - MUR_PER_USD constant', () => {
  it('exposes the static fallback rate', () => {
    expect(MUR_PER_USD).toBe(45);
  });
});
