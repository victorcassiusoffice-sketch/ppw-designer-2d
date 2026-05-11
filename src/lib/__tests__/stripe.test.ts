/**
 * Stripe scaffold - unit tests.
 *
 * The dev environment may have VITE_STRIPE_PUBLISHABLE_KEY set in
 * .env.local (Vic pasted it in Week 3). For deterministic results,
 * scrub it on import.meta.env around the "unset" tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCheckoutPayload,
  isStripeConfigured,
  makeOrderId,
  startStripeCheckout,
  type CreateCheckoutPayload,
} from '../stripe';
import type { CartTotals } from '../../store/cartStore';
import type { Product } from '../../data/products.schema';

function clearPublishableKey(): void {
  vi.stubEnv('VITE_STRIPE_PUBLISHABLE_KEY', '');
}
function restorePublishableKey(): void {
  vi.unstubAllEnvs();
}

function fakeProduct(id: string, currency: 'MUR' | 'USD' | 'EUR' | 'GBP', value: number): Product {
  return {
    id,
    sku: id,
    name: 'Test ' + id,
    category: 'plant',
    supplier: 'Test Supplier',
    dimensions_cm: { length: 100, width: 100, height: 100 },
    weight_kg: 1,
    price: { value, currency },
    commission_pct: 0,
    shopify_ready: false,
    image_url: '',
    designer_status: 'Not Started',
    delivery_regions: ['MU'],
    notes: '',
  };
}

function fakeCart(): CartTotals {
  return {
    lines: [
      {
        productId: 'a',
        product: fakeProduct('a', 'USD', 100),
        quantity: 2,
        placedCount: 2,
        unitPrice: 100,
        unitCurrency: 'USD',
        unitPriceDisplay: 100,
        lineTotalDisplay: 200,
        perRoom: [],
      },
      {
        productId: 'b',
        product: fakeProduct('b', 'MUR', 5000),
        quantity: 1,
        placedCount: 1,
        unitPrice: 5000,
        unitCurrency: 'MUR',
        unitPriceDisplay: 111,
        lineTotalDisplay: 111,
        perRoom: [],
      },
    ],
    uniqueProductCount: 2,
    totalItemCount: 3,
    subtotal: 311,
    subtotalByCurrency: { MUR: 13995, USD: 311, EUR: 286.12, GBP: 245.69 },
    currency: 'USD',
  };
}

describe('isStripeConfigured', () => {
  beforeEach(() => clearPublishableKey());
  afterEach(() => restorePublishableKey());
  it('reports false when no publishable key is set', () => {
    expect(isStripeConfigured()).toBe(false);
  });
});

describe('startStripeCheckout', () => {
  beforeEach(() => clearPublishableKey());
  afterEach(() => restorePublishableKey());
  it('returns pending when the key is unset, never calls fetch', async () => {
    const fetchSpy = vi.fn();
    const payload = buildCheckoutPayload({
      cart: fakeCart(),
      customer: {
        name: 'V', email: 'v@example.com', phone: '+230123', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '00000', country: 'MU', notes: '',
      },
      origin: 'http://localhost',
      orderId: 'PPW-TEST',
    });
    const result = await startStripeCheckout(payload, fetchSpy as unknown as typeof fetch);
    expect(result.status).toBe('pending');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('buildCheckoutPayload', () => {
  it('maps cart lines into Stripe-shaped line items', () => {
    const customer = {
      name: 'Vic',
      email: 'vic@ppwellness.co',
      phone: '+230123',
      addressLine1: '1 Beach Rd',
      addressLine2: '',
      city: 'Tamarin',
      postcode: '90901',
      country: 'MU',
      notes: 'leave at gate',
    };
    const payload: CreateCheckoutPayload = buildCheckoutPayload({
      cart: fakeCart(),
      customer,
      origin: 'https://designer.ppwellness.co',
      orderId: 'PPW-ABC-123',
    });
    expect(payload.currency).toBe('USD');
    expect(payload.lineItems).toHaveLength(2);
    expect(payload.cart).toHaveLength(2);
    expect(payload.lineItems[0]).toMatchObject({
      productId: 'a',
      quantity: 2,
      unitAmount: 10000,
      currency: 'USD',
    });
    expect(payload.successUrl).toContain('/order/success');
    expect(payload.successUrl).toContain('CHECKOUT_SESSION_ID');
    expect(payload.cancelUrl).toContain('/order/cancelled');
    expect(payload.orderId).toBe('PPW-ABC-123');
    expect(payload.notes).toBe('leave at gate');
  });

  it('keeps MUR amounts as integer rupees (no minor unit)', () => {
    const cart = fakeCart();
    cart.currency = 'MUR';
    cart.lines = [{ ...cart.lines[1], unitPriceDisplay: 5000, lineTotalDisplay: 5000 }];
    const payload = buildCheckoutPayload({
      cart,
      customer: {
        name: 'Vic', email: 'v@ppw.co', phone: '+230', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
      },
      origin: 'http://x',
      orderId: 'PPW-X',
    });
    expect(payload.lineItems[0].unitAmount).toBe(5000);
    expect(payload.currency).toBe('MUR');
  });
});

describe('makeOrderId', () => {
  it('starts with PPW-', () => {
    expect(makeOrderId().startsWith('PPW-')).toBe(true);
  });

  it('produces unique-ish ids', () => {
    const set = new Set<string>();
    for (let i = 0; i < 20; i++) set.add(makeOrderId());
    expect(set.size).toBeGreaterThan(15);
  });
});
