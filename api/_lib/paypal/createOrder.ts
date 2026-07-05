/**
 * Vercel serverless function - create PayPal Standard order.
 *
 * POST /api/createPaypalOrder
 *   body: { cart, customer, currency, successUrl, cancelUrl, orderId }
 *   200:  { paypalOrderId: string, approvalUrl: string }
 *   400:  { error: '<safe-message>' }
 *   405:  wrong method
 *   500:  { error: '<safe-message>' } - PayPal env unset OR API error
 *
 * Mirrors api/create-checkout-session.ts contract so the same client
 * payload shape works for both rails. We re-use the validator + the
 * line-item builder pattern but go through PayPal's REST API instead
 * of Stripe.
 *
 * Phase 1.5 multi-rail. Wrapped in withSentry (no-op until Phase 1
 * observability lands) so logs carry a handler tag.
 */

import { withSentry, type MinReq, type MinRes } from '../sentry.js';
import { readPaypalEnv, paypalFetch } from '../paypalClient.js';
import type {
  CartLineItemPayload,
  CustomerInfo,
  PropertySnapshot,
  Currency,
} from '../orderTypes.js';

const ALLOWED_ORIGINS = new Set([
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://designer.ppwellness.co',
]);

const ALLOWED_CURRENCIES: Currency[] = ['MUR', 'USD', 'EUR', 'GBP'];

function corsHeaders(origin: string | undefined): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://designer.ppwellness.co';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function readJsonBody(req: MinReq): Promise<unknown> {
  const b = req.body;
  if (b === undefined || b === null) return {};
  if (typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  if (typeof b === 'string') {
    try {
      return JSON.parse(b);
    } catch {
      return null;
    }
  }
  if (Buffer.isBuffer(b)) {
    try {
      return JSON.parse(b.toString('utf8'));
    } catch {
      return null;
    }
  }
  return null;
}

export interface ValidatedPaypalRequest {
  cart: CartLineItemPayload[];
  customer: CustomerInfo;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
  orderId: string;
  property?: PropertySnapshot;
  notes?: string;
}

export function validatePaypalRequest(
  payload: unknown,
): { ok: true; data: ValidatedPaypalRequest } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid request body.' };
  const p = payload as Partial<ValidatedPaypalRequest>;

  if (!Array.isArray(p.cart) || p.cart.length === 0) {
    return { ok: false, error: 'Cart is empty.' };
  }
  for (const li of p.cart) {
    if (!li || typeof li !== 'object') return { ok: false, error: 'Invalid line item.' };
    if (typeof li.name !== 'string' || li.name.length === 0) return { ok: false, error: 'Line item missing name.' };
    if (typeof li.quantity !== 'number' || li.quantity <= 0 || !Number.isFinite(li.quantity)) {
      return { ok: false, error: 'Line item quantity must be a positive number.' };
    }
    if (typeof li.unitAmount !== 'number' || li.unitAmount <= 0 || !Number.isFinite(li.unitAmount)) {
      return { ok: false, error: 'Line item amount must be a positive number.' };
    }
    if (!ALLOWED_CURRENCIES.includes(li.currency as Currency)) {
      return { ok: false, error: 'Line item currency unsupported.' };
    }
  }
  if (!p.customer || typeof p.customer !== 'object') return { ok: false, error: 'Customer info missing.' };
  if (typeof p.customer.email !== 'string' || p.customer.email.length === 0) {
    return { ok: false, error: 'Customer email required.' };
  }
  if (!ALLOWED_CURRENCIES.includes(p.currency as Currency)) {
    return { ok: false, error: 'Unsupported currency.' };
  }
  if (typeof p.successUrl !== 'string' || !p.successUrl.startsWith('http')) {
    return { ok: false, error: 'successUrl invalid.' };
  }
  if (typeof p.cancelUrl !== 'string' || !p.cancelUrl.startsWith('http')) {
    return { ok: false, error: 'cancelUrl invalid.' };
  }
  if (typeof p.orderId !== 'string' || p.orderId.length === 0) {
    return { ok: false, error: 'orderId missing.' };
  }
  return {
    ok: true,
    data: {
      cart: p.cart as CartLineItemPayload[],
      customer: p.customer as CustomerInfo,
      currency: p.currency as Currency,
      successUrl: p.successUrl,
      cancelUrl: p.cancelUrl,
      orderId: p.orderId,
      property: p.property,
      notes: p.notes,
    },
  };
}

/**
 * Convert our internal minor-unit line items to PayPal's
 * decimal-string format. PayPal wants "value" as a string like "29.99",
 * always with 2 decimals for currencies that have minor units. MUR has
 * no minor unit (it's effectively integer rupees), so we send it with
 * 2 decimal zeros for PayPal's parser.
 */
