/**
 * Server-side re-pricing tests — Phase 0 money-path (IMPL-1 defect 2).
 *
 * The seed-catalog fixtures use REAL entries from src/data/products.json:
 *   id 'k1-nordictrack-2450' / sku 'K1-CDIO-NT2450' — Rs 150,000 MUR
 *   → canonical minor (cents-of-MUR) = 15,000,000.
 */

import { describe, it, expect } from 'vitest';
import {
  repriceCart,
  convertMinorFallback,
  FX_TOLERANCE_PCT,
  type MarketplacePriceRow,
} from '../_lib/pricing/repriceCart';
import type { CartLineItemPayload } from '../_lib/orderTypes';

const SEED_ID = 'k1-nordictrack-2450';
const SEED_SKU = 'K1-CDIO-NT2450';
const SEED_MINOR_MUR = 15_000_000; // Rs 150,000 × 100

function marketplaceLookup(
  rows: Record<number, MarketplacePriceRow>,
): (ids: number[]) => Promise<Map<number, MarketplacePriceRow>> {
  return async (ids) => {
    const m = new Map<number, MarketplacePriceRow>();
    for (const id of ids) {
      if (rows[id]) m.set(id, rows[id]);
    }
    return m;
  };
}

function line(overrides: Partial<CartLineItemPayload> = {}): CartLineItemPayload {
  return {
    productId: '42',
    name: 'Treadmill',
    quantity: 1,
    unitAmount: 100000,
    currency: 'MUR',
    ...overrides,
  };
}

