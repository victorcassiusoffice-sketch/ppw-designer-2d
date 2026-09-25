import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const effects = vi.hoisted(() => ({ db: vi.fn(), fetch: vi.fn(), email: vi.fn() }));
vi.mock('../_db/client.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('../_db/client.js')>(),
  getDb: effects.db,
}));
vi.mock('../_lib/email/send.js', () => ({ sendEmail: effects.email }));
vi.mock('../_lib/email/dispatch.js', () => ({
  dispatchDesignSavedEmail: effects.email,
  dispatchOrderConfirmedEmail: effects.email,
  dispatchMerchantOrderConfirmedEmail: effects.email,
}));
import checkout from '../create-checkout-session';
import paypal from '../paypal-router';
import orders from '../orders';
import stripeWebhook from '../stripe-webhook';
import connectWebhook from '../stripe-connect/webhook';
import merchants from '../merchants-router';
import cron from '../cron-router';
import cartQuote from '../cart-quote';
import { isShowcaseDeployment, rejectShowcaseTransaction, SHOWCASE_NOTICE } from '../_lib/showcaseSafety';

function response() {
  const res = {
    statusCode: 0,
    body: null as unknown,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { res.headers[name] = value; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: unknown) { res.body = body; },
    end() {},
  };
  return res;
}

describe('public showcase server boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('DEMO_ONLY', 'false');
    vi.stubEnv('CRON_SECRET', 'test-cron-secret');
    vi.stubGlobal('fetch', effects.fetch);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  const submissions = [
    ['Stripe checkout', checkout, '/api/create-checkout-session', 'POST'],
    ['Stripe webhook', stripeWebhook, '/api/stripe-webhook', 'POST'],
    ['Connect webhook', connectWebhook, '/api/stripe-connect/webhook', 'POST'],
    ['PayPal create alias', paypal, '/api/createPaypalOrder', 'POST'],
    ['PayPal capture alias', paypal, '/api/capturePaypalOrder', 'POST'],
    ['PayPal create', paypal, '/api/paypal/createOrder', 'POST'],
    ['PayPal capture', paypal, '/api/paypal/captureOrder', 'POST'],
    ['PayPal webhook', paypal, '/api/paypal/webhook', 'POST'],
    ['PayPal query action', paypal, '/api/paypal-router?action=captureOrder', 'POST'],
    ['Gumroad order', orders, '/api/gumroad/create-order', 'POST'],
    ['Gumroad callback', orders, '/api/gumroad/ping', 'POST'],
    ['Quote request', orders, '/api/leads', 'POST'],
    ['Save and email design', orders, '/api/designs', 'POST'],
    ['Submit saved design', orders, '/api/designs/42', 'PUT'],
    ['Supplier signup email', merchants, '/api/merchants/signup', 'POST'],
    ['Merchant magic-link email', orders, '/api/merchants/tintex/magic-link', 'POST'],
    ['Merchant fulfilment update', orders, '/api/merchants/tintex/order-update', 'POST'],
    ['Tracked supplier checkout redirect', orders, '/api/k1/redirect', 'GET'],
    ['Gumroad reconciliation', cron, '/api/cron/gumroad-reconcile', 'GET'],
    ['Email reconciliation', cron, '/api/cron/email-send-reconcile', 'GET'],
    ['Order escalation', cron, '/api/cron/escalate-orders', 'GET'],
    ['Payout processing', cron, '/api/cron/disburse-payouts', 'GET'],
  ] as const;

  it.each(submissions)('blocks %s before any database, mail or network effect', async (_name, handler, url, method) => {
    const res = response();
    const readBody = vi.fn(() => { throw new Error('transaction body must not be read'); });
    const req = {
      method,
      url: `${url}${url.includes('?') ? '&' : '?'}demo=false&preview=false`,
      headers: { authorization: 'Bearer test-cron-secret', 'x-demo-only': 'false' },
      query: { action: 'captureOrder' },
      get body() { return readBody(); },
    };
    await handler(req as never, res as never);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: SHOWCASE_NOTICE, code: 'SHOWCASE_READ_ONLY' });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(readBody).not.toHaveBeenCalled();
    expect(effects.db).not.toHaveBeenCalled();
    expect(effects.email).not.toHaveBeenCalled();
    expect(effects.fetch).not.toHaveBeenCalled();
  });

  it('allows the pure cart totals endpoint on a preview', async () => {
    const where = vi.fn().mockResolvedValue([{ id: 1, merchantId: 7 }]);
    effects.db.mockReturnValue({ select: () => ({ from: () => ({ where }) }) });
    const res = response();
    await cartQuote({ method: 'POST', headers: {}, body: { cart: [
      { productId: 1, sku: 'tile', name: 'Tile', quantity: 2, unitPriceMinor: 100, currency: 'MUR' },
    ] } } as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ totalMinor: 200, currency: 'MUR' });
    expect(effects.email).not.toHaveBeenCalled();
    expect(effects.fetch).not.toHaveBeenCalled();
  });

  it('preserves authenticated merchant product routes instead of blanket-blocking writes', async () => {
    const res = response();
    await merchants({ method: 'POST', url: '/api/merchants/tintex/products/upload-image', headers: {}, body: {} } as never, res as never);
    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ error: 'missing_session' });
  });

  it('allows production requests through to the existing handler', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const readBody = vi.fn(() => ({}));
    const res = response();
    await orders({ method: 'POST', url: '/api/leads?demo=true', headers: {}, get body() { return readBody(); } } as never, res as never);
    expect(readBody).toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'customerEmail required.' });
  });

  it('preserves a successful production quote submission', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const values = vi.fn(() => ({ returning: async () => [{ id: 42, customerEmail: 'client@example.com' }] }));
    effects.db.mockReturnValue({ insert: () => ({ values }) });
    const res = response();
    await orders({ method: 'POST', url: '/api/leads', headers: {}, body: { customerEmail: 'CLIENT@example.com', message: 'Quote please' } } as never, res as never);
    expect(res.statusCode).toBe(201);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ customerEmail: 'client@example.com', message: 'Quote please' }));
    expect(res.body).toEqual({ lead: { id: 42, customerEmail: 'client@example.com' } });
  });

  it('can explicitly secure a standalone demo deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('DEMO_ONLY', ' true ');
    expect(rejectShowcaseTransaction(response())).toBe(true);
  });

  it.each(['production', 'development', ''])('keeps %s unchanged without the explicit demo flag', (environment) => {
    vi.stubEnv('VERCEL_ENV', environment);
    expect(isShowcaseDeployment()).toBe(false);
    const res = response();
    expect(rejectShowcaseTransaction(res)).toBe(false);
    expect(res.statusCode).toBe(0);
  });
});
