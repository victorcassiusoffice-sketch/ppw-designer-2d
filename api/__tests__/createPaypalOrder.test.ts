/**
 * Unit tests for api/createPaypalOrder.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processPaypalOrderRequest,
  validatePaypalRequest,
  buildPaypalOrderBody,
  toPaypalAmount,
} from '../_lib/paypal/createOrder';
import type { Repricer } from '../_lib/pricing/repriceCart';
import { _resetPaypalTokenCacheForTests } from '../_lib/paypalClient';

/** Pass-through repricer: trusts the client cart (tests that target the
 *  PayPal plumbing, not pricing). Pricing behaviour is covered in
 *  repriceCart.test.ts + dedicated cases below. */
const passRepricer: Repricer = async (cart) => ({ ok: true, cart, priceAdjusted: false });

function makeValidRequest() {
  return {
    cart: [
      { productId: 'sku-1', name: 'Ice bath barrel', quantity: 1, unitAmount: 199900, currency: 'USD' as const },
      { productId: 'sku-2', name: 'Sleep pod', quantity: 2, unitAmount: 99900, currency: 'USD' as const },
    ],
    customer: {
      name: 'Test Customer',
      email: 'test@example.com',
      phone: '+230 5 123 4567',
      addressLine1: '1 Wellness Way',
      city: 'Tamarin',
      postcode: '90100',
      country: 'MU',
    },
    currency: 'USD' as const,
    successUrl: 'https://designer.ppwellness.co/order/success',
    cancelUrl: 'https://designer.ppwellness.co/order/cancelled',
    orderId: 'PPW-TEST-001',
    notes: 'Lift access only on weekdays.',
  };
}

describe('validatePaypalRequest', () => {
  it('accepts a complete payload', () => {
    expect(validatePaypalRequest(makeValidRequest()).ok).toBe(true);
  });
  it('rejects empty cart', () => {
    const r = makeValidRequest(); r.cart = [];
    const v = validatePaypalRequest(r);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/empty/i);
  });
  it('rejects unsupported currency', () => {
    const r = makeValidRequest(); (r as { currency: string }).currency = 'ZZZ';
    expect(validatePaypalRequest(r).ok).toBe(false);
  });
  it('rejects non-http successstring | URL', () => {
    const r = makeValidRequest(); r.successUrl = 'javascript:alert(1)';
    expect(validatePaypalRequest(r).ok).toBe(false);
  });
  it('rejects missing email', () => {
    const r = makeValidRequest(); r.customer.email = '';
    expect(validatePaypalRequest(r).ok).toBe(false);
  });
  it('rejects missing orderId', () => {
    const r = makeValidRequest(); r.orderId = '';
    expect(validatePaypalRequest(r).ok).toBe(false);
  });
});

describe('toPaypalAmount', () => {
  it('converts USD cents to 2-decimal string', () => {
    expect(toPaypalAmount(199900, 'USD')).toBe('1999.00');
    expect(toPaypalAmount(50, 'USD')).toBe('0.50');
  });
  it('treats MUR as minor units too (Phase 0 wire-contract) — Rs 1,000 = 100000 minor → "1000.00"', () => {
    expect(toPaypalAmount(100000, 'MUR')).toBe('1000.00');
    // Regression for the 100× overcharge (IMPL-1 defect 3): 50000 minor
    // is Rs 500.00, NOT Rs 50,000.
    expect(toPaypalAmount(50000, 'MUR')).toBe('500.00');
  });
});

describe('buildPaypalOrderBody', () => {
  it('produces 2-decimal totals and CAPTURE intent', () => {
    const v = validatePaypalRequest(makeValidRequest());
    if (!v.ok) throw new Error(v.error);
    const body = buildPaypalOrderBody(v.data);
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units).toHaveLength(1);
    const pu = body.purchase_units[0];
    expect(pu.amount.currency_code).toBe('USD');
    expect(pu.amount.value).toBe('3997.00');
    expect(pu.items).toHaveLength(2);
    expect(pu.items[0].unit_amount.value).toBe('1999.00');
    expect(pu.items[1].quantity).toBe('2');
  });
  it('appends rail+orderId to return_url', () => {
    const v = validatePaypalRequest(makeValidRequest());
    if (!v.ok) throw new Error(v.error);
    const body = buildPaypalOrderBody(v.data);
    expect(body.application_context.return_url).toContain('rail=paypal');
    expect(body.application_context.return_url).toContain('PPW-TEST-001');
  });
  it('uses reference_id from orderId', () => {
    const v = validatePaypalRequest(makeValidRequest());
    if (!v.ok) throw new Error(v.error);
    const body = buildPaypalOrderBody(v.data);
    expect(body.purchase_units[0].reference_id).toBe('PPW-TEST-001');
  });

  it('packs orderId + checkout email into custom_id (defect 5 email channel)', () => {
    const v = validatePaypalRequest(makeValidRequest());
    if (!v.ok) throw new Error(v.error);
    const body = buildPaypalOrderBody(v.data);
    expect(body.purchase_units[0].custom_id).toBe('PPW-TEST-001|test@example.com');
  });

  it('MUR regression (both rails): Rs 1,000 sent as 100000 minor reaches PayPal as "1000.00"', () => {
    const r = {
      ...makeValidRequest(),
      currency: 'MUR',
      cart: [
        { productId: '7', name: 'Yoga mat', quantity: 1, unitAmount: 100000, currency: 'MUR' },
      ],
    };
    const v = validatePaypalRequest(r);
    if (!v.ok) throw new Error(v.error);
    const body = buildPaypalOrderBody(v.data);
    expect(body.purchase_units[0].items[0].unit_amount.value).toBe('1000.00');
    expect(body.purchase_units[0].amount.value).toBe('1000.00');
  });

  it('prefers the server-resolved sku over productId on PayPal items', () => {
    const r = {
      ...makeValidRequest(),
      cart: [
        { productId: 'k1-x', name: 'X', quantity: 1, unitAmount: 100, currency: 'USD', sku: 'K1-REAL-SKU' },
      ],
    };
    const v = validatePaypalRequest(r);
    if (!v.ok) throw new Error(v.error);
    const body = buildPaypalOrderBody(v.data);
    expect(body.purchase_units[0].items[0].sku).toBe('K1-REAL-SKU');
  });
});

