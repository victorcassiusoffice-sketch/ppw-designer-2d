/**
 * Vercel serverless function — create Stripe Checkout Session.
 *
 * POST /api/create-checkout-session
 *   body:  CreateCheckoutSessionRequest (see api/lib/orderTypes.ts)
 *   200:   { url: string }
 *   400:   { error: '<safe-message>' }   — validation failure
 *   405:   wrong method
 *   500:   { error: '<safe-message>' }   — secret unset OR Stripe error
 *
 * Vic pastes STRIPE_SECRET_KEY into the Vercel project env in Week 4b.
 * Until then any POST that reaches this function returns 500 with a
 * generic "payments not configured" message (we do NOT leak which env
 * var is missing to the client).
 *
 * The exported `handler` is the Vercel entrypoint. The exported
 * `processCheckoutRequest` is the testable pure-ish core — see
 * api/__tests__/createCheckoutSession.test.ts.
 */

import Stripe from 'stripe';
import type {
  CreateCheckoutSessionRequest,
  CartLineItemPayload,
  CustomerInfo,
  PropertySnapshot,
  Currency,
} from './lib/orderTypes.js';

// Pin Stripe API version — bumping should be a deliberate edit.
const STRIPE_API_VERSION = '2025-02-24.acacia' as const;

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

interface MinimalReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface MinimalRes {
  setHeader(name: string, value: string): void;
  status(code: number): MinimalRes;
  end(payload?: string): void;
  json(body: unknown): void;
}

/** Read the request body as a parsed object regardless of how Vercel framed it. */
async function readJsonBody(req: MinimalReq): Promise<unknown> {
  // Vercel's default Node runtime auto-parses JSON when content-type is
  // application/json — `req.body` is already an object. If it's a string
  // (or a Buffer in some configs), fall back to JSON.parse.
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

interface ValidatedRequest {
  cart: CartLineItemPayload[];
  customer: CustomerInfo;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
  orderId: string;
  property?: PropertySnapshot;
  notes?: string;
}

export function validateRequest(payload: unknown): { ok: true; data: ValidatedRequest } | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'Invalid request body.' };
  const p = payload as Partial<CreateCheckoutSessionRequest>;

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
 * Build the metadata snapshot. Stripe caps each metadata VALUE at 500
 * chars — we truncate aggressively rather than crash.
 */
export function buildMetadata(req: ValidatedRequest): Record<string, string> {
  const trunc = (s: string, n = 480): string => (s.length <= n ? s : s.slice(0, n - 1) + '…');
  const propertySummary = req.property
    ? JSON.stringify({
        id: req.property.id,
        name: req.property.name,
        rooms: req.property.rooms.map((r) => ({
          id: r.id,
          name: r.name,
          itemCount: r.itemCount,
        })),
      })
    : '';
  const customerAddress = JSON.stringify({
    line1: req.customer.addressLine1,
    line2: req.customer.addressLine2 ?? '',
    city: req.customer.city,
    postcode: req.customer.postcode,
    country: req.customer.country,
  });
  return {
    orderId: trunc(req.orderId),
    notes: trunc(req.notes ?? ''),
    property: trunc(propertySummary),
    customer_address: trunc(customerAddress),
    customer_phone: trunc(req.customer.phone ?? ''),
  };
}

/** Build the Stripe-friendly line items array. */
export function buildLineItems(
  cart: CartLineItemPayload[],
  fallbackCurrency: Currency,
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return cart.map((li) => {
    const currency = (li.currency ?? fallbackCurrency).toLowerCase();
    const productData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData.ProductData = {
      name: li.name,
    };
    if (li.imageUrl && /^https?:\/\//.test(li.imageUrl)) {
      productData.images = [li.imageUrl];
    }
    return {
      price_data: {
        currency,
        unit_amount: Math.round(li.unitAmount),
        product_data: productData,
      },
      quantity: li.quantity,
    };
  });
}

/**
 * Public-for-tests: take a parsed body + a Stripe client, return either
 * a Checkout-Session URL or an error. Keeps the Vercel handler thin so
 * tests don't need to fake req/res objects.
 */
export async function processCheckoutRequest(
  payload: unknown,
  stripe: Pick<Stripe, 'checkout'>,
): Promise<{ status: 200; url: string } | { status: 400 | 500; error: string }> {
  const v = validateRequest(payload);
  if (!v.ok) return { status: 400, error: v.error };
  const { data } = v;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: data.customer.email,
      line_items: buildLineItems(data.cart, data.currency),
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: buildMetadata(data),
    });
    if (!session.url) {
      return { status: 500, error: 'Checkout session created without a URL.' };
    }
    return { status: 200, url: session.url };
  } catch (err) {
    // Sanitise Stripe errors — surface ONLY the safe `message` field. No
    // env-var names, no stack, no raw request id.
    const message =
      err instanceof Error && typeof err.message === 'string'
        ? err.message.slice(0, 200)
        : 'Failed to create checkout session.';
    return { status: 500, error: message };
  }
}

/** Vercel function entry point. */
export default async function handler(req: MinimalReq, res: MinimalRes): Promise<void> {
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

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || secret.trim().length === 0) {
    // Don't tell the client which env var is missing.
    res.status(500);
    res.json({ error: 'Payments are not configured. Please try again later.' });
    return;
  }

  const body = await readJsonBody(req);
  if (body === null) {
    res.status(400);
    res.json({ error: 'Body must be valid JSON.' });
    return;
  }

  const stripe = new Stripe(secret, { apiVersion: STRIPE_API_VERSION });
  const result = await processCheckoutRequest(body, stripe);
  if (result.status === 200) {
    res.status(200);
    res.json({ url: result.url });
    return;
  }
  res.status(result.status);
  res.json({ error: result.error });
}
