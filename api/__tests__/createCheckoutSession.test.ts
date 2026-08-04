/**
 * Unit tests for api/create-checkout-session.ts
 */

import { describe, it, expect, vi } from 'vitest';
import {
  processCheckoutRequest,
  validateRequest,
  buildMetadata,
  buildLineItems,
} from '../create-checkout-session';
import type { Repricer } from '../_lib/pricing/repriceCart';
import type { CreateCheckoutSessionRequest } from '../_lib/orderTypes';
import type Stripe from 'stripe';

/** Pass-through repricer for tests that target the Stripe plumbing —
 *  pricing behaviour is covered in repriceCart.test.ts. */
const passRepricer: Repricer = async (cart) => ({ ok: true, cart, priceAdjusted: false });

function makeValidRequest(): CreateCheckoutSessionRequest {
  return {
    cart: [
      { productId: 'sku-1', name: 'Ice bath barrel', quantity: 1, unitAmount: 2999900, currency: 'MUR' },
      { productId: 'sku-2', name: 'Sleep pod', quantity: 2, unitAmount: 4999900, currency: 'MUR' },
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
    currency: 'MUR',
    successUrl: 'https://designer.ppwellness.co/order/success',
    cancelUrl: 'https://designer.ppwellness.co/order/cancelled',
    orderId: 'PPW-TEST-001',
    property: {
      id: 'prop-1',
      name: 'Vic Showroom',
      rooms: [{ id: 'r1', name: 'Cold Plunge', itemCount: 1 }],
    },
    notes: 'Lift access only on weekdays.',
  };
}

describe('validateRequest', () => {
  it('accepts a complete payload', () => {
    expect(validateRequest(makeValidRequest()).ok).toBe(true);
  });

  it('rejects an empty cart', () => {
    const req = makeValidRequest();
    req.cart = [];
    const v = validateRequest(req);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/empty/i);
  });

  it('rejects an unsupported currency', () => {
    const req = makeValidRequest();
    // @ts-expect-error testing invalid runtime value
    req.currency = 'ZZZ';
    expect(validateRequest(req).ok).toBe(false);
  });

  it('rejects a missing email', () => {
    const req = makeValidRequest();
    req.customer.email = '';
    expect(validateRequest(req).ok).toBe(false);
  });

  it('rejects a non-http success URL', () => {
    const req = makeValidRequest();
    req.successUrl = 'javascript:alert(1)';
    expect(validateRequest(req).ok).toBe(false);
  });
});

describe('buildMetadata', () => {
  it('truncates oversized property snapshot to <=500 chars per value', () => {
    const req = makeValidRequest();
    req.property = {
      id: 'p',
      name: 'Mega Property',
      rooms: Array.from({ length: 50 }, (_, i) => ({
        id: 'room-' + i + '-' + 'x'.repeat(30),
        name: 'Room ' + i + ' ' + 'y'.repeat(30),
        itemCount: i,
      })),
    };
    const v = validateRequest(req);
    if (!v.ok) throw new Error(v.error);
    const md = buildMetadata(v.data);
    for (const [, value] of Object.entries(md)) {
      expect(value.length).toBeLessThanOrEqual(500);
    }
  });

  it('always carries orderId', () => {
    const v = validateRequest(makeValidRequest());
    if (!v.ok) throw new Error(v.error);
    expect(buildMetadata(v.data).orderId).toBe('PPW-TEST-001');
  });
});

describe('buildLineItems', () => {
  it('maps cart -> Stripe line items with lowercase currency and rounded amounts', () => {
    const req = makeValidRequest();
    const items = buildLineItems(req.cart, req.currency);
    expect(items).toHaveLength(2);
    const pd0 = items[0].price_data;
    if (!pd0 || !pd0.product_data) throw new Error('price_data missing');
    expect(pd0.currency).toBe('mur');
    expect(pd0.unit_amount).toBe(2999900);
    expect(pd0.product_data.name).toBe('Ice bath barrel');
    expect(items[1].quantity).toBe(2);
  });

  it('attaches images only when URL is http(s)', () => {
    const req = makeValidRequest();
    req.cart[0].imageUrl = 'https://cdn.ppwellness.co/sku-1.png';
    req.cart[1].imageUrl = 'javascript:alert(1)';
    const items = buildLineItems(req.cart, req.currency);
    const pd0 = items[0].price_data;
    const pd1 = items[1].price_data;
    if (!pd0 || !pd1 || !pd0.product_data || !pd1.product_data) throw new Error('price_data missing');
    expect(pd0.product_data.images).toEqual(['https://cdn.ppwellness.co/sku-1.png']);
    expect(pd1.product_data.images).toBeUndefined();
  });
});

