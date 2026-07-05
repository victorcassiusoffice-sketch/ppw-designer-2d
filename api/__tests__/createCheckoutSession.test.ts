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
import type { CreateCheckoutSessionRequest } from '../_lib/orderTypes';
import type Stripe from 'stripe';

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
    const res = await processCheckoutRequest(makeValidRequest(), fakeStripe);
    expect(res.status).toBe(200);
    if (res.status === 200) {
      expect(res.url).toContain('checkout.stripe.com');
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
    const res = await processCheckoutRequest(makeValidRequest(), fakeStripe);
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
    const res = await processCheckoutRequest({ cart: [] }, fakeStripe);
    expect(res.status).toBe(400);
  });
});
