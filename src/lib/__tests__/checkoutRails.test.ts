/**
 * Unit tests for the checkout-rail seam (src/lib/checkoutRails.ts) and
 * the Gumroad client helpers (src/lib/gumroadCheckout.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCheckoutRail, railButtonLabel } from '../checkoutRails';
import {
  readGumroadReturnFlag,
  resolveGumroadReturnRef,
  stripGumroadReturnParams,
  saveGumroadPendingRef,
  readGumroadPendingRef,
  clearGumroadPendingRef,
  GUMROAD_PENDING_REF_KEY,
} from '../gumroadCheckout';

describe('resolveCheckoutRail', () => {
  it('picks gumroad when VITE_GUMROAD_ENABLED=true', () => {
    expect(resolveCheckoutRail({ VITE_GUMROAD_ENABLED: 'true' })).toBe('gumroad');
  });
  it('gumroad wins over paypal and stripe when several are on', () => {
    expect(
      resolveCheckoutRail({
        VITE_GUMROAD_ENABLED: 'true',
        VITE_PAYPAL_ENABLED: 'true',
        VITE_STRIPE_ENABLED: 'true',
      }),
    ).toBe('gumroad');
  });
  it('paypal when only paypal is on', () => {
    expect(resolveCheckoutRail({ VITE_PAYPAL_ENABLED: 'true' })).toBe('paypal');
  });
  it('stripe when only stripe is on', () => {
    expect(resolveCheckoutRail({ VITE_STRIPE_ENABLED: 'true' })).toBe('stripe');
  });
  it('defaults to paypal (legacy behaviour) when nothing is set', () => {
    expect(resolveCheckoutRail({})).toBe('paypal');
  });
  it('treats "false"/empty/garbage as off', () => {
    expect(
      resolveCheckoutRail({ VITE_GUMROAD_ENABLED: 'false', VITE_STRIPE_ENABLED: '' }),
    ).toBe('paypal');
    expect(resolveCheckoutRail({ VITE_GUMROAD_ENABLED: 'nope' })).toBe('paypal');
  });
  it('accepts boolean true and "1"/"yes"/"on" variants', () => {
    expect(resolveCheckoutRail({ VITE_GUMROAD_ENABLED: true })).toBe('gumroad');
    expect(resolveCheckoutRail({ VITE_GUMROAD_ENABLED: '1' })).toBe('gumroad');
    expect(resolveCheckoutRail({ VITE_GUMROAD_ENABLED: 'ON' })).toBe('gumroad');
  });
});

describe('railButtonLabel', () => {
  it('labels every rail in both states', () => {
    expect(railButtonLabel('gumroad', false)).toMatch(/Gumroad/);
    expect(railButtonLabel('gumroad', true)).toMatch(/Redirecting/);
    expect(railButtonLabel('paypal', false)).toMatch(/PayPal/);
    expect(railButtonLabel('stripe', false)).toMatch(/Stripe/);
  });
});

describe('gumroad return helpers', () => {
  it('readGumroadReturnFlag detects ?rail=gumroad', () => {
    expect(readGumroadReturnFlag('?rail=gumroad')).toBe(true);
    expect(readGumroadReturnFlag('rail=gumroad&x=1')).toBe(true);
    expect(readGumroadReturnFlag('?rail=paypal')).toBe(false);
    expect(readGumroadReturnFlag('')).toBe(false);
  });

  it('stripGumroadReturnParams removes the round-trip params only', () => {
    expect(
      stripGumroadReturnParams('/order/track/mp_1?rail=gumroad&sale_id=s1&keep=yes'),
    ).toBe('/order/track/mp_1?keep=yes');
    expect(stripGumroadReturnParams('/order/track/mp_1?rail=gumroad')).toBe('/order/track/mp_1');
  });

  it('resolveGumroadReturnRef prefers the query param', () => {
    expect(resolveGumroadReturnRef('?order_ref=mp_q')).toBe('mp_q');
  });
});

describe('gumroad pending-ref storage', () => {
  // vitest env is node — provide a minimal localStorage shim.
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  it('save → read → clear round-trips', () => {
    expect(readGumroadPendingRef()).toBeNull();
    saveGumroadPendingRef('mp_local');
    expect(readGumroadPendingRef()).toBe('mp_local');
    expect(resolveGumroadReturnRef('')).toBe('mp_local');
    // Query param still wins over storage.
    expect(resolveGumroadReturnRef('?order_ref=mp_q')).toBe('mp_q');
    clearGumroadPendingRef();
    expect(readGumroadPendingRef()).toBeNull();
    expect(GUMROAD_PENDING_REF_KEY).toBe('ppw_gumroad_pending_ref');
  });
});
