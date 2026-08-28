/**
 * PayPal client scaffold - unit tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildPaypalCheckoutPayload,
  isPaypalEnabled,
  startPaypalCheckout,
  capturePaypalOrder,
  type CreatePaypalOrderPayload,
} from '../paypal';
import type { CartTotals } from '../../store/cartStore';
import type { Product } from '../../data/products.schema';

function enablePaypal() {
  vi.stubEnv('VITE_PAYPAL_ENABLED', 'true');
}
function disablePaypal() {
  vi.stubEnv('VITE_PAYPAL_ENABLED', 'false');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    ],
    floorLines: [],
    subtotal: 200,
    floorSubtotal: 0,
    uniqueProductCount: 1,
    subtotalByCurrency: { MUR: 0, USD: 200, EUR: 0, GBP: 0 } as Record<"MUR"|"USD"|"EUR"|"GBP", number>,
    currency: 'USD',
    totalItemCount: 2,
  };
}

describe('isPaypalEnabled', () => {
  it('returns true when flag string is "true"', () => {
    enablePaypal();
    expect(isPaypalEnabled()).toBe(true);
  });
  it('returns false when flag string is "false"', () => {
    disablePaypal();
    expect(isPaypalEnabled()).toBe(false);
  });
  it('returns false when flag is unset', () => {
    vi.stubEnv('VITE_PAYPAL_ENABLED', '');
    expect(isPaypalEnabled()).toBe(false);
  });
});

describe('buildPaypalCheckoutPayload', () => {
  it('maps cart lines into PayPal-shaped line items', () => {
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
    const payload: CreatePaypalOrderPayload = buildPaypalCheckoutPayload({
      cart: fakeCart(),
      customer,
      origin: 'https://designer.ppwellness.co',
      orderId: 'PPW-ABC-123',
    });
    expect(payload.currency).toBe('USD');
    expect(payload.cart).toHaveLength(1);
    expect(payload.cart[0]).toMatchObject({
      productId: 'a',
      quantity: 2,
      unitAmount: 10000,
      currency: 'USD',
    });
    expect(payload.successUrl).toContain('/order/success');
    expect(payload.cancelUrl).toContain('/order/cancelled');
    expect(payload.orderId).toBe('PPW-ABC-123');
    expect(payload.notes).toBe('leave at gate');
  });

  it('sends MUR as minor units (×100 — Phase 0 wire-contract)', () => {
    const cart = fakeCart();
    cart.currency = 'MUR';
    cart.lines = [{ ...cart.lines[0], unitPriceDisplay: 5000, lineTotalDisplay: 5000 }];
    const payload = buildPaypalCheckoutPayload({
      cart,
      customer: {
        name: 'V', email: 'v@ppw.co', phone: '+230', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
      },
      origin: 'http://x',
      orderId: 'PPW-X',
    });
    expect(payload.cart[0].unitAmount).toBe(500000);
    expect(payload.currency).toBe('MUR');
  });

  it('MUR regression (designer rail): Rs 1,000 becomes 100000 minor on the wire', () => {
    const cart = fakeCart();
    cart.currency = 'MUR';
    cart.lines = [{ ...cart.lines[0], unitPriceDisplay: 1000, lineTotalDisplay: 1000 }];
    const payload = buildPaypalCheckoutPayload({
      cart,
      customer: {
        name: 'V', email: 'v@ppw.co', phone: '+230', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
      },
      origin: 'http://x',
      orderId: 'PPW-X',
    });
    // Server-side toPaypalAmount(100000, 'MUR') renders "1000.00" — see
    // api/__tests__/createPaypalOrder.test.ts for the server half.
    expect(payload.cart[0].unitAmount).toBe(100000);
  });
});

describe('startPaypalCheckout - disabled', () => {
  beforeEach(disablePaypal);
  it('returns pending without calling fetch', async () => {
    const fetchSpy = vi.fn();
    const payload = buildPaypalCheckoutPayload({
      cart: fakeCart(),
      customer: {
        name: 'V', email: 'v@x.co', phone: '+230', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
      },
      origin: 'http://localhost',
      orderId: 'PPW-TEST',
    });
    const r = await startPaypalCheckout(payload, fetchSpy as unknown as typeof fetch);
    expect(r.status).toBe('pending');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('startPaypalCheckout - enabled', () => {
  beforeEach(enablePaypal);

  it('falls back to pending on 404', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response('not found', { status: 404 }),
    ) as unknown as typeof fetch;
    const payload = buildPaypalCheckoutPayload({
      cart: fakeCart(),
      customer: {
        name: 'V', email: 'v@x.co', phone: '+230', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
      },
      origin: 'http://localhost',
      orderId: 'PPW-TEST',
    });
    const r = await startPaypalCheckout(payload, fetchSpy);
    expect(r.status).toBe('pending');
  });

  it('returns error when server 500s with json', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'PayPal not configured' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const payload = buildPaypalCheckoutPayload({
      cart: fakeCart(),
      customer: {
        name: 'V', email: 'v@x.co', phone: '+230', addressLine1: '1',
        addressLine2: '', city: 'P-L', postcode: '0', country: 'MU', notes: '',
      },
      origin: 'http://localhost',
      orderId: 'PPW-TEST',
    });
    const r = await startPaypalCheckout(payload, fetchSpy);
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/not configured/i);
  });
});

describe('capturePaypalOrder', () => {
  it('returns ok:true on a 200 json body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, paymentStatus: 'captured' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const r = await capturePaypalOrder('PAY-X', 'PPW-Y', fetchSpy);
    expect(r.ok).toBe(true);
  });

  it('returns ok:false with error on 500', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'capture failed' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;
    const r = await capturePaypalOrder('PAY-X', 'PPW-Y', fetchSpy);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/capture failed/i);
  });

  it('handles non-JSON response with ok:false', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response('<html>error</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    ) as unknown as typeof fetch;
    const r = await capturePaypalOrder('PAY-X', 'PPW-Y', fetchSpy);
    expect(r.ok).toBe(false);
  });
});
