/**
 * Review P1 (2026-08-04) — priceAdjusted consumption tests.
 *
 * The server's re-pricing flag used to dead-end: no client code read
 * it, so a server-adjusted total was silently charged. These tests
 * prove (a) the confirm helper, and (b) that startPaypalCheckout
 * blocks the redirect when the buyer declines the adjusted price.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { confirmAdjustedPrices } from '../priceAdjust';
import { startPaypalCheckout, type CreatePaypalOrderPayload } from '../paypal';

function stubWindow(confirmResult: boolean) {
  const confirm = vi.fn(() => confirmResult);
  const assign = vi.fn();
  vi.stubGlobal('window', { confirm, location: { assign } });
  return { confirm, assign };
}

function minimalPayload(): CreatePaypalOrderPayload {
  return {
    currency: 'MUR',
    customer: {
      name: 'V', email: 'v@x.co', phone: '+230', addressLine1: '1',
      addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
    },
    cart: [
      { productId: 'a', name: 'Item', quantity: 1, unitAmount: 100000, currency: 'MUR' },
    ],
    successUrl: 'http://localhost/order/success',
    cancelUrl: 'http://localhost/order/cancelled',
    orderId: 'PPW-ADJ-1',
  } as CreatePaypalOrderPayload;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('confirmAdjustedPrices', () => {
  it('proceeds (true) when no window/confirm exists (server price is correct; prompt is disclosure)', () => {
    expect(confirmAdjustedPrices()).toBe(true);
  });

  it('returns the user\'s confirm() answer when a window exists', () => {
    const { confirm } = stubWindow(false);
    expect(confirmAdjustedPrices()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    stubWindow(true);
    expect(confirmAdjustedPrices()).toBe(true);
  });
});

describe('startPaypalCheckout — priceAdjusted gate (review P1)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_PAYPAL_ENABLED', 'true');
  });

  function fetchWith(priceAdjusted: boolean) {
    return vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          paypalOrderId: 'PAYPAL-1',
          approvalUrl: 'https://paypal.example/approve',
          priceAdjusted,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;
  }

  it('blocks the redirect + returns error when the buyer declines the adjusted price', async () => {
    const { assign } = stubWindow(false);
    const r = await startPaypalCheckout(minimalPayload(), fetchWith(true));
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/prices were updated/i);
    expect(assign).not.toHaveBeenCalled();
  });

  it('redirects when the buyer accepts the adjusted price', async () => {
    const { confirm, assign } = stubWindow(true);
    const r = await startPaypalCheckout(minimalPayload(), fetchWith(true));
    expect(r.status).toBe('redirected');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('https://paypal.example/approve');
  });

  it('never prompts when priceAdjusted is false', async () => {
    const { confirm, assign } = stubWindow(false);
    const r = await startPaypalCheckout(minimalPayload(), fetchWith(false));
    expect(r.status).toBe('redirected');
    expect(confirm).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalled();
  });
});