describe('processPaypalOrderRequest', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    _resetPaypalTokenCacheForTests();
    process.env = {
      ...ORIGINAL_ENV,
      PAYPAL_CLIENT_ID: 'test-client-id',
      PAYPAL_CLIENT_SECRET: 'test-secret',
      PAYPAL_ENV: 'sandbox',
    };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 500 when PayPal env unset', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    const res = await processPaypalOrderRequest(makeValidRequest());
    expect(res.status).toBe(500);
    if (res.status === 500) expect(res.error).toMatch(/not configured/i);
  });

  it('returns 400 on validation failure', async () => {
    const res = await processPaypalOrderRequest({ cart: [] });
    expect(res.status).toBe(400);
  });

  it('happy path returns approvalUrl + paypalOrderId', async () => {
    const fakeFetch = vi.fn(async (url: string |string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok-123', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.endsWith('/v2/checkout/orders')) {
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-ORDER-XYZ',
            status: 'CREATED',
            links: [
              { rel: 'self', href: 'https://api.sandbox.paypal.com/x', method: 'GET' },
              { rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-XYZ', method: 'GET' },
            ],
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error('Unexpected fetch ' + u);
    }) as unknown as typeof fetch;
    const res = await processPaypalOrderRequest(makeValidRequest(), fakeFetch, passRepricer);
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.paypalOrderId).toBe('PAYPAL-ORDER-XYZ');
      expect(res.approvalUrl).toContain('paypal.com/checkoutnow');
      expect(res.priceAdjusted).toBe(false);
    }
  });

  it('re-prices a tampered cart to the server price and flags priceAdjusted', async () => {
    const sent: unknown[] = [];
    const fakeFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (u.endsWith('/v2/checkout/orders')) {
        sent.push(JSON.parse(String(init?.body ?? '{}')));
        return new Response(
          JSON.stringify({
            id: 'PAYPAL-ORDER-REPRICED',
            links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?x', method: 'GET' }],
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new Error('Unexpected fetch ' + u);
    }) as unknown as typeof fetch;
    // Repricer stub simulating the server catalog: corrects the tampered
    // 1-cent price to the real 199900.
    const correctingRepricer: Repricer = async (cart) => ({
      ok: true,
      cart: cart.map((li) => ({ ...li, unitAmount: 199900 })),
      priceAdjusted: true,
    });
    const req = makeValidRequest();
    req.cart = [
      { productId: 'sku-1', name: 'Ice bath barrel', quantity: 1, unitAmount: 1, currency: 'USD' as const },
    ];
    const res = await processPaypalOrderRequest(req, fakeFetch, correctingRepricer);
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.priceAdjusted).toBe(true);
    const body = sent[0] as {
      purchase_units: Array<{ items: Array<{ unit_amount: { value: string } }> }>;
    };
    expect(body.purchase_units[0].items[0].unit_amount.value).toBe('1999.00');
  });

  it('rejects the request when the repricer rejects (unknown id → 400)', async () => {
    const rejectingRepricer: Repricer = async () => ({
      ok: false,
      status: 400,
      error: 'Unknown product id: 999',
    });
    const res = await processPaypalOrderRequest(makeValidRequest(), undefined, rejectingRepricer);
    expect(res.status).toBe(400);
    if (res.status === 400) expect(res.error).toMatch(/unknown product/i);
  });

  it('returns 500 when PayPal returns no approve link', async () => {
    const fakeFetch = vi.fn(async (url: string |string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ id: 'X', links: [{ rel: 'self', href: '/x', method: 'GET' }] }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const res = await processPaypalOrderRequest(makeValidRequest(), fakeFetch, passRepricer);
    expect(res.status).toBe(500);
  });

  it('sanitises PayPal API errors to a short message', async () => {
    const fakeFetch = vi.fn(async (url: string |string | URL) => {
      const u = String(url);
      if (u.endsWith('/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'tok', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('forbidden', { status: 403 });
    }) as unknown as typeof fetch;
    const res = await processPaypalOrderRequest(makeValidRequest(), fakeFetch, passRepricer);
    expect(res.status).toBe(500);
    if (res.status === 500) {
      expect(res.error.length).toBeLessThanOrEqual(200);
      expect(res.error).not.toContain('test-secret');
    }
  });
});
