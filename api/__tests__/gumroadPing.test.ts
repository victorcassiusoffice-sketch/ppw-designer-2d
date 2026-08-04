/**
 * Unit tests for api/_lib/gumroad/webhook.ts — the account Ping handler
 * (server-side sale verification, underpaid hold, idempotent replay,
 * wrong-product no-op, orderRef mismatch rejection).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the finalize-chain stages so finalizeGumroadOrder can be exercised
// directly (no DB). importOriginal keeps sibling named exports intact —
// recordStripeOrder.ts (buildCaptureShapeFromCartMeta) imports from the
// payout modules too.
vi.mock('../_lib/payouts/recordOrderItemsForOrder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/payouts/recordOrderItemsForOrder')>();
  return {
    ...actual,
    recordOrderItemsForOrder: vi.fn(async () => ({ ok: true, inserted: 1 })),
  };
});
vi.mock('../_lib/payouts/recordPayoutsForOrder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/payouts/recordPayoutsForOrder')>();
  return {
    ...actual,
    recordPayoutsForOrder: vi.fn(async () => ({ ok: true, inserted: 1 })),
  };
});
vi.mock('../_lib/payouts/recordReferralsForOrder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/payouts/recordReferralsForOrder')>();
  return {
    ...actual,
    recordReferralsForOrder: vi.fn(async () => ({ ok: true, inserted: 0 })),
  };
});
vi.mock('../_lib/email/dispatch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/email/dispatch')>();
  return {
    ...actual,
    dispatchOrderConfirmedEmail: vi.fn(async () => ({ ok: true })),
  };
});

import {
  processGumroadPing,
  parseGumroadPing,
  extractOrderRef,
  settleVerifiedSale,
  finalizeGumroadOrder,
  type SaleVerifier,
  type OrderLoader,
  type OrderStatusWriter,
  type OrderFinalizer,
  type PendingGumroadOrderRow,
  type VerifiedGumroadSale,
} from '../_lib/gumroad/webhook';
import { recordOrderItemsForOrder } from '../_lib/payouts/recordOrderItemsForOrder';
import { recordPayoutsForOrder } from '../_lib/payouts/recordPayoutsForOrder';
import { recordReferralsForOrder } from '../_lib/payouts/recordReferralsForOrder';
import { dispatchOrderConfirmedEmail } from '../_lib/email/dispatch';

const GUM_ENV = {
  GUMROAD_ACCESS_TOKEN: 'tok_test',
  GUMROAD_DESIGNER_PRODUCT_ID: 'prod_designer_123',
  GUMROAD_DESIGNER_PRODUCT_URL: 'https://victorix08.gumroad.com/l/ppw-designer-order',
} as NodeJS.ProcessEnv;

function makePingBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sale_id: 'sale_1',
    product_id: 'prod_designer_123',
    price: '10000',
    email: 'buyer@example.com',
    refunded: 'false',
    test: 'false',
    'url_params[order_ref]': 'mp_abc',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<PendingGumroadOrderRow> = {}): PendingGumroadOrderRow {
  return {
    ppwOrderId: 'mp_abc',
    customerEmail: 'buyer@example.com',
    currency: 'MUR',
    totalMinor: 450000,
    paymentRail: 'gumroad',
    paymentStatus: 'pending',
    expectedUsdMinor: 10000,
    cartMeta: [{ sku: 'K1-BAR-01', quantity: 1, unitMinor: 450000 }],
    ...overrides,
  };
}

function makeSale(overrides: Partial<VerifiedGumroadSale> = {}): VerifiedGumroadSale {
  return {
    saleId: 'sale_1',
    productId: 'prod_designer_123',
    priceUsdMinor: 10000,
    email: 'buyer@example.com',
    refunded: false,
    test: false,
    ...overrides,
  };
}

const okVerifier: SaleVerifier = async () => ({ ok: true, sale: makeSale() });
const okLoader: OrderLoader = async () => makeOrder();
const okMarker: OrderStatusWriter = async () => ({ ok: true });
const noopFinalizer: OrderFinalizer = async () => {};

describe('parseGumroadPing', () => {
  it('parses an object body (Vercel-parsed urlencoded)', () => {
    const p = parseGumroadPing(makePingBody());
    expect(p).not.toBeNull();
    expect(p!.saleId).toBe('sale_1');
    expect(p!.productId).toBe('prod_designer_123');
    expect(p!.priceUsdMinor).toBe(10000);
    expect(p!.orderRef).toBe('mp_abc');
    expect(p!.refunded).toBe(false);
  });
  it('parses a raw x-www-form-urlencoded string body', () => {
    const raw =
      'sale_id=sale_9&product_id=prod_designer_123&price=5000&url_params%5Border_ref%5D=mp_xyz&test=true';
    const p = parseGumroadPing(raw);
    expect(p).not.toBeNull();
    expect(p!.saleId).toBe('sale_9');
    expect(p!.priceUsdMinor).toBe(5000);
    expect(p!.orderRef).toBe('mp_xyz');
    expect(p!.test).toBe(true);
  });
  it('returns null on garbage', () => {
    expect(parseGumroadPing(undefined)).toBeNull();
    expect(parseGumroadPing({})).toBeNull();
    expect(parseGumroadPing(42)).toBeNull();
  });
});

describe('extractOrderRef', () => {
  it('reads the nested url_params object form', () => {
    expect(extractOrderRef({ url_params: { order_ref: 'mp_1' } })).toBe('mp_1');
  });
  it('reads the flat bracketed key form', () => {
    expect(extractOrderRef({ 'url_params[order_ref]': 'mp_2' })).toBe('mp_2');
  });
  it('returns null when absent', () => {
    expect(extractOrderRef({})).toBeNull();
  });
});

describe('processGumroadPing', () => {
  it('400s an invalid payload', async () => {
    const r = await processGumroadPing('not-a-ping', { env: GUM_ENV });
    expect(r.status).toBe(400);
  });

  it('503s when the rail env is unset', async () => {
    const r = await processGumroadPing(makePingBody(), { env: {} as NodeJS.ProcessEnv });
    expect(r.status).toBe(503);
  });

  it('IGNORES pings for other products on the account (200 no-op, no verify call)', async () => {
    const verify = vi.fn(okVerifier);
    const r = await processGumroadPing(makePingBody({ product_id: 'some_other_product' }), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
      markOrder: okMarker,
      finalize: noopFinalizer,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, ignored: 'unknown_product' });
    expect(verify).not.toHaveBeenCalled();
  });

  it('400s when order_ref is missing from url_params', async () => {
    const body = makePingBody();
    delete body['url_params[order_ref]'];
    const r = await processGumroadPing(body, {
      env: GUM_ENV,
      verifySale: okVerifier,
      loadOrder: okLoader,
    });
    expect(r.status).toBe(400);
    if (r.status === 400) expect(r.body.error).toMatch(/order_ref/);
  });

  it('VERIFIES the sale server-side (verifier called with the sale id + env token)', async () => {
    const verify = vi.fn(okVerifier);
    const finalize = vi.fn(noopFinalizer);
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
      markOrder: okMarker,
      finalize,
    });
    expect(r.status).toBe(200);
    expect(verify).toHaveBeenCalledOnce();
    expect(verify.mock.calls[0]![0]).toBe('sale_1');
    expect(verify.mock.calls[0]![1].accessToken).toBe('tok_test');
  });

  it('502s when the verification API fails (Gumroad will retry)', async () => {
    const verify: SaleVerifier = async () => ({ ok: false, error: 'Gumroad sale lookup failed: 500' });
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
    });
    expect(r.status).toBe(502);
  });

  it('400s a verified sale whose product_id does not match (tampered ping)', async () => {
    const verify: SaleVerifier = async () => ({
      ok: true,
      sale: makeSale({ productId: 'evil_product' }),
    });
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
    });
    expect(r.status).toBe(400);
  });

  it('ignores refunded sales (no fulfilment)', async () => {
    const verify: SaleVerifier = async () => ({ ok: true, sale: makeSale({ refunded: true }) });
    const finalize = vi.fn(noopFinalizer);
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
      markOrder: okMarker,
      finalize,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ignored: 'refunded' });
    expect(finalize).not.toHaveBeenCalled();
  });

  it('REJECTS an unknown order_ref (400, no fulfilment)', async () => {
    const loader: OrderLoader = async () => null;
    const finalize = vi.fn(noopFinalizer);
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: okVerifier,
      loadOrder: loader,
      markOrder: okMarker,
      finalize,
    });
    expect(r.status).toBe(400);
    if (r.status === 400) expect(r.body.error).toMatch(/Unknown order_ref/);
    expect(finalize).not.toHaveBeenCalled();
  });

  it('rejects an order_ref that belongs to a different rail', async () => {
    const loader: OrderLoader = async () => makeOrder({ paymentRail: 'paypal' });
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: okVerifier,
      loadOrder: loader,
    });
    expect(r.status).toBe(400);
  });

  it('UNDERPAID: paid < expected → order held, finalize NOT run', async () => {
    const verify: SaleVerifier = async () => ({
      ok: true,
      // Buyer edited the PWYW price down to $1.00
      sale: makeSale({ priceUsdMinor: 100 }),
    });
    const mark = vi.fn(okMarker);
    const finalize = vi.fn(noopFinalizer);
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
      markOrder: mark,
      finalize,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ underpaid: true, paidUsdMinor: 100, expectedUsdMinor: 10000 });
    expect(mark).toHaveBeenCalledOnce();
    expect(mark.mock.calls[0]![1]).toBe('underpaid');
    expect(finalize).not.toHaveBeenCalled();
  });

  it('CAPTURED: paid >= expected → order captured + finalize chain runs', async () => {
    const mark = vi.fn(okMarker);
    const finalize = vi.fn(noopFinalizer);
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: okVerifier,
      loadOrder: okLoader,
      markOrder: mark,
      finalize,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, captured: true });
    expect(mark.mock.calls[0]![1]).toBe('captured');
    expect(finalize).toHaveBeenCalledOnce();
    expect(finalize.mock.calls[0]![0].ppwOrderId).toBe('mp_abc');
  });

  it('IDEMPOTENT REPLAY: an already-captured order acks 200 without re-finalizing', async () => {
    const loader: OrderLoader = async () => makeOrder({ paymentStatus: 'captured' });
    const mark = vi.fn(okMarker);
    const finalize = vi.fn(noopFinalizer);
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: okVerifier,
      loadOrder: loader,
      markOrder: mark,
      finalize,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, already: true });
    expect(mark).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('overpaid (buyer raised the PWYW price) still captures', async () => {
    const verify: SaleVerifier = async () => ({
      ok: true,
      sale: makeSale({ priceUsdMinor: 15000 }),
    });
    const r = await processGumroadPing(makePingBody(), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
      markOrder: okMarker,
      finalize: noopFinalizer,
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ captured: true });
  });
});

describe('settleVerifiedSale (shared with the reconcile cron)', () => {
  it('propagates a status-write failure as an error outcome', async () => {
    const mark: OrderStatusWriter = async () => ({ ok: false, error: 'db down' });
    const s = await settleVerifiedSale(makeOrder(), makeSale(), {
      markOrder: mark,
      finalize: noopFinalizer,
    });
    expect(s.outcome).toBe('error');
  });

  it('passes the VERIFIED sale through to finalize (test flag preserved)', async () => {
    const finalize = vi.fn(noopFinalizer);
    const s = await settleVerifiedSale(makeOrder(), makeSale({ test: true }), {
      markOrder: okMarker,
      finalize,
    });
    expect(s.outcome).toBe('captured');
    expect(finalize).toHaveBeenCalledOnce();
    expect(finalize.mock.calls[0]![1]).toMatchObject({ saleId: 'sale_1', test: true });
  });
});

describe('finalizeGumroadOrder — test-sale gate (P1: no phantom payouts)', () => {
  beforeEach(() => {
    vi.mocked(recordOrderItemsForOrder).mockClear();
    vi.mocked(recordPayoutsForOrder).mockClear();
    vi.mocked(recordReferralsForOrder).mockClear();
    vi.mocked(dispatchOrderConfirmedEmail).mockClear();
  });

  it('REAL sale: order_items → email → payouts → referrals all run', async () => {
    await finalizeGumroadOrder(makeOrder(), makeSale({ test: false }));
    expect(recordOrderItemsForOrder).toHaveBeenCalledOnce();
    expect(dispatchOrderConfirmedEmail).toHaveBeenCalledOnce();
    expect(recordPayoutsForOrder).toHaveBeenCalledOnce();
    expect(vi.mocked(recordPayoutsForOrder).mock.calls[0]![0]).toBe('mp_abc');
    expect(recordReferralsForOrder).toHaveBeenCalledOnce();
  });

  it('TEST sale ($0 collected): order_items + email still run, but NO merchant payout and NO referral commission are queued', async () => {
    await finalizeGumroadOrder(makeOrder(), makeSale({ test: true }));
    expect(recordOrderItemsForOrder).toHaveBeenCalledOnce();
    expect(dispatchOrderConfirmedEmail).toHaveBeenCalledOnce();
    expect(recordPayoutsForOrder).not.toHaveBeenCalled();
    expect(recordReferralsForOrder).not.toHaveBeenCalled();
  });

  it('TEST sale end-to-end via processGumroadPing (default finalizer): captures with test:true, payouts never touched', async () => {
    const verify: SaleVerifier = async () => ({ ok: true, sale: makeSale({ test: true }) });
    const r = await processGumroadPing(makePingBody({ test: 'true' }), {
      env: GUM_ENV,
      verifySale: verify,
      loadOrder: okLoader,
      markOrder: okMarker,
      // finalize NOT injected — exercises the real finalizeGumroadOrder
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, captured: true, test: true });
    expect(recordOrderItemsForOrder).toHaveBeenCalledOnce();
    expect(dispatchOrderConfirmedEmail).toHaveBeenCalledOnce();
    expect(recordPayoutsForOrder).not.toHaveBeenCalled();
    expect(recordReferralsForOrder).not.toHaveBeenCalled();
  });
});
