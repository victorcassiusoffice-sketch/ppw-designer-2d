/**
 * OMS Wave 5.4 — cart-split property tests.
 *
 * Vitest-flavoured property tests on splitCartByMerchant. We don't pull
 * fast-check as a dep (free-tier discipline) — instead we hand-roll a
 * small generator that emits cart shapes with arbitrary line counts,
 * merchants, currencies, quantities, and prices, then assert invariants
 * on the result.
 *
 * Invariants tested:
 *   1. Conservation: sum(line totals) == result.totalMinor when ok.
 *   2. Partition: every input line lands in exactly one merchant bucket.
 *   3. Per-merchant subtotal == sum of line totals in that bucket.
 *   4. Mixed currencies always reject.
 *   5. Empty cart always rejects.
 *   6. Missing merchant link always rejects.
 *   7. Negative or non-integer quantity always rejects.
 */

import { describe, it, expect } from 'vitest';
import {
  splitCartByMerchant,
  type CartLineItem,
  type ProductMerchantLink,
} from '../lib/cart/split';

function rng(seed: number): () => number {
  // Mulberry32 — deterministic PRNG so failures reproduce.
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

interface Gen {
  cart: CartLineItem[];
  lookup: Map<number, ProductMerchantLink>;
  expectedTotalMinor: number;
  merchantBucketTotals: Map<number, number>;
}

function genCart(seed: number, opts: { currencies?: string[]; merchants?: number[] } = {}): Gen {
  const r = rng(seed);
  const currencies = opts.currencies ?? ['USD'];
  const merchants = opts.merchants ?? [1, 2, 3];
  const lineCount = Math.max(1, Math.floor(r() * 8) + 1);
  const cart: CartLineItem[] = [];
  const lookup = new Map<number, ProductMerchantLink>();
  const merchantBucketTotals = new Map<number, number>();
  let totalMinor = 0;
  const productPool = new Set<number>();

  for (let i = 0; i < lineCount; i++) {
    const productId = Math.floor(r() * 1000) + 1;
    productPool.add(productId);
    const merchantId = merchants[Math.floor(r() * merchants.length)]!;
    if (!lookup.has(productId)) {
      lookup.set(productId, { productId, merchantId, primarySupplierId: null });
    }
    const link = lookup.get(productId)!;
    const quantity = Math.max(1, Math.floor(r() * 5) + 1);
    const unitPriceMinor = Math.floor(r() * 100_000) + 1;
    const currency = currencies[Math.floor(r() * currencies.length)]!;
    const lineTotal = quantity * unitPriceMinor;
    cart.push({
      productId,
      sku: `SKU-${productId}`,
      name: `P${productId}`,
      quantity,
      unitPriceMinor,
      currency,
    });
    if (currencies.length === 1) {
      totalMinor += lineTotal;
      merchantBucketTotals.set(
        link.merchantId,
        (merchantBucketTotals.get(link.merchantId) ?? 0) + lineTotal,
      );
    }
  }

  return { cart, lookup, expectedTotalMinor: totalMinor, merchantBucketTotals };
}

describe('splitCartByMerchant — property tests', () => {
  it('conserves total across 200 random single-currency carts', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { cart, lookup, expectedTotalMinor, merchantBucketTotals } = genCart(seed);
      const result = splitCartByMerchant(cart, lookup);
      if (!result.ok) {
        // Should only happen for impossible inputs — fail loudly.
        throw new Error(`seed ${seed} unexpectedly rejected: ${result.error}`);
      }
      expect(result.totalMinor).toBe(expectedTotalMinor);
      // Partition: every merchant bucket sum matches our oracle.
      for (const m of result.merchantBreakdown) {
        expect(m.subtotalMinor).toBe(merchantBucketTotals.get(m.merchantId) ?? 0);
        // Each bucket's items sum to its own subtotal.
        const lineSum = m.items.reduce((s, i) => s + i.lineTotalMinor, 0);
        expect(lineSum).toBe(m.subtotalMinor);
      }
    }
  });

  it('rejects every mixed-currency cart (100 random)', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const { cart, lookup } = genCart(seed * 7 + 11, {
        currencies: ['USD', 'MUR', 'EUR'],
      });
      // Skip carts the generator happened to produce as single-currency.
      // We're testing the rejection path, not the generator distribution.
      if (cart.length < 2) {
        cart.push({
          productId: cart[0]!.productId,
          sku: cart[0]!.sku,
          name: cart[0]!.name,
          quantity: 1,
          unitPriceMinor: 100,
          currency: 'USD',
        });
      }
      // Force two distinct currencies on the first and last lines.
      cart[0]!.currency = 'USD';
      cart[cart.length - 1]!.currency = 'MUR';
      const result = splitCartByMerchant(cart, lookup);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toMatch(/mixed currencies/i);
      }
    }
  });

  it('rejects when any line is missing a merchant link', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { cart } = genCart(seed);
      const emptyLookup = new Map<number, ProductMerchantLink>();
      const result = splitCartByMerchant(cart, emptyLookup);
      expect(result.ok).toBe(false);
    }
  });

  it('rejects negative or non-integer quantities', () => {
    const lookup = new Map([[1, { productId: 1, merchantId: 1, primarySupplierId: null }]]);
    for (const badQty of [0, -1, 1.5, NaN, Infinity]) {
      const result = splitCartByMerchant(
        [
          {
            productId: 1,
            sku: 'X',
            name: 'X',
            quantity: badQty,
            unitPriceMinor: 100,
            currency: 'USD',
          },
        ],
        lookup,
      );
      expect(result.ok).toBe(false);
    }
  });

  it('rejects empty cart', () => {
    const result = splitCartByMerchant([], new Map());
    expect(result.ok).toBe(false);
  });

  it('partitions deterministically — same input yields same merchant breakdown order', () => {
    const { cart, lookup } = genCart(42);
    const a = splitCartByMerchant(cart, lookup);
    const b = splitCartByMerchant(cart, lookup);
    expect(a).toEqual(b);
    if (a.ok && b.ok) {
      // Order is merchantId ascending — verify.
      const ids = a.merchantBreakdown.map((m) => m.merchantId);
      const sorted = [...ids].sort((x, y) => x - y);
      expect(ids).toEqual(sorted);
    }
  });
});