describe('processCheckoutRequest - happy path', () => {
  it('returns the URL from Stripe', async () => {
    const fakeStripe = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: 'cs_test_123',
            url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          }),
        },
      },
    } as unknown as Pick<Stripe, 'checkout'>;
    const res = await processCheckoutRequest(makeValidRequest(), fakeStripe, passRepricer);
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.url).toContain('checkout.stripe.com');
      expect(res.priceAdjusted).toBe(false);
    }
  });

  it('sanitises Stripe errors -> 500 with safe message', async () => {
    const fakeStripe = {
      checkout: {
        sessions: {
          create: vi.fn().mockRejectedValue(new Error('Card declined; key sk_live_secret123')),
        },
      },
    } as unknown as Pick<Stripe, 'checkout'>;
    const res = await processCheckoutRequest(makeValidRequest(), fakeStripe, passRepricer);
    expect(res.status).toBe(500);
    if (res.status === 500) {
      expect(typeof res.error).toBe('string');
      expect(res.error.length).toBeLessThanOrEqual(200);
    }
  });

  it('returns 400 on validation failure', async () => {
    const fakeStripe = {
      checkout: { sessions: { create: vi.fn() } },
    } as unknown as Pick<Stripe, 'checkout'>;
    const res = await processCheckoutRequest({ cart: [] }, fakeStripe, passRepricer);
    expect(res.status).toBe(400);
  });
});

describe('processCheckoutRequest - server re-pricing (IMPL-1 defect 2)', () => {
  function stripeSpy() {
    const create = vi.fn().mockResolvedValue({
      id: 'cs_test_456',
      url: 'https://checkout.stripe.com/c/pay/cs_test_456',
    });
    const stripe = { checkout: { sessions: { create } } } as unknown as Pick<Stripe, 'checkout'>;
    return { stripe, create };
  }

  it('charges the SERVER price when the client price is tampered and flags priceAdjusted', async () => {
    const { stripe, create } = stripeSpy();
    const correctingRepricer: Repricer = async (cart) => ({
      ok: true,
      cart: cart.map((li) => ({ ...li, unitAmount: 2999900, sku: 'K1-REAL' })),
      priceAdjusted: true,
    });
    const req = makeValidRequest();
    req.cart = [
      { productId: 'sku-1', name: 'Ice bath barrel', quantity: 1, unitAmount: 1, currency: 'MUR' },
    ];
    const res = await processCheckoutRequest(req, stripe, correctingRepricer);
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.priceAdjusted).toBe(true);
    const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(2999900);
  });

  it('rejects when the repricer rejects (unknown id → 400) and never calls Stripe', async () => {
    const { stripe, create } = stripeSpy();
    const rejectingRepricer: Repricer = async () => ({
      ok: false,
      status: 400,
      error: 'Unknown catalog item: ghost',
    });
    const res = await processCheckoutRequest(makeValidRequest(), stripe, rejectingRepricer);
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('P0 currency-tamper: a MUR-labelled line in a USD request is charged in USD via the real repricer', async () => {
    // Attack from the review: POST currency:'USD' with a line claiming
    // currency:'MUR' + a USD-sized unitAmount. Before the fix
    // buildLineItems charged the USD-sized number as MUR (~1/45 the
    // price). The real repriceCart must normalise the line currency to
    // the request currency so Stripe charges USD.
    const { repriceCart, convertMinorFallback } = await import('../_lib/pricing/repriceCart');
    const serverUsd = convertMinorFallback(15_000_000, 'MUR', 'USD'); // k1-nordictrack-2450
    const { stripe, create } = stripeSpy();
    const realRepricer: Repricer = (cart, currency) =>
      repriceCart(cart, currency, async () => new Map());
    const req = makeValidRequest();
    req.currency = 'USD';
    req.cart = [
      {
        productId: 'k1-nordictrack-2450',
        name: 'Treadmill',
        quantity: 1,
        unitAmount: serverUsd,
        currency: 'MUR', // tampered per-line currency
      },
    ];
    const res = await processCheckoutRequest(req, stripe, realRepricer);
    expect(res.status).toBe(200);
    if (res.status === 200) expect(res.priceAdjusted).toBe(true); // mismatch flagged
    const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params.line_items?.[0]?.price_data?.currency).toBe('usd'); // NOT 'mur'
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(serverUsd);
  });

  it('stashes the repriced cart snapshot + client_reference_id on the session (defect 6 feed)', async () => {
    const { stripe, create } = stripeSpy();
    const res = await processCheckoutRequest(makeValidRequest(), stripe, passRepricer);
    expect(res.status).toBe(200);
    const params = create.mock.calls[0][0] as Stripe.Checkout.SessionCreateParams;
    expect(params.client_reference_id).toBe('PPW-TEST-001');
    const cartMeta = JSON.parse((params.metadata as Record<string, string>).cart) as Array<{
      s: string;
      q: number;
      u: number;
    }>;
    expect(cartMeta).toEqual([
      { s: 'sku-1', q: 1, u: 2999900 },
      { s: 'sku-2', q: 2, u: 4999900 },
    ]);
  });
});
