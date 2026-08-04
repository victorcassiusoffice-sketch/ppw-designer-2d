/**
 * PayPal client-side scaffold - mirror of src/lib/stripe.ts.
 *
 * MVP behaviour:
 *   1. Read `VITE_PAYPAL_ENABLED` from `import.meta.env`. Treated as
 *      truthy when it parses to the literal string 'true'.
 *   2. If false -> the UI hides the PayPal rail entirely.
 *   3. If true -> POST the order payload to /api/createPaypalOrder
 *      and hard-redirect to the approval URL PayPal returns.
 *   4. On the return leg the success page calls /api/capturePaypalOrder
 *      with {paypalOrderId, ppwOrderId} to finalise the payment.
 *
 * Server-side env vars (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
 * PAYPAL_ENV, PAYPAL_WEBHOOK_ID) live only in Vercel - the browser
 * never sees them.
 *
 * Vite-inlining note: same constraint as stripe.ts - we MUST use the
 * literal `import.meta.env.VITE_PAYPAL_ENABLED` token at call sites or
 * Vite won't replace it at build time.
 */

import type { Currency } from '../data/products.schema';
import type { CartTotals } from '../store/cartStore';
import type { CheckoutFormValues } from '../store/checkoutStore';

export function isPaypalEnabled(): boolean {
  // Direct dotted access - Vite inlines the literal at build time.
  const raw = import.meta.env.VITE_PAYPAL_ENABLED;
  if (typeof raw === 'string' && raw.trim().toLowerCase() === 'true') return true;
  if (raw === true) return true;
  return false;
}

export interface PaypalCheckoutLineItem {
  productId: string;
  name: string;
  quantity: number;
  /** Smallest unit for ALL currencies — cents for USD/EUR/GBP AND
   *  cents-of-MUR for MUR (Phase 0 wire-contract 2026-08-04). */
  unitAmount: number;
  currency: Currency;
  imageUrl?: string;
}

export interface PaypalPropertySnapshot {
  id: string;
  name: string;
  rooms: Array<{ id: string; name: string; itemCount: number }>;
}

export interface CreatePaypalOrderPayload {
  currency: Currency;
  customer: CheckoutFormValues;
  cart: PaypalCheckoutLineItem[];
  successUrl: string;
  cancelUrl: string;
  orderId: string;
  property?: PaypalPropertySnapshot;
  notes?: string;
}

/**
 * Map a CartTotals + customer form into the PayPal-shaped payload
 * the /api/createPaypalOrder endpoint expects.
 */
export function buildPaypalCheckoutPayload(args: {
  cart: CartTotals;
  customer: CheckoutFormValues;
  origin: string;
  orderId: string;
  property?: PaypalPropertySnapshot;
  successUrl?: string;
  cancelUrl?: string;
}): CreatePaypalOrderPayload {
  const cart: PaypalCheckoutLineItem[] = args.cart.lines.map((l) => ({
    productId: l.productId,
    name: l.product.name,
    quantity: l.quantity,
    // MINOR units for every currency (MUR included — cents-of-MUR).
    // The old MUR-as-major special case caused a 100× overcharge once
    // the server standardised on minor units (IMPL-1 defect 3).
    unitAmount: Math.round(l.unitPriceDisplay * 100),
    currency: args.cart.currency,
    imageUrl: l.product.image_url || undefined,
  }));
  const successUrl =
    args.successUrl ?? `${args.origin}/order/success?id=${encodeURIComponent(args.orderId)}`;
  const cancelUrl = args.cancelUrl ?? `${args.origin}/order/cancelled`;
  return {
    currency: args.cart.currency,
    customer: args.customer,
    cart,
    successUrl,
    cancelUrl,
    orderId: args.orderId,
    property: args.property,
    notes: args.customer.notes,
  };
}

export interface PaypalRedirectResult {
  status: 'redirected' | 'pending' | 'error';
  message?: string;
  paypalOrderId?: string;
}

/**
 * POST to /api/createPaypalOrder and follow the approval URL. Falls
 * back to 'pending' (caller routes to /order/pending) when the
 * serverless function isn't reachable - same convention as stripe.ts.
 */
export async function startPaypalCheckout(
  payload: CreatePaypalOrderPayload,
  doFetch: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<PaypalRedirectResult> {
  if (!isPaypalEnabled()) {
    return { status: 'pending', message: 'PayPal is disabled in this environment.' };
  }
  if (!doFetch) {
    return { status: 'error', message: 'fetch is unavailable in this environment.' };
  }
  let body: { paypalOrderId?: string; approvalUrl?: string; error?: string } | null = null;
  try {
    const res = await doFetch('/api/createPaypalOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 404 || res.status === 501) {
      return {
        status: 'pending',
        message:
          'Local dev: /api/createPaypalOrder unavailable. Falling back to manual handover.',
      };
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        status: 'pending',
        message: 'Local dev: response was not JSON. Falling back to manual handover.',
      };
    }
    if (!res.ok) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return {
        status: 'error',
        message: body?.error ?? `Server returned ${res.status} ${res.statusText}.`,
      };
    }
    body = (await res.json()) as { paypalOrderId?: string; approvalUrl?: string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: 'error', message: msg };
  }
  if (!body?.approvalUrl) {
    return { status: 'error', message: 'Server did not return a PayPal approval URL.' };
  }
  if (typeof window !== 'undefined') {
    window.location.assign(body.approvalUrl);
  }
  return { status: 'redirected', paypalOrderId: body.paypalOrderId };
}

/**
 * POST to /api/capturePaypalOrder with {paypalOrderId, ppwOrderId}.
 * Used by the /order/success page on the return leg from PayPal.
 */
export async function capturePaypalOrder(
  paypalOrderId: string,
  ppwOrderId: string,
  doFetch: typeof fetch | undefined = typeof fetch !== 'undefined' ? fetch : undefined,
): Promise<{ ok: boolean; error?: string }> {
  if (!doFetch) return { ok: false, error: 'fetch is unavailable in this environment.' };
  try {
    const res = await doFetch('/api/capturePaypalOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paypalOrderId, ppwOrderId }),
    });
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return { ok: false, error: 'Non-JSON response from capture endpoint.' };
    }
    const body = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `Capture returned ${res.status}.` };
    }
    return { ok: Boolean(body.ok) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