describe('repriceCart — marketplace items (numeric Neon ids)', () => {
  const rows = {
    42: { priceMinor: 100000, currency: 'MUR', status: 'active' },
    43: { priceMinor: 250000, currency: 'MUR', status: 'active' },
  };

  it('accepts a correctly priced cart without adjustment', async () => {
    const r = await repriceCart([line()], 'MUR', marketplaceLookup(rows));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.priceAdjusted).toBe(false);
      expect(r.cart[0].unitAmount).toBe(100000);
    }
  });

  it('corrects a tampered price to the server price and flags priceAdjusted', async () => {
    const r = await repriceCart(
      [line({ unitAmount: 1 })], // tamper: Rs 0.01
      'MUR',
      marketplaceLookup(rows),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.priceAdjusted).toBe(true);
      expect(r.cart[0].unitAmount).toBe(100000);
    }
  });

  it('rejects an unknown product id with 400', async () => {
    const r = await repriceCart(
      [line({ productId: '999' })],
      'MUR',
      marketplaceLookup(rows),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.error).toMatch(/unknown product/i);
    }
  });

  it('rejects a non-active product with 400', async () => {
    const r = await repriceCart(
      [line({ productId: '44' })],
      'MUR',
      marketplaceLookup({ 44: { priceMinor: 5000, currency: 'MUR', status: 'archived' } }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('rejects a product/request currency mismatch with 400', async () => {
    const r = await repriceCart(
      [line({ currency: 'USD', unitAmount: 100 })],
      'USD',
      marketplaceLookup(rows), // product 42 is MUR
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('fails CLOSED (500) when the pricing lookup throws', async () => {
    const r = await repriceCart([line()], 'MUR', async () => {
      throw new Error('db down');
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });
});

describe('repriceCart — designer-rail items (seed catalog)', () => {
  it('reprices by catalog id in the native currency (exact match, no flag)', async () => {
    const r = await repriceCart(
      [line({ productId: SEED_ID, unitAmount: SEED_MINOR_MUR })],
      'MUR',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.priceAdjusted).toBe(false);
      expect(r.cart[0].unitAmount).toBe(SEED_MINOR_MUR);
      expect(r.cart[0].sku).toBe(SEED_SKU);
    }
  });

  it('also resolves by SKU', async () => {
    const r = await repriceCart(
      [line({ productId: SEED_SKU, unitAmount: SEED_MINOR_MUR })],
      'MUR',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cart[0].unitAmount).toBe(SEED_MINOR_MUR);
  });

  it('corrects a tampered designer price and flags priceAdjusted', async () => {
    const r = await repriceCart(
      [line({ productId: SEED_ID, unitAmount: 100 })], // tamper: Rs 1
      'MUR',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.priceAdjusted).toBe(true);
      expect(r.cart[0].unitAmount).toBe(SEED_MINOR_MUR);
    }
  });

  it('rejects unknown catalog ids with 400', async () => {
    const r = await repriceCart(
      [line({ productId: 'no-such-item' })],
      'MUR',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.error).toMatch(/unknown catalog/i);
    }
  });

  it('accepts a live-FX client price within tolerance of the fallback conversion', async () => {
    const serverUsd = convertMinorFallback(SEED_MINOR_MUR, 'MUR', 'USD');
    const clientUsd = Math.round(serverUsd * (1 + FX_TOLERANCE_PCT * 0.5)); // inside tolerance
    const r = await repriceCart(
      [line({ productId: SEED_ID, currency: 'USD', unitAmount: clientUsd })],
      'USD',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.priceAdjusted).toBe(false);
      expect(r.cart[0].unitAmount).toBe(clientUsd); // client live-FX price kept
    }
  });

  it('overrides an out-of-tolerance FX price with the server conversion', async () => {
    const serverUsd = convertMinorFallback(SEED_MINOR_MUR, 'MUR', 'USD');
    const r = await repriceCart(
      [line({ productId: SEED_ID, currency: 'USD', unitAmount: 1 })], // tamper
      'USD',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.priceAdjusted).toBe(true);
      expect(r.cart[0].unitAmount).toBe(serverUsd);
    }
  });
});

describe('repriceCart — per-line currency normalisation (review P0)', () => {
  it('overwrites a tampered line currency with the request currency (designer rail)', async () => {
    // Attack: request USD, but the line claims MUR so Stripe would
    // charge the USD-sized number as MUR (~1/45 the price).
    const serverUsd = convertMinorFallback(SEED_MINOR_MUR, 'MUR', 'USD');
    const r = await repriceCart(
      [line({ productId: SEED_ID, currency: 'MUR', unitAmount: serverUsd })],
      'USD',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cart[0].currency).toBe('USD'); // request currency wins
      expect(r.cart[0].unitAmount).toBe(serverUsd);
      expect(r.priceAdjusted).toBe(true); // mismatch flagged as tampering
    }
  });

  it('overwrites a tampered line currency on the marketplace rail too', async () => {
    const r = await repriceCart(
      [line({ productId: '42', currency: 'USD' })],
      'MUR',
      marketplaceLookup({ 42: { priceMinor: 100000, currency: 'MUR', status: 'active' } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cart[0].currency).toBe('MUR');
      expect(r.priceAdjusted).toBe(true);
    }
  });

  it('leaves currency + flag untouched when line currency matches the request', async () => {
    const r = await repriceCart(
      [line({ productId: SEED_ID, unitAmount: SEED_MINOR_MUR, currency: 'MUR' })],
      'MUR',
      marketplaceLookup({}),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cart[0].currency).toBe('MUR');
      expect(r.priceAdjusted).toBe(false);
    }
  });
});

describe('repriceCart — marketplace SKU attach (review P1)', () => {
  it('attaches the real catalog SKU from the products row', async () => {
    const r = await repriceCart(
      [line({ productId: '42' })],
      'MUR',
      marketplaceLookup({
        42: { priceMinor: 100000, currency: 'MUR', status: 'active', sku: 'K1-CDIO-NT2450' },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Without this, PayPal echoes item.sku = '42' (Neon numeric id),
      // recordOrderItemsForOrder matches nothing, and the whole
      // order_items → payouts → referrals → merchant-email pipeline
      // no-ops on the marketplace rail.
      expect(r.cart[0].sku).toBe('K1-CDIO-NT2450');
    }
  });

  it('OVERWRITES a client-supplied sku with the server catalog sku', async () => {
    const r = await repriceCart(
      [line({ productId: '42', sku: 'FORGED-SKU' })],
      'MUR',
      marketplaceLookup({
        42: { priceMinor: 100000, currency: 'MUR', status: 'active', sku: 'REAL-SKU' },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cart[0].sku).toBe('REAL-SKU');
  });

  it('leaves sku undefined when the products row has none', async () => {
    const r = await repriceCart(
      [line({ productId: '42' })],
      'MUR',
      marketplaceLookup({ 42: { priceMinor: 100000, currency: 'MUR', status: 'active' } }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cart[0].sku).toBeUndefined();
  });
});

describe('convertMinorFallback', () => {
  it('MUR→USD uses the fallback rate (45 MUR = 1 USD)', () => {
    expect(convertMinorFallback(4500, 'MUR', 'USD')).toBe(100);
  });
  it('same-currency is identity', () => {
    expect(convertMinorFallback(1234, 'MUR', 'MUR')).toBe(1234);
  });
});