export function toPaypalAmount(unitAmount: number, currency: Currency): string {
  // For USD/EUR/GBP unitAmount is in cents - divide by 100.
  // For MUR our payload uses integer rupees (no minor unit).
  const rupeeMode = currency === 'MUR';
  const major = rupeeMode ? unitAmount : unitAmount / 100;
  return major.toFixed(2);
}

export function buildPaypalOrderBody(req: ValidatedPaypalRequest): {
  intent: 'CAPTURE';
  purchase_units: Array<{
    reference_id: string;
    description?: string;
    amount: {
      currency_code: string;
      value: string;
      breakdown: {
        item_total: { currency_code: string; value: string };
      };
    };
    items: Array<{
      name: string;
      quantity: string;
      unit_amount: { currency_code: string; value: string };
      sku?: string;
    }>;
  }>;
  application_context: {
    brand_name: string;
    return_url: string;
    cancel_url: string;
    user_action: 'PAY_NOW';
    shipping_preference: 'NO_SHIPPING';
  };
} {
  const currency = req.currency;
  let runningTotal = 0;
  const items = req.cart.map((li) => {
    const unit = toPaypalAmount(li.unitAmount, currency);
    runningTotal += parseFloat(unit) * li.quantity;
    const item: {
      name: string;
      quantity: string;
      unit_amount: { currency_code: string; value: string };
      sku?: string;
    } = {
      name: li.name.slice(0, 127),
      quantity: String(li.quantity),
      unit_amount: { currency_code: currency, value: unit },
    };
    if (li.productId) item.sku = li.productId.slice(0, 127);
    return item;
  });
  const totalStr = runningTotal.toFixed(2);
  // Append orderId/email to return_url so the success page can resume.
  const sep = req.successUrl.includes('?') ? '&' : '?';
  const returnUrl = `${req.successUrl}${sep}rail=paypal&id=${encodeURIComponent(req.orderId)}`;
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: req.orderId.slice(0, 256),
        description: (req.notes ?? '').slice(0, 127) || undefined,
        amount: {
          currency_code: currency,
          value: totalStr,
          breakdown: {
            item_total: { currency_code: currency, value: totalStr },
          },
        },
        items,
      },
    ],
    application_context: {
      brand_name: 'Peak Performance Wellness',
      return_url: returnUrl,
      cancel_url: req.cancelUrl,
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
    },
  };
}

interface PaypalOrderResponse {
  id?: string;
  status?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

/**
 * Public-for-tests: take a parsed body + a fetch implementation,
 * return either {paypalOrderId, approvalUrl} or an error.
 */
export async function processPaypalOrderRequest(
  payload: unknown,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { status: 200; paypalOrderId: string; approvalUrl: string }
  | { status: 400 | 500; error: string }
> {
  const v = validatePaypalRequest(payload);
  if (!v.ok) return { status: 400, error: v.error };
  let cfg;
  try {
    cfg = readPaypalEnv();
  } catch {
    return { status: 500, error: 'PayPal not configured' };
  }
  try {
    const body = buildPaypalOrderBody(v.data);
    const res = await paypalFetch(
      '/v2/checkout/orders',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
      cfg,
      fetchFn,
    );
    if (!res.ok) {
      // Don't echo the PayPal error body - it can contain client_id /
      // request_id and we don't want that on the wire.
      return { status: 500, error: `PayPal create-order failed: ${res.status}` };
    }
    const json = (await res.json()) as PaypalOrderResponse;
    if (!json.id) return { status: 500, error: 'PayPal returned no order id.' };
    const approve = (json.links ?? []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!approve?.href) return { status: 500, error: 'PayPal returned no approval URL.' };
    return { status: 200, paypalOrderId: json.id, approvalUrl: approve.href };
  } catch (err) {
    const message =
      err instanceof Error && typeof err.message === 'string'
        ? err.message.slice(0, 200)
        : 'Failed to create PayPal order.';
    return { status: 500, error: message };
  }
}

async function rawHandler(req: MinReq, res: MinRes): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  const cors = corsHeaders(origin);
  for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).end();
    return;
  }

  const body = await readJsonBody(req);
  if (body === null) {
    res.status(400);
    res.json({ error: 'Body must be valid JSON.' });
    return;
  }

  const result = await processPaypalOrderRequest(body);
  if (result.status === 200) {
    res.status(200);
    res.json({ paypalOrderId: result.paypalOrderId, approvalUrl: result.approvalUrl });
    return;
  }
  res.status(result.status);
  res.json({ error: result.error });
}

export const handler = withSentry(rawHandler);

