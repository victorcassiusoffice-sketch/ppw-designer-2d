/**
 * PayPal return-leg helpers — Phase 0 money-path (IMPL-1 defect 1).
 *
 * When the buyer approves a payment on PayPal they are redirected back to
 * our successUrl with `?token=<paypalOrderId>&PayerID=...` appended (plus
 * the `rail=paypal&id=<orderRef>` we appended at create-order time).
 * Nothing captured the funds on that return leg before — approved orders
 * simply expired. Both return pages (marketplace /order/track/:ref and
 * designer /order/success) now run the capture via this module.
 *
 * Kept as pure functions + an orchestrator so the flow is unit-testable
 * without rendering the pages.
 */

import { capturePaypalOrder } from './paypal';

export interface PaypalReturnParams {
  /** PayPal order id (the `token` query param) — null when absent. */
  token: string | null;
  /** True when this navigation is a PayPal approval return. */
  isPaypalReturn: boolean;
}

/** Read the PayPal return params out of a query string (`location.search`). */
export function readPaypalReturnParams(search: string): PaypalReturnParams {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const token = params.get('token');
  return { token, isPaypalReturn: Boolean(token && token.trim().length > 0) };
}

/**
 * Remove the PayPal round-trip params (`token`, `PayerID`, `rail`) from a
 * URL, keeping everything else (`id` survives so a refresh still resolves
 * the order). Returns the cleaned href (path + remaining query + hash).
 */
export function stripPaypalReturnParams(href: string): string {
  const url = new URL(href, 'http://placeholder.local');
  url.searchParams.delete('token');
  url.searchParams.delete('PayerID');
  url.searchParams.delete('rail');
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
}

export interface RunPaypalReturnCaptureArgs {
  /** PayPal order id from the `token` param. */
  token: string;
  /** Our order ref (marketplace orderRef / designer orderId). */
  orderRef: string;
  /** Injectable for tests; defaults to the real API call. */
  capture?: (
    paypalOrderId: string,
    ppwOrderId: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Runs ONLY after a confirmed capture — this is where the cart is
   *  cleared (IMPL-1 defect 4: never before the redirect). */
  onSuccess: () => void;
  onFailure: (error: string) => void;
}

/**
 * Run the capture call and route the outcome. The server capture is
 * idempotent (ALREADY_CAPTURED → success), so re-invoking on retry is
 * safe. Resolves true on success, false on failure.
 */
export async function runPaypalReturnCapture(
  args: RunPaypalReturnCaptureArgs,
): Promise<boolean> {
  const capture = args.capture ?? capturePaypalOrder;
  try {
    const result = await capture(args.token, args.orderRef);
    if (result.ok) {
      args.onSuccess();
      return true;
    }
    args.onFailure(result.error ?? 'Payment capture failed.');
    return false;
  } catch (err) {
    args.onFailure(err instanceof Error ? err.message : String(err));
    return false;
  }
}
