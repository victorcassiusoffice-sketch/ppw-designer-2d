import { describe, it, expect } from 'vitest';
import { splitCartByMerchant, type CartLineItem, type ProductMerchantLink } from '../_lib/cart/split';
import { validateCart } from '../cart-quote';

const usdItem = (productId: number, sku: string, qty: number, price: number): CartLineItem => ({
  productId,
  sku,
  name: `Product ${sku}`,
  quantity: qty,
  unitPriceMinor: price,
  currency: 'USD',
});

const link = (productId: number, merchantId: number, supplierId: number | null = null): [number, ProductMerchantLink] => [
  productId,
  { productId, merchantId, primarySupplierId: supplierId },
];

describe('splitCartByMerchant', () => {
  it('rejects empty cart', () => {
    const r = splitCartByMerchant([], new Map());
    expect(r.ok).toBe(false);
  });

  it('rejects mixed currencies', () => {
    const cart = [
      usdItem(1, 'A', 1, 1000),
      { ...usdItem(2, 'B', 1, 2000), currency: 'EUR' },
    ];
    const lookup = new Map([link(1, 10), link(2, 20)]);
    const r = splitCartByMerchant(cart, lookup);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/mixed currencies/i);
  });

  it('rejects line item with no merchant link', () => {
    const r = splitCartByMerchant([usdItem(1, 'A', 1, 1000)], new Map());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no merchant link/i);
  });

  it('rejects negative quantity', () => {
    const cart = [{ ...usdItem(1, 'A', 1, 1000), quantity: -1 }];
    const lookup = new Map([link(1, 10)]);
    const r = splitCartByMerchant(cart, lookup);
    expect(r.ok).toBe(false);
  });

  it('groups items by merchant + sums correctly', () => {
    const cart = [
      usdItem(1, 'A', 2, 1000), // merchant 10, line total 2000
      usdItem(2, 'B', 1, 1500), // merchant 10, line total 1500
      usdItem(3, 'C', 3, 500), // merchant 20, line total 1500
    ];
    const lookup = new Map([link(1, 10), link(2, 10), link(3, 20)]);
    const r = splitCartByMerchant(cart, lookup);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalMinor).toBe(5000);
      expect(r.merchantBreakdown).toHaveLength(2);
      const m10 = r.merchantBreakdown.find((m) => m.merchantId === 10);
      const m20 = r.merchantBreakdown.find((m) => m.merchantId === 20);
      expect(m10?.subtotalMinor).toBe(3500);
      expect(m10?.itemCount).toBe(3);
      expect(m20?.subtotalMinor).toBe(1500);
      expect(m20?.itemCount).toBe(3);
    }
  });

  it('preserves currency in result', () => {
    const cart = [{ ...usdItem(1, 'A', 1, 1000), currency: 'MUR' }];
    const lookup = new Map([link(1, 10)]);
    const r = splitCartByMerchant(cart, lookup);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.currency).toBe('MUR');
  });

  it('passes supplier id through', () => {
    const cart = [usdItem(1, 'A', 1, 1000)];
    const lookup = new Map([link(1, 10, 99)]);
    const r = splitCartByMerchant(cart, lookup);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.merchantBreakdown[0].supplierId).toBe(99);
  });

  it('sorts merchantBreakdown by merchantId ascending', () => {
    const cart = [usdItem(1, 'A', 1, 100), usdItem(2, 'B', 1, 100), usdItem(3, 'C', 1, 100)];
    const lookup = new Map([link(1, 30), link(2, 10), link(3, 20)]);
    const r = splitCartByMerchant(cart, lookup);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.merchantBreakdown.map((m) => m.merchantId)).toEqual([10, 20, 30]);
  });
});

describe('validateCart (Phase 4 cart-quote)', () => {
  const valid = {
    cart: [{ productId: 1, sku: 'A', name: 'X', quantity: 1, unitPriceMinor: 1000, currency: 'USD' }],
  };

  it('accepts a minimal valid payload', () => {
    const r = validateCart(valid);
    expect(r.ok).toBe(true);
  });

  it('rejects empty cart', () => {
    expect(validateCart({ cart: [] }).ok).toBe(false);
  });

  it('rejects missing productId', () => {
    expect(validateCart({ cart: [{ ...valid.cart[0], productId: 0 }] }).ok).toBe(false);
  });

  it('rejects fractional quantity', () => {
    expect(validateCart({ cart: [{ ...valid.cart[0], quantity: 1.5 }] }).ok).toBe(false);
  });

  it('rejects negative price', () => {
    expect(validateCart({ cart: [{ ...valid.cart[0], unitPriceMinor: -1 }] }).ok).toBe(false);
  });

  it('rejects 4-letter currency', () => {
    expect(validateCart({ cart: [{ ...valid.cart[0], currency: 'EURO' }] }).ok).toBe(false);
  });

  it('uppercases currency', () => {
    const r = validateCart({ cart: [{ ...valid.cart[0], currency: 'mur' }] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data[0].currency).toBe('MUR');
  });
});
