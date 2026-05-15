/**
 * OMS Wave 5.3 — marketplace cart store round-trip.
 *
 * Validates the Zustand store add/remove/setQuantity invariants used
 * by the new MarketplaceCartPage (Wave 1.1) before any persistence.
 *
 * Couldn't reuse the Designer save/load test directly (W2.6 schema is
 * server-side; UI save button is staged for a follow-up tick), so this
 * proves the client-side state machine instead.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useMarketplaceCart, totalMinor } from '../marketplaceCartStore';

beforeEach(() => {
  useMarketplaceCart.setState({ items: [] });
});

describe('marketplaceCartStore — round-trip invariants', () => {
  it('adds an item with default qty=1', () => {
    useMarketplaceCart.getState().addItem({
      productId: 42,
      sku: 'SKU-42',
      name: 'Sleep pod XL',
      category: 'sleep-pod',
      unitPriceMinor: 250000,
      currency: 'USD',
      imageUrl: null,
    });
    const items = useMarketplaceCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toBe(1);
    expect(items[0]!.productId).toBe(42);
  });

  it('coalesces a repeated addItem into a higher quantity', () => {
    const add = () =>
      useMarketplaceCart.getState().addItem({
        productId: 7,
        sku: 'X',
        name: 'X',
        category: 'plant',
        unitPriceMinor: 1000,
        currency: 'MUR',
        imageUrl: null,
      });
    add();
    add();
    add();
    const items = useMarketplaceCart.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toBe(3);
  });

  it('setQuantity(0) removes the line', () => {
    useMarketplaceCart.getState().addItem({
      productId: 1,
      sku: 'A',
      name: 'A',
      category: 'plant',
      unitPriceMinor: 500,
      currency: 'USD',
      imageUrl: null,
    });
    useMarketplaceCart.getState().setQuantity(1, 0);
    expect(useMarketplaceCart.getState().items).toHaveLength(0);
  });

  it('setQuantity coerces fractions / negatives via floor + max(0)', () => {
    useMarketplaceCart.getState().addItem({
      productId: 1,
      sku: 'A',
      name: 'A',
      category: 'plant',
      unitPriceMinor: 100,
      currency: 'USD',
      imageUrl: null,
    });
    useMarketplaceCart.getState().setQuantity(1, 3.7);
    expect(useMarketplaceCart.getState().items[0]!.quantity).toBe(3);
    useMarketplaceCart.getState().setQuantity(1, -5);
    expect(useMarketplaceCart.getState().items).toHaveLength(0);
  });

  it('clear() empties the cart', () => {
    useMarketplaceCart.getState().addItem({
      productId: 1,
      sku: 'A',
      name: 'A',
      category: 'plant',
      unitPriceMinor: 100,
      currency: 'USD',
      imageUrl: null,
    });
    useMarketplaceCart.getState().clear();
    expect(useMarketplaceCart.getState().items).toHaveLength(0);
  });

  it('totalMinor sums quantity × unit across items', () => {
    expect(
      totalMinor([
        {
          productId: 1,
          sku: 'A',
          name: 'A',
          category: 'plant',
          quantity: 2,
          unitPriceMinor: 100,
          currency: 'USD',
          imageUrl: null,
        },
        {
          productId: 2,
          sku: 'B',
          name: 'B',
          category: 'plant',
          quantity: 3,
          unitPriceMinor: 50,
          currency: 'USD',
          imageUrl: null,
        },
      ]),
    ).toBe(2 * 100 + 3 * 50);
  });
});
