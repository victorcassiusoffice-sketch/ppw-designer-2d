/**
 * Unit tests for api/_lib/gumroad/createOrder.ts — the Gumroad interim
 * rail's create-order core (re-pricing enforced, USD conversion
 * disclosed, pending row written, PWYW checkout URL built, graceful 503s).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  processGumroadCreateRequest,
  convertMinorToUsd,
  buildGumroadCheckoutUrl,
  buildCartMeta,
  GUMROAD_FX_DISCLOSURE,
  GUMROAD_MIN_USD_MINOR,
  type PendingOrderWriter,
  type PendingGumroadOrderArgs,
} from '../_lib/gumroad/createOrder';
import type { Repricer } from '../_lib/pricing/repriceCart';

const GUM_ENV = {
  GUMROAD_ACCESS_TOKEN: 'tok_test',
  GUMROAD_DESIGNER_PRODUCT_ID: 'prod_designer_123',
  GUMROAD_DESIGNER_PRODUCT_URL: 'https://victorix08.gumroad.com/l/ppw-designer-order',
} as NodeJS.ProcessEnv;

const passRepricer: Repricer = async (cart) => ({ ok: true, cart, priceAdjusted: false });
const okWriter: PendingOrderWriter = async () => ({ ok: true });

function makeValidRequest() {
  return {
    cart: [
      { productId: '42', sku: 'K1-BAR-01', name: 'Ice bath barrel', quantity: 1, unitAmount: 300000, currency: 'MUR' as const },
      { productId: '43', sku: 'K1-POD-02', name: 'Sleep pod', quantity: 2, unitAmount: 75000, currency: 'MUR' as const },
    ],
    customer: {
      name: 'Test Customer',
      email: 'buyer@example.com',
      phone: '',
      addressLine1: '',
      city: 'Tamarin',
      postcode: '90100',
      country: 'MU',
    },
    currency: 'MUR' as const,
    successUrl: 'https://designer.ppwellness.co/order/track/mp_abc?rail=gumroad',
    cancelUrl: 'https://designer.ppwellness.co/marketplace/checkout',
    orderId: 'mp_abc',
  };
}

describe('convertMinorToUsd', () => {
  it('converts MUR minor to USD minor at the fallback rate (1 USD = 45 MUR)', () => {
    // Rs 4,500.00 = 450000 minor → $100.00 = 10000 minor
    expect(convertMinorToUsd(450000, 'MUR')).toEqual({ usdMinor: 10000, rateUsed: 45 });
  });
  it('is identity for USD', () => {
    expect(convertMinorToUsd(12345, 'USD')).toEqual({ usdMinor: 12345, rateUsed: 1 });
  });
});

describe('buildGumroadCheckoutUrl', () => {
  it('builds the PWYW pre-fill URL with price, wanted, order_ref and email', () => {
    const url = new URL(
      buildGumroadCheckoutUrl({
        productUrl: 'https://victorix08.gumroad.com/l/ppw-designer-order',
        usdMinor: 10000,
        orderRef: 'mp_abc',
        email: 'buyer@example.com',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://victorix08.gumroad.com/l/ppw-designer-order');
    expect(url.searchParams.get('price')).toBe('100.00');
    expect(url.searchParams.get('wanted')).toBe('true');
    expect(url.searchParams.get('order_ref')).toBe('mp_abc');
    expect(url.searchParams.get('email')).toBe('buyer@example.com');
  });
});

describe('processGumroadCreateRequest', () => {
  it('answers 503 with the missing var names when env unset', async () => {
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: passRepricer,
      writer: okWriter,
      env: {} as NodeJS.ProcessEnv,
    });
    expect(r.status).toBe(503);
    if (r.status === 503) {
      expect(r.error).toMatch(/GUMROAD_ACCESS_TOKEN/);
      expect(r.error).toMatch(/GUMROAD_DESIGNER_PRODUCT_ID/);
      expect(r.error).toMatch(/GUMROAD_DESIGNER_PRODUCT_URL/);
    }
  });

  it('rejects an empty cart with 400', async () => {
    const req = makeValidRequest();
    (req as { cart: unknown[] }).cart = [];
    const r = await processGumroadCreateRequest(req, {
      repricer: passRepricer,
      writer: okWriter,
      env: GUM_ENV,
    });
    expect(r.status).toBe(400);
  });

  it('ENFORCES server re-pricing: the writer receives the server total, not the client total', async () => {
    // Client claims Rs 1.00 per item; the server reprices to the real amounts.
    const req = makeValidRequest();
    req.cart = req.cart.map((li) => ({ ...li, unitAmount: 100 }));
    const serverRepricer: Repricer = async (cart, currency) => ({
      ok: true,
      cart: cart.map((li) => ({
        ...li,
        unitAmount: li.productId === '42' ? 300000 : 75000,
        currency,
      })),
      priceAdjusted: true,
    });
    const writer = vi.fn(async (_args: PendingGumroadOrderArgs) => ({ ok: true }));
    const r = await processGumroadCreateRequest(req, {
      repricer: serverRepricer,
      writer,
      env: GUM_ENV,
    });
    expect(r.status).toBe(200);
    // Server total: 300000 + 2×75000 = 450000 MUR minor
    expect(writer).toHaveBeenCalledOnce();
    const args = writer.mock.calls[0]![0];
    expect(args.totalMinor).toBe(450000);
    expect(args.expectedUsdMinor).toBe(10000);
    if (r.status === 200) expect(r.priceAdjusted).toBe(true);
  });

  it('fails CLOSED (propagates re-pricing errors)', async () => {
    const failRepricer: Repricer = async () => ({
      ok: false,
      status: 500,
      error: 'Pricing service unavailable. Please retry.',
    });
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: failRepricer,
      writer: okWriter,
      env: GUM_ENV,
    });
    expect(r.status).toBe(500);
  });

  it('discloses the indicative USD conversion (rate + disclosure text)', async () => {
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: passRepricer,
      writer: okWriter,
      env: GUM_ENV,
    });
    expect(r.status).toBe(200);
    if (r.status === 200) {
      expect(r.usdMinor).toBe(10000); // 450000 MUR minor / 45
      expect(r.fxRateUsed).toBe(45);
      expect(r.fxIndicative).toBe(true);
      expect(r.fxDisclosure).toBe(GUMROAD_FX_DISCLOSURE);
    }
  });

  it('writes the pending row with orderRef, email, currency and cart snapshot', async () => {
    const writer = vi.fn(async (_args: PendingGumroadOrderArgs) => ({ ok: true }));
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: passRepricer,
      writer,
      env: GUM_ENV,
    });
    expect(r.status).toBe(200);
    const args = writer.mock.calls[0]![0];
    expect(args.orderRef).toBe('mp_abc');
    expect(args.customerEmail).toBe('buyer@example.com');
    expect(args.currency).toBe('MUR');
    expect(args.fxRateUsed).toBe(45);
    expect(args.cartMeta).toEqual([
      { s: 'K1-BAR-01', q: 1, u: 300000 },
      { s: 'K1-POD-02', q: 2, u: 75000 },
    ]);
  });

  it('builds the checkout URL from the env product URL', async () => {
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: passRepricer,
      writer: okWriter,
      env: GUM_ENV,
    });
    expect(r.status).toBe(200);
    if (r.status === 200) {
      const url = new URL(r.checkoutUrl);
      expect(url.origin + url.pathname).toBe('https://victorix08.gumroad.com/l/ppw-designer-order');
      expect(url.searchParams.get('price')).toBe('100.00');
      expect(url.searchParams.get('wanted')).toBe('true');
      expect(url.searchParams.get('order_ref')).toBe('mp_abc');
    }
  });

  it('rejects totals below the Gumroad $1 minimum', async () => {
    const req = makeValidRequest();
    req.cart = [
      { productId: '42', sku: 'K1-BAR-01', name: 'Sticker', quantity: 1, unitAmount: 100, currency: 'MUR' },
    ];
    const r = await processGumroadCreateRequest(req, {
      repricer: passRepricer,
      writer: okWriter,
      env: GUM_ENV,
    });
    expect(r.status).toBe(400);
    if (r.status === 400) expect(r.error).toMatch(/minimum/i);
    expect(GUMROAD_MIN_USD_MINOR).toBe(100);
  });

  it('answers 503 with a migration hint when the enum is not migrated', async () => {
    const writer: PendingOrderWriter = async () => ({
      ok: false,
      notMigrated: true,
      error: 'invalid input value for enum payment_rail: "gumroad"',
    });
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: passRepricer,
      writer,
      env: GUM_ENV,
    });
    expect(r.status).toBe(503);
    if (r.status === 503) expect(r.error).toMatch(/0028/);
  });

  it('answers 500 (fail closed, no redirect) when the pending write fails', async () => {
    const writer: PendingOrderWriter = async () => ({ ok: false, error: 'boom' });
    const r = await processGumroadCreateRequest(makeValidRequest(), {
      repricer: passRepricer,
      writer,
      env: GUM_ENV,
    });
    expect(r.status).toBe(500);
  });
});

describe('buildCartMeta', () => {
  it('prefers the server-resolved SKU and falls back to productId', () => {
    expect(
      buildCartMeta([
        { productId: '42', sku: 'K1-X', name: 'a', quantity: 1, unitAmount: 100, currency: 'MUR' },
        { productId: 'seed-1', name: 'b', quantity: 2, unitAmount: 200, currency: 'MUR' },
      ]),
    ).toEqual([
      { s: 'K1-X', q: 1, u: 100 },
      { s: 'seed-1', q: 2, u: 200 },
    ]);
  });
});
