/**
 * Stripe scaffold - Week 3, extended Week 4a.
 *
 * MVP behaviour:
 *   1. Read `VITE_STRIPE_PUBLISHABLE_KEY` from `import.meta.env`.
 *   2. If unset -> callers fall back to /order/pending (manual handover).
 *   3. If set -> load the JS SDK, post the order payload to the Vercel
 *      function at `/api/create-checkout-session`, and on success
 *      hard-redirect the browser to the Checkout Session URL Stripe
 *      returned.
 *
 * The Stripe Checkout Session MUST be created server-side (the secret
 * key cannot live in the browser). See `api/create-checkout-session.ts`
 * for the Vercel function impl.
 */

import { loadStripe } from '@stripe/stripe-js';
import type { Currency } from '../data/products.schema';
import type { CartTotals } from '../store/cartStore';
import type { CheckoutFormValues } from '../store/checkoutStore';

const PUBLISHABLE_KEY_ENV = 'VITE_STRIPE_PUBLISHABLE_KEY';

/** Read the publishable key from Vite's import.meta.env. */
export function getPublishableKey(): string | undefined {
  try {
    const env = (import.meta as unknown as { env?: Record<string, string> })?.env;
    const key = env?.[PUBLISHABLE_KEY_ENV];
    if (typeof key === 'string' && key.trim().length > 0) return key.trim();
  } catch {
    /* ignore */
  }
  return undefined;
}

export function isStripeConfigured(): boolean {
  return Boolean(getPublishableKey());
}

let _stripePromise: ReturnType<typeof loadStripe> | null = null;

export function warmStripe(): void {
  if (_stripePromise) return;
  const key = getPublishableKey();
  if (!key) return;
  _stripePromise = loadStripe(key);
}

export interface CheckoutLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitAmount: number;
  currency: Currency;
  imageUrl?: string;
}

/** Lean property snapshot - embedded as metadata so the webhook can rebuild context. */
export interface PropertySnapshotForCheckout {
  id: string;
  name: string;
  rooms: Array<{ id: string; name: string; itemCount: number }>;
}

export interface CreateCheckoutPayload {
  currency: Currency;
  customer: CheckoutFormValues;
  /** New name expected by api/create-checkout-session.ts. */
  cart: CheckoutLineItem[];
  /** Back-compat alias - identical to `cart`. */
  lineItems: CheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  orderId: string;
  property?: PropertySnapshotForCheckout;
  notes?: string;
}

/**
 * Map a CartTotals + customer form into the Stripe-Checkout-Session
 * shaped payload our server endpoint receives.
 */
export function buildCheckoutPayload(args: {
  cart: CartTotals;
  customer: CheckoutFormValues;
  origin: string;
  orderId: string;
  property?: PropertySnapshotForCheckout;
}): CreateCheckoutPayload {
  const lineItems: CheckoutLineItem[] = args.cart.lines.map((l) => ({
    productId: l.productId,
    name: l.product.name,
    quantity: l.quantity,
    // Stripe wants amounts in the smallest unit; for MUR (no minor unit)
    // we use the integer value, for the others we multiply by 100.
    unitAmount:
      args.cart.currency === 'MUR'
        ? Math.round(l.unitPriceDisplay)
        : Math.round(l.unitPriceDisplay * 100),
    currency: args.cart.currency,
    imageUrl: l.product.image_url || undefined,
  }));
  return {
    currency: args.cart.currency,
    customer: args.customer,
    cart: lineItems,
    lineItems,
    successUrl: `${args.origin}/order/success?cs={CHECKOUT_SESSION_ID}&id=${encodeURIComponent(args.orderId)}`,
    cancelUrl: `${args.origin}/order/cancelled`,
    orderId: args.orderId,
    property: args.property,
    notes: args.customer.notes,
  };
}

export interface RedirectResult {
  status: 'redirected' | 'pending' | 'error';
  message?: string;
}

/**
 * POST to /api/create-checkout-session and follow the URL. Falls back
 * to 'pending' status (caller routes to /order/pending) if:
 *   - publishable key isn't set
 *   - endpoint returns 404 (local Vite dev with no Vercel functions)
 *   - endpoint returns 501 (legacy stub)
 *   - response isn't JSON (Vite SPA fallthrough serving index.html)
 */
export async function startStripeCheckout(
  payload: CreateCheckoutPayload,
  doFetch: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<RedirectResult> {
  if (!isStripeConfigured()) {
    return {
      status: 'pending',
      message: 'Stripe publishable key not set - falling back to manual handover.',
    };
  }
  if (!doFetch) {
    return { status: 'error', message: 'fetch is unavailable in this environment.' };
  }
  let session: { id?: string; url?: string } | null = null;
  try {
    const res = await doFetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 501) {
      return {
        status: 'pending',
        message:
          'Checkout session endpoint not yet deployed. Falling back to manual handover.',
      };
    }
    if (res.status === 404) {
      return {
        status: 'pending',
        message:
          'Local dev: no serverless function reachable at /api/create-checkout-session. Falling back to manual handover.',
      };
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        status: 'pending',
        message:
          'Local dev: serverless function unavailable (response was not JSON). Falling back to manual handover.',
      };
    }
    if (!res.ok) {
      let body: { error?: string } | null = null;
      try { body = await res.json(); } catch { /* ignore */ }
      return {
        status: 'error',
        message: body?.error ?? `Server returned ${res.status} ${res.statusText}.`,
      };
    }
    session = (await res.json()) as { id?: string; url?: string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: msg };
  }
  if (!session?.url) {
    return { status: 'error', message: 'Server did not return a Checkout Session URL.' };
  }
  warmStripe();
  if (typeof window !== 'undefined') {
    window.location.assign(session.url);
  }
  return { status: 'redirected' };
}

/** Generate a short timestamp-based order confirmation number. */
export function makeOrderId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `PPW-${ts}-${rand}`;
}
